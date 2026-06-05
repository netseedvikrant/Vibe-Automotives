-- Sprint 2 Fix 9: engineering_risks table for PM Dashboard KPIs
-- Run in Supabase SQL Editor if the table is missing or uses legacy columns.

CREATE TABLE IF NOT EXISTS public.engineering_risks (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,
  risk_title text NOT NULL,
  severity text CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
  status text CHECK (status IN ('Open', 'Mitigated', 'Closed')) DEFAULT 'Open',
  created_at timestamptz DEFAULT now()
);

-- Backfill severity from legacy impact_level if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'engineering_risks' AND column_name = 'impact_level'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'engineering_risks' AND column_name = 'severity'
  ) THEN
    ALTER TABLE public.engineering_risks ADD COLUMN severity text;
    UPDATE public.engineering_risks SET severity = impact_level WHERE severity IS NULL;
  END IF;
END $$;

ALTER TABLE public.engineering_risks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON public.engineering_risks;
CREATE POLICY "Allow All" ON public.engineering_risks FOR ALL USING (true) WITH CHECK (true);
