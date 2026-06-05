-- ========================================================
-- AUTO DEV SCHEMA FIX: APPROVALS & DDR REVIEWS
-- ========================================================

-- 1. Fix approvals table (recreate to match schema)
DROP TABLE IF EXISTS public.approvals CASCADE;

CREATE TABLE public.approvals (
    id uuid default uuid_generate_v4() primary key,
    target_id uuid not null, -- can be program_id, feasibility_id, eco_id, etc.
    target_type text not null,
    approver_id uuid references public.users(id),
    status text check (status in ('Pending', 'Approved', 'Rejected')) default 'Pending',
    comments text,
    signature_hash text,
    verified_timestamp timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Configure RLS for approvals
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON public.approvals;
CREATE POLICY "Allow All" ON public.approvals FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.approvals TO authenticated, anon;


-- 2. Fix ddr_reviews table columns (add missing columns)
ALTER TABLE public.ddr_reviews 
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cad_file_id uuid REFERENCES public.cad_files(id),
  ADD COLUMN IF NOT EXISTS title text DEFAULT 'DDR Review',
  ADD COLUMN IF NOT EXISTS due_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id);

-- If title was previously added but has null values, set default
UPDATE public.ddr_reviews SET title = 'DDR Review' WHERE title IS NULL;

-- Make title NOT NULL if it isn't
ALTER TABLE public.ddr_reviews ALTER COLUMN title SET NOT NULL;

-- Configure RLS for ddr_reviews
ALTER TABLE public.ddr_reviews DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON public.ddr_reviews;
CREATE POLICY "Allow All" ON public.ddr_reviews FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.ddr_reviews ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ddr_reviews TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
