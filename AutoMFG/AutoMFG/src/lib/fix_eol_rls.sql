-- ============================================================
-- FIX: RLS policies for EOL tables and vin_units
-- Run this in Supabase SQL Editor to resolve RLS 42501 errors
-- ============================================================

-- ── DDL: CREATE MISSING TABLES IF NOT EXIST ──────────────────

CREATE TABLE IF NOT EXISTS finished_goods_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vin TEXT REFERENCES vin_units(vin) ON DELETE CASCADE,
    release_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'Released',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logistics_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vin TEXT REFERENCES vin_units(vin) ON DELETE CASCADE,
    transport_status TEXT DEFAULT 'Pending Dispatch',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scm_handoffs (
    id TEXT PRIMARY KEY,
    handoff_type TEXT,
    source_module TEXT DEFAULT 'AutoMFG',
    target_module TEXT DEFAULT 'AutoSCM',
    related_work_order_id TEXT,
    related_vin TEXT,
    related_material_id TEXT,
    payload JSONB,
    status TEXT DEFAULT 'Pending',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE
);

-- ── ENABLE RLS AND DEFINE POLICIES ───────────────────────────

-- 1. vin_units
ALTER TABLE vin_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vin_units_select" ON vin_units;
DROP POLICY IF EXISTS "vin_units_insert" ON vin_units;
DROP POLICY IF EXISTS "vin_units_update" ON vin_units;
DROP POLICY IF EXISTS "vin_units_delete" ON vin_units;
CREATE POLICY "vin_units_select" ON vin_units FOR SELECT USING (true);
CREATE POLICY "vin_units_insert" ON vin_units FOR INSERT WITH CHECK (true);
CREATE POLICY "vin_units_update" ON vin_units FOR UPDATE USING (true);
CREATE POLICY "vin_units_delete" ON vin_units FOR DELETE USING (true);

-- 2. eol_test_runs
ALTER TABLE eol_test_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eol_test_runs_select" ON eol_test_runs;
DROP POLICY IF EXISTS "eol_test_runs_insert" ON eol_test_runs;
DROP POLICY IF EXISTS "eol_test_runs_update" ON eol_test_runs;
DROP POLICY IF EXISTS "eol_test_runs_delete" ON eol_test_runs;
CREATE POLICY "eol_test_runs_select" ON eol_test_runs FOR SELECT USING (true);
CREATE POLICY "eol_test_runs_insert" ON eol_test_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "eol_test_runs_update" ON eol_test_runs FOR UPDATE USING (true);
CREATE POLICY "eol_test_runs_delete" ON eol_test_runs FOR DELETE USING (true);

-- 2.5 eol_test_results
ALTER TABLE eol_test_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eol_test_results_select" ON eol_test_results;
DROP POLICY IF EXISTS "eol_test_results_insert" ON eol_test_results;
DROP POLICY IF EXISTS "eol_test_results_update" ON eol_test_results;
DROP POLICY IF EXISTS "eol_test_results_delete" ON eol_test_results;
CREATE POLICY "eol_test_results_select" ON eol_test_results FOR SELECT USING (true);
CREATE POLICY "eol_test_results_insert" ON eol_test_results FOR INSERT WITH CHECK (true);
CREATE POLICY "eol_test_results_update" ON eol_test_results FOR UPDATE USING (true);
CREATE POLICY "eol_test_results_delete" ON eol_test_results FOR DELETE USING (true);

-- 3. eol_certificates
ALTER TABLE eol_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eol_certificates_select" ON eol_certificates;
DROP POLICY IF EXISTS "eol_certificates_insert" ON eol_certificates;
DROP POLICY IF EXISTS "eol_certificates_update" ON eol_certificates;
DROP POLICY IF EXISTS "eol_certificates_delete" ON eol_certificates;
CREATE POLICY "eol_certificates_select" ON eol_certificates FOR SELECT USING (true);
CREATE POLICY "eol_certificates_insert" ON eol_certificates FOR INSERT WITH CHECK (true);
CREATE POLICY "eol_certificates_update" ON eol_certificates FOR UPDATE USING (true);
CREATE POLICY "eol_certificates_delete" ON eol_certificates FOR DELETE USING (true);

-- 4. serial_production_releases
ALTER TABLE serial_production_releases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "serial_production_releases_select" ON serial_production_releases;
DROP POLICY IF EXISTS "serial_production_releases_insert" ON serial_production_releases;
DROP POLICY IF EXISTS "serial_production_releases_update" ON serial_production_releases;
DROP POLICY IF EXISTS "serial_production_releases_delete" ON serial_production_releases;
CREATE POLICY "serial_production_releases_select" ON serial_production_releases FOR SELECT USING (true);
CREATE POLICY "serial_production_releases_insert" ON serial_production_releases FOR INSERT WITH CHECK (true);
CREATE POLICY "serial_production_releases_update" ON serial_production_releases FOR UPDATE USING (true);
CREATE POLICY "serial_production_releases_delete" ON serial_production_releases FOR DELETE USING (true);

-- 5. finished_goods_releases
ALTER TABLE finished_goods_releases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finished_goods_releases_select" ON finished_goods_releases;
DROP POLICY IF EXISTS "finished_goods_releases_insert" ON finished_goods_releases;
DROP POLICY IF EXISTS "finished_goods_releases_update" ON finished_goods_releases;
DROP POLICY IF EXISTS "finished_goods_releases_delete" ON finished_goods_releases;
CREATE POLICY "finished_goods_releases_select" ON finished_goods_releases FOR SELECT USING (true);
CREATE POLICY "finished_goods_releases_insert" ON finished_goods_releases FOR INSERT WITH CHECK (true);
CREATE POLICY "finished_goods_releases_update" ON finished_goods_releases FOR UPDATE USING (true);
CREATE POLICY "finished_goods_releases_delete" ON finished_goods_releases FOR DELETE USING (true);

-- 6. logistics_releases
ALTER TABLE logistics_releases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "logistics_releases_select" ON logistics_releases;
DROP POLICY IF EXISTS "logistics_releases_insert" ON logistics_releases;
DROP POLICY IF EXISTS "logistics_releases_update" ON logistics_releases;
DROP POLICY IF EXISTS "logistics_releases_delete" ON logistics_releases;
CREATE POLICY "logistics_releases_select" ON logistics_releases FOR SELECT USING (true);
CREATE POLICY "logistics_releases_insert" ON logistics_releases FOR INSERT WITH CHECK (true);
CREATE POLICY "logistics_releases_update" ON logistics_releases FOR UPDATE USING (true);
CREATE POLICY "logistics_releases_delete" ON logistics_releases FOR DELETE USING (true);

-- 7. scm_handoffs
ALTER TABLE scm_handoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_handoffs_select" ON scm_handoffs;
DROP POLICY IF EXISTS "scm_handoffs_insert" ON scm_handoffs;
DROP POLICY IF EXISTS "scm_handoffs_update" ON scm_handoffs;
DROP POLICY IF EXISTS "scm_handoffs_delete" ON scm_handoffs;
CREATE POLICY "scm_handoffs_select" ON scm_handoffs FOR SELECT USING (true);
CREATE POLICY "scm_handoffs_insert" ON scm_handoffs FOR INSERT WITH CHECK (true);
CREATE POLICY "scm_handoffs_update" ON scm_handoffs FOR UPDATE USING (true);
CREATE POLICY "scm_handoffs_delete" ON scm_handoffs FOR DELETE USING (true);
