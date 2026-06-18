-- ── STEP 0: Configure RLS policies for infrastructure tables ─────────────────
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

ALTER TABLE part_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "part_master_select" ON part_master;
DROP POLICY IF EXISTS "part_master_insert" ON part_master;
DROP POLICY IF EXISTS "part_master_update" ON part_master;
DROP POLICY IF EXISTS "part_master_delete" ON part_master;
CREATE POLICY "part_master_select" ON part_master FOR SELECT USING (true);
CREATE POLICY "part_master_insert" ON part_master FOR INSERT WITH CHECK (true);
CREATE POLICY "part_master_update" ON part_master FOR UPDATE USING (true);
CREATE POLICY "part_master_delete" ON part_master FOR DELETE USING (true);

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

-- tools
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tools_select" ON tools;
DROP POLICY IF EXISTS "tools_insert" ON tools;
DROP POLICY IF EXISTS "tools_update" ON tools;
DROP POLICY IF EXISTS "tools_delete" ON tools;
CREATE POLICY "tools_select" ON tools FOR SELECT USING (true);
CREATE POLICY "tools_insert" ON tools FOR INSERT WITH CHECK (true);
CREATE POLICY "tools_update" ON tools FOR UPDATE USING (true);
CREATE POLICY "tools_delete" ON tools FOR DELETE USING (true);

-- tool_replacement_requests
ALTER TABLE tool_replacement_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tool_replacement_requests_select" ON tool_replacement_requests;
DROP POLICY IF EXISTS "tool_replacement_requests_insert" ON tool_replacement_requests;
DROP POLICY IF EXISTS "tool_replacement_requests_update" ON tool_replacement_requests;
DROP POLICY IF EXISTS "tool_replacement_requests_delete" ON tool_replacement_requests;
CREATE POLICY "tool_replacement_requests_select" ON tool_replacement_requests FOR SELECT USING (true);
CREATE POLICY "tool_replacement_requests_insert" ON tool_replacement_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "tool_replacement_requests_update" ON tool_replacement_requests FOR UPDATE USING (true);
CREATE POLICY "tool_replacement_requests_delete" ON tool_replacement_requests FOR DELETE USING (true);

-- purchase_requisitions
ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_requisitions_select" ON purchase_requisitions;
DROP POLICY IF EXISTS "purchase_requisitions_insert" ON purchase_requisitions;
DROP POLICY IF EXISTS "purchase_requisitions_update" ON purchase_requisitions;
DROP POLICY IF EXISTS "purchase_requisitions_delete" ON purchase_requisitions;
CREATE POLICY "purchase_requisitions_select" ON purchase_requisitions FOR SELECT USING (true);
CREATE POLICY "purchase_requisitions_insert" ON purchase_requisitions FOR INSERT WITH CHECK (true);
CREATE POLICY "purchase_requisitions_update" ON purchase_requisitions FOR UPDATE USING (true);
CREATE POLICY "purchase_requisitions_delete" ON purchase_requisitions FOR DELETE USING (true);


-- ── STEP 1: Seed and Clean Plants & Production Lines ──────────────────────────
DO $$
DECLARE
  v_canon_plant_id UUID;
  v_line_1_id UUID;
  v_line_2_id UUID;
  v_line_3_id UUID;
  v_line_4_id UUID;
  r RECORD;
  sql_stmt TEXT;
BEGIN
  -- 1. Get or create a single canonical plant
  SELECT plant_id INTO v_canon_plant_id 
  FROM plants 
  WHERE name = 'Plant A' 
  ORDER BY plant_id 
  LIMIT 1;

  IF v_canon_plant_id IS NULL THEN
    INSERT INTO plants (name, location, timezone)
    VALUES ('Plant A', 'Munich, Germany', 'Europe/Berlin')
    RETURNING plant_id INTO v_canon_plant_id;
  END IF;

  -- 2. Get or create a single canonical line for each name under the canonical plant
  SELECT line_id INTO v_line_1_id FROM production_lines WHERE plant_id = v_canon_plant_id AND line_name = 'Line 1' ORDER BY line_id LIMIT 1;
  IF v_line_1_id IS NULL THEN
    INSERT INTO production_lines (plant_id, line_name, status) VALUES (v_canon_plant_id, 'Line 1', 'active') RETURNING line_id INTO v_line_1_id;
  END IF;
  
  SELECT line_id INTO v_line_2_id FROM production_lines WHERE plant_id = v_canon_plant_id AND line_name = 'Line 2' ORDER BY line_id LIMIT 1;
  IF v_line_2_id IS NULL THEN
    INSERT INTO production_lines (plant_id, line_name, status) VALUES (v_canon_plant_id, 'Line 2', 'active') RETURNING line_id INTO v_line_2_id;
  END IF;

  SELECT line_id INTO v_line_3_id FROM production_lines WHERE plant_id = v_canon_plant_id AND line_name = 'Line 3' ORDER BY line_id LIMIT 1;
  IF v_line_3_id IS NULL THEN
    INSERT INTO production_lines (plant_id, line_name, status) VALUES (v_canon_plant_id, 'Line 3', 'active') RETURNING line_id INTO v_line_3_id;
  END IF;

  SELECT line_id INTO v_line_4_id FROM production_lines WHERE plant_id = v_canon_plant_id AND line_name = 'Line 4' ORDER BY line_id LIMIT 1;
  IF v_line_4_id IS NULL THEN
    INSERT INTO production_lines (plant_id, line_name, status) VALUES (v_canon_plant_id, 'Line 4', 'active') RETURNING line_id INTO v_line_4_id;
  END IF;

  -- 3. Dynamically re-associate all table columns referencing 'line_id' to point to canonical lines
  FOR r IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND column_name = 'line_id'
      AND table_name NOT IN ('production_lines')
  LOOP
    sql_stmt := format('
      UPDATE %I t
      SET line_id = CASE COALESCE((SELECT line_name FROM production_lines pl WHERE pl.line_id = t.line_id), %L)
        WHEN %L THEN %L::uuid
        WHEN %L THEN %L::uuid
        WHEN %L THEN %L::uuid
        ELSE %L::uuid
      END
      WHERE line_id IS NOT NULL',
      r.table_name, 'Line 1',
      'Line 2', v_line_2_id,
      'Line 3', v_line_3_id,
      'Line 4', v_line_4_id,
      v_line_1_id
    );
    EXECUTE sql_stmt;
  END LOOP;

  -- 4. Dynamically re-associate all table columns referencing 'plant_id' to point to the canonical plant
  FOR r IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND column_name = 'plant_id'
      AND table_name NOT IN ('plants', 'production_lines')
  LOOP
    sql_stmt := format('
      UPDATE %I t
      SET plant_id = %L::uuid
      WHERE plant_id IS NOT NULL',
      r.table_name, v_canon_plant_id
    );
    EXECUTE sql_stmt;
  END LOOP;

  -- 5. Delete all other non-canonical production lines
  DELETE FROM production_lines 
  WHERE line_id NOT IN (v_line_1_id, v_line_2_id, v_line_3_id, v_line_4_id);

  -- 6. Delete all other non-canonical plants
  DELETE FROM plants 
  WHERE plant_id <> v_canon_plant_id;

END $$;

-- ── STEP 2: Seed part_master ──────────────────────────────────────────────────
INSERT INTO part_master (part_number, model, variant) VALUES
  ('BMW-M4-DOOR-LH',    'M4', 'Competition'),
  ('BMW-3-CHASSIS',     '3',  'Sedan'),
  ('BMW-5-ENGINE-MOUNT','5',  'xDrive'),
  ('BMW-7-DASH-PANEL',  '7',  'L'),
  ('BMW-M3-EXHAUST',    'M3', 'CS')
ON CONFLICT (part_number) DO NOTHING;

-- ── STEP 4: Backfill production_plans (part_number) using CTE ────────────────
WITH numbered AS (
  SELECT
    plan_id,
    planned_qty,
    ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM production_plans
  WHERE part_number IS NULL
),
assigned AS (
  SELECT
    plan_id,
    planned_qty,
    CASE (rn % 5)
      WHEN 1 THEN 'BMW-M4-DOOR-LH'
      WHEN 2 THEN 'BMW-3-CHASSIS'
      WHEN 3 THEN 'BMW-5-ENGINE-MOUNT'
      WHEN 4 THEN 'BMW-7-DASH-PANEL'
      ELSE        'BMW-M3-EXHAUST'
    END AS assigned_part,
    COALESCE(NULLIF(planned_qty, 0), 50) AS safe_qty
  FROM numbered
)
UPDATE production_plans pp
SET
  part_number = a.assigned_part,
  planned_qty = a.safe_qty
FROM assigned a
WHERE pp.plan_id = a.plan_id;

-- ── STEP 5: Backfill production_plans (line_id) using CTE ────────────────────
WITH numbered AS (
  SELECT
    plan_id,
    ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM production_plans
  WHERE line_id IS NULL
),
lines_list AS (
  SELECT line_id, ROW_NUMBER() OVER (ORDER BY line_name) AS ln_rn
  FROM production_lines
),
assigned AS (
  SELECT n.plan_id, l.line_id
  FROM numbered n
  JOIN lines_list l ON ((n.rn - 1) % COALESCE(NULLIF((SELECT COUNT(*) FROM production_lines), 0), 1) + 1) = l.ln_rn
)
UPDATE production_plans pp
SET line_id = a.line_id
FROM assigned a
WHERE pp.plan_id = a.plan_id;

-- Also set plant_id where missing
UPDATE production_plans
SET plant_id = (SELECT plant_id FROM plants WHERE name = 'Plant A' LIMIT 1)
WHERE plant_id IS NULL;

-- ── STEP 6: Backfill work_orders from parent plan ─────────────────────────────
UPDATE work_orders wo
SET
  part_number = pp.part_number,
  line_id     = pp.line_id,
  plant_id    = pp.plant_id,
  planned_qty = COALESCE(NULLIF(wo.planned_qty, 0), pp.planned_qty, 50)
FROM production_plans pp
WHERE wo.plan_id = pp.plan_id
  AND (wo.part_number IS NULL OR wo.line_id IS NULL);

-- ── VERIFY ────────────────────────────────────────────────────────────────────
SELECT 'LINE'  AS type, line_name AS label, status          AS status FROM production_lines
UNION ALL
SELECT 'PLAN',  COALESCE(part_number,'[null]'), status      FROM production_plans
UNION ALL
SELECT 'WO',    COALESCE(part_number,'[null]'), status      FROM work_orders
ORDER BY type, label;
