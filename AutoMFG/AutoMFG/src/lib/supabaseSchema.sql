-- AutoMFG — Supabase Schema (fixed)
-- Run in Supabase SQL Editor — paste all at once
-- KEY FIX: Removed public.users shadow table.
--   All user FKs now reference auth.users(id) directly.
--   A "profiles" table stores display metadata only.
-- ============================================================

-- ── PROFILES (mirrors auth.users, no shadow table) ────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  plant TEXT DEFAULT 'Plant A',
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    split_part(NEW.email, '@', 1)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── RBAC ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS permissions (
  permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  scope TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID REFERENCES roles(role_id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(permission_id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(role_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS user_plant_access (
  access_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_id UUID,
  data_scope TEXT DEFAULT 'assigned'
);

-- ── SESSIONS & AUDIT ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  terminal TEXT,
  device TEXT,
  login_time TIMESTAMPTZ DEFAULT now(),
  logout_time TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity TEXT,
  action TEXT,
  payload JSONB,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- ── PLANT MASTER ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plants (
  plant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata'
);

CREATE TABLE IF NOT EXISTS production_lines (
  line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES plants(plant_id),
  line_name TEXT NOT NULL,
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS shifts (
  shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES plants(plant_id),
  shift_name TEXT,
  start_time TIME,
  end_time TIME
);

CREATE TABLE IF NOT EXISTS work_centers (
  work_center_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID REFERENCES production_lines(line_id),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_center_calendars (
  calendar_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_center_id UUID REFERENCES work_centers(work_center_id),
  date DATE,
  capacity_minutes INT
);

CREATE TABLE IF NOT EXISTS stations (
  station_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID REFERENCES production_lines(line_id),
  work_center_id UUID REFERENCES work_centers(work_center_id),
  station_name TEXT NOT NULL,
  sequence_no INT
);

CREATE TABLE IF NOT EXISTS machines (
  machine_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID REFERENCES production_lines(line_id),
  station_id UUID REFERENCES stations(station_id),
  machine_name TEXT,
  status TEXT DEFAULT 'running'
    CHECK (status IN ('running','breakdown','maintenance','idle'))
);

-- ── TRACEABILITY ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS part_master (
  part_number TEXT PRIMARY KEY,
  model TEXT,
  variant TEXT,
  uom TEXT DEFAULT 'EA'
);

CREATE TABLE IF NOT EXISTS vin_units (
  vin TEXT PRIMARY KEY,
  part_number TEXT REFERENCES part_master(part_number),
  current_status TEXT DEFAULT 'planned'
);

-- ── PRODUCTION PLANNING ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS demand_orders (
  demand_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT DEFAULT 'SAP',
  part_number TEXT REFERENCES part_master(part_number),
  qty INT,
  required_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_plans (
  plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES plants(plant_id),
  line_id UUID REFERENCES production_lines(line_id),
  part_number TEXT REFERENCES part_master(part_number),
  vin_range TEXT,
  planned_qty INT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','frozen')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_availability_checks (
  material_check_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES production_plans(plan_id),
  status TEXT,
  checked_at TIMESTAMPTZ DEFAULT now(),
  shortage_details JSONB
);

CREATE TABLE IF NOT EXISTS capacity_checks (
  capacity_check_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES production_plans(plan_id),
  utilization_pct NUMERIC(5,2),
  result TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_approvals (
  approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES production_plans(plan_id),
  approver_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision TEXT CHECK (decision IN ('approved','rejected')),
  comments TEXT,
  decided_at TIMESTAMPTZ DEFAULT now()
);

-- ── WORK ORDERS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_orders (
  wo_number TEXT PRIMARY KEY,
  plan_id UUID REFERENCES production_plans(plan_id),
  plant_id UUID REFERENCES plants(plant_id),
  line_id UUID REFERENCES production_lines(line_id),
  part_number TEXT REFERENCES part_master(part_number),
  vin TEXT REFERENCES vin_units(vin),
  planned_qty INT,
  actual_qty INT DEFAULT 0,
  scrap_qty INT DEFAULT 0,
  status TEXT DEFAULT 'created'
    CHECK (status IN ('created','released','in_progress','completed','closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  released_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS work_order_operations (
  operation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number TEXT REFERENCES work_orders(wo_number),
  operation_no INT,
  work_center_id UUID REFERENCES work_centers(work_center_id),
  standard_time_min NUMERIC(8,2),
  routing_seq INT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS material_issues (
  issue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number TEXT REFERENCES work_orders(wo_number),
  part_number TEXT,
  issued_qty INT,
  issued_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_postings (
  posting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number TEXT REFERENCES work_orders(wo_number),
  finished_qty INT,
  erp_ref TEXT,
  posted_at TIMESTAMPTZ DEFAULT now()
);

-- ── SHOP FLOOR EXECUTION ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS operation_records (
  operation_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID REFERENCES work_order_operations(operation_id),
  operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  qty_produced INT DEFAULT 0,
  actual_cycle_time NUMERIC(8,2),
  status TEXT DEFAULT 'in_progress'
);

CREATE TABLE IF NOT EXISTS digital_signoffs (
  signoff_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_record_id UUID REFERENCES operation_records(operation_record_id),
  signoff_method TEXT DEFAULT 'touch' CHECK (signoff_method IN ('barcode','touch')),
  signed_at TIMESTAMPTZ DEFAULT now(),
  operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS takt_events (
  takt_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_record_id UUID REFERENCES operation_records(operation_record_id),
  station_id UUID REFERENCES stations(station_id),
  standard_takt NUMERIC(8,2),
  actual_cycle NUMERIC(8,2),
  overrun_flag BOOLEAN DEFAULT false,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS andon_events (
  andon_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number TEXT REFERENCES work_orders(wo_number),
  station_id UUID REFERENCES stations(station_id),
  issue_type TEXT CHECK (issue_type IN ('quality_defect','part_shortage','machine_issue','safety')),
  severity TEXT CHECK (severity IN ('low','medium','high','critical')),
  raised_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  raised_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issue_resolutions (
  resolution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  andon_id UUID REFERENCES andon_events(andon_id),
  resolver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_taken TEXT,
  resolution_time_min INT,
  resolved_at TIMESTAMPTZ DEFAULT now()
);

-- ── QUALITY ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS defect_records (
  defect_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number TEXT REFERENCES work_orders(wo_number),
  station_id UUID REFERENCES stations(station_id),
  defect_type TEXT,
  qty INT DEFAULT 1,
  disposition TEXT CHECK (disposition IN ('scrap','rework','uai','pending')),
  logged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  logged_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rework_orders (
  rework_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id UUID REFERENCES defect_records(defect_id),
  station_id UUID REFERENCES stations(station_id),
  assigned_operator UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open','in_progress','completed','failed'))
);

CREATE TABLE IF NOT EXISTS uai_approvals (
  uai_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id UUID REFERENCES defect_records(defect_id),
  qe_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  qe_approved_at TIMESTAMPTZ,
  qm_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  qm_approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending_qe'
    CHECK (status IN ('pending_qe','pending_qm','approved','rejected'))
);

CREATE TABLE IF NOT EXISTS scrap_certificates (
  certificate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id UUID REFERENCES defect_records(defect_id),
  cost_impact NUMERIC(12,2),
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS root_cause_analyses (
  rca_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT CHECK (source_type IN ('defect','breakdown','hold')),
  source_id UUID,
  method TEXT CHECK (method IN ('5why','ishikawa')),
  root_cause TEXT,
  analysis_data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS corrective_actions (
  ca_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rca_id UUID REFERENCES root_cause_analyses(rca_id),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT,
  due_date DATE,
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open','in_progress','closed','overdue'))
);

CREATE TABLE IF NOT EXISTS quality_inspections (
  inspection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number TEXT REFERENCES work_orders(wo_number),
  control_plan_ref TEXT,
  inspector_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  result TEXT CHECK (result IN ('pass','fail','pending')),
  inspected_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inspection_checks (
  check_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES quality_inspections(inspection_id),
  characteristic TEXT,
  measurement NUMERIC(12,4),
  usl NUMERIC(12,4),
  lsl NUMERIC(12,4),
  status TEXT CHECK (status IN ('ok','nok'))
);

CREATE TABLE IF NOT EXISTS batch_holds (
  hold_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES quality_inspections(inspection_id),
  reason TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','released')),
  held_at TIMESTAMPTZ DEFAULT now(),
  released_at TIMESTAMPTZ
);

-- ── EOL TESTING ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eol_test_runs (
  eol_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vin TEXT REFERENCES vin_units(vin),
  run_no INT DEFAULT 1,
  overall_result TEXT
    CHECK (overall_result IN ('pass','fail','conditional_pass','pending')),
  tested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tested_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eol_test_results (
  eol_result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eol_run_id UUID REFERENCES eol_test_runs(eol_run_id),
  test_item TEXT,
  measured_value TEXT,
  result TEXT CHECK (result IN ('pass','fail'))
);

CREATE TABLE IF NOT EXISTS eol_certificates (
  eol_certificate_no TEXT PRIMARY KEY,
  eol_run_id UUID REFERENCES eol_test_runs(eol_run_id),
  certificate_link TEXT,
  issued_at TIMESTAMPTZ DEFAULT now()
);

-- ── TOOLING ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tools (
  tool_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID REFERENCES machines(machine_id),
  line_id UUID REFERENCES production_lines(line_id),
  tool_name TEXT,
  cycle_count INT DEFAULT 0,
  max_life INT,
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS tool_replacement_requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES tools(tool_id),
  reason TEXT,
  urgency TEXT CHECK (urgency IN ('low','medium','high','critical')),
  status TEXT DEFAULT 'open',
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calibration_records (
  calibration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES tools(tool_id),
  certificate_link TEXT,
  calibrated_at TIMESTAMPTZ,
  next_due DATE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── MAINTENANCE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS breakdown_tickets (
  ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID REFERENCES machines(machine_id),
  description TEXT,
  severity TEXT CHECK (severity IN ('P1','P2','P3','P4')),
  assigned_tech UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open','acknowledged','in_repair','closed')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_diagnoses (
  diagnosis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES breakdown_tickets(ticket_id),
  failure_mode TEXT,
  cause TEXT,
  diagnosed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spare_parts_requests (
  spare_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES breakdown_tickets(ticket_id),
  part_description TEXT,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repair_activities (
  repair_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES breakdown_tickets(ticket_id),
  parts_used JSONB,
  actions TEXT,
  repair_minutes INT,
  repaired_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  repaired_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trial_runs (
  trial_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES breakdown_tickets(ticket_id),
  result TEXT CHECK (result IN ('pass','fail')),
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_kpis (
  kpi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID REFERENCES machines(machine_id),
  mttr_minutes NUMERIC(10,2),
  mtbf_hours NUMERIC(10,2),
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- ── SHIFT HANDOVER ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_handover_reports (
  handover_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES shifts(shift_id),
  outgoing_supervisor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  incoming_supervisor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  planned_output INT,
  actual_output INT,
  scrap_count INT DEFAULT 0,
  downtime_minutes INT DEFAULT 0,
  safety_events INT DEFAULT 0,
  open_issues TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','signed_off')),
  created_at TIMESTAMPTZ DEFAULT now(),
  signed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS carry_forward_tasks (
  task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id UUID REFERENCES shift_handover_reports(handover_id),
  description TEXT,
  priority TEXT CHECK (priority IN ('low','medium','high','critical')),
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS end_of_shift_summaries (
  summary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES shifts(shift_id),
  line_id UUID REFERENCES production_lines(line_id),
  planned_qty INT,
  actual_qty INT,
  scrap_count INT,
  open_issues_count INT,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- ── OEE & KPIs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oee_kpis (
  oee_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID REFERENCES production_lines(line_id),
  shift_id UUID REFERENCES shifts(shift_id),
  date DATE,
  availability NUMERIC(5,2),
  performance NUMERIC(5,2),
  quality NUMERIC(5,2),
  -- oee_pct computed as A × P × Q / 10000
  oee_pct NUMERIC(5,2) GENERATED ALWAYS AS
    (ROUND((availability * performance * quality) / 10000, 2)) STORED
);

CREATE TABLE IF NOT EXISTS production_kpis (
  kpi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES plants(plant_id),
  line_id UUID REFERENCES production_lines(line_id),
  date DATE,
  fpy NUMERIC(5,2),
  scrap_rate NUMERIC(5,2),
  schedule_adherence NUMERIC(5,2),
  andon_response_avg_min NUMERIC(8,2),
  eol_first_pass_rate NUMERIC(5,2)
);

-- ── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role_id UUID REFERENCES roles(role_id),
  source_type TEXT,
  source_id UUID,
  message TEXT,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread','read')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offline_sync_queue (
  sync_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id TEXT,
  entity TEXT,
  payload JSONB,
  sync_status TEXT DEFAULT 'pending'
    CHECK (sync_status IN ('pending','synced','failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── ENABLE REALTIME ──────────────────────────────────────────
ALTER TABLE andon_events        REPLICA IDENTITY FULL;
ALTER TABLE notifications       REPLICA IDENTITY FULL;
ALTER TABLE breakdown_tickets   REPLICA IDENTITY FULL;
ALTER TABLE work_orders         REPLICA IDENTITY FULL;
ALTER TABLE batch_holds         REPLICA IDENTITY FULL;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE andon_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log             ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update only their own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Notifications: users see only their own
CREATE POLICY "notif_select" ON notifications FOR SELECT
  USING (recipient_user_id = auth.uid());
CREATE POLICY "notif_update" ON notifications FOR UPDATE
  USING (recipient_user_id = auth.uid());

-- Audit log: insert-only for authenticated users, select for sys_admin
CREATE POLICY "audit_insert" ON audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── SEED ROLES ───────────────────────────────────────────────
INSERT INTO roles (role_name) VALUES
  ('production_manager'),
  ('shift_supervisor'),
  ('line_leader'),
  ('machine_operator'),
  ('production_planner'),
  ('maintenance_tech'),
  ('quality_inspector'),
  ('plant_manager'),
  ('sys_admin')
ON CONFLICT (role_name) DO NOTHING;

-- ── SEED PLANTS ──────────────────────────────────────────────
INSERT INTO plants (name, location, timezone) VALUES
  ('Plant A', 'Munich, Germany',  'Europe/Berlin'),
  ('Plant B', 'Leipzig, Germany', 'Europe/Berlin')
ON CONFLICT DO NOTHING;

-- ── SEED PARTS ───────────────────────────────────────────────
INSERT INTO part_master (part_number, model, variant) VALUES
  ('BMW-M4-DOOR-LH',    'M4',  'Competition'),
  ('BMW-3-CHASSIS',     '3',   'Sedan'),
  ('BMW-5-ENGINE-MOUNT','5',   'xDrive'),
  ('BMW-7-DASH-PANEL',  '7',   'L'),
  ('BMW-M3-EXHAUST',    'M3',  'CS')
ON CONFLICT DO NOTHING;

-- ── HOW TO CREATE USERS ──────────────────────────────────────
-- In Supabase Dashboard → Authentication → Users → "Add user"
-- Use email format:  prod.manager@automfg.io  /  Prod1234
--                    shift.super@automfg.io   /  Shift123
--                    line.leader@automfg.io   /  Line1234
--                    mach.operator@automfg.io /  Mach1234
--                    prod.planner@automfg.io  /  Plan1234
--                    maint.tech@automfg.io    /  Main1234
--                    qual.inspector@automfg.io/  Qual1234
--                    plant.manager@automfg.io /  Plant123
--                    sys.admin@automfg.io     /  Admin123
-- The trigger above will auto-create their profiles row.


-- ── CENTRAL CROSS-MODULE CONNECTIVITY TRIGGERS (VIBE INTEGRATION) ──

-- Bridge 3: Scrap-to-CAPA
ALTER TABLE defect_records ADD COLUMN IF NOT EXISTS supplier_id UUID;

CREATE OR REPLACE FUNCTION update_supplier_quality_score()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_id UUID;
  v_scrap_count INT;
  v_new_score NUMERIC;
  v_supplier_name TEXT;
BEGIN
  -- Get the supplier_id from defect_records
  SELECT supplier_id INTO v_supplier_id FROM defect_records WHERE defect_id = NEW.defect_id;
  
  IF v_supplier_id IS NOT NULL THEN
    -- Count the number of scrap defects for this supplier
    SELECT COUNT(*) INTO v_scrap_count 
    FROM scrap_certificates sc
    JOIN defect_records dr ON sc.defect_id = dr.defect_id
    WHERE dr.supplier_id = v_supplier_id;
    
    -- Calculate new quality score (starting at 100, subtracting 5 per scrap defect)
    v_new_score := GREATEST(0, 100 - (v_scrap_count * 5));
    
    -- Update the suppliers table
    UPDATE suppliers 
    SET quality_score = v_new_score 
    WHERE supplier_id = v_supplier_id;
    
    -- If Quality Score falls below 90%, generate CAPA notification
    IF v_new_score < 90 THEN
      SELECT supplier_name INTO v_supplier_name FROM suppliers WHERE supplier_id = v_supplier_id;
      
      INSERT INTO notifications (user_role, title, message, priority, read_status)
      VALUES (
        'supplier_quality_engineer', 
        'CAPA Required: ' || COALESCE(v_supplier_name, 'Unknown Supplier'), 
        'Quality Score for ' || COALESCE(v_supplier_name, 'Unknown Supplier') || ' has dropped to ' || v_new_score || '%. Immediate corrective action is required.', 
        'High', 
        FALSE
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_supplier_quality_score
AFTER INSERT ON scrap_certificates
FOR EACH ROW
EXECUTE FUNCTION update_supplier_quality_score();


-- Bridge 4: Tooling-to-Procurement
CREATE OR REPLACE FUNCTION generate_tool_replacement_pr()
RETURNS TRIGGER AS $$
DECLARE
  v_tool_name TEXT;
BEGIN
  SELECT tool_name INTO v_tool_name FROM tools WHERE tool_id = NEW.tool_id;
  
  INSERT INTO purchase_requisitions (
    material_name,
    part_code,
    quantity,
    estimated_cost,
    procurement_type,
    supplier_category,
    priority,
    status,
    department,
    notes,
    created_by
  ) VALUES (
    'Replacement parts for tool: ' || COALESCE(v_tool_name, NEW.tool_id::text),
    'TOOL-REP-' || UPPER(SUBSTRING(NEW.tool_id::text, 1, 8)),
    1,
    25000.00,
    'Spare Parts',
    'Tooling',
    'High',
    'Draft',
    'Production',
    'Auto-generated draft purchase requisition for tool replacement request: ' || COALESCE(NEW.reason, 'Life limit reached'),
    NEW.requested_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_generate_tool_replacement_pr
AFTER INSERT ON tool_replacement_requests
FOR EACH ROW
EXECUTE FUNCTION generate_tool_replacement_pr();

