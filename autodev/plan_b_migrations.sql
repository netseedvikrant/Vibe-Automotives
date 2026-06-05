-- Plan B SQL Migrations for workflow rejection flows

-- 1. ECO fields
ALTER TABLE public.eco_requests 
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 2. PPAP fields
ALTER TABLE public.ppap_submissions 
  ADD COLUMN IF NOT EXISTS rejection_feedback text,
  ADD COLUMN IF NOT EXISTS interim_conditions text;

-- 3. DDR rejection reason
ALTER TABLE public.ddr_reviews 
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 4. PPAP status constraint update
ALTER TABLE public.ppap_submissions 
  DROP CONSTRAINT IF EXISTS ppap_submissions_status_check;
ALTER TABLE public.ppap_submissions 
  ADD CONSTRAINT ppap_submissions_status_check 
  CHECK (status IN ('Pending', 'In Review', 'Approved', 'Rejected', 'Interim Approved'));

-- 5. MBOM rejection reason
ALTER TABLE public.mbom_reviews 
  ADD COLUMN IF NOT EXISTS rejection_reason text;

NOTIFY pgrst, 'reload schema';
