-- ========================================================
-- AUTO DEV PHASE 1: DATABASE & STORAGE SCHEMA UPGRADE
-- ========================================================

-- 1. Create Storage Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('cad_models', 'cad_models', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('ppap_documents', 'ppap_documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Relax Storage Security Policies for Development Upload/Download
DROP POLICY IF EXISTS "Allow public read access to cad_models" ON storage.objects;
DROP POLICY IF EXISTS "Allow public write access to cad_models" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to ppap_documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public write access to ppap_documents" ON storage.objects;
DROP POLICY IF EXISTS "Global Allow All on Objects" ON storage.objects;

CREATE POLICY "Global Allow All on Objects" ON storage.objects FOR ALL USING (true) WITH CHECK (true);

-- 3. Upgrade EBOM schema
ALTER TABLE public.ebom ADD COLUMN IF NOT EXISTS drawing_number text;
ALTER TABLE public.ebom ADD COLUMN IF NOT EXISTS uom text DEFAULT 'pcs';
ALTER TABLE public.ebom ADD COLUMN IF NOT EXISTS bom_type text DEFAULT 'EBOM' CHECK (bom_type IN ('EBOM', 'MBOM'));
ALTER TABLE public.ebom ADD COLUMN IF NOT EXISTS status text DEFAULT 'Draft' CHECK (status IN ('Draft', 'Under Review', 'Approved', 'Released', 'Under Review (ECO)'));

-- 4. Create trigger to automatically raise ECN/ECO on post-freeze edits
CREATE OR REPLACE FUNCTION public.trg_ebom_change_after_freeze()
RETURNS TRIGGER AS $$
DECLARE
    is_gate_1_frozen boolean := false;
BEGIN
    -- Check if Gate 1 (Design Freeze) is Completed for this program
    SELECT EXISTS (
        SELECT 1 FROM public.apqp_gates
        WHERE program_id = COALESCE(NEW.program_id, OLD.program_id)
          AND gate_number = 1
          AND gate_status = 'Completed'
    ) INTO is_gate_1_frozen;

    IF is_gate_1_frozen THEN
        -- Auto-trigger ECN/ECO
        INSERT INTO public.eco_requests (
            program_id,
            title,
            description,
            reason,
            priority,
            status,
            requested_by
        ) VALUES (
            COALESCE(NEW.program_id, OLD.program_id),
            'Automated ECO: BOM Revision after Design Freeze',
            'Automated change detection: Part ' || COALESCE(NEW.part_number, OLD.part_number) || ' (' || COALESCE(NEW.part_name, OLD.part_name) || ') was modified/added after Gate 1 Design Freeze.',
            'Post-freeze BOM modification',
            'Normal',
            'Pending',
            COALESCE(NEW.supplier_id, '00000000-0000-0000-0000-000000000000'::uuid) -- Fallback system uuid or NULL
        );

        -- Override the status to 'Under Review (ECO)'
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
            NEW.status := 'Under Review (ECO)';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ebom_modification_monitor ON public.ebom;
CREATE TRIGGER trg_ebom_modification_monitor
BEFORE INSERT OR UPDATE OR DELETE ON public.ebom
FOR EACH ROW EXECUTE FUNCTION public.trg_ebom_change_after_freeze();

NOTIFY pgrst, 'reload schema';
