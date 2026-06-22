-- Fix for missing ebom_refs column and schema cache reload
ALTER TABLE public.design_tasks
  ADD COLUMN IF NOT EXISTS ebom_refs text[] DEFAULT '{}';

-- Force Supabase PostgREST to reload its schema cache
-- This resolves the "Could not find the 'ebom_refs' column ... in the schema cache" error
NOTIFY pgrst, 'reload schema';
