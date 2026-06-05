-- Sprint 3 Fix 15: eBOM refs on design tasks for linking tab persistence
ALTER TABLE public.design_tasks
  ADD COLUMN IF NOT EXISTS ebom_refs text[] DEFAULT '{}';
