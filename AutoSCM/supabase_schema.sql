-- ==========================================
-- AutoSCM Supabase PostgreSQL Schema
-- ==========================================

-- Clean up existing tables to avoid schema mismatch errors (like missing columns)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS procurement_tracking CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS quotations CASCADE;
DROP TABLE IF EXISTS rfq_suppliers CASCADE;
DROP TABLE IF EXISTS rfq CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS approvals CASCADE;
DROP TABLE IF EXISTS purchase_requisitions CASCADE;
DROP TABLE IF EXISTS material_requests CASCADE;
DROP TABLE IF EXISTS shortage_alerts CASCADE;
DROP TABLE IF EXISTS material_requirements CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS production_plans CASCADE;
DROP TABLE IF EXISTS bom_items CASCADE;
DROP TABLE IF EXISTS bom_master CASCADE;
DROP TABLE IF EXISTS material_list CASCADE;
DROP TABLE IF EXISTS erp_users CASCADE;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS erp_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE DEFAULT gen_random_uuid(),
    auth_id UUID, -- References auth.users(id) in Supabase
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT, -- Plain text password for demo login
    password_hash TEXT, -- Included for reference, though Supabase handles auth securely
    role TEXT NOT NULL,
    department TEXT,
    profile_image_url TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. BOM MASTER TABLE
CREATE TABLE IF NOT EXISTS bom_master (
    bom_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name TEXT NOT NULL,
    product_code TEXT UNIQUE NOT NULL,
    version TEXT NOT NULL,
    created_by UUID REFERENCES erp_users(id),
    release_date DATE,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. BOM ITEMS TABLE
CREATE TABLE IF NOT EXISTS bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID REFERENCES bom_master(bom_id) ON DELETE CASCADE,
    material_name TEXT NOT NULL,
    part_code TEXT NOT NULL,
    category TEXT,
    qty_per_product NUMERIC NOT NULL,
    unit TEXT DEFAULT 'pcs',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. PRODUCTION PLANS TABLE
CREATE TABLE IF NOT EXISTS production_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name TEXT NOT NULL,
    bom_id UUID REFERENCES autoscm_handoffs(id),
    production_quantity INTEGER NOT NULL,
    production_date DATE,
    priority TEXT,
    shift TEXT,
    planner_id UUID REFERENCES erp_users(id),
    status TEXT DEFAULT 'Planned',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. INVENTORY TABLE
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_name TEXT NOT NULL,
    part_code TEXT UNIQUE NOT NULL,
    available_stock INTEGER DEFAULT 0,
    reserved_stock INTEGER DEFAULT 0,
    warehouse TEXT,
    safety_stock INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Active',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. MATERIAL REQUIREMENTS TABLE
CREATE TABLE IF NOT EXISTS material_requirements (
    requirement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_plan_id UUID REFERENCES production_plans(plan_id) ON DELETE CASCADE,
    material_name TEXT NOT NULL,
    required_quantity INTEGER NOT NULL,
    available_quantity INTEGER NOT NULL,
    shortage_quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. SHORTAGE ALERTS TABLE
CREATE TABLE IF NOT EXISTS shortage_alerts (
    shortage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_name TEXT NOT NULL,
    required_quantity INTEGER NOT NULL,
    available_quantity INTEGER NOT NULL,
    shortage_quantity INTEGER NOT NULL,
    severity TEXT NOT NULL, -- Critical, High, Medium, Low
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. MATERIAL REQUESTS TABLE
CREATE TABLE IF NOT EXISTS material_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_name TEXT NOT NULL,
    part_code TEXT NOT NULL,
    required_quantity INTEGER NOT NULL,
    shortage_quantity INTEGER NOT NULL,
    requested_by UUID REFERENCES erp_users(id),
    required_date DATE,
    priority TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Pending', -- Pending, Buyer Reviewing, PR Created, RFQ Active, PO Generated, Delivered
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8b. PURCHASE REQUISITIONS TABLE
CREATE TABLE IF NOT EXISTS purchase_requisitions (
    pr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_request_id UUID REFERENCES material_requests(request_id),
    material_name TEXT NOT NULL,
    part_code TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    estimated_cost NUMERIC,
    procurement_type TEXT,
    supplier_category TEXT,
    required_delivery_date DATE,
    budget_code TEXT,
    notes TEXT,
    currency TEXT DEFAULT 'USD',
    tax_amount NUMERIC DEFAULT 0,
    created_by UUID REFERENCES erp_users(id),
    department TEXT DEFAULT 'Production',
    priority TEXT,
    status TEXT DEFAULT 'Draft',
    finance_approval_status TEXT DEFAULT 'Pending',
    finance_approved_by UUID REFERENCES erp_users(id),
    finance_approval_date TIMESTAMP WITH TIME ZONE,
    finance_comments TEXT,
    procurement_head_status TEXT DEFAULT 'Pending',
    procurement_head_approved_by UUID REFERENCES erp_users(id),
    procurement_head_approval_date TIMESTAMP WITH TIME ZONE,
    procurement_head_comments TEXT,
    rfq_status TEXT DEFAULT 'Not Started',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8c. APPROVALS TABLE
CREATE TABLE IF NOT EXISTS approvals (
    approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id UUID REFERENCES purchase_requisitions(pr_id) ON DELETE CASCADE,
    approver_role TEXT NOT NULL,
    approver_name TEXT,
    status TEXT NOT NULL,
    comments TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. SUPPLIERS TABLE (Supplier Master Database)
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_name TEXT NOT NULL,
    supplier_code TEXT UNIQUE,
    category TEXT,
    products_supplied TEXT,
    supplier_rating TEXT,
    quality_score NUMERIC,
    on_time_delivery_percent NUMERIC,
    rejection_rate NUMERIC,
    previous_delay_count INTEGER DEFAULT 0,
    lead_time_days INTEGER,
    supplier_status TEXT DEFAULT 'Approved',
    city TEXT,
    country TEXT,
    contact_person TEXT,
    contact_email TEXT,
    phone_number TEXT,
    annual_contract_value NUMERIC,
    risk_level TEXT,
    performance_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert 15 Realistic Automotive Suppliers
INSERT INTO suppliers (supplier_name, supplier_code, category, products_supplied, supplier_rating, quality_score, on_time_delivery_percent, rejection_rate, previous_delay_count, lead_time_days, supplier_status, city, country, contact_person, contact_email, phone_number, annual_contract_value, risk_level, performance_status) VALUES
('Bosch', 'SUP-BOSCH-01', 'Electronics', 'ECUs, Sensors, ABS Modules', 'Gold', 98.5, 99.0, 0.5, 1, 7, 'Approved', 'Stuttgart', 'Germany', 'Hans Müller', 'b2b@bosch-auto.com', '+49 711 8110', 12500000, 'Low', 'Excellent'),
('Michelin', 'SUP-MICH-02', 'Tires', 'Performance Tires, All-Season Tires', 'Gold', 97.0, 96.5, 1.2, 2, 14, 'Approved', 'Clermont-Ferrand', 'France', 'Jean Dupont', 'fleet@michelin.fr', '+33 4 73 32 20', 8500000, 'Low', 'Excellent'),
('Denso', 'SUP-DENSO-03', 'Engine Components', 'Fuel Injectors, Radiators, Alternators', 'Gold', 99.0, 98.0, 0.8, 0, 10, 'Approved', 'Kariya', 'Japan', 'Kenji Sato', 'sales@denso.co.jp', '+81 566 25 5511', 11200000, 'Low', 'Excellent'),
('Valeo', 'SUP-VALEO-04', 'Lighting', 'LED Headlamps, Wipers, Thermal Systems', 'Silver', 94.5, 93.0, 2.5, 4, 12, 'Approved', 'Paris', 'France', 'Marie Curie', 'auto@valeo.com', '+33 1 40 55 20', 6400000, 'Medium', 'Good'),
('Continental', 'SUP-CONT-05', 'Tires', 'Tires, Brake Systems, Tachographs', 'Gold', 97.5, 96.0, 1.1, 1, 10, 'Approved', 'Hanover', 'Germany', 'Klaus Weber', 'oem@continental.de', '+49 511 9380', 9800000, 'Low', 'Excellent'),
('Magna International', 'SUP-MAGNA-06', 'Chassis', 'Chassis, Seats, Body Exteriors', 'Silver', 92.0, 91.5, 3.2, 5, 21, 'Approved', 'Aurora', 'Canada', 'David Smith', 'sourcing@magna.com', '+1 905 726 2462', 15000000, 'Medium', 'Good'),
('Bharat Forge', 'SUP-BHARAT-07', 'Steel', 'Forged Engine Components, Crankshafts', 'Bronze', 88.0, 85.0, 5.5, 8, 30, 'Approved', 'Pune', 'India', 'Rahul Sharma', 'exports@bharatforge.com', '+91 20 2682 8000', 4500000, 'High', 'Needs Improvement'),
('Motherson Sumi', 'SUP-MOTHER-08', 'Wiring Harness', 'Wiring Harnesses, Mirrors', 'Silver', 93.5, 94.0, 2.0, 3, 14, 'Approved', 'Noida', 'India', 'Amit Patel', 'sales@motherson.com', '+91 120 6679500', 5200000, 'Medium', 'Good'),
('Exide', 'SUP-EXIDE-09', 'Batteries', 'Lead-Acid Batteries, AGM Batteries', 'Silver', 91.0, 92.5, 3.5, 4, 10, 'Approved', 'Milton', 'USA', 'John Doe', 'industrial@exide.com', '+1 800 523 9433', 3800000, 'Medium', 'Good'),
('ZF Group', 'SUP-ZF-10', 'Suspension', 'Transmissions, Axles, Shock Absorbers', 'Gold', 98.0, 97.5, 1.0, 1, 15, 'Approved', 'Friedrichshafen', 'Germany', 'Stefan Schmidt', 'contact@zf.com', '+49 7541 770', 14200000, 'Low', 'Excellent'),
('SKF', 'SUP-SKF-11', 'Engine Components', 'Bearings, Seals, Mechatronics', 'Gold', 97.5, 98.0, 0.9, 0, 8, 'Approved', 'Gothenburg', 'Sweden', 'Lars Svensson', 'auto.sales@skf.com', '+46 31 337 10', 7100000, 'Low', 'Excellent'),
('Amaron', 'SUP-AMARON-12', 'Batteries', 'Automotive Batteries', 'Bronze', 89.5, 87.0, 4.2, 7, 12, 'Approved', 'Tirupati', 'India', 'Srinivas Rao', 'b2b@amara-raja.co.in', '+91 877 2265000', 2100000, 'High', 'Needs Improvement'),
('Bridgestone', 'SUP-BRIDGE-13', 'Tires', 'OEM Tires', 'Silver', 95.0, 94.5, 2.1, 3, 14, 'Approved', 'Tokyo', 'Japan', 'Hiroshi Tanaka', 'oem@bridgestone.co.jp', '+81 3 5208 5111', 8900000, 'Medium', 'Good'),
('Yokohama', 'SUP-YOKO-14', 'Tires', 'Performance Tires', 'Bronze', 87.0, 88.5, 4.8, 6, 18, 'Approved', 'Tokyo', 'Japan', 'Taro Suzuki', 'global@yokohamatire.com', '+81 3 5400 4531', 3200000, 'High', 'Needs Improvement'),
('Cummins', 'SUP-CUMMINS-15', 'Engine Components', 'Diesel Engines, Filtration', 'Gold', 98.5, 97.0, 1.0, 2, 21, 'Approved', 'Columbus', 'USA', 'Michael Brown', 'oem.parts@cummins.com', '+1 812 377 5000', 16500000, 'Low', 'Excellent')
ON CONFLICT (supplier_code) DO NOTHING;


-- 10. RFQ TABLE
CREATE TABLE IF NOT EXISTS rfq (
    rfq_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id UUID REFERENCES purchase_requisitions(pr_id) ON DELETE CASCADE,
    rfq_number TEXT,
    material_name TEXT NOT NULL,
    part_code TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    quotation_deadline DATE,
    required_delivery_date DATE,
    technical_specifications TEXT,
    created_by UUID REFERENCES erp_users(id),
    status TEXT DEFAULT 'Open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10b. RFQ SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS rfq_suppliers (
    rfq_supplier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID REFERENCES rfq(rfq_id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(supplier_id),
    supplier_name TEXT,
    supplier_email TEXT,
    rfq_sent_status TEXT DEFAULT 'Sent',
    quotation_status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS quotations (
    quotation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID REFERENCES rfq(rfq_id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(supplier_id),
    supplier_name TEXT,
    quoted_price NUMERIC NOT NULL,
    currency TEXT DEFAULT 'USD',
    delivery_days INTEGER,
    payment_terms TEXT,
    minimum_order_quantity INTEGER DEFAULT 1,
    warranty_terms TEXT,
    additional_notes TEXT,
    quotation_status TEXT DEFAULT 'Submitted',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. PURCHASE ORDERS TABLE
CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(supplier_id),
    rfq_id UUID REFERENCES rfq(rfq_id),
    total_amount NUMERIC NOT NULL,
    delivery_date DATE,
    payment_terms TEXT,
    status TEXT DEFAULT 'Generated',
    acknowledgment_status TEXT DEFAULT 'Pending',
    asn_status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12b. ASN TABLE
CREATE TABLE IF NOT EXISTS asn (
    asn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asn_number TEXT,
    po_id UUID REFERENCES purchase_orders(po_id),
    supplier_id UUID REFERENCES suppliers(supplier_id),
    supplier_name TEXT,
    truck_number TEXT,
    driver_name TEXT,
    driver_contact TEXT,
    shipment_quantity INTEGER,
    dispatch_date DATE,
    expected_arrival TIMESTAMP WITH TIME ZONE,
    logistics_partner TEXT,
    vehicle_type TEXT,
    shipment_notes TEXT,
    shipment_status TEXT DEFAULT 'Shipment In Transit',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. PROCUREMENT TRACKING TABLE
CREATE TABLE IF NOT EXISTS procurement_tracking (
    tracking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_request_id UUID REFERENCES material_requests(request_id) ON DELETE CASCADE,
    current_stage TEXT NOT NULL, -- Material Request, Buyer Review, PR Created, RFQ Active, Supplier Selected, PO Generated, In Transit, Delivered
    comments TEXT,
    updated_by UUID REFERENCES erp_users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_role TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'Normal',
    read_status BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES erp_users(id),
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE erp_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE bom_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_requirements DISABLE ROW LEVEL SECURITY;
ALTER TABLE shortage_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE approvals DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE rfq DISABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Note: Policies need to be created based on your specific requirements.
-- For testing purposes, you can create permissive policies:
-- CREATE POLICY "Allow all actions" ON bom_master FOR ALL USING (true);
-- (Repeat for each table to disable RLS restrictions during testing)


-- ==========================================
-- SEED SAMPLE DATA
-- ==========================================

-- We insert fixed UUIDs to reference them below
INSERT INTO bom_master (bom_id, product_name, product_code, version) VALUES 
('11111111-1111-1111-1111-111111111111', 'Electric Car Model X', 'EV-X', 'v1.0'),
('22222222-1111-1111-1111-111111111111', 'SUV Model S', 'SUV-S', 'v1.0'),
('33333333-1111-1111-1111-111111111111', 'Sports Car Model R', 'SPR-R', 'v1.0'),
('44444444-1111-1111-1111-111111111111', 'Compact Hatchback C', 'HTB-C', 'v1.0'),
('55555555-1111-1111-1111-111111111111', 'Luxury Sedan L', 'SED-L', 'v1.0'),
('66666666-1111-1111-1111-111111111111', 'Electric Truck T', 'TRK-T', 'v1.0')
ON CONFLICT DO NOTHING;

INSERT INTO bom_items (bom_id, material_name, part_code, category, qty_per_product) VALUES 
-- Electric Car Model X
('11111111-1111-1111-1111-111111111111', 'Tire', 'TYR-100', 'Wheels', 4),
('11111111-1111-1111-1111-111111111111', 'Battery Pack', 'BAT-200', 'Electrical', 1),
('11111111-1111-1111-1111-111111111111', 'Front Seat', 'SET-101', 'Interior', 2),
('11111111-1111-1111-1111-111111111111', 'Rear Seat', 'SET-102', 'Interior', 3),
('11111111-1111-1111-1111-111111111111', 'Brake Pad', 'BRK-300', 'Brakes', 8),
('11111111-1111-1111-1111-111111111111', 'Steering Wheel', 'STR-400', 'Interior', 1),

-- SUV Model S
('22222222-1111-1111-1111-111111111111', 'SUV Tire', 'TYR-200', 'Wheels', 4),
('22222222-1111-1111-1111-111111111111', 'Engine Assembly', 'ENG-100', 'Powertrain', 1),
('22222222-1111-1111-1111-111111111111', 'Starter Battery', 'BAT-210', 'Electrical', 1),
('22222222-1111-1111-1111-111111111111', 'Door Panel', 'DRP-500', 'Body', 4),
('22222222-1111-1111-1111-111111111111', 'Brake Disc', 'BRD-310', 'Brakes', 4),

-- Sports Car Model R
('33333333-1111-1111-1111-111111111111', 'Performance Tire', 'PTY-110', 'Wheels', 4),
('33333333-1111-1111-1111-111111111111', 'Turbo Engine', 'TEG-220', 'Powertrain', 1),
('33333333-1111-1111-1111-111111111111', 'Racing Seat', 'RST-330', 'Interior', 2),
('33333333-1111-1111-1111-111111111111', 'Carbon Door Panel', 'CDP-440', 'Body', 2),
('33333333-1111-1111-1111-111111111111', 'Carbon Spoiler', 'CSP-880', 'Body', 1),

-- Compact Hatchback C
('44444444-1111-1111-1111-111111111111', 'Standard Tire', 'STY-100', 'Wheels', 4),
('44444444-1111-1111-1111-111111111111', 'Small Engine', 'SME-100', 'Powertrain', 1),
('44444444-1111-1111-1111-111111111111', 'Cloth Seat', 'CLS-100', 'Interior', 5),
('44444444-1111-1111-1111-111111111111', 'Halogen Headlight', 'HLG-100', 'Electrical', 2),
('44444444-1111-1111-1111-111111111111', 'Steel Wheel', 'STW-100', 'Wheels', 4),

-- Luxury Sedan L
('55555555-1111-1111-1111-111111111111', 'Premium Tire', 'PRT-100', 'Wheels', 4),
('55555555-1111-1111-1111-111111111111', 'V6 Engine', 'V6E-100', 'Powertrain', 1),
('55555555-1111-1111-1111-111111111111', 'Leather Seat', 'LTS-100', 'Interior', 5),
('55555555-1111-1111-1111-111111111111', 'Sunroof', 'SNR-100', 'Body', 1),
('55555555-1111-1111-1111-111111111111', 'LED Taillight', 'LDT-100', 'Electrical', 2),

-- Electric Truck T
('66666666-1111-1111-1111-111111111111', 'Off-road Tire', 'OFT-100', 'Wheels', 4),
('66666666-1111-1111-1111-111111111111', 'Heavy Duty Battery', 'HDB-100', 'Electrical', 1),
('66666666-1111-1111-1111-111111111111', 'Truck Bed', 'TRB-100', 'Body', 1),
('66666666-1111-1111-1111-111111111111', 'Reinforced Chassis', 'RFC-100', 'Body', 1),
('66666666-1111-1111-1111-111111111111', 'Tow Hitch', 'TWH-100', 'Body', 1);

INSERT INTO inventory (material_name, part_code, available_stock, warehouse) VALUES 
('Tire', 'TYR-100', 200, 'WH-A'),
('Battery Pack', 'BAT-200', 50, 'WH-B'),
('Front Seat', 'SET-101', 120, 'WH-A'),
('Rear Seat', 'SET-102', 150, 'WH-A'),
('Brake Pad', 'BRK-300', 300, 'WH-A'),
('Steering Wheel', 'STR-400', 60, 'WH-B'),
('SUV Tire', 'TYR-200', 400, 'WH-A'),
('Engine Assembly', 'ENG-100', 10, 'WH-B'),
('Starter Battery', 'BAT-210', 40, 'WH-B'),
('Door Panel', 'DRP-500', 160, 'WH-A'),
('Brake Disc', 'BRD-310', 200, 'WH-A'),
('Performance Tire', 'PTY-110', 80, 'WH-A'),
('Turbo Engine', 'TEG-220', 5, 'WH-B'),
('Racing Seat', 'RST-330', 20, 'WH-A'),
('Carbon Door Panel', 'CDP-440', 20, 'WH-B'),
('Carbon Spoiler', 'CSP-880', 10, 'WH-B'),
('Standard Tire', 'STY-100', 500, 'WH-A'),
('Small Engine', 'SME-100', 45, 'WH-B'),
('Cloth Seat', 'CLS-100', 250, 'WH-A'),
('Halogen Headlight', 'HLG-100', 100, 'WH-B'),
('Steel Wheel', 'STW-100', 200, 'WH-A'),
('Premium Tire', 'PRT-100', 120, 'WH-A'),
('V6 Engine', 'V6E-100', 15, 'WH-B'),
('Leather Seat', 'LTS-100', 75, 'WH-A'),
('Sunroof', 'SNR-100', 30, 'WH-A'),
('LED Taillight', 'LDT-100', 80, 'WH-B'),
('Off-road Tire', 'OFT-100', 160, 'WH-A'),
('Heavy Duty Battery', 'HDB-100', 20, 'WH-B'),
('Truck Bed', 'TRB-100', 40, 'WH-A'),
('Reinforced Chassis', 'RFC-100', 40, 'WH-B'),
('Tow Hitch', 'TWH-100', 60, 'WH-A')
ON CONFLICT DO NOTHING;

-- Insert a sample production plan
INSERT INTO production_plans (plan_id, product_name, bom_id, production_quantity, production_date, priority)
VALUES ('22222222-2222-2222-2222-222222222222', 'Electric Car Model X', '11111111-1111-1111-1111-111111111111', 100, '2026-10-15', 'High')
ON CONFLICT DO NOTHING;

-- Auto-generate some shortage alerts based on calculation (400 required vs 200 available for Tires)
INSERT INTO shortage_alerts (material_name, required_quantity, available_quantity, shortage_quantity, severity) VALUES
('Tire', 400, 200, 200, 'Critical'),
('Battery Pack', 100, 50, 50, 'Critical'),
('Brake Pad', 800, 300, 500, 'Critical');


-- ==========================================
-- 16. MATERIAL LIST TABLE (Master Catalogue)
-- ==========================================

CREATE TABLE IF NOT EXISTS material_list (
    material_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    material_name     TEXT        NOT NULL,
    part_code         TEXT        UNIQUE NOT NULL,
    category          TEXT        NOT NULL,
    sub_category      TEXT,
    unit              TEXT        DEFAULT 'pcs',
    description       TEXT,
    standard_cost     NUMERIC     DEFAULT 0,
    lead_time_days    INTEGER     DEFAULT 14,
    safety_stock_qty  INTEGER     DEFAULT 50,
    applicable_models TEXT,
    status            TEXT        DEFAULT 'Active',
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE material_list DISABLE ROW LEVEL SECURITY;

INSERT INTO material_list
  (material_name, part_code, category, sub_category, unit, description, standard_cost, lead_time_days, safety_stock_qty, applicable_models)
VALUES
-- WHEELS
('Tire',              'TYR-100', 'Wheels', 'Standard Tires',    'pcs', 'Standard passenger car tire for Electric Car Model X',           3500,  10, 100, 'EV-X'),
('SUV Tire',          'TYR-200', 'Wheels', 'SUV Tires',         'pcs', 'Heavy-duty all-terrain tire for SUV Model S',                   4200,  12, 150, 'SUV-S'),
('Performance Tire',  'PTY-110', 'Wheels', 'Performance Tires', 'pcs', 'High-grip performance tire for Sports Car Model R',             7800,  14,  40, 'SPR-R'),
('Standard Tire',     'STY-100', 'Wheels', 'Standard Tires',    'pcs', 'Economy standard tire for Compact Hatchback C',                 2800,   9, 200, 'HTB-C'),
('Premium Tire',      'PRT-100', 'Wheels', 'Premium Tires',     'pcs', 'Premium riding-comfort tire for Luxury Sedan L',                6200,  12,  60, 'SED-L'),
('Off-road Tire',     'OFT-100', 'Wheels', 'Off-Road Tires',    'pcs', 'Reinforced off-road tire for Electric Truck T',                 5500,  14,  80, 'TRK-T'),
('Steel Wheel',       'STW-100', 'Wheels', 'Wheel Rims',        'pcs', 'Standard steel wheel rim for Compact Hatchback C',              1800,   7, 100, 'HTB-C'),
-- ELECTRICAL
('Battery Pack',      'BAT-200', 'Electrical', 'EV Batteries',       'pcs', 'High-capacity lithium-ion battery pack for EV Model X',  180000, 21,  30, 'EV-X'),
('Starter Battery',   'BAT-210', 'Electrical', 'Lead-Acid Batteries','pcs', '12V lead-acid starter battery for SUV Model S',            4500,   7,  20, 'SUV-S'),
('Heavy Duty Battery','HDB-100', 'Electrical', 'EV Batteries',       'pcs', 'High-voltage heavy-duty battery pack for Electric Truck T',250000, 25,  10, 'TRK-T'),
('Halogen Headlight', 'HLG-100', 'Electrical', 'Lighting',           'pcs', 'Standard halogen headlight assembly for Hatchback C',       2200,   8,  50, 'HTB-C'),
('LED Taillight',     'LDT-100', 'Electrical', 'Lighting',           'pcs', 'LED taillight cluster for Luxury Sedan L',                  3800,  10,  40, 'SED-L'),
-- INTERIOR
('Front Seat',        'SET-101', 'Interior', 'Seats',    'pcs', 'Standard fabric front seat assembly for EV Model X',          8500,  14,  60, 'EV-X'),
('Rear Seat',         'SET-102', 'Interior', 'Seats',    'pcs', 'Three-piece rear bench seat for EV Model X',                  7200,  14,  75, 'EV-X'),
('Racing Seat',       'RST-330', 'Interior', 'Seats',    'pcs', 'Bucket racing seat with harness mount for Sports Car R',    18000,  21,  10, 'SPR-R'),
('Cloth Seat',        'CLS-100', 'Interior', 'Seats',    'pcs', 'Economy cloth seat set for Compact Hatchback C',               5500,  12, 100, 'HTB-C'),
('Leather Seat',      'LTS-100', 'Interior', 'Seats',    'pcs', 'Premium full-leather seat with heating for Luxury Sedan L',  22000,  21,  30, 'SED-L'),
('Steering Wheel',    'STR-400', 'Interior', 'Controls', 'pcs', 'Multi-function steering wheel with mounted controls',          4800,  10,  30, 'EV-X'),
('Sunroof',           'SNR-100', 'Interior', 'Roof Systems', 'pcs', 'Panoramic glass sunroof panel for Luxury Sedan L',        15000,  18,  15, 'SED-L'),
-- BRAKES
('Brake Pad',         'BRK-300', 'Brakes', 'Friction Components', 'pcs', 'Standard ceramic brake pad set for EV Model X',   1200,  7, 150, 'EV-X'),
('Brake Disc',        'BRD-310', 'Brakes', 'Rotors',              'pcs', 'Ventilated brake disc rotor for SUV Model S',       3200,  8, 100, 'SUV-S'),
-- POWERTRAIN
('Engine Assembly',   'ENG-100', 'Powertrain', 'Engines', 'pcs', 'Complete internal combustion engine assembly for SUV S',  95000, 30,  5, 'SUV-S'),
('Turbo Engine',      'TEG-220', 'Powertrain', 'Engines', 'pcs', 'Turbocharged high-performance engine for Sports Car R',  145000, 35,  3, 'SPR-R'),
('Small Engine',      'SME-100', 'Powertrain', 'Engines', 'pcs', 'Compact fuel-efficient engine for Hatchback C',            55000, 25,  8, 'HTB-C'),
('V6 Engine',         'V6E-100', 'Powertrain', 'Engines', 'pcs', 'V6 petrol engine for Luxury Sedan L',                     115000, 30,  5, 'SED-L'),
-- BODY
('Door Panel',        'DRP-500', 'Body', 'Panels',     'pcs', 'Stamped steel door panel for SUV Model S',                   6500,  12,  80, 'SUV-S'),
('Carbon Door Panel', 'CDP-440', 'Body', 'Panels',     'pcs', 'Lightweight CFRP door panel for Sports Car R',              28000,  21,  10, 'SPR-R'),
('Carbon Spoiler',    'CSP-880', 'Body', 'Aero Parts', 'pcs', 'Rear carbon fibre aerodynamic spoiler for Sports Car R',   18500,  18,   8, 'SPR-R'),
-- CHASSIS
('Truck Bed',          'TRB-100', 'Chassis', 'Structural', 'pcs', 'Heavy-duty load bed for Electric Truck T',               35000,  20,  20, 'TRK-T'),
('Reinforced Chassis', 'RFC-100', 'Chassis', 'Structural', 'pcs', 'High-strength steel ladder chassis for Electric Truck T', 72000, 28,  10, 'TRK-T'),
('Tow Hitch',          'TWH-100', 'Chassis', 'Towing',    'pcs', 'Class-IV tow hitch receiver for Electric Truck T',         8200,  10,  30, 'TRK-T')
ON CONFLICT (part_code) DO NOTHING;

