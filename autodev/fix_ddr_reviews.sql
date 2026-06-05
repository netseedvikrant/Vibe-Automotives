-- SQL Migration to fix ddr_reviews table columns

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

NOTIFY pgrst, 'reload schema';
