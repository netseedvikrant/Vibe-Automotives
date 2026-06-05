-- 1. CLEANUP (To allow re-running the script)
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.approvals CASCADE;
DROP TABLE IF EXISTS public.ppap_submissions CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.dvpr_records CASCADE;
DROP TABLE IF EXISTS public.validation_tests CASCADE;
DROP TABLE IF EXISTS public.prototype_builds CASCADE;
DROP TABLE IF EXISTS public.eco_requests CASCADE;
DROP TABLE IF EXISTS public.ebom CASCADE;
DROP TABLE IF EXISTS public.ddr_comments CASCADE;
DROP TABLE IF EXISTS public.cad_files CASCADE;
DROP TABLE IF EXISTS public.apqp_gates CASCADE;
DROP TABLE IF EXISTS public.engineering_risks CASCADE;
DROP TABLE IF EXISTS public.trl_assessments CASCADE;
DROP TABLE IF EXISTS public.feasibility_reviews CASCADE;
DROP TABLE IF EXISTS public.programs CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 3. TABLES

-- USERS TABLE
create table public.users (
    id uuid references auth.users on delete cascade primary key,
    full_name text not null,
    email text unique not null,
    role text check (role in ('Program Manager', 'Lead Engineer', 'Chief Engineer', 'Design Engineer', 'Validation Engineer', 'Quality Engineer', 'Supplier Engineer', 'Admin')) default 'Design Engineer',
    plant_location text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- PROGRAMS TABLE
create table public.programs (
    id uuid default uuid_generate_v4() primary key,
    program_code text unique not null,
    program_name text not null,
    target_market text,
    estimated_budget numeric,
    target_launch_date date,
    vehicle_category text,
    priority_level text check (priority_level in ('Standard', 'High', 'Critical')),
    program_description text,
    expected_risks text,
    current_gate integer default 0,
    status text check (status in ('Concept', 'Feasibility', 'Design', 'Prototype', 'Validation', 'PPAP', 'Production', 'Delayed', 'On Track')) default 'Concept',
    created_by uuid references public.users(id),
    assigned_lead_engineer uuid references public.users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- FEASIBILITY REVIEWS (LEAD ENGINEER)
create table public.feasibility_reviews (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    technical_assessment text,
    trl_level integer check (trl_level between 1 and 9),
    manufacturing_feasibility text,
    engineering_recommendation text,
    status text check (status in ('Draft', 'Submitted', 'Approved', 'Rejected')) default 'Draft',
    reviewed_by uuid references public.users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TRL ASSESSMENTS
create table public.trl_assessments (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    category text not null,
    score integer check (score between 1 and 9),
    justification text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ENGINEERING RISKS
create table public.engineering_risks (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    risk_title text not null,
    impact_level text check (impact_level in ('Low', 'Medium', 'High', 'Critical')),
    probability text check (probability in ('Low', 'Medium', 'High')),
    mitigation_strategy text,
    status text default 'Open',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- APQP GATES
create table public.apqp_gates (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    gate_name text not null,
    gate_number integer not null,
    gate_status text check (gate_status in ('Pending', 'In Progress', 'Completed', 'Blocked')) default 'Pending',
    completion_percentage integer default 0,
    due_date date,
    approved_by uuid references public.users(id),
    approval_timestamp timestamp with time zone,
    remarks text
);

-- CAD FILES (DESIGN ENGINEER)
create table public.cad_files (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    file_name text not null,
    file_url text not null,
    version text default '1.0',
    description text,
    uploaded_by uuid references public.users(id),
    status text check (status in ('In Progress', 'Review', 'Frozen')) default 'In Progress',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- DDR REVIEWS (CROSS-FUNCTIONAL WORKFLOW)
create table public.ddr_reviews (
    id uuid default uuid_generate_v4() primary key,
    task_id uuid references public.design_tasks(id) on delete cascade,
    program_id uuid references public.programs(id) on delete cascade,
    cad_file_id uuid references public.cad_files(id),
    title text not null,
    status text check (status in ('Open', 'Under Review', 'Corrections Required', 'Resolved', 'Rejected', 'Closed')) default 'Open',
    current_stage text default 'Cross Functional',
    due_date timestamp with time zone,
    created_by uuid references public.users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- DDR ASSIGNMENTS (REVIEWERS)
create table public.ddr_assignments (
    id uuid default uuid_generate_v4() primary key,
    ddr_id uuid references public.ddr_reviews(id) on delete cascade,
    reviewer_id uuid references public.users(id),
    role text, -- e.g., 'Manufacturing', 'Quality'
    status text check (status in ('Pending', 'Approved', 'Rejected')) default 'Pending',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- DDR COMMENTS (ENGINEERING FEEDBACK)
create table public.ddr_comments (
    id uuid default uuid_generate_v4() primary key,
    ddr_id uuid references public.ddr_reviews(id) on delete cascade,
    cad_file_id uuid references public.cad_files(id) on delete cascade,
    author_id uuid references public.users(id),
    assigned_to uuid references public.users(id), -- Usually Design Engineer
    category text,
    severity text check (severity in ('Critical', 'High', 'Medium', 'Low')),
    subsystem_ref text,
    comment_text text not null,
    screenshot_url text,
    status text check (status in ('Open', 'Resolved', 'Closed')) default 'Open',
    resolution_notes text,
    due_date timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- DESIGN CORRECTIONS (TRACKING FIXES)
create table public.design_corrections (
    id uuid default uuid_generate_v4() primary key,
    ddr_comment_id uuid references public.ddr_comments(id) on delete cascade,
    design_engineer_id uuid references public.users(id),
    correction_details text,
    new_cad_revision_id uuid references public.cad_files(id),
    status text check (status in ('Pending', 'Implemented', 'Verified')) default 'Pending',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- EBOM (ENGINEERING BILL OF MATERIALS)
create table public.ebom (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    part_number text not null,
    part_name text not null,
    quantity integer not null,
    material text,
    supplier_id uuid, -- link to suppliers table
    revision text default 'A',
    drawing_number text,
    uom text default 'pcs',
    bom_type text default 'EBOM' check (bom_type in ('EBOM', 'MBOM')),
    status text default 'Draft' check (status in ('Draft', 'Under Review', 'Approved', 'Released', 'Under Review (ECO)')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ECO REQUESTS (ENGINEERING CHANGE ORDER)
create table public.eco_requests (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    title text not null,
    description text not null,
    reason text,
    priority text check (priority in ('Normal', 'High', 'Urgent')),
    status text check (status in ('Draft', 'Pending', 'Approved', 'Implemented', 'Rejected')) default 'Draft',
    requested_by uuid references public.users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- PROTOTYPE BUILDS
create table public.prototype_builds (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    build_phase text not null, -- e.g., 'Alpha', 'Beta', 'VP'
    quantity integer,
    start_date date,
    end_date date,
    status text default 'Planned',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- VALIDATION TESTS (VALIDATION ENGINEER)
create table public.validation_tests (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    test_name text not null,
    test_type text, -- e.g., 'Durability', 'Crash', 'NVH'
    standard_ref text, -- e.g., 'ISO 26262'
    status text check (status in ('Scheduled', 'Running', 'Passed', 'Failed', 'Incomplete')) default 'Scheduled',
    result_summary text,
    result_url text,
    tested_by uuid references public.users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- DVPR RECORDS (DESIGN VERIFICATION PLAN & REPORT)
create table public.dvpr_records (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    requirement_id text not null,
    test_method text,
    acceptance_criteria text,
    result text check (result in ('Pass', 'Fail', 'N/A')),
    validation_id uuid references public.validation_tests(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- SUPPLIERS
create table public.suppliers (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    contact_email text,
    category text,
    rating numeric,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- PPAP SUBMISSIONS (SUPPLIER PORTAL)
create table public.ppap_submissions (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    supplier_id uuid references public.suppliers(id),
    part_id uuid references public.ebom(id),
    submission_level integer check (submission_level between 1 and 5),
    status text check (status in ('Submitted', 'In Review', 'Approved', 'Rejected')) default 'Submitted',
    document_url text,
    reviewed_by uuid references public.users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- APPROVALS
create table public.approvals (
    id uuid default uuid_generate_v4() primary key,
    target_id uuid not null, -- can be program_id, feasibility_id, eco_id, etc.
    target_type text not null,
    approver_id uuid references public.users(id),
    status text check (status in ('Pending', 'Approved', 'Rejected')) default 'Pending',
    comments text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- NOTIFICATIONS
create table public.notifications (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.users(id) on delete cascade,
    title text not null,
    message text not null,
    type text, -- 'Workflow', 'Alert', 'System'
    read_status boolean default false,
    link text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ACTIVITY LOGS (AUDIT TRAIL)
create table public.activity_logs (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.users(id),
    program_id uuid references public.programs(id),
    action_type text not null,
    action_description text not null,
    old_values jsonb,
    new_values jsonb,
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- DOCUMENTS (GENERIC)
create table public.documents (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id),
    title text not null,
    file_url text not null,
    category text,
    version text default '1.0',
    created_by uuid references public.users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- WORKFLOW INSTANCES (ENGINEERING LIFECYCLE TRACKER)
create table public.workflow_instances (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    current_stage text not null, -- CONCEPT, FEASIBILITY, DESIGN, VALIDATION, PPAP, PRODUCTION
    assigned_role text not null,
    assigned_user_id uuid references public.users(id),
    workflow_status text check (workflow_status in ('Active', 'Completed', 'Blocked', 'Pending')) default 'Active',
    started_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TECHNICAL ASSESSMENTS (Expanded for Lead Engineer)
create table public.technical_assessments (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid references public.programs(id) on delete cascade,
    lead_engineer_id uuid references public.users(id),
    
    -- Section 1: Feasibility
    architecture_complexity text,
    ev_compatibility_score integer,
    subsystem_observations jsonb, -- detailed analysis of cooling, battery, ADAS etc.
    
    -- Section 4: Manufacturing
    tooling_constraints text,
    assembly_complexity_score integer,
    plant_readiness_assessment text,
    
    -- Section 5: Resources
    est_engineering_hours integer,
    est_prototype_count integer,
    required_lab_slots text,
    
    -- Section 6: Recommendation
    recommendation text check (recommendation in ('Approve', 'Reject', 'Conditional')),
    recommendation_notes text,
    
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. ENABLE REALTIME
alter publication supabase_realtime add table programs;
alter publication supabase_realtime add table apqp_gates;
alter publication supabase_realtime add table feasibility_reviews;
alter publication supabase_realtime add table cad_files;
alter publication supabase_realtime add table eco_requests;
alter publication supabase_realtime add table validation_tests;
alter publication supabase_realtime add table ppap_submissions;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table activity_logs;
alter publication supabase_realtime add table workflow_instances;
alter publication supabase_realtime add table technical_assessments;

-- 5. ROW LEVEL SECURITY (RLS)
alter table public.users enable row level security;
alter table public.programs enable row level security;
alter table public.feasibility_reviews enable row level security;
alter table public.trl_assessments enable row level security;
alter table public.engineering_risks enable row level security;
alter table public.apqp_gates enable row level security;
alter table public.cad_files enable row level security;
alter table public.ddr_comments enable row level security;
alter table public.ebom enable row level security;
alter table public.eco_requests enable row level security;
alter table public.prototype_builds enable row level security;
alter table public.validation_tests enable row level security;
alter table public.dvpr_records enable row level security;
alter table public.suppliers enable row level security;
alter table public.ppap_submissions enable row level security;
alter table public.approvals enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.documents enable row level security;

-- Policies (Development-friendly but role-aware)
create policy "Public Access" on public.users for select using (true);
create policy "Everyone can view programs" on public.programs for select using (true);
create policy "Admins can do everything" on public.programs for all using (
  exists (select 1 from public.users where id = auth.uid() and role = 'Admin')
);
create policy "Program Managers can manage programs" on public.programs for all using (
  exists (select 1 from public.users where id = auth.uid() and role = 'Program Manager')
);

-- (Generic access for simplicity in this demo, in production these would be much more granular)
create policy "Authenticated access" on public.notifications for all using (auth.uid() = user_id);
create policy "Global activity view" on public.activity_logs for select using (true);
create policy "Allow all on ebom" on public.ebom for all using (true) with check (true);

-- 6. FUNCTIONS & TRIGGERS
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger set_updated_at
before update on public.programs
for each row execute procedure public.handle_updated_at();
