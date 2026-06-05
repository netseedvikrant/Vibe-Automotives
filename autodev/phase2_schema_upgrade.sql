-- ========================================================
-- AUTO DEV PHASE 2: DVP&R DATABASE & TRIGGER UPGRADES
-- ========================================================

-- 1. Upgrade dvpr_records Schema
ALTER TABLE public.dvpr_records ADD COLUMN IF NOT EXISTS test_item text;
ALTER TABLE public.dvpr_records ADD COLUMN IF NOT EXISTS test_method text;
ALTER TABLE public.dvpr_records ADD COLUMN IF NOT EXISTS acceptance_criteria text;
ALTER TABLE public.dvpr_records ADD COLUMN IF NOT EXISTS sample_size integer DEFAULT 1;
ALTER TABLE public.dvpr_records ADD COLUMN IF NOT EXISTS completion_date timestamp with time zone;
ALTER TABLE public.dvpr_records ADD COLUMN IF NOT EXISTS signoff_status text DEFAULT 'Pending' CHECK (signoff_status IN ('Pending', 'Signed Off'));
ALTER TABLE public.dvpr_records ADD COLUMN IF NOT EXISTS result text DEFAULT 'Pending' CHECK (result IN ('Pass', 'Fail', 'Pending'));
ALTER TABLE public.dvpr_records ADD COLUMN IF NOT EXISTS validation_test_id uuid REFERENCES public.validation_tests(id) ON DELETE SET NULL;

-- 2. DVP&R Auto-Generation Trigger based on vehicle_category when moving to Feasibility
CREATE OR REPLACE FUNCTION public.trg_generate_dvpr_records()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if status changed to 'Feasibility' (or inserted as 'Feasibility')
    IF (TG_OP = 'INSERT' AND NEW.status = 'Feasibility') OR 
       (TG_OP = 'UPDATE' AND NEW.status = 'Feasibility' AND (OLD.status IS NULL OR OLD.status <> 'Feasibility')) THEN
        
        -- Insert DVP&R items based on vehicle_category
        IF NEW.vehicle_category IN ('BEV', 'EV') THEN
            INSERT INTO public.dvpr_records (program_id, test_item, test_method, acceptance_criteria, sample_size, status, signoff_status, result)
            VALUES 
            (NEW.id, 'Thermal Runaway Safety Test', 'UN ECE R100', 'No fire, explosion, or gas leakage for 1 hour after cell puncture', 3, 'Draft', 'Pending', 'Pending'),
            (NEW.id, 'Battery Pack Crash Integrity', 'ISO 12405', 'Insulation resistance > 100 ohms/V post-impact', 2, 'Draft', 'Pending', 'Pending'),
            (NEW.id, 'High Voltage Isolation Assessment', 'FMVSS 305', 'HV Isolation resistance > 500 ohms/V under wet conditions', 5, 'Draft', 'Pending', 'Pending'),
            (NEW.id, 'Regenerative Braking Performance', 'ECE R13H', 'Deceleration rate >= 0.3g during regen braking', 3, 'Draft', 'Pending', 'Pending');
        ELSIF NEW.vehicle_category = 'ICE' THEN
            INSERT INTO public.dvpr_records (program_id, test_item, test_method, acceptance_criteria, sample_size, status, signoff_status, result)
            VALUES 
            (NEW.id, 'Tailpipe Emissions Test', 'WLTP Cycle', 'CO < 1.0g/km, NOx < 0.08g/km, PM < 4.5mg/km', 10, 'Draft', 'Pending', 'Pending'),
            (NEW.id, 'Fuel System Leakage & Integrity', 'FMVSS 301', 'Zero fuel loss after crash impact', 3, 'Draft', 'Pending', 'Pending'),
            (NEW.id, 'Engine Durability Verification', '500-hour dynamometer', 'Power drop < 5%, zero coolant or oil leaks', 2, 'Draft', 'Pending', 'Pending'),
            (NEW.id, 'EGR Flow Response Test', 'ISO 15031', 'EGR valve response time within 200ms', 5, 'Draft', 'Pending', 'Pending');
        ELSIF NEW.vehicle_category IN ('HEV', 'PHEV') THEN
            INSERT INTO public.dvpr_records (program_id, test_item, test_method, acceptance_criteria, sample_size, status, signoff_status, result)
            VALUES 
            (NEW.id, 'High Voltage Isolation Assessment', 'FMVSS 305', 'HV Isolation resistance > 500 ohms/V under wet conditions', 5, 'Draft', 'Pending', 'Pending'),
            (NEW.id, 'Hybrid Mode Transition Smoothness', 'CES-HYB-01', 'Smooth engine start and power handover transition < 150ms', 4, 'Draft', 'Pending', 'Pending'),
            (NEW.id, 'Fuel System Leakage & Integrity', 'FMVSS 301', 'Zero fuel loss after crash impact', 3, 'Draft', 'Pending', 'Pending'),
            (NEW.id, 'Battery Pack Thermal Management', 'ISO 12405-2', 'Max temperature variance across cells < 5°C under peak load', 2, 'Draft', 'Pending', 'Pending');
        ELSE
            -- Generic vehicle testing requirements
            INSERT INTO public.dvpr_records (program_id, test_item, test_method, acceptance_criteria, sample_size, status, signoff_status, result)
            VALUES 
            (NEW.id, 'Structural Crash Test', 'Euro NCAP', '5-star safety rating and zero passenger cabin intrusion', 2, 'Draft', 'Pending', 'Pending'),
            (NEW.id, 'Bumper Impact Performance', 'ECE R42', 'No structural damage to core safety systems under low-speed impact', 5, 'Draft', 'Pending', 'Pending'),
            (NEW.id, 'Environmental Climate Chamber Test', 'ISO 16750-4', 'Full electronic functionality verified from -40°C to +85°C', 4, 'Draft', 'Pending', 'Pending'),
            (NEW.id, 'Electromagnetic Compatibility (EMC)', 'CISPR 25', 'No interference with dashboard displays; Class 3 limits met', 3, 'Draft', 'Pending', 'Pending');
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_generate_dvpr ON public.programs;
CREATE TRIGGER trg_auto_generate_dvpr
AFTER INSERT OR UPDATE ON public.programs
FOR EACH ROW EXECUTE FUNCTION public.trg_generate_dvpr_records();

-- 3. Automatic Status Sync: Validation Test to DVP&R result
CREATE OR REPLACE FUNCTION public.trg_sync_dvpr_result()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Passed' THEN
        UPDATE public.dvpr_records
        SET result = 'Pass',
            completion_date = timezone('utc'::text, now())
        WHERE validation_test_id = NEW.id;
    ELSIF NEW.status = 'Failed' THEN
        UPDATE public.dvpr_records
        SET result = 'Fail',
            completion_date = timezone('utc'::text, now())
        WHERE validation_test_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validation_status_sync ON public.validation_tests;
CREATE TRIGGER trg_validation_status_sync
AFTER UPDATE OF status ON public.validation_tests
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_dvpr_result();

NOTIFY pgrst, 'reload schema';
