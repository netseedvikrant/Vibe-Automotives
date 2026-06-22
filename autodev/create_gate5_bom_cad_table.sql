-- 1. Create the dedicated Table for BOM and CAD for Gate 5 approved programs
CREATE TABLE IF NOT EXISTS gate5_bom_cad_handoffs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE UNIQUE,
    program_name TEXT,
    ebom_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    cad_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'Pending Transfer',
    released_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE gate5_bom_cad_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users on gate5_bom_cad_handoffs" 
ON gate5_bom_cad_handoffs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert access to authenticated users on gate5_bom_cad_handoffs" 
ON gate5_bom_cad_handoffs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update access to authenticated users on gate5_bom_cad_handoffs" 
ON gate5_bom_cad_handoffs FOR UPDATE TO authenticated USING (true);


-- 3. Automatically aggregate and insert all Gate 5 approved programs 
--    into the new handoff table as JSON payloads.
INSERT INTO gate5_bom_cad_handoffs (
    program_id, 
    program_name,
    ebom_payload, 
    cad_payload, 
    released_at
)
SELECT 
    p.id,
    p.program_name,
    
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
    
    -- Aggregate all CAD models into a single JSON array
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'file_name', c.file_name,
            'file_url', c.file_url,
            'version', c.version,
            'status', c.status,
            'description', c.description
        )) 
        FROM cad_files c WHERE c.program_id = p.id
    ), '[]'::jsonb) AS cad_payload,
    
    -- Timestamps
    COALESCE(
        g.approval_timestamp,
        NOW()
    ) AS released_at

FROM programs p
JOIN apqp_gates g ON p.id = g.program_id
WHERE g.gate_number = 5 AND g.gate_status = 'Completed'
ON CONFLICT (program_id) DO NOTHING;
