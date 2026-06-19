-- ============================================================
-- AutoMFG — Fix RLS Policies for Maintenance Tables
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. ENABLE ROW LEVEL SECURITY ──────────────────────────────
ALTER TABLE maintenance_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_kpis ENABLE ROW LEVEL SECURITY;

-- ── 2. DROP EXISTING POLICIES IF ANY ──────────────────────────
DROP POLICY IF EXISTS "diagnoses_select" ON maintenance_diagnoses;
DROP POLICY IF EXISTS "diagnoses_insert" ON maintenance_diagnoses;
DROP POLICY IF EXISTS "diagnoses_update" ON maintenance_diagnoses;
DROP POLICY IF EXISTS "diagnoses_delete" ON maintenance_diagnoses;

DROP POLICY IF EXISTS "spare_requests_select" ON spare_parts_requests;
DROP POLICY IF EXISTS "spare_requests_insert" ON spare_parts_requests;
DROP POLICY IF EXISTS "spare_requests_update" ON spare_parts_requests;
DROP POLICY IF EXISTS "spare_requests_delete" ON spare_parts_requests;

DROP POLICY IF EXISTS "repairs_select" ON repair_activities;
DROP POLICY IF EXISTS "repairs_insert" ON repair_activities;
DROP POLICY IF EXISTS "repairs_update" ON repair_activities;
DROP POLICY IF EXISTS "repairs_delete" ON repair_activities;

DROP POLICY IF EXISTS "trials_select" ON trial_runs;
DROP POLICY IF EXISTS "trials_insert" ON trial_runs;
DROP POLICY IF EXISTS "trials_update" ON trial_runs;
DROP POLICY IF EXISTS "trials_delete" ON trial_runs;

DROP POLICY IF EXISTS "kpis_select" ON maintenance_kpis;
DROP POLICY IF EXISTS "kpis_insert" ON maintenance_kpis;
DROP POLICY IF EXISTS "kpis_update" ON maintenance_kpis;
DROP POLICY IF EXISTS "kpis_delete" ON maintenance_kpis;

-- ── 3. CREATE NEW POLICIES ────────────────────────────────────

-- maintenance_diagnoses
CREATE POLICY "diagnoses_select" ON maintenance_diagnoses FOR SELECT USING (true);
CREATE POLICY "diagnoses_insert" ON maintenance_diagnoses FOR INSERT WITH CHECK (true);
CREATE POLICY "diagnoses_update" ON maintenance_diagnoses FOR UPDATE USING (true);
CREATE POLICY "diagnoses_delete" ON maintenance_diagnoses FOR DELETE USING (true);

-- spare_parts_requests
CREATE POLICY "spare_requests_select" ON spare_parts_requests FOR SELECT USING (true);
CREATE POLICY "spare_requests_insert" ON spare_parts_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "spare_requests_update" ON spare_parts_requests FOR UPDATE USING (true);
CREATE POLICY "spare_requests_delete" ON spare_parts_requests FOR DELETE USING (true);

-- repair_activities
CREATE POLICY "repairs_select" ON repair_activities FOR SELECT USING (true);
CREATE POLICY "repairs_insert" ON repair_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "repairs_update" ON repair_activities FOR UPDATE USING (true);
CREATE POLICY "repairs_delete" ON repair_activities FOR DELETE USING (true);

-- trial_runs
CREATE POLICY "trials_select" ON trial_runs FOR SELECT USING (true);
CREATE POLICY "trials_insert" ON trial_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "trials_update" ON trial_runs FOR UPDATE USING (true);
CREATE POLICY "trials_delete" ON trial_runs FOR DELETE USING (true);

-- maintenance_kpis
CREATE POLICY "kpis_select" ON maintenance_kpis FOR SELECT USING (true);
CREATE POLICY "kpis_insert" ON maintenance_kpis FOR INSERT WITH CHECK (true);
CREATE POLICY "kpis_update" ON maintenance_kpis FOR UPDATE USING (true);
CREATE POLICY "kpis_delete" ON maintenance_kpis FOR DELETE USING (true);
