-- =============================================
-- FIX: RLS Policies + Data Repair for stuck programs
-- CRITICAL for Conditional Approval workflow
-- Run this in Supabase SQL Editor
-- =============================================

-- 0. DATA REPAIR: Reset programs incorrectly advanced to 'Design' status
--    These are programs where:
--    - status = 'Design' (set prematurely by old buggy code on Conditional approval)
--    - Gate 0 has NOT been completed (Chief never officially approved Gate 0)
--    - There is a workflow_instance at GATE_0_CONDITIONAL_REVIEW or FEASIBILITY_PENDING
--    Safe: only resets programs that should not have moved past Feasibility yet.
UPDATE public.programs p
SET status = 'Feasibility'
WHERE p.status = 'Design'
  AND NOT EXISTS (
    SELECT 1 FROM public.apqp_gates g
    WHERE g.program_id = p.id
      AND g.gate_number = 0
      AND g.gate_status = 'Completed'
  )
  AND EXISTS (
    SELECT 1 FROM public.workflow_instances w
    WHERE w.program_id = p.id
      AND w.current_stage IN ('GATE_0_CONDITIONAL_REVIEW', 'FEASIBILITY_PENDING', 'GATE_0_APPROVAL_PENDING')
  );

-- 1. workflow_instances — had RLS enabled but NO policy, so all reads returned empty []
ALTER TABLE public.workflow_instances DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON public.workflow_instances;
CREATE POLICY "Allow All" ON public.workflow_instances FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.workflow_instances TO authenticated, anon;

-- 2. technical_assessments — same issue
ALTER TABLE public.technical_assessments DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON public.technical_assessments;
CREATE POLICY "Allow All" ON public.technical_assessments FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.technical_assessments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.technical_assessments TO authenticated, anon;

-- 3. Other tables that may need policies — each wrapped in a safe DO block
--    so missing tables are skipped instead of stopping the whole script

DO $$ BEGIN
  ALTER TABLE public.apqp_gates DISABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow All" ON public.apqp_gates;
  CREATE POLICY "Allow All" ON public.apqp_gates FOR ALL USING (true) WITH CHECK (true);
  ALTER TABLE public.apqp_gates ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON public.apqp_gates TO authenticated, anon;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'apqp_gates does not exist, skipping.';
END $$;

DO $$ BEGIN
  ALTER TABLE public.approvals DISABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow All" ON public.approvals;
  CREATE POLICY "Allow All" ON public.approvals FOR ALL USING (true) WITH CHECK (true);
  ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON public.approvals TO authenticated, anon;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'approvals does not exist, skipping.';
END $$;

DO $$ BEGIN
  ALTER TABLE public.feasibility_reviews DISABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow All" ON public.feasibility_reviews;
  CREATE POLICY "Allow All" ON public.feasibility_reviews FOR ALL USING (true) WITH CHECK (true);
  ALTER TABLE public.feasibility_reviews ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON public.feasibility_reviews TO authenticated, anon;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'feasibility_reviews does not exist, skipping.';
END $$;

DO $$ BEGIN
  ALTER TABLE public.ddr_reviews DISABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow All" ON public.ddr_reviews;
  CREATE POLICY "Allow All" ON public.ddr_reviews FOR ALL USING (true) WITH CHECK (true);
  ALTER TABLE public.ddr_reviews ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON public.ddr_reviews TO authenticated, anon;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'ddr_reviews does not exist, skipping.';
END $$;

DO $$ BEGIN
  ALTER TABLE public.ddr_comments DISABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow All" ON public.ddr_comments;
  CREATE POLICY "Allow All" ON public.ddr_comments FOR ALL USING (true) WITH CHECK (true);
  ALTER TABLE public.ddr_comments ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON public.ddr_comments TO authenticated, anon;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'ddr_comments does not exist, skipping.';
END $$;

DO $$ BEGIN
  ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow All" ON public.documents;
  CREATE POLICY "Allow All" ON public.documents FOR ALL USING (true) WITH CHECK (true);
  ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON public.documents TO authenticated, anon;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'documents does not exist, skipping.';
END $$;

DO $$ BEGIN
  ALTER TABLE public.apqp_elements DISABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow All" ON public.apqp_elements;
  CREATE POLICY "Allow All" ON public.apqp_elements FOR ALL USING (true) WITH CHECK (true);
  ALTER TABLE public.apqp_elements ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON public.apqp_elements TO authenticated, anon;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'apqp_elements does not exist, skipping.';
END $$;

DO $$ BEGIN
  ALTER TABLE public.ebom DISABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow All" ON public.ebom;
  CREATE POLICY "Allow All" ON public.ebom FOR ALL USING (true) WITH CHECK (true);
  ALTER TABLE public.ebom ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON public.ebom TO authenticated, anon;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'ebom does not exist, skipping.';
END $$;

-- 4. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

