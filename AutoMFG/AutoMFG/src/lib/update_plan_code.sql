-- ============================================================
-- AutoMFG — RLS Policies + plan_code Migration
-- Run this entire script in Supabase Dashboard → SQL Editor
-- ============================================================
-- NOTE: Policies grant BOTH "authenticated" AND "anon" roles.
-- This is necessary because mock-login users have no Supabase
-- JWT session, so their requests arrive as the "anon" role.
-- ============================================================

-- ── SECTION 1: RLS POLICIES FOR work_orders ─────────────────
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read work_orders" ON work_orders;
DROP POLICY IF EXISTS "Allow authenticated insert work_orders" ON work_orders;
DROP POLICY IF EXISTS "Allow authenticated update work_orders" ON work_orders;
DROP POLICY IF EXISTS "Allow authenticated delete work_orders" ON work_orders;
DROP POLICY IF EXISTS "Allow anon read work_orders" ON work_orders;
DROP POLICY IF EXISTS "Allow anon insert work_orders" ON work_orders;
DROP POLICY IF EXISTS "Allow anon update work_orders" ON work_orders;
DROP POLICY IF EXISTS "Allow anon delete work_orders" ON work_orders;

CREATE POLICY "Allow authenticated read work_orders" ON work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert work_orders" ON work_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update work_orders" ON work_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete work_orders" ON work_orders FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow anon read work_orders" ON work_orders FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert work_orders" ON work_orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update work_orders" ON work_orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete work_orders" ON work_orders FOR DELETE TO anon USING (true);


-- ── SECTION 2: RLS POLICIES FOR production_plans ────────────
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read production_plans" ON production_plans;
DROP POLICY IF EXISTS "Allow authenticated insert production_plans" ON production_plans;
DROP POLICY IF EXISTS "Allow authenticated update production_plans" ON production_plans;
DROP POLICY IF EXISTS "Allow anon read production_plans" ON production_plans;
DROP POLICY IF EXISTS "Allow anon insert production_plans" ON production_plans;
DROP POLICY IF EXISTS "Allow anon update production_plans" ON production_plans;

CREATE POLICY "Allow authenticated read production_plans" ON production_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert production_plans" ON production_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update production_plans" ON production_plans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon read production_plans" ON production_plans FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert production_plans" ON production_plans FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update production_plans" ON production_plans FOR UPDATE TO anon USING (true) WITH CHECK (true);


-- ── SECTION 3: RLS POLICIES FOR plan_approvals ──────────────
ALTER TABLE plan_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read plan_approvals" ON plan_approvals;
DROP POLICY IF EXISTS "Allow authenticated insert plan_approvals" ON plan_approvals;
DROP POLICY IF EXISTS "Allow anon read plan_approvals" ON plan_approvals;
DROP POLICY IF EXISTS "Allow anon insert plan_approvals" ON plan_approvals;

CREATE POLICY "Allow authenticated read plan_approvals" ON plan_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert plan_approvals" ON plan_approvals FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow anon read plan_approvals" ON plan_approvals FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert plan_approvals" ON plan_approvals FOR INSERT TO anon WITH CHECK (true);


-- ── SECTION 4: plan_code COLUMN + TRIGGER ───────────────────
ALTER TABLE production_plans
  ADD COLUMN IF NOT EXISTS plan_code TEXT;

-- Backfill existing rows with PP-001, PP-002, etc.
WITH numbered AS (
  SELECT plan_id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM production_plans
  WHERE plan_code IS NULL
)
UPDATE production_plans
SET plan_code = 'PP-' || LPAD(numbered.rn::TEXT, 3, '0')
FROM numbered
WHERE production_plans.plan_id = numbered.plan_id;

-- Auto-assign plan_code on INSERT
CREATE OR REPLACE FUNCTION assign_plan_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM production_plans;
  NEW.plan_code := 'PP-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_plan_code ON production_plans;
CREATE TRIGGER trigger_plan_code
  BEFORE INSERT ON production_plans
  FOR EACH ROW
  WHEN (NEW.plan_code IS NULL)
  EXECUTE FUNCTION assign_plan_code();


-- ── SECTION 5: RLS POLICIES FOR QUALITY GATE TABLES ─────────
-- Table A: defect_records
ALTER TABLE defect_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read defect_records" ON defect_records;
DROP POLICY IF EXISTS "Allow authenticated insert defect_records" ON defect_records;
DROP POLICY IF EXISTS "Allow anon read defect_records" ON defect_records;
DROP POLICY IF EXISTS "Allow anon insert defect_records" ON defect_records;

CREATE POLICY "Allow authenticated read defect_records" ON defect_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert defect_records" ON defect_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow anon read defect_records" ON defect_records FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert defect_records" ON defect_records FOR INSERT TO anon WITH CHECK (true);

-- Table B: quality_inspections
ALTER TABLE quality_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read quality_inspections" ON quality_inspections;
DROP POLICY IF EXISTS "Allow authenticated insert quality_inspections" ON quality_inspections;
DROP POLICY IF EXISTS "Allow anon read quality_inspections" ON quality_inspections;
DROP POLICY IF EXISTS "Allow anon insert quality_inspections" ON quality_inspections;

CREATE POLICY "Allow authenticated read quality_inspections" ON quality_inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert quality_inspections" ON quality_inspections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow anon read quality_inspections" ON quality_inspections FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert quality_inspections" ON quality_inspections FOR INSERT TO anon WITH CHECK (true);

-- Table C: inspection_checks
ALTER TABLE inspection_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read inspection_checks" ON inspection_checks;
DROP POLICY IF EXISTS "Allow authenticated insert inspection_checks" ON inspection_checks;
DROP POLICY IF EXISTS "Allow anon read inspection_checks" ON inspection_checks;
DROP POLICY IF EXISTS "Allow anon insert inspection_checks" ON inspection_checks;

CREATE POLICY "Allow authenticated read inspection_checks" ON inspection_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert inspection_checks" ON inspection_checks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow anon read inspection_checks" ON inspection_checks FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert inspection_checks" ON inspection_checks FOR INSERT TO anon WITH CHECK (true);

-- Table D: batch_holds
ALTER TABLE batch_holds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read batch_holds" ON batch_holds;
DROP POLICY IF EXISTS "Allow authenticated insert batch_holds" ON batch_holds;
DROP POLICY IF EXISTS "Allow anon read batch_holds" ON batch_holds;
DROP POLICY IF EXISTS "Allow anon insert batch_holds" ON batch_holds;

CREATE POLICY "Allow authenticated read batch_holds" ON batch_holds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert batch_holds" ON batch_holds FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow anon read batch_holds" ON batch_holds FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert batch_holds" ON batch_holds FOR INSERT TO anon WITH CHECK (true);


-- ── SECTION 6: RLS POLICIES FOR SHOP FLOOR TABLES ───────────
-- Table A: operation_records
ALTER TABLE operation_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read operation_records" ON operation_records;
DROP POLICY IF EXISTS "Allow authenticated insert operation_records" ON operation_records;
DROP POLICY IF EXISTS "Allow authenticated update operation_records" ON operation_records;
DROP POLICY IF EXISTS "Allow anon read operation_records" ON operation_records;
DROP POLICY IF EXISTS "Allow anon insert operation_records" ON operation_records;
DROP POLICY IF EXISTS "Allow anon update operation_records" ON operation_records;

CREATE POLICY "Allow authenticated read operation_records" ON operation_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert operation_records" ON operation_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update operation_records" ON operation_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read operation_records" ON operation_records FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert operation_records" ON operation_records FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update operation_records" ON operation_records FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Table B: digital_signoffs
ALTER TABLE digital_signoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read digital_signoffs" ON digital_signoffs;
DROP POLICY IF EXISTS "Allow authenticated insert digital_signoffs" ON digital_signoffs;
DROP POLICY IF EXISTS "Allow anon read digital_signoffs" ON digital_signoffs;
DROP POLICY IF EXISTS "Allow anon insert digital_signoffs" ON digital_signoffs;

CREATE POLICY "Allow authenticated read digital_signoffs" ON digital_signoffs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert digital_signoffs" ON digital_signoffs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow anon read digital_signoffs" ON digital_signoffs FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert digital_signoffs" ON digital_signoffs FOR INSERT TO anon WITH CHECK (true);

-- Table C: andon_events
ALTER TABLE andon_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read andon_events" ON andon_events;
DROP POLICY IF EXISTS "Allow authenticated insert andon_events" ON andon_events;
DROP POLICY IF EXISTS "Allow authenticated update andon_events" ON andon_events;
DROP POLICY IF EXISTS "Allow anon read andon_events" ON andon_events;
DROP POLICY IF EXISTS "Allow anon insert andon_events" ON andon_events;
DROP POLICY IF EXISTS "Allow anon update andon_events" ON andon_events;

CREATE POLICY "Allow authenticated read andon_events" ON andon_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert andon_events" ON andon_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update andon_events" ON andon_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read andon_events" ON andon_events FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert andon_events" ON andon_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update andon_events" ON andon_events FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Table D: issue_resolutions
ALTER TABLE issue_resolutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read issue_resolutions" ON issue_resolutions;
DROP POLICY IF EXISTS "Allow authenticated insert issue_resolutions" ON issue_resolutions;
DROP POLICY IF EXISTS "Allow anon read issue_resolutions" ON issue_resolutions;
DROP POLICY IF EXISTS "Allow anon insert issue_resolutions" ON issue_resolutions;

CREATE POLICY "Allow authenticated read issue_resolutions" ON issue_resolutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert issue_resolutions" ON issue_resolutions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow anon read issue_resolutions" ON issue_resolutions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert issue_resolutions" ON issue_resolutions FOR INSERT TO anon WITH CHECK (true);
