-- Run on the NEW Lamoon Supabase project after 01_schema.sql.
-- This migration creates only missing tables. No existing product/order data is deleted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ingredients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL UNIQUE CHECK(length(btrim(name)) BETWEEN 2 AND 120),
 quantity integer NOT NULL DEFAULT 0 CHECK(quantity >= 0),
 unit text NOT NULL DEFAULT 'กก.',
 minimum integer NOT NULL DEFAULT 0 CHECK(minimum >= 0),
 category text NOT NULL DEFAULT 'รายการอื่น ๆ',
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ingredient_stock_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 ingredient_id uuid NOT NULL REFERENCES public.ingredients(id),
 delta integer NOT NULL,
 reason text NOT NULL,
 actor_id uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_stock_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ingredients_staff_read ON public.ingredients;
CREATE POLICY ingredients_staff_read ON public.ingredients FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS ingredient_audit_staff_read ON public.ingredient_stock_audit;
CREATE POLICY ingredient_audit_staff_read ON public.ingredient_stock_audit FOR SELECT TO authenticated USING (public.is_staff());
GRANT SELECT ON public.ingredients, public.ingredient_stock_audit TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_create_ingredient(p_name text,p_quantity integer,p_unit text,p_minimum integer,p_category text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff() THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
 IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 120 OR p_quantity IS NULL OR p_quantity < 0 OR p_minimum IS NULL OR p_minimum < 0 OR nullif(btrim(p_unit),'') IS NULL OR nullif(btrim(p_category),'') IS NULL THEN RAISE EXCEPTION 'INVALID_INGREDIENT'; END IF;
 INSERT INTO public.ingredients(name,quantity,unit,minimum,category) VALUES(btrim(p_name),p_quantity,btrim(p_unit),p_minimum,btrim(p_category)) RETURNING id INTO v_id;
 INSERT INTO public.ingredient_stock_audit(ingredient_id,delta,reason,actor_id) VALUES(v_id,p_quantity,'created',auth.uid());
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.admin_adjust_ingredient(p_ingredient_id uuid,p_delta integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_quantity integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff() THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
 IF p_delta IS NULL OR p_delta=0 THEN RAISE EXCEPTION 'INVALID_DELTA'; END IF;
 UPDATE public.ingredients SET quantity=quantity+p_delta,updated_at=now()
 WHERE id=p_ingredient_id AND is_active AND quantity::bigint+p_delta::bigint BETWEEN 0 AND 2147483647 RETURNING quantity INTO v_quantity;
 IF NOT FOUND THEN RAISE EXCEPTION 'INGREDIENT_NOT_FOUND_OR_INSUFFICIENT'; END IF;
 INSERT INTO public.ingredient_stock_audit(ingredient_id,delta,reason,actor_id) VALUES(p_ingredient_id,p_delta,'admin_adjustment',auth.uid());
 RETURN v_quantity;
END $$;
CREATE OR REPLACE FUNCTION public.admin_hide_ingredient(p_ingredient_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff() THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
 UPDATE public.ingredients SET is_active=false,updated_at=now() WHERE id=p_ingredient_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'INGREDIENT_NOT_FOUND'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_create_ingredient(text,integer,text,integer,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_adjust_ingredient(uuid,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_hide_ingredient(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_create_ingredient(text,integer,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_ingredient(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hide_ingredient(uuid) TO authenticated;
COMMIT;
