-- Lamoon: explicit cup/tub approval. Run on NEW Supabase project after 01_schema.sql, 02_ordering_rpc.sql and 03_admin_rpc.sql.
-- Existing order records and stock are not modified by this migration.
-- Tub order_items use product_id NULL and product_name_snapshot = 'ไอศกรีมแบบถัง'.
-- Cup order_items must have product_id. A mismatched order is rejected safely.
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
 -- Verify tub lines cannot be accidentally charged as cups and vice versa.
 IF EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id=o.id AND (
   (oi.product_name_snapshot='ไอศกรีมแบบถัง' AND oi.product_id IS NOT NULL)
   OR (oi.product_name_snapshot<>'ไอศกรีมแบบถัง' AND oi.product_id IS NULL)
 )) THEN RAISE EXCEPTION 'INVALID_ORDER_ITEM_TYPE'; END IF;
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
REVOKE ALL ON FUNCTION public.approve_lamoon_order(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_lamoon_order(text,integer) TO authenticated;
COMMIT;
