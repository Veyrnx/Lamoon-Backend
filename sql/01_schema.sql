-- NEW EMPTY SUPABASE PROJECT ONLY. Never run against old Production.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, full_name text, phone text, role text NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','owner','assistant')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE, is_member boolean NOT NULL DEFAULT false, points_balance integer NOT NULL DEFAULT 0 CHECK(points_balance>=0), loyalty_reset_at timestamptz, phone text, address text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, description text, image_url text, price numeric(12,2) NOT NULL CHECK(price>=0), unit_label text NOT NULL DEFAULT 'ถ้วย', is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.product_stock (product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE RESTRICT, quantity integer NOT NULL DEFAULT 0 CHECK(quantity>=0), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.promotions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, code text NOT NULL UNIQUE, description text, promotion_type text NOT NULL CHECK(promotion_type IN ('fixed','percent')), value numeric(12,2) NOT NULL CHECK(value>=0), minimum_order_amount numeric(12,2) NOT NULL DEFAULT 0, member_only boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true, starts_at timestamptz, ends_at timestamptz);
CREATE TABLE public.orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text NOT NULL UNIQUE, customer_id uuid NOT NULL REFERENCES public.customers(id), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','preparing','ready','delivered','cancelled')), order_date timestamptz NOT NULL DEFAULT now(), delivery_date timestamptz, delivery_type text NOT NULL DEFAULT 'pickup' CHECK(delivery_type IN ('pickup','in_town','outside_town')), delivery_address text, subtotal numeric(12,2) NOT NULL DEFAULT 0, discount_amount numeric(12,2) NOT NULL DEFAULT 0, total_amount numeric(12,2) NOT NULL DEFAULT 0, promotion_id uuid REFERENCES public.promotions(id), payment_status text NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid','refunded')), payment_method text, notes text, created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE, product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT, product_name_snapshot text NOT NULL, quantity integer NOT NULL CHECK(quantity>0), unit_price numeric(12,2) NOT NULL, line_total numeric(12,2) NOT NULL, item_options jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE, delivery_status text NOT NULL DEFAULT 'scheduled', scheduled_at timestamptz, delivered_at timestamptz);
CREATE TABLE public.loyalty_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE, order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL, points_change integer NOT NULL, transaction_type text NOT NULL CHECK(transaction_type IN ('earned','redeemed','expired','adjustment')), description text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.stock_audit (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, product_id uuid NOT NULL REFERENCES public.products(id), order_id uuid REFERENCES public.orders(id), delta integer NOT NULL, reason text NOT NULL, actor_id uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON public.orders(customer_id,created_at DESC);
CREATE INDEX ON public.order_items(order_id);
CREATE INDEX ON public.loyalty_transactions(customer_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN ('owner','assistant')) $$;
CREATE OR REPLACE FUNCTION public.new_user_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
 INSERT INTO public.profiles(id,full_name,phone,role) VALUES(NEW.id,COALESCE(NEW.raw_user_meta_data->>'full_name',split_part(NEW.email,'@',1)),NEW.raw_user_meta_data->>'phone','customer');
 INSERT INTO public.customers(profile_id,phone,loyalty_reset_at) VALUES(NEW.id,NEW.raw_user_meta_data->>'phone',now()+interval '1 year');
 RETURN NEW; END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.new_user_profile();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid() OR public.is_staff());
CREATE POLICY customers_read ON public.customers FOR SELECT TO authenticated USING(profile_id=auth.uid() OR public.is_staff());
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated USING(profile_id=auth.uid()) WITH CHECK(profile_id=auth.uid());
CREATE POLICY products_public ON public.products FOR SELECT TO anon,authenticated USING(is_active OR public.is_staff());
CREATE POLICY stock_staff ON public.product_stock FOR SELECT TO authenticated USING(public.is_staff());
CREATE POLICY promotions_public ON public.promotions FOR SELECT TO anon,authenticated USING(is_active OR public.is_staff());
CREATE POLICY orders_read ON public.orders FOR SELECT TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.customers c WHERE c.id=orders.customer_id AND c.profile_id=auth.uid()));
CREATE POLICY items_read ON public.order_items FOR SELECT TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.orders o JOIN public.customers c ON c.id=o.customer_id WHERE o.id=order_items.order_id AND c.profile_id=auth.uid()));
CREATE POLICY deliveries_read ON public.deliveries FOR SELECT TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.orders o JOIN public.customers c ON c.id=o.customer_id WHERE o.id=deliveries.order_id AND c.profile_id=auth.uid()));
CREATE POLICY loyalty_read ON public.loyalty_transactions FOR SELECT TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.customers c WHERE c.id=loyalty_transactions.customer_id AND c.profile_id=auth.uid()));
CREATE POLICY stock_audit_read ON public.stock_audit FOR SELECT TO authenticated USING(public.is_staff());
GRANT SELECT ON public.products,public.promotions TO anon,authenticated;
GRANT SELECT ON public.profiles,public.customers,public.product_stock,public.orders,public.order_items,public.deliveries,public.loyalty_transactions,public.stock_audit TO authenticated;
GRANT UPDATE(phone,address) ON public.customers TO authenticated;
COMMIT;
