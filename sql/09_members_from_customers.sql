-- 10_members_from_customers.sql
-- Existing customers become members; future rows default to membership.
-- No data is deleted. Staff-only RPC atomically adjusts balance and records history.
BEGIN;
ALTER TABLE public.customers ALTER COLUMN is_member SET DEFAULT true;
UPDATE public.customers SET is_member = true WHERE is_member IS DISTINCT FROM true;
-- New auth signups should also create a customer row through the existing new_user_profile trigger.
CREATE OR REPLACE FUNCTION public.admin_record_customer_purchase(p_customer_id uuid, p_amount numeric)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_points integer; v_balance integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff() THEN RAISE EXCEPTION 'STAFF_ONLY'; END IF;
  IF p_customer_id IS NULL OR p_amount IS NULL OR p_amount < 10 OR p_amount > 100000000 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;
  v_points := floor(p_amount / 10)::integer;
  UPDATE public.customers SET points_balance = points_balance + v_points
  WHERE id = p_customer_id AND is_member = true
  RETURNING points_balance INTO v_balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;
  INSERT INTO public.loyalty_transactions(customer_id,points_change,transaction_type,description)
  VALUES(p_customer_id,v_points,'earned','ยอดซื้อหน้าร้าน ' || p_amount::text || ' บาท');
  RETURN v_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_record_customer_purchase(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_record_customer_purchase(uuid,numeric) TO authenticated;
COMMIT;
