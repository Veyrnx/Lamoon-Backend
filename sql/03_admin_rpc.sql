-- NEW PROJECT: run after 01 and 02. Tub items (product_id NULL) are approved without automatic stock deduction.
BEGIN;
CREATE OR REPLACE FUNCTION public.approve_lamoon_order(p_order_number text,p_lead_days integer DEFAULT 2) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE; line record; available integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff() THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
 IF p_lead_days IS NULL OR p_lead_days NOT BETWEEN 0 AND 60 THEN RAISE EXCEPTION 'INVALID_LEAD_DAYS'; END IF;
 SELECT * INTO o FROM public.orders WHERE order_number=p_order_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF o.status <> 'pending' THEN RAISE EXCEPTION 'ORDER_NOT_PENDING'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.order_items WHERE order_id=o.id) THEN RAISE EXCEPTION 'ORDER_HAS_NO_ITEMS'; END IF;
 FOR line IN SELECT product_id,sum(quantity)::bigint AS needed FROM public.order_items WHERE order_id=o.id AND product_id IS NOT NULL GROUP BY product_id ORDER BY product_id LOOP
   IF line.needed<1 OR line.needed>2147483647 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
   SELECT quantity INTO available FROM public.product_stock WHERE product_id=line.product_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
   IF available<line.needed THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
   UPDATE public.product_stock SET quantity=quantity-line.needed::integer,updated_at=now() WHERE product_id=line.product_id;
   INSERT INTO public.stock_audit(product_id,order_id,delta,reason,actor_id) VALUES(line.product_id,o.id,-line.needed::integer,'order_approved',auth.uid());
 END LOOP;
 UPDATE public.orders SET status='confirmed',delivery_date=COALESCE(delivery_date,now()+make_interval(days=>p_lead_days)),updated_at=now() WHERE id=o.id;
 RETURN o.id;
END $$;
CREATE OR REPLACE FUNCTION public.admin_set_order_stage(p_order_number text,p_status text,p_payment_paid boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
 IF NOT public.is_staff() THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
 IF p_status NOT IN ('preparing','ready','delivered','cancelled') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
 SELECT * INTO o FROM public.orders WHERE order_number=p_order_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF o.status='pending' THEN RAISE EXCEPTION 'APPROVE_FIRST'; END IF;
 UPDATE public.orders SET status=p_status,payment_status=CASE WHEN p_payment_paid THEN 'paid' ELSE payment_status END,updated_at=now() WHERE id=o.id;
END $$;
CREATE OR REPLACE FUNCTION public.admin_set_delivery(p_order_number text,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE oid uuid;
BEGIN
 IF NOT public.is_staff() THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
 IF p_status NOT IN ('out_for_delivery','delivered') THEN RAISE EXCEPTION 'INVALID_DELIVERY_STATUS'; END IF;
 SELECT id INTO oid FROM public.orders WHERE order_number=p_order_number;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 INSERT INTO public.deliveries(order_id,delivery_status,delivered_at) VALUES(oid,p_status,CASE WHEN p_status='delivered' THEN now() ELSE NULL END)
 ON CONFLICT(order_id) DO UPDATE SET delivery_status=EXCLUDED.delivery_status,delivered_at=EXCLUDED.delivered_at;
END $$;
CREATE OR REPLACE FUNCTION public.admin_create_catalog_product(p_name text,p_price numeric,p_quantity integer DEFAULT 0) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid;
BEGIN
 IF NOT public.is_staff() THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120 OR p_price IS NULL OR p_price<=0 OR p_quantity IS NULL OR p_quantity<0 THEN RAISE EXCEPTION 'INVALID_PRODUCT'; END IF;
 INSERT INTO public.products(name,price) VALUES(btrim(p_name),p_price) RETURNING id INTO pid;
 INSERT INTO public.product_stock(product_id,quantity) VALUES(pid,p_quantity);
 IF p_quantity>0 THEN INSERT INTO public.stock_audit(product_id,delta,reason,actor_id) VALUES(pid,p_quantity,'initial_stock',auth.uid()); END IF;
 RETURN pid;
END $$;
CREATE OR REPLACE FUNCTION public.admin_adjust_catalog_stock(p_product_id uuid,p_delta integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q integer;
BEGIN
 IF NOT public.is_staff() THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
 IF p_delta IS NULL OR p_delta=0 THEN RAISE EXCEPTION 'INVALID_DELTA'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=p_product_id AND is_active) THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
 UPDATE public.product_stock SET quantity=quantity+p_delta,updated_at=now() WHERE product_id=p_product_id AND quantity::bigint+p_delta::bigint BETWEEN 0 AND 2147483647 RETURNING quantity INTO q;
 IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
 INSERT INTO public.stock_audit(product_id,delta,reason,actor_id) VALUES(p_product_id,p_delta,'admin_adjustment',auth.uid());
 RETURN q;
END $$;
CREATE OR REPLACE FUNCTION public.admin_hide_catalog_product(p_product_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_staff() THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
 UPDATE public.products SET is_active=false WHERE id=p_product_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.approve_lamoon_order(text,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_set_order_stage(text,text,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_set_delivery(text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_create_catalog_product(text,numeric,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_adjust_catalog_stock(uuid,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_hide_catalog_product(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_lamoon_order(text,integer),public.admin_set_order_stage(text,text,boolean),public.admin_set_delivery(text,text),public.admin_create_catalog_product(text,numeric,integer),public.admin_adjust_catalog_stock(uuid,integer),public.admin_hide_catalog_product(uuid) TO authenticated;
COMMIT;
