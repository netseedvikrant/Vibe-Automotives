-- ========================================================
-- AUTO DEV PHASE 4: CFRB VOTING, E-SIGNATURES & COMPLIANCE
-- ========================================================

-- 1. Create ECO Votes Table for CFRB review board
CREATE TABLE IF NOT EXISTS public.eco_votes (
    id uuid default uuid_generate_v4() primary key,
    eco_id uuid REFERENCES public.eco_requests(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    vote text check (vote in ('Approve', 'Reject', 'More Info')) not null,
    comments text,
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
    UNIQUE(eco_id, user_id)
);

-- 2. Create APQP 18-Element Checklist Table
CREATE TABLE IF NOT EXISTS public.apqp_elements (
    id uuid default uuid_generate_v4() primary key,
    program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,
    element_name text not null,
    status text check (status in ('Not Started', 'In Progress', 'Completed', 'Under Review')) default 'Not Started',
    file_name text,
    file_url text,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    UNIQUE(program_id, element_name)
);

-- 3. Upgrade approvals table to support signature hash
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS signature_hash text;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS verified_timestamp timestamp with time zone;

-- 4. Trigger to automatically populate 18 APQP elements when a new program is inserted
CREATE OR REPLACE FUNCTION public.trg_populate_apqp_elements()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.apqp_elements (program_id, element_name, status)
    VALUES
    (NEW.id, 'Design Records', 'Not Started'),
    (NEW.id, 'Engineering Change Documents', 'Not Started'),
    (NEW.id, 'Customer Engineering Approval', 'Not Started'),
    (NEW.id, 'Design Failure Mode & Effects Analysis (DFMEA)', 'Not Started'),
    (NEW.id, 'Process Flow Diagram', 'Not Started'),
    (NEW.id, 'Process Failure Mode & Effects Analysis (PFMEA)', 'Not Started'),
    (NEW.id, 'Control Plan', 'Not Started'),
    (NEW.id, 'Measurement System Analysis (MSA)', 'Not Started'),
    (NEW.id, 'Dimensional Results', 'Not Started'),
    (NEW.id, 'Material / Performance Test Results', 'Not Started'),
    (NEW.id, 'Initial Process Studies (Capability)', 'Not Started'),
    (NEW.id, 'Qualified Laboratory Documentation', 'Not Started'),
    (NEW.id, 'Appearance Approval Report (AAR)', 'Not Started'),
    (NEW.id, 'Sample Production Product', 'Not Started'),
    (NEW.id, 'Master Sample', 'Not Started'),
    (NEW.id, 'Checking Aids', 'Not Started'),
    (NEW.id, 'Customer-Specific Requirements', 'Not Started'),
    (NEW.id, 'Part Submission Warrant (PSW)', 'Not Started')
    ON CONFLICT (program_id, element_name) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_auto_populate_apqp_elements
AFTER INSERT ON public.programs
FOR EACH ROW
EXECUTE FUNCTION public.trg_populate_apqp_elements();

-- 5. Seeding logic for pre-existing programs
INSERT INTO public.apqp_elements (program_id, element_name, status)
SELECT p.id, elem, 'Not Started'
FROM public.programs p
CROSS JOIN (
    VALUES 
    ('Design Records'),
    ('Engineering Change Documents'),
    ('Customer Engineering Approval'),
    ('Design Failure Mode & Effects Analysis (DFMEA)'),
    ('Process Flow Diagram'),
    ('Process Failure Mode & Effects Analysis (PFMEA)'),
    ('Control Plan'),
    ('Measurement System Analysis (MSA)'),
    ('Dimensional Results'),
    ('Material / Performance Test Results'),
    ('Initial Process Studies (Capability)'),
    ('Qualified Laboratory Documentation'),
    ('Appearance Approval Report (AAR)'),
    ('Sample Production Product'),
    ('Master Sample'),
    ('Checking Aids'),
    ('Customer-Specific Requirements'),
    ('Part Submission Warrant (PSW)')
) AS t(elem)
ON CONFLICT (program_id, element_name) DO NOTHING;

-- 6. Trigger to automatically approve ECO request when CFRB votes are cast
CREATE OR REPLACE FUNCTION public.check_eco_approval_status()
RETURNS TRIGGER AS $$
DECLARE
    approved_roles_count integer;
    target_program_id uuid;
    eco_title text;
BEGIN
    -- Get eco details
    SELECT program_id, title INTO target_program_id, eco_title
    FROM public.eco_requests
    WHERE id = NEW.eco_id;

    -- Count distinct CFRB roles that voted 'Approve' for this ECO
    SELECT COUNT(DISTINCT u.role)
    INTO approved_roles_count
    FROM public.eco_votes v
    JOIN public.users u ON v.user_id = u.id
    WHERE v.eco_id = NEW.eco_id
      AND v.vote = 'Approve'
      AND u.role IN ('Chief Engineer', 'Lead Engineer', 'Quality Engineer', 'Manufacturing Engineer');

    -- Require at least 2 distinct CFRB roles for approval in the system
    IF approved_roles_count >= 2 THEN
        UPDATE public.eco_requests
        SET status = 'Approved'
        WHERE id = NEW.eco_id;

        -- Create notification
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES
        (null, 'Engineering Change Approved', 'ECO "' || eco_title || '" has been approved by the Cross-Functional Review Board (CFRB).', 'success');
        
        -- Create activity log
        INSERT INTO public.activity_logs (program_id, action_type, action_description)
        VALUES
        (target_program_id, 'ECO Approved', 'CFRB review complete: ECO "' || eco_title || '" approved.');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_eco_vote_approval
AFTER INSERT OR UPDATE ON public.eco_votes
FOR EACH ROW
EXECUTE FUNCTION public.check_eco_approval_status();
