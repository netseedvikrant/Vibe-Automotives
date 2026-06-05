-- ==========================================
-- VIBE ENTERPRISE: Cross-Module Bridges & ASPICE Compliance (Phases 3 & 5)
-- ==========================================
-- INSTRUCTIONS: Run this in your Supabase SQL Editor. 
-- Adjust table names as necessary to match your exact schema.

-- ==========================================
-- PHASE 3: Strict ASPICE Compliance Enforcement (AutoDev)
-- ==========================================
-- Prevents Chief Engineer from approving Gate 2-5 if validation tests are not 'Passed'

CREATE OR REPLACE FUNCTION check_aspice_compliance()
RETURNS TRIGGER AS $$
DECLARE
    failed_tests INTEGER;
BEGIN
    -- Only check if the gate is being marked as 'Approved'
    IF NEW.status = 'Approved' AND NEW.gate_number >= 2 THEN
        
        -- Count how many tests associated with this gate's program are NOT 'Passed'
        SELECT COUNT(*) INTO failed_tests
        FROM validation_tests
        WHERE program_id = NEW.program_id 
          AND gate_requirement = NEW.gate_number
          AND status != 'Passed';
          
        IF failed_tests > 0 THEN
            RAISE EXCEPTION 'ASPICE Compliance Block: Cannot approve Gate % because % required validation tests are not in Passed status.', NEW.gate_number, failed_tests;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Trigger to AutoDev gates table
DROP TRIGGER IF EXISTS aspice_gate_enforcement ON apqp_gates;
CREATE TRIGGER aspice_gate_enforcement
BEFORE UPDATE ON apqp_gates
FOR EACH ROW EXECUTE FUNCTION check_aspice_compliance();


-- ==========================================
-- PHASE 5: Automated Cross-Module Database Bridges
-- ==========================================

-- ------------------------------------------
-- Bridge 1: Design-to-Procurement (AutoDev -> AutoSCM)
-- Automatically generate a Purchase Requisition in AutoSCM when an EBOM is Approved
-- ------------------------------------------
CREATE OR REPLACE FUNCTION generate_pr_from_ebom()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Approved' AND OLD.status != 'Approved' THEN
        -- Insert a Draft PR into AutoSCM purchase_requisitions table
        INSERT INTO purchase_requisitions (
            title, 
            department, 
            estimated_cost, 
            status, 
            notes
        ) VALUES (
            'Auto-PR: Initial Procurement for EBOM ' || NEW.product_code,
            'AutoDev R&D',
            50000.00, -- Default budgetary estimate
            'Draft',
            'Automatically generated from AutoDev EBOM Freeze (Gate 1). Please review quantities and routing.'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_pr_from_ebom ON ebom;
CREATE TRIGGER trg_generate_pr_from_ebom
AFTER UPDATE ON ebom
FOR EACH ROW EXECUTE FUNCTION generate_pr_from_ebom();


-- ------------------------------------------
-- Bridge 2 & 3: Scrap-to-CAPA Penalty (AutoMFG -> AutoSCM)
-- When a scrap defect is logged against a supplier in AutoMFG, deduct 5 points.
-- If score drops below 90, open a CAPA (Corrective Action) notification.
-- ------------------------------------------
CREATE OR REPLACE FUNCTION penalize_supplier_for_scrap()
RETURNS TRIGGER AS $$
DECLARE
    current_score INTEGER;
BEGIN
    IF NEW.supplier_id IS NOT NULL THEN
        -- Deduct 5 points from Supplier AVL scorecard
        UPDATE suppliers 
        SET rating = rating - 5 
        WHERE id = NEW.supplier_id 
        RETURNING rating INTO current_score;
        
        -- Bridge 3: If score drops below 90, trigger CAPA alert for SQE
        IF current_score < 90 THEN
            INSERT INTO notifications (
                recipient_role, 
                message, 
                type, 
                read
            ) VALUES (
                'supplier_quality_engineer',
                'CAPA ALERT: Supplier ' || NEW.supplier_id || ' rating dropped to ' || current_score || ' due to manufacturing scrap defect logging.',
                'CAPA_ALERT',
                FALSE
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Assuming AutoMFG logs scrap in 'defect_records' table
DROP TRIGGER IF EXISTS trg_scrap_penalty ON defect_records;
CREATE TRIGGER trg_scrap_penalty
AFTER INSERT ON defect_records
FOR EACH ROW EXECUTE FUNCTION penalize_supplier_for_scrap();


-- ------------------------------------------
-- Bridge 4: Tooling-to-Procurement (AutoMFG -> AutoSCM)
-- When tool life > 95%, auto-generate replacement PR.
-- ------------------------------------------
CREATE OR REPLACE FUNCTION generate_tool_replacement_pr()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.life_percentage >= 95 AND OLD.life_percentage < 95 THEN
        INSERT INTO purchase_requisitions (
            title, 
            department, 
            status, 
            notes
        ) VALUES (
            'URGENT: Tooling Replacement PR for ' || NEW.tool_name,
            'AutoMFG Maintenance',
            'Draft',
            'Automated requisition. Tool ' || NEW.tool_name || ' has exceeded 95% of its lifecycle on the assembly line.'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Assuming AutoMFG tracks tools in 'tools' table
DROP TRIGGER IF EXISTS trg_tool_replacement ON tools;
CREATE TRIGGER trg_tool_replacement
AFTER UPDATE ON tools
FOR EACH ROW EXECUTE FUNCTION generate_tool_replacement_pr();
