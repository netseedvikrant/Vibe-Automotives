-- Migrate existing programs that have already completed Gate 5
-- into the newly created serial_production_releases table.

INSERT INTO serial_production_releases (program_id, approved_by, signature_hash, released_at)
SELECT 
    g.program_id,
    'Chief Engineer' AS approved_by,
    
    -- Attempt to grab the original e-signature hash if it exists
    COALESCE(
        (SELECT signature_hash FROM approvals a 
         WHERE a.target_id = g.program_id 
           AND a.target_type = 'GATE_5' 
           AND a.status = 'Approved' 
         ORDER BY a.verified_timestamp DESC LIMIT 1),
        'MIGRATED_LEGACY_RELEASE'
    ) AS signature_hash,
    
    -- Use the approval timestamp, fallback to gate update time or now
    COALESCE(
        (SELECT verified_timestamp FROM approvals a 
         WHERE a.target_id = g.program_id 
           AND a.target_type = 'GATE_5' 
           AND a.status = 'Approved' 
         ORDER BY a.verified_timestamp DESC LIMIT 1),
        g.approval_timestamp,
        NOW()
    ) AS released_at

FROM apqp_gates g
WHERE g.gate_number = 5 
  AND g.gate_status = 'Completed'
  
  -- Ensure we don't accidentally insert duplicates if run multiple times
  AND NOT EXISTS (
      SELECT 1 FROM serial_production_releases s 
      WHERE s.program_id = g.program_id
  );
