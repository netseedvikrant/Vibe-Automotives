-- ─────────────────────────────────────────────────────────────────────────────
-- AutoMFG — Full Data Fix (v2 — fixed window function error)
-- Run this in Supabase SQL Editor (paste all, click Run).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: Seed Plant A ──────────────────────────────────────────────────────
INSERT INTO plants (name, location, timezone)
VALUES ('Plant A', 'Munich, Germany', 'Europe/Berlin')
ON CONFLICT DO NOTHING;

-- ── STEP 2: Seed part_master ──────────────────────────────────────────────────
INSERT INTO part_master (part_number, model, variant) VALUES
  ('BMW-M4-DOOR-LH',    'M4', 'Competition'),
  ('BMW-3-CHASSIS',     '3',  'Sedan'),
  ('BMW-5-ENGINE-MOUNT','5',  'xDrive'),
  ('BMW-7-DASH-PANEL',  '7',  'L'),
  ('BMW-M3-EXHAUST',    'M3', 'CS')
ON CONFLICT (part_number) DO NOTHING;

-- ── STEP 3: Seed production lines ────────────────────────────────────────────
INSERT INTO production_lines (plant_id, line_name, status)
SELECT plant_id, ln.line_name, 'active'
FROM plants, (VALUES ('Line 1'),('Line 2'),('Line 3'),('Line 4')) AS ln(line_name)
WHERE plants.name = 'Plant A'
ON CONFLICT DO NOTHING;

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
  JOIN lines_list l ON ((n.rn - 1) % (SELECT COUNT(*) FROM production_lines) + 1) = l.ln_rn
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
