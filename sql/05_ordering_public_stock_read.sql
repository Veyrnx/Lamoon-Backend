-- Run in NEW Supabase SQL Editor after 01_schema.sql.
-- Allows public read of stock ONLY for active catalog products.
-- Does not grant direct INSERT/UPDATE/DELETE on stock.
BEGIN;
GRANT SELECT ON public.product_stock TO anon, authenticated;
DROP POLICY IF EXISTS ordering_public_read_active_stock ON public.product_stock;
CREATE POLICY ordering_public_read_active_stock
ON public.product_stock FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.is_active = true));
COMMIT;
