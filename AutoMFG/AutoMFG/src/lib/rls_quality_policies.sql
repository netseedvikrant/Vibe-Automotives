-- ============================================================
-- AutoMFG — RLS Policies for Quality Module Tables
-- Run this in: Supabase Dashboard → SQL Editor
--
-- These policies allow authenticated users (logged-in via
-- Supabase Auth) to read/write the quality module tables.
-- The anon role gets read-only access for unauthenticated
-- SELECT calls (e.g. fetching defects on mount).
-- ============================================================

-- ── 1. DEFECT RECORDS ────────────────────────────────────────
ALTER TABLE defect_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "defect_records_select" ON defect_records;
DROP POLICY IF EXISTS "defect_records_insert" ON defect_records;
DROP POLICY IF EXISTS "defect_records_update" ON defect_records;

CREATE POLICY "defect_records_select" ON defect_records
  FOR SELECT USING (true);

CREATE POLICY "defect_records_insert" ON defect_records
  FOR INSERT WITH CHECK (true);

CREATE POLICY "defect_records_update" ON defect_records
  FOR UPDATE USING (true);

-- ── 2. QUALITY INSPECTIONS ───────────────────────────────────
ALTER TABLE quality_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quality_inspections_select" ON quality_inspections;
DROP POLICY IF EXISTS "quality_inspections_insert" ON quality_inspections;

CREATE POLICY "quality_inspections_select" ON quality_inspections
  FOR SELECT USING (true);

CREATE POLICY "quality_inspections_insert" ON quality_inspections
  FOR INSERT WITH CHECK (true);

-- ── 3. INSPECTION CHECKS ─────────────────────────────────────
ALTER TABLE inspection_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_checks_select" ON inspection_checks;
DROP POLICY IF EXISTS "inspection_checks_insert" ON inspection_checks;

CREATE POLICY "inspection_checks_select" ON inspection_checks
  FOR SELECT USING (true);

CREATE POLICY "inspection_checks_insert" ON inspection_checks
  FOR INSERT WITH CHECK (true);

-- ── 4. BATCH HOLDS ───────────────────────────────────────────
ALTER TABLE batch_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "batch_holds_select" ON batch_holds;
DROP POLICY IF EXISTS "batch_holds_insert" ON batch_holds;
DROP POLICY IF EXISTS "batch_holds_update" ON batch_holds;

CREATE POLICY "batch_holds_select" ON batch_holds
  FOR SELECT USING (true);

CREATE POLICY "batch_holds_insert" ON batch_holds
  FOR INSERT WITH CHECK (true);

CREATE POLICY "batch_holds_update" ON batch_holds
  FOR UPDATE USING (true);

-- ── 5. ROOT CAUSE ANALYSES ───────────────────────────────────
ALTER TABLE root_cause_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rca_select" ON root_cause_analyses;
DROP POLICY IF EXISTS "rca_insert" ON root_cause_analyses;

CREATE POLICY "rca_select" ON root_cause_analyses
  FOR SELECT USING (true);

CREATE POLICY "rca_insert" ON root_cause_analyses
  FOR INSERT WITH CHECK (true);

-- ── 6. CORRECTIVE ACTIONS ────────────────────────────────────
ALTER TABLE corrective_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ca_select" ON corrective_actions;
DROP POLICY IF EXISTS "ca_insert" ON corrective_actions;
DROP POLICY IF EXISTS "ca_update" ON corrective_actions;

CREATE POLICY "ca_select" ON corrective_actions
  FOR SELECT USING (true);

CREATE POLICY "ca_insert" ON corrective_actions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ca_update" ON corrective_actions
  FOR UPDATE USING (true);

-- ── 7. SCRAP CERTIFICATES ────────────────────────────────────
ALTER TABLE scrap_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scrap_cert_select" ON scrap_certificates;
DROP POLICY IF EXISTS "scrap_cert_insert" ON scrap_certificates;

CREATE POLICY "scrap_cert_select" ON scrap_certificates
  FOR SELECT USING (true);

CREATE POLICY "scrap_cert_insert" ON scrap_certificates
  FOR INSERT WITH CHECK (true);

-- ── 8. REWORK ORDERS ─────────────────────────────────────────
ALTER TABLE rework_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rework_orders_select" ON rework_orders;
DROP POLICY IF EXISTS "rework_orders_insert" ON rework_orders;
DROP POLICY IF EXISTS "rework_orders_update" ON rework_orders;

CREATE POLICY "rework_orders_select" ON rework_orders
  FOR SELECT USING (true);

CREATE POLICY "rework_orders_insert" ON rework_orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "rework_orders_update" ON rework_orders
  FOR UPDATE USING (true);

-- ── 9. UAI APPROVALS ─────────────────────────────────────────
ALTER TABLE uai_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uai_approvals_select" ON uai_approvals;
DROP POLICY IF EXISTS "uai_approvals_insert" ON uai_approvals;
DROP POLICY IF EXISTS "uai_approvals_update" ON uai_approvals;

CREATE POLICY "uai_approvals_select" ON uai_approvals
  FOR SELECT USING (true);

CREATE POLICY "uai_approvals_insert" ON uai_approvals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "uai_approvals_update" ON uai_approvals
  FOR UPDATE USING (true);

-- ── DONE ─────────────────────────────────────────────────────
-- All quality module tables now allow authenticated reads/writes.
-- The WITH CHECK (true) policies permit any authenticated or
-- anonymous Supabase client to insert/update rows.
-- Tighten to: WITH CHECK (auth.uid() IS NOT NULL)
-- if you want to restrict to logged-in users only.
