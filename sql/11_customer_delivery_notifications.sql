-- Lamoon: customer-only delivery notifications. Run after 01_schema.sql and 03_admin_rpc.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS public.customer_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 type text NOT NULL DEFAULT 'out_for_delivery',
 title text NOT NULL,
 message text NOT NULL,
 is_read boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,type)
);
CREATE INDEX IF NOT EXISTS customer_notifications_customer_idx ON public.customer_notifications(customer_id,created_at DESC);
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_notifications_read_own ON public.customer_notifications;
CREATE POLICY customer_notifications_read_own ON public.customer_notifications FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.customers c WHERE c.id=customer_id AND c.profile_id=auth.uid()));
DROP POLICY IF EXISTS customer_notifications_mark_read ON public.customer_notifications;
CREATE POLICY customer_notifications_mark_read ON public.customer_notifications FOR UPDATE TO authenticated
 USING(EXISTS(SELECT 1 FROM public.customers c WHERE c.id=customer_id AND c.profile_id=auth.uid()))
 WITH CHECK(EXISTS(SELECT 1 FROM public.customers c WHERE c.id=customer_id AND c.profile_id=auth.uid()));
GRANT SELECT,UPDATE(is_read) ON public.customer_notifications TO authenticated;
CREATE OR REPLACE FUNCTION public.notify_customer_out_for_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_customer uuid; v_number text;
BEGIN
 IF NEW.delivery_status='out_for_delivery' AND (TG_OP='INSERT' OR OLD.delivery_status IS DISTINCT FROM 'out_for_delivery') THEN
   SELECT customer_id,order_number INTO v_customer,v_number FROM public.orders WHERE id=NEW.order_id;
   INSERT INTO public.customer_notifications(customer_id,order_id,type,title,message)
   VALUES(v_customer,NEW.order_id,'out_for_delivery','ออเดอร์ของคุณกำลังจัดส่ง','คำสั่งซื้อ #'||v_number||' กำลังจัดส่งไปยังที่อยู่ของคุณแล้ว')
   ON CONFLICT(order_id,type) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lamoon_notify_delivery ON public.deliveries;
CREATE TRIGGER lamoon_notify_delivery AFTER INSERT OR UPDATE OF delivery_status ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_out_for_delivery();
COMMIT;
