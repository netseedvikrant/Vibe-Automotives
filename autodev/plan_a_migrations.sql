-- Plan A SQL Migrations for missing columns

ALTER TABLE public.eco_requests 
  ADD COLUMN IF NOT EXISTS change_type text DEFAULT 'Design',
  ADD COLUMN IF NOT EXISTS affected_parts text,
  ADD COLUMN IF NOT EXISTS cost_of_change numeric(12,2),
  ADD COLUMN IF NOT EXISTS implementation_date date;

ALTER TABLE public.ppap_submissions 
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS process_flow_url text,
  ADD COLUMN IF NOT EXISTS msa_url text,
  ADD COLUMN IF NOT EXISTS cpk_value numeric(5,2);

NOTIFY pgrst, 'reload schema';
