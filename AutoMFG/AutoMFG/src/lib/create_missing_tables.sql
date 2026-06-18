-- Missing Tables for AutoMFG/AutoSCM integration

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID,
    part_code TEXT,
    transaction_type TEXT, -- 'WO_ISSUE', 'ACTUAL_CONSUMPTION', 'SCRAP', 'REWORK_ISSUE'
    quantity INTEGER,
    previous_qty INTEGER,
    new_qty INTEGER,
    reference_type TEXT,
    reference_id TEXT,
    work_order_id TEXT,
    vin TEXT,
    reason TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_consumption_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id TEXT,
    part_code TEXT,
    quantity INTEGER,
    logged_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS replenishment_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID,
    part_code TEXT,
    source_type TEXT,
    source_id TEXT,
    shortage_qty INTEGER,
    trigger_reason TEXT,
    priority TEXT,
    status TEXT DEFAULT 'Pending',
    purchase_requisition_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_ncrs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID,
    part_code TEXT,
    defect_id UUID,
    vin TEXT,
    ncr_type TEXT,
    severity TEXT,
    description TEXT,
    status TEXT DEFAULT 'Open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scm_handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Disable RLS for these tables for testing
ALTER TABLE inventory_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_consumption_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE replenishment_triggers DISABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_ncrs DISABLE ROW LEVEL SECURITY;
ALTER TABLE scm_handoffs DISABLE ROW LEVEL SECURITY;
