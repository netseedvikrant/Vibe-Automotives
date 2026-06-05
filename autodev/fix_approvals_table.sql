-- Drop the mismatched/outdated approvals table and recreate it
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

-- Configure RLS
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON public.approvals;
CREATE POLICY "Allow All" ON public.approvals FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.approvals TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
