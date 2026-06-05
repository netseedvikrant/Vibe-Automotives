-- ========================================================
-- AUTO DEV SCHEMA FIX: ECO VOTES & CACHE RELOAD
-- ========================================================

-- Recreate eco_votes table to align with CFRB voting schema
DROP TABLE IF EXISTS public.eco_votes CASCADE;

CREATE TABLE public.eco_votes (
    id uuid default uuid_generate_v4() primary key,
    eco_id uuid REFERENCES public.eco_requests(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    vote text check (vote in ('Approve', 'Reject', 'More Info')) not null,
    comments text,
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
    UNIQUE(eco_id, user_id)
);

-- Enable RLS and add Allow All policy for development
ALTER TABLE public.eco_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON public.eco_votes;
CREATE POLICY "Allow All" ON public.eco_votes FOR ALL USING (true) WITH CHECK (true);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
