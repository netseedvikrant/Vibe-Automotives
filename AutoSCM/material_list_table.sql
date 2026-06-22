-- ==========================================
-- MATERIAL LIST TABLE
-- AutoSCM — Master Material Catalogue
-- ==========================================

CREATE TABLE IF NOT EXISTS material_list (
    material_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    material_name     TEXT        NOT NULL,
    part_code         TEXT        UNIQUE NOT NULL,
    category          TEXT        NOT NULL,   -- Wheels | Electrical | Interior | Brakes | Powertrain | Body | Chassis
    sub_category      TEXT,                   -- optional finer grouping
    unit              TEXT        DEFAULT 'pcs',
    description       TEXT,
    standard_cost     NUMERIC     DEFAULT 0,  -- base unit cost (INR)
    lead_time_days    INTEGER     DEFAULT 14,
    safety_stock_qty  INTEGER     DEFAULT 50,
    applicable_models TEXT,                   -- e.g. 'EV-X, SUV-S'
    status            TEXT        DEFAULT 'Active',  -- Active | Discontinued | Under Review
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE material_list DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- SEED DATA — All 31 Materials
-- ==========================================

INSERT INTO material_list
  (material_name, part_code, category, sub_category, unit, description, standard_cost, lead_time_days, safety_stock_qty, applicable_models)
VALUES

-- WHEELS
('Tire',              'TYR-100', 'Wheels', 'Standard Tires',    'pcs', 'Standard passenger car tire for Electric Car Model X',          3500,  10, 100, 'EV-X'),
('SUV Tire',          'TYR-200', 'Wheels', 'SUV Tires',         'pcs', 'Heavy-duty all-terrain tire for SUV Model S',                  4200,  12, 150, 'SUV-S'),
('Performance Tire',  'PTY-110', 'Wheels', 'Performance Tires', 'pcs', 'High-grip performance tire for Sports Car Model R',            7800,  14,  40, 'SPR-R'),
('Standard Tire',     'STY-100', 'Wheels', 'Standard Tires',    'pcs', 'Economy standard tire for Compact Hatchback C',               2800,   9, 200, 'HTB-C'),
('Premium Tire',      'PRT-100', 'Wheels', 'Premium Tires',     'pcs', 'Premium riding-comfort tire for Luxury Sedan L',              6200,  12,  60, 'SED-L'),
('Off-road Tire',     'OFT-100', 'Wheels', 'Off-Road Tires',    'pcs', 'Reinforced off-road tire for Electric Truck T',               5500,  14,  80, 'TRK-T'),
('Steel Wheel',       'STW-100', 'Wheels', 'Wheel Rims',        'pcs', 'Standard steel wheel rim for Compact Hatchback C',            1800,   7, 100, 'HTB-C'),

-- ELECTRICAL
('Battery Pack',      'BAT-200', 'Electrical', 'EV Batteries',      'pcs', 'High-capacity lithium-ion battery pack for EV Model X',   180000, 21,  30, 'EV-X'),
('Starter Battery',   'BAT-210', 'Electrical', 'Lead-Acid Batteries','pcs', '12V lead-acid starter battery for SUV Model S',           4500,   7,  20, 'SUV-S'),
('Heavy Duty Battery','HDB-100', 'Electrical', 'EV Batteries',      'pcs', 'High-voltage heavy-duty battery pack for Electric Truck T',250000, 25,  10, 'TRK-T'),
('Halogen Headlight', 'HLG-100', 'Electrical', 'Lighting',          'pcs', 'Standard halogen headlight assembly for Hatchback C',      2200,   8,  50, 'HTB-C'),
('LED Taillight',     'LDT-100', 'Electrical', 'Lighting',          'pcs', 'LED taillight cluster for Luxury Sedan L',                 3800,  10,  40, 'SED-L'),

-- INTERIOR
('Front Seat',        'SET-101', 'Interior', 'Seats', 'pcs', 'Standard fabric front seat assembly for EV Model X',         8500,  14,  60, 'EV-X'),
('Rear Seat',         'SET-102', 'Interior', 'Seats', 'pcs', 'Three-piece rear bench seat for EV Model X',                 7200,  14,  75, 'EV-X'),
('Racing Seat',       'RST-330', 'Interior', 'Seats', 'pcs', 'Bucket racing seat with harness mount for Sports Car R',   18000,  21,  10, 'SPR-R'),
('Cloth Seat',        'CLS-100', 'Interior', 'Seats', 'pcs', 'Economy cloth seat set for Compact Hatchback C',             5500,  12, 100, 'HTB-C'),
('Leather Seat',      'LTS-100', 'Interior', 'Seats', 'pcs', 'Premium full-leather seat with heating for Luxury Sedan L', 22000,  21,  30, 'SED-L'),
('Steering Wheel',    'STR-400', 'Interior', 'Controls', 'pcs', 'Multi-function steering wheel with mounted controls',      4800,  10,  30, 'EV-X'),
('Sunroof',           'SNR-100', 'Interior', 'Roof Systems', 'pcs', 'Panoramic glass sunroof panel for Luxury Sedan L',   15000,  18,  15, 'SED-L'),

-- BRAKES
('Brake Pad',         'BRK-300', 'Brakes', 'Friction Components', 'pcs', 'Standard ceramic brake pad set for EV Model X',   1200,   7, 150, 'EV-X'),
('Brake Disc',        'BRD-310', 'Brakes', 'Rotors',              'pcs', 'Ventilated brake disc rotor for SUV Model S',       3200,   8, 100, 'SUV-S'),

-- POWERTRAIN
('Engine Assembly',   'ENG-100', 'Powertrain', 'Engines',        'pcs', 'Complete internal combustion engine assembly for SUV S', 95000, 30,  5, 'SUV-S'),
('Turbo Engine',      'TEG-220', 'Powertrain', 'Engines',        'pcs', 'Turbocharged high-performance engine for Sports Car R', 145000, 35,  3, 'SPR-R'),
('Small Engine',      'SME-100', 'Powertrain', 'Engines',        'pcs', 'Compact fuel-efficient engine for Hatchback C',         55000, 25,  8, 'HTB-C'),
('V6 Engine',         'V6E-100', 'Powertrain', 'Engines',        'pcs', 'V6 petrol engine for Luxury Sedan L',                 115000, 30,  5, 'SED-L'),

-- BODY
('Door Panel',        'DRP-500', 'Body', 'Panels',    'pcs', 'Stamped steel door panel for SUV Model S',                   6500,  12,  80, 'SUV-S'),
('Carbon Door Panel', 'CDP-440', 'Body', 'Panels',    'pcs', 'Lightweight CFRP door panel for Sports Car R',              28000,  21,  10, 'SPR-R'),
('Carbon Spoiler',    'CSP-880', 'Body', 'Aero Parts','pcs', 'Rear carbon fibre aerodynamic spoiler for Sports Car R',    18500,  18,   8, 'SPR-R'),

-- CHASSIS
('Truck Bed',          'TRB-100', 'Chassis', 'Structural', 'pcs', 'Heavy-duty load bed for Electric Truck T',              35000,  20,  20, 'TRK-T'),
('Reinforced Chassis', 'RFC-100', 'Chassis', 'Structural', 'pcs', 'High-strength steel ladder chassis for Electric Truck T',72000, 28,  10, 'TRK-T'),
('Tow Hitch',          'TWH-100', 'Chassis', 'Towing',     'pcs', 'Class-IV tow hitch receiver for Electric Truck T',       8200,  10,  30, 'TRK-T')

ON CONFLICT (part_code) DO NOTHING;

-- ==========================================
-- QUICK VIEW — verify insert
-- ==========================================
-- SELECT category, COUNT(*) as total FROM material_list GROUP BY category ORDER BY total DESC;
