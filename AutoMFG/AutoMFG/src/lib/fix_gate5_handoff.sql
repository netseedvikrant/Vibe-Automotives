-- ============================================================
-- FIX: gate5_bom_cad_handoffs RLS policies & Automation Trigger
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Enable RLS and create permissive policies for gate5_bom_cad_handoffs
ALTER TABLE gate5_bom_cad_handoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gate5_bom_cad_handoffs_select" ON gate5_bom_cad_handoffs;
DROP POLICY IF EXISTS "gate5_bom_cad_handoffs_insert" ON gate5_bom_cad_handoffs;
DROP POLICY IF EXISTS "gate5_bom_cad_handoffs_update" ON gate5_bom_cad_handoffs;
DROP POLICY IF EXISTS "gate5_bom_cad_handoffs_delete" ON gate5_bom_cad_handoffs;

CREATE POLICY "gate5_bom_cad_handoffs_select" ON gate5_bom_cad_handoffs FOR SELECT USING (true);
CREATE POLICY "gate5_bom_cad_handoffs_insert" ON gate5_bom_cad_handoffs FOR INSERT WITH CHECK (true);
CREATE POLICY "gate5_bom_cad_handoffs_update" ON gate5_bom_cad_handoffs FOR UPDATE USING (true);
CREATE POLICY "gate5_bom_cad_handoffs_delete" ON gate5_bom_cad_handoffs FOR DELETE USING (true);

-- 2. Create the automation trigger to bridge AutoDev -> AutoMFG on Gate 5 approval
CREATE OR REPLACE FUNCTION handle_gate5_handoff()
RETURNS TRIGGER AS $$
DECLARE
  ebom_json JSONB;
  cad_json JSONB;
BEGIN
  -- Trigger when program status becomes 'Production'
  IF NEW.status = 'Production' AND (OLD.status IS DISTINCT FROM 'Production' OR OLD.status IS NULL) THEN
    -- Fetch associated EBOM items as a JSON array
    SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
    INTO ebom_json
    FROM (
      SELECT id, program_id, part_number, part_name, quantity, material, revision, drawing_number, uom, bom_type, status
      FROM ebom
      WHERE program_id = NEW.id
    ) e;

    -- Fetch associated CAD files as a JSON array
    SELECT COALESCE(jsonb_agg(c), '[]'::jsonb)
    INTO cad_json
    FROM (
      SELECT id, program_id, file_name, file_url, version, description, status
      FROM cad_files
      WHERE program_id = NEW.id
    ) c;

    -- Delete any existing handoff for this program to prevent duplicates
    DELETE FROM gate5_bom_cad_handoffs WHERE program_id = NEW.id;

    -- Insert new handoff record
    INSERT INTO gate5_bom_cad_handoffs (program_name, program_id, released_at, ebom_payload, cad_payload)
    VALUES (NEW.program_name, NEW.id, NOW(), ebom_json, cad_json);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gate5_handoff ON programs;
CREATE TRIGGER trg_gate5_handoff
AFTER UPDATE ON programs
FOR EACH ROW
EXECUTE FUNCTION handle_gate5_handoff();

-- 3. One-time backfill for existing programs with 'Production' status
DO $$
DECLARE
  r RECORD;
  ebom_json JSONB;
  cad_json JSONB;
BEGIN
  FOR r IN SELECT id, program_name FROM programs WHERE status = 'Production' LOOP
    -- Fetch associated EBOM items
    SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
    INTO ebom_json
    FROM (
      SELECT id, program_id, part_number, part_name, quantity, material, revision, drawing_number, uom, bom_type, status
      FROM ebom
      WHERE program_id = r.id
    ) e;

    -- Fetch associated CAD files
    SELECT COALESCE(jsonb_agg(c), '[]'::jsonb)
    INTO cad_json
    FROM (
      SELECT id, program_id, file_name, file_url, version, description, status
      FROM cad_files
      WHERE program_id = r.id
    ) c;

    -- Delete old and insert
    DELETE FROM gate5_bom_cad_handoffs WHERE program_id = r.id;
    INSERT INTO gate5_bom_cad_handoffs (program_name, program_id, released_at, ebom_payload, cad_payload)
    VALUES (r.program_name, r.id, NOW(), ebom_json, cad_json);
  END LOOP;
END;
$$;
