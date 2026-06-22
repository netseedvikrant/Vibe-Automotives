-- 1. Create the dedicated SCM Handoff Table
CREATE TABLE autoscm_handoffs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE UNIQUE,
    target_launch_date DATE,
    ebom_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    ppap_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    eco_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'Pending SCM Transfer',
    released_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE autoscm_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users" 
ON autoscm_handoffs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert access to authenticated users" 
ON autoscm_handoffs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update access to authenticated users" 
ON autoscm_handoffs FOR UPDATE TO authenticated USING (true);


-- 3. Automatically aggregate and insert all Gate 5 approved programs 
--    into the new handoff table as JSON payloads.
INSERT INTO autoscm_handoffs (
    program_id, 
    target_launch_date, 
    ebom_payload, 
    ppap_payload, 
    eco_payload, 
    released_at
)
SELECT 
    p.id,
    p.target_launch_date,
    
    -- Aggregate all eBOM parts into a single JSON array
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'part_number', e.part_number,
            'part_name', e.part_name,
            'revision', e.revision,
            'quantity', e.quantity,
            'material', e.material,
            'drawing_number', e.drawing_number,
            'uom', e.uom
        )) 
        FROM ebom e WHERE e.program_id = p.id
    ), '[]'::jsonb) AS ebom_payload,
    
    -- Aggregate all Approved Suppliers (PPAP) into a single JSON array
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'supplier_name', pp.supplier_name,
            'submission_level', pp.submission_level,
            'status', pp.status,
            'psw_url', pp.psw_url
        )) 
        FROM ppap_submissions pp WHERE pp.program_id = p.id AND pp.status = 'Approved'
    ), '[]'::jsonb) AS ppap_payload,
    
    -- Aggregate all Approved Engineering Change Orders (ECOs)
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'eco_id', ec.id,
            'title', ec.title,
            'status', ec.status
        )) 
        FROM eco_requests ec WHERE ec.program_id = p.id AND ec.status = 'Approved'
    ), '[]'::jsonb) AS eco_payload,
    
    -- Timestamps
    COALESCE(
        g.approval_timestamp,
        NOW()
    ) AS released_at

FROM programs p
JOIN apqp_gates g ON p.id = g.program_id
WHERE g.gate_number = 5 AND g.gate_status = 'Completed'
ON CONFLICT (program_id) DO NOTHING;
