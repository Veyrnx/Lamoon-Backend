-- Run once in Supabase SQL Editor after admin_order_notifications exists.
-- The existing Cron job and reminder function are already installed; do NOT recreate them.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_order_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Optional: verify that the existing job remains enabled.
SELECT jobid, jobname, schedule, active FROM cron.job
WHERE jobname = 'lamoon-tub-delivery-2h';
