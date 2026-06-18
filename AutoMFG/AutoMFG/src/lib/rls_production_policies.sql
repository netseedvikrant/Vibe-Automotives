-- ============================================================
-- AutoMFG — RLS Policies for Production & Shop Floor Tables
-- Run this in: Supabase Dashboard → SQL Editor
--
-- These policies grant SELECT, INSERT, and UPDATE permissions
-- on production tables to resolve 401 Unauthorized errors.
-- ============================================================

-- ── 1. ANDON EVENTS ──────────────────────────────────────────
ALTER TABLE andon_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "andon_events_select" ON andon_events;
DROP POLICY IF EXISTS "andon_events_insert" ON andon_events;
DROP POLICY IF EXISTS "andon_events_update" ON andon_events;

CREATE POLICY "andon_events_select" ON andon_events FOR SELECT USING (true);
CREATE POLICY "andon_events_insert" ON andon_events FOR INSERT WITH CHECK (true);
CREATE POLICY "andon_events_update" ON andon_events FOR UPDATE USING (true);

-- ── 2. PRODUCTION PLANS ──────────────────────────────────────
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_select" ON production_plans;
DROP POLICY IF EXISTS "plans_insert" ON production_plans;
DROP POLICY IF EXISTS "plans_update" ON production_plans;

CREATE POLICY "plans_select" ON production_plans FOR SELECT USING (true);
CREATE POLICY "plans_insert" ON production_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "plans_update" ON production_plans FOR UPDATE USING (true);

-- ── 3. WORK ORDERS ───────────────────────────────────────────
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "work_orders_select" ON work_orders;
DROP POLICY IF EXISTS "work_orders_insert" ON work_orders;
DROP POLICY IF EXISTS "work_orders_update" ON work_orders;

CREATE POLICY "work_orders_select" ON work_orders FOR SELECT USING (true);
CREATE POLICY "work_orders_insert" ON work_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "work_orders_update" ON work_orders FOR UPDATE USING (true);

-- ── 4. TAKT EVENTS ───────────────────────────────────────────
ALTER TABLE takt_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "takt_select" ON takt_events;
DROP POLICY IF EXISTS "takt_insert" ON takt_events;

CREATE POLICY "takt_select" ON takt_events FOR SELECT USING (true);
CREATE POLICY "takt_insert" ON takt_events FOR INSERT WITH CHECK (true);

-- ── 5. TOOLS ─────────────────────────────────────────────────
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tools_select" ON tools;
DROP POLICY IF EXISTS "tools_insert" ON tools;
DROP POLICY IF EXISTS "tools_update" ON tools;

CREATE POLICY "tools_select" ON tools FOR SELECT USING (true);
CREATE POLICY "tools_insert" ON tools FOR INSERT WITH CHECK (true);
CREATE POLICY "tools_update" ON tools FOR UPDATE USING (true);

-- ── 6. SHIFT HANDOVER REPORTS ────────────────────────────────
ALTER TABLE shift_handover_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "handover_select" ON shift_handover_reports;
DROP POLICY IF EXISTS "handover_insert" ON shift_handover_reports;
DROP POLICY IF EXISTS "handover_update" ON shift_handover_reports;

CREATE POLICY "handover_select" ON shift_handover_reports FOR SELECT USING (true);
CREATE POLICY "handover_insert" ON shift_handover_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "handover_update" ON shift_handover_reports FOR UPDATE USING (true);

-- ── 7. BREAKDOWN TICKETS ─────────────────────────────────────
ALTER TABLE breakdown_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "breakdowns_select" ON breakdown_tickets;
DROP POLICY IF EXISTS "breakdowns_insert" ON breakdown_tickets;
DROP POLICY IF EXISTS "breakdowns_update" ON breakdown_tickets;

CREATE POLICY "breakdowns_select" ON breakdown_tickets FOR SELECT USING (true);
CREATE POLICY "breakdowns_insert" ON breakdown_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "breakdowns_update" ON breakdown_tickets FOR UPDATE USING (true);

-- ── 8. SHIFTS ────────────────────────────────────────────────
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shifts_select" ON shifts;
DROP POLICY IF EXISTS "shifts_insert" ON shifts;
DROP POLICY IF EXISTS "shifts_update" ON shifts;

CREATE POLICY "shifts_select" ON shifts FOR SELECT USING (true);
CREATE POLICY "shifts_insert" ON shifts FOR INSERT WITH CHECK (true);
CREATE POLICY "shifts_update" ON shifts FOR UPDATE USING (true);

-- ── 9. CALIBRATION RECORDS ────────────────────────────────────
ALTER TABLE calibration_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calibration_select" ON calibration_records;
DROP POLICY IF EXISTS "calibration_insert" ON calibration_records;

CREATE POLICY "calibration_select" ON calibration_records FOR SELECT USING (true);
CREATE POLICY "calibration_insert" ON calibration_records FOR INSERT WITH CHECK (true);

-- ── 10. TOOL REPLACEMENT REQUESTS ──────────────────────────────
ALTER TABLE tool_replacement_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "replacement_select" ON tool_replacement_requests;
DROP POLICY IF EXISTS "replacement_insert" ON tool_replacement_requests;

CREATE POLICY "replacement_select" ON tool_replacement_requests FOR SELECT USING (true);
CREATE POLICY "replacement_insert" ON tool_replacement_requests FOR INSERT WITH CHECK (true);

-- ── 11. EOL TEST RUNS ─────────────────────────────────────────
ALTER TABLE eol_test_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eol_test_runs_select" ON eol_test_runs;
DROP POLICY IF EXISTS "eol_test_runs_insert" ON eol_test_runs;

CREATE POLICY "eol_test_runs_select" ON eol_test_runs FOR SELECT USING (true);
CREATE POLICY "eol_test_runs_insert" ON eol_test_runs FOR INSERT WITH CHECK (true);

-- ── 12. EOL TEST RESULTS ──────────────────────────────────────
ALTER TABLE eol_test_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eol_test_results_select" ON eol_test_results;
DROP POLICY IF EXISTS "eol_test_results_insert" ON eol_test_results;

CREATE POLICY "eol_test_results_select" ON eol_test_results FOR SELECT USING (true);
CREATE POLICY "eol_test_results_insert" ON eol_test_results FOR INSERT WITH CHECK (true);

-- ── 13. EOL CERTIFICATES ──────────────────────────────────────
ALTER TABLE eol_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eol_certs_select" ON eol_certificates;
DROP POLICY IF EXISTS "eol_certs_insert" ON eol_certificates;

CREATE POLICY "eol_certs_select" ON eol_certificates FOR SELECT USING (true);
CREATE POLICY "eol_certs_insert" ON eol_certificates FOR INSERT WITH CHECK (true);

-- ── 14. VIN UNITS & PART MASTER ────────────────────────────────
ALTER TABLE vin_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vin_units_select" ON vin_units;
DROP POLICY IF EXISTS "vin_units_insert" ON vin_units;
DROP POLICY IF EXISTS "vin_units_update" ON vin_units;

CREATE POLICY "vin_units_select" ON vin_units FOR SELECT USING (true);
CREATE POLICY "vin_units_insert" ON vin_units FOR INSERT WITH CHECK (true);
CREATE POLICY "vin_units_update" ON vin_units FOR UPDATE USING (true);

ALTER TABLE part_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "part_master_select" ON part_master;
DROP POLICY IF EXISTS "part_master_insert" ON part_master;
DROP POLICY IF EXISTS "part_master_update" ON part_master;
DROP POLICY IF EXISTS "part_master_delete" ON part_master;
CREATE POLICY "part_master_select" ON part_master FOR SELECT USING (true);
CREATE POLICY "part_master_insert" ON part_master FOR INSERT WITH CHECK (true);
CREATE POLICY "part_master_update" ON part_master FOR UPDATE USING (true);
CREATE POLICY "part_master_delete" ON part_master FOR DELETE USING (true);

-- ── 15. PLANTS & PRODUCTION LINES ──────────────────────────────
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plants_select" ON plants;
DROP POLICY IF EXISTS "plants_insert" ON plants;
DROP POLICY IF EXISTS "plants_update" ON plants;
DROP POLICY IF EXISTS "plants_delete" ON plants;
CREATE POLICY "plants_select" ON plants FOR SELECT USING (true);
CREATE POLICY "plants_insert" ON plants FOR INSERT WITH CHECK (true);
CREATE POLICY "plants_update" ON plants FOR UPDATE USING (true);
CREATE POLICY "plants_delete" ON plants FOR DELETE USING (true);

ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "production_lines_select" ON production_lines;
DROP POLICY IF EXISTS "production_lines_insert" ON production_lines;
DROP POLICY IF EXISTS "production_lines_update" ON production_lines;
DROP POLICY IF EXISTS "production_lines_delete" ON production_lines;
CREATE POLICY "production_lines_select" ON production_lines FOR SELECT USING (true);
CREATE POLICY "production_lines_insert" ON production_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "production_lines_update" ON production_lines FOR UPDATE USING (true);
CREATE POLICY "production_lines_delete" ON production_lines FOR DELETE USING (true);
