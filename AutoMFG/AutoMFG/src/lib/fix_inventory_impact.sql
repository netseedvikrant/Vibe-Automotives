-- ============================================================
-- FIX: Schema and RLS policies for Inventory Impact tracking
-- Run this in Supabase SQL Editor to alter the inventory table
-- ============================================================

-- ── 1. ADD COLUMNS FOR INVENTORY IMPACTS ──────────────────────
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS defect_id UUID;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS wo_number TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS scrap_qty INTEGER DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS deducted_qty INTEGER DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2) DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10,2) DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS supplier_defect BOOLEAN DEFAULT FALSE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS ncr_generated TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS replenishment_status TEXT DEFAULT 'PENDING';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS source_module TEXT DEFAULT 'AutoMFG';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS linked_module TEXT DEFAULT 'ScrapRework';

-- ── 2. ENABLE ROW LEVEL SECURITY ──────────────────────────────
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- ── 3. CREATE POLICIES ────────────────────────────────────────
DROP POLICY IF EXISTS "inventory_select" ON inventory;
DROP POLICY IF EXISTS "inventory_insert" ON inventory;
DROP POLICY IF EXISTS "inventory_update" ON inventory;
DROP POLICY IF EXISTS "inventory_delete" ON inventory;

CREATE POLICY "inventory_select" ON inventory FOR SELECT USING (true);
CREATE POLICY "inventory_insert" ON inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "inventory_update" ON inventory FOR UPDATE USING (true);
CREATE POLICY "inventory_delete" ON inventory FOR DELETE USING (true);
