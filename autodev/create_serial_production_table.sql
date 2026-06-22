-- Table to track programs released for serial production at Gate 5
CREATE TABLE serial_production_releases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    approved_by TEXT,
    signature_hash TEXT,
    released_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE serial_production_releases ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access to authenticated users" 
ON serial_production_releases FOR SELECT 
TO authenticated 
USING (true);

-- Allow insert access for authenticated users
CREATE POLICY "Allow insert access to authenticated users" 
ON serial_production_releases FOR INSERT 
TO authenticated 
WITH CHECK (true);
