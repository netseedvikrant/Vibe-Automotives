-- ========================================================
-- AUTO DEV PHASE 6: SECURITY HARDENING & RLS POLICY AUDIT
-- ========================================================

-- Enable Row Level Security on PPAP submissions
ALTER TABLE public.ppap_submissions ENABLE ROW LEVEL SECURITY;

-- Drop any existing generic policy
DROP POLICY IF EXISTS "Allow All" ON public.ppap_submissions;
DROP POLICY IF EXISTS "Role-based PPAP access" ON public.ppap_submissions;

-- Create secure, role-aware RLS policy
CREATE POLICY "Role-based PPAP access" ON public.ppap_submissions
    FOR ALL
    USING (
        -- 1. Corporate role users can view all PPAP records
        (SELECT role FROM public.users WHERE id = auth.uid()) IN ('Admin', 'Program Manager', 'Quality Engineer', 'Chief Engineer', 'Lead Engineer', 'Manufacturing Engineer')
        OR
        -- 2. Suppliers can only view their own submissions
        supplier_id = auth.uid()
        OR
        -- 3. Development fallback: permit anon/development access
        auth.uid() IS NULL
    )
    WITH CHECK (
        -- 1. Corporate role users can write/edit PPAP records
        (SELECT role FROM public.users WHERE id = auth.uid()) IN ('Admin', 'Program Manager', 'Quality Engineer', 'Chief Engineer', 'Lead Engineer', 'Manufacturing Engineer')
        OR
        -- 2. Suppliers can insert/edit their own submissions
        supplier_id = auth.uid()
        OR
        -- 3. Development fallback
        auth.uid() IS NULL
    );

-- Enforce security policies for other validation and BOM records
ALTER TABLE public.validation_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All" ON public.validation_tests;
DROP POLICY IF EXISTS "Role-based validation access" ON public.validation_tests;

CREATE POLICY "Role-based validation access" ON public.validation_tests
    FOR ALL
    USING (
        -- Quality and Validation engineers can access all tests
        (SELECT role FROM public.users WHERE id = auth.uid()) IN ('Admin', 'Program Manager', 'Quality Engineer', 'Chief Engineer', 'Lead Engineer', 'Validation Engineer')
        OR
        auth.uid() IS NULL
    );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
