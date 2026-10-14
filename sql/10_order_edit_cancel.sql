-- Lamoon: staff-only edit pending orders; cancel unpaid undelivered orders.
-- Back up first. Existing records are not changed by installing these functions.
BEGIN;
CREATE TABLE IF NOT EXISTS public.order_admin_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES public.orders(id),
 action text NOT NULL CHECK (action IN ('edited','cancelled')),
 before_data jsonb NOT NULL,
 after_data jsonb,
 reason text,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_admin_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_admin_audit_staff_select ON public.order_admin_audit;
CREATE POLICY order_admin_audit_staff_select ON public.order_admin_audit
FOR SELECT TO authenticated USING (public.is_staff());
GRANT SELECT ON public.order_admin_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_edit_pending_order(
 p_order_number text, p_delivery_address text, p_items jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE; line record; n integer; count_items integer; subtotal numeric(12,2); before_json jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff() THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
 SELECT * INTO o FROM public.orders WHERE order_number=p_order_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF o.status <> 'pending' OR o.payment_status <> 'unpaid' THEN RAISE EXCEPTION 'ONLY_PENDING_UNPAID_EDITABLE'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
 SELECT count(*) INTO count_items FROM public.order_items WHERE order_id=o.id;
 IF count_items=0 OR jsonb_array_length(p_items) <> count_items THEN RAISE EXCEPTION 'ALL_ITEMS_REQUIRED'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) j WHERE jsonb_typeof(j) <> 'object' OR NOT (j ? 'id') OR NOT (j ? 'quantity') OR (j->>'quantity') !~ '^[0-9]+$') THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) j GROUP BY j->>'id' HAVING count(*) > 1) THEN RAISE EXCEPTION 'DUPLICATE_ITEM'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) j LEFT JOIN public.order_items oi ON oi.id::text=j->>'id' AND oi.order_id=o.id WHERE oi.id IS NULL) THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
 SELECT jsonb_build_object('order',to_jsonb(o),'items',COALESCE((SELECT jsonb_agg(to_jsonb(oi)) FROM public.order_items oi WHERE oi.order_id=o.id),'[]'::jsonb)) INTO before_json;
 FOR line IN SELECT j->>'id' AS id, (j->>'quantity')::numeric AS quantity FROM jsonb_array_elements(p_items) j LOOP
   IF line.quantity < 1 OR line.quantity > 10000 OR line.quantity <> trunc(line.quantity) THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
   UPDATE public.order_items SET quantity=line.quantity::integer, line_total=round(unit_price*line.quantity,2) WHERE id::text=line.id AND order_id=o.id;
 END LOOP;
 SELECT COALESCE(sum(line_total),0) INTO subtotal FROM public.order_items WHERE order_id=o.id;
 -- Keep existing discount; never permit negative payable total.
 UPDATE public.orders SET delivery_address=NULLIF(btrim(p_delivery_address),''),subtotal=subtotal,
 total_amount=greatest(0,subtotal-discount_amount),updated_at=now() WHERE id=o.id;
 INSERT INTO public.order_admin_audit(order_id,action,before_data,after_data,actor_id)
 VALUES(o.id,'edited',before_json,
 jsonb_build_object('order',(SELECT to_jsonb(x) FROM public.orders x WHERE x.id=o.id),'items',(SELECT jsonb_agg(to_jsonb(oi)) FROM public.order_items oi WHERE oi.order_id=o.id)),auth.uid());
 RETURN o.id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_lamoon_order(
 p_order_number text, p_reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE; line record; deducted bigint; returned bigint; before_json jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff() THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
 SELECT * INTO o FROM public.orders WHERE order_number=p_order_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF o.status NOT IN ('pending','confirmed','preparing','ready') THEN RAISE EXCEPTION 'ORDER_NOT_CANCELLABLE'; END IF;
 IF o.payment_status <> 'unpaid' THEN RAISE EXCEPTION 'PAID_ORDER_REFUND_FIRST'; END IF;
 IF EXISTS (SELECT 1 FROM public.deliveries WHERE order_id=o.id AND delivery_status IN ('out_for_delivery','delivered')) THEN RAISE EXCEPTION 'DELIVERY_ALREADY_STARTED'; END IF;
 before_json:=to_jsonb(o);
 -- Only restore quantities proven deducted for this order by audit records.
 FOR line IN SELECT product_id, -sum(delta)::bigint AS net_deducted FROM public.stock_audit
   WHERE order_id=o.id GROUP BY product_id ORDER BY product_id LOOP
   IF line.net_deducted < 0 THEN RAISE EXCEPTION 'STOCK_AUDIT_INCONSISTENT'; END IF;
   IF line.net_deducted > 0 THEN
     IF line.net_deducted > 2147483647 THEN RAISE EXCEPTION 'INVALID_STOCK_RESTORE'; END IF;
     UPDATE public.product_stock SET quantity=quantity+line.net_deducted::integer,updated_at=now()
     WHERE product_id=line.product_id AND quantity::bigint+line.net_deducted <= 2147483647;
     IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_RESTORE_FAILED'; END IF;
     INSERT INTO public.stock_audit(product_id,order_id,delta,reason,actor_id)
     VALUES(line.product_id,o.id,line.net_deducted::integer,'order_cancelled',auth.uid());
   END IF;
 END LOOP;
 -- Refuse to cancel an approved cup order if its deduction is not recorded.
 IF o.status <> 'pending' AND EXISTS (
   SELECT 1 FROM public.order_items oi WHERE oi.order_id=o.id AND oi.product_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.stock_audit sa WHERE sa.order_id=o.id AND sa.product_id=oi.product_id AND sa.reason='order_approved')
 ) THEN RAISE EXCEPTION 'MISSING_STOCK_AUDIT_REVIEW_REQUIRED'; END IF;
 UPDATE public.orders SET status='cancelled',updated_at=now() WHERE id=o.id;
 INSERT INTO public.order_admin_audit(order_id,action,before_data,after_data,reason,actor_id)
 VALUES(o.id,'cancelled',before_json,(SELECT to_jsonb(x) FROM public.orders x WHERE x.id=o.id),btrim(p_reason),auth.uid());
 RETURN o.id;
END $$;
REVOKE ALL ON FUNCTION public.admin_edit_pending_order(text,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_cancel_lamoon_order(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_edit_pending_order(text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_lamoon_order(text,text) TO authenticated;
COMMIT;
