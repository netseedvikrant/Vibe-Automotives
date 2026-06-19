-- ============================================================
-- FIX: RLS policies for calibration_records and related tables
-- Run this in Supabase SQL Editor (or add to your seed script)
-- ============================================================

-- calibration_records
ALTER TABLE calibration_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calibration_records_select" ON calibration_records;
DROP POLICY IF EXISTS "calibration_records_insert" ON calibration_records;
DROP POLICY IF EXISTS "calibration_records_update" ON calibration_records;
DROP POLICY IF EXISTS "calibration_records_delete" ON calibration_records;
CREATE POLICY "calibration_records_select" ON calibration_records FOR SELECT USING (true);
CREATE POLICY "calibration_records_insert" ON calibration_records FOR INSERT WITH CHECK (true);
CREATE POLICY "calibration_records_update" ON calibration_records FOR UPDATE USING (true);
CREATE POLICY "calibration_records_delete" ON calibration_records FOR DELETE USING (true);

-- tools (in case it also has RLS)
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tools_select" ON tools;
DROP POLICY IF EXISTS "tools_insert" ON tools;
DROP POLICY IF EXISTS "tools_update" ON tools;
DROP POLICY IF EXISTS "tools_delete" ON tools;
CREATE POLICY "tools_select" ON tools FOR SELECT USING (true);
CREATE POLICY "tools_insert" ON tools FOR INSERT WITH CHECK (true);
CREATE POLICY "tools_update" ON tools FOR UPDATE USING (true);
CREATE POLICY "tools_delete" ON tools FOR DELETE USING (true);

-- tool_replacement_requests (triggered from calibration)
ALTER TABLE tool_replacement_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tool_replacement_requests_select" ON tool_replacement_requests;
DROP POLICY IF EXISTS "tool_replacement_requests_insert" ON tool_replacement_requests;
DROP POLICY IF EXISTS "tool_replacement_requests_update" ON tool_replacement_requests;
DROP POLICY IF EXISTS "tool_replacement_requests_delete" ON tool_replacement_requests;
CREATE POLICY "tool_replacement_requests_select" ON tool_replacement_requests FOR SELECT USING (true);
CREATE POLICY "tool_replacement_requests_insert" ON tool_replacement_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "tool_replacement_requests_update" ON tool_replacement_requests FOR UPDATE USING (true);
CREATE POLICY "tool_replacement_requests_delete" ON tool_replacement_requests FOR DELETE USING (true);

-- purchase_requisitions (generated from failed calibration)
ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_requisitions_select" ON purchase_requisitions;
DROP POLICY IF EXISTS "purchase_requisitions_insert" ON purchase_requisitions;
DROP POLICY IF EXISTS "purchase_requisitions_update" ON purchase_requisitions;
DROP POLICY IF EXISTS "purchase_requisitions_delete" ON purchase_requisitions;
CREATE POLICY "purchase_requisitions_select" ON purchase_requisitions FOR SELECT USING (true);
CREATE POLICY "purchase_requisitions_insert" ON purchase_requisitions FOR INSERT WITH CHECK (true);
CREATE POLICY "purchase_requisitions_update" ON purchase_requisitions FOR UPDATE USING (true);
CREATE POLICY "purchase_requisitions_delete" ON purchase_requisitions FOR DELETE USING (true);
