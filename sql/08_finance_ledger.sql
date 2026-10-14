-- Run in NEW Supabase project after 01_schema.sql. No seed/mock balances.
BEGIN;
CREATE TABLE IF NOT EXISTS public.finance_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entry_type text NOT NULL CHECK (entry_type IN ('income','expense')),
 description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 500),
 amount numeric(12,2) NOT NULL CHECK (amount > 0),
 entry_date timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finance_entries_entry_date_idx ON public.finance_entries(entry_date DESC);
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_staff_select ON public.finance_entries;
CREATE POLICY finance_staff_select ON public.finance_entries FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS finance_staff_insert ON public.finance_entries;
CREATE POLICY finance_staff_insert ON public.finance_entries FOR INSERT TO authenticated WITH CHECK (public.is_staff() AND created_by = auth.uid());
DROP POLICY IF EXISTS finance_staff_delete ON public.finance_entries;
CREATE POLICY finance_staff_delete ON public.finance_entries FOR DELETE TO authenticated USING (public.is_staff());
GRANT SELECT, INSERT, DELETE ON public.finance_entries TO authenticated;
COMMIT;
