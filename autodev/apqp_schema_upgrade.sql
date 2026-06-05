-- ==========================================
-- AUTO DEV APQP POST-DESIGN-FREEZE WORKFLOW
-- SCHEMA UPGRADE SCRIPT
-- ==========================================

-- 1. MBOM REVIEWS (Manufacturing BOM Review)
create table if not exists public.mbom_reviews (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    ebom_id uuid references public.ebom(id),
    reviewer_id uuid references public.users(id),
    role text check (role in ('Manufacturing Engineer', 'Procurement', 'Quality Engineer')),
    status text check (status in ('Pending', 'Approved', 'Rejected')) default 'Pending',
    comments text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. PROTOTYPE BUILDS
create table if not exists public.prototype_builds (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    build_type text check (build_type in ('Mule', 'Alpha', 'Beta', 'Pre-Production')),
    quantity integer not null default 1,
    status text check (status in ('Planning', 'Parts Sourcing', 'Assembly', 'Inspection', 'Complete')) default 'Planning',
    plant_location text,
    scheduled_start date,
    scheduled_end date,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. VALIDATION TESTS (DVP&R Execution)
create table if not exists public.validation_tests (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    prototype_id uuid references public.prototype_builds(id),
    test_name text not null, -- e.g., 'Thermal Cycling', 'Crash Test'
    test_category text,
    assigned_engineer uuid references public.users(id),
    status text check (status in ('Scheduled', 'In Progress', 'Passed', 'Failed')) default 'Scheduled',
    result_data text,
    failure_reason text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. DVP&R RECORDS (Design Verification Plan & Report)
create table if not exists public.dvpr_records (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    status text check (status in ('Draft', 'In Review', 'Approved', 'Rejected')) default 'Draft',
    approved_by uuid references public.users(id),
    approval_date timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. PPAP SUBMISSIONS (Production Part Approval Process)
create table if not exists public.ppap_submissions (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    supplier_id uuid, -- Would link to a suppliers table
    part_number text,
    submission_level integer check (submission_level between 1 and 5) default 3,
    status text check (status in ('Pending', 'In Review', 'Approved', 'Rejected')) default 'Pending',
    psw_url text,
    dfmea_url text,
    pfmea_url text,
    control_plan_url text,
    reviewed_by uuid references public.users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- DISABLE RLS FOR RAPID PROTOTYPING
-- ==========================================
ALTER TABLE public.mbom_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prototype_builds DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dvpr_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ppap_submissions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON public.mbom_reviews;
DROP POLICY IF EXISTS "Allow All" ON public.prototype_builds;
DROP POLICY IF EXISTS "Allow All" ON public.validation_tests;
DROP POLICY IF EXISTS "Allow All" ON public.dvpr_records;
DROP POLICY IF EXISTS "Allow All" ON public.ppap_submissions;

CREATE POLICY "Allow All" ON public.mbom_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All" ON public.prototype_builds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All" ON public.validation_tests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All" ON public.dvpr_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow All" ON public.ppap_submissions FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.mbom_reviews TO authenticated, anon;
GRANT ALL ON public.prototype_builds TO authenticated, anon;
GRANT ALL ON public.validation_tests TO authenticated, anon;
GRANT ALL ON public.dvpr_records TO authenticated, anon;
GRANT ALL ON public.ppap_submissions TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
