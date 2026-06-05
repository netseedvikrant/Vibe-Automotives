-- AutoMFG — DROP SCRIPT
-- Run this FIRST in Supabase SQL Editor, then run supabaseSchema.sql
-- Safe to run multiple times (all IF EXISTS)
-- ================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Drop tables in reverse dependency order (children before parents)
DROP TABLE IF EXISTS offline_sync_queue          CASCADE;
DROP TABLE IF EXISTS notifications               CASCADE;
DROP TABLE IF EXISTS production_kpis             CASCADE;
DROP TABLE IF EXISTS oee_kpis                    CASCADE;
DROP TABLE IF EXISTS end_of_shift_summaries      CASCADE;
DROP TABLE IF EXISTS carry_forward_tasks         CASCADE;
DROP TABLE IF EXISTS shift_handover_reports      CASCADE;
DROP TABLE IF EXISTS maintenance_kpis            CASCADE;
DROP TABLE IF EXISTS trial_runs                  CASCADE;
DROP TABLE IF EXISTS repair_activities           CASCADE;
DROP TABLE IF EXISTS spare_parts_requests        CASCADE;
DROP TABLE IF EXISTS maintenance_diagnoses       CASCADE;
DROP TABLE IF EXISTS breakdown_tickets           CASCADE;
DROP TABLE IF EXISTS calibration_records         CASCADE;
DROP TABLE IF EXISTS tool_replacement_requests   CASCADE;
DROP TABLE IF EXISTS tools                       CASCADE;
DROP TABLE IF EXISTS eol_certificates            CASCADE;
DROP TABLE IF EXISTS eol_test_results            CASCADE;
DROP TABLE IF EXISTS eol_test_runs               CASCADE;
DROP TABLE IF EXISTS batch_holds                 CASCADE;
DROP TABLE IF EXISTS inspection_checks           CASCADE;
DROP TABLE IF EXISTS quality_inspections         CASCADE;
DROP TABLE IF EXISTS corrective_actions          CASCADE;
DROP TABLE IF EXISTS root_cause_analyses         CASCADE;
DROP TABLE IF EXISTS scrap_certificates          CASCADE;
DROP TABLE IF EXISTS uai_approvals               CASCADE;
DROP TABLE IF EXISTS rework_orders               CASCADE;
DROP TABLE IF EXISTS defect_records              CASCADE;
DROP TABLE IF EXISTS issue_resolutions           CASCADE;
DROP TABLE IF EXISTS andon_events                CASCADE;
DROP TABLE IF EXISTS takt_events                 CASCADE;
DROP TABLE IF EXISTS digital_signoffs            CASCADE;
DROP TABLE IF EXISTS operation_records           CASCADE;
DROP TABLE IF EXISTS inventory_postings          CASCADE;
DROP TABLE IF EXISTS material_issues             CASCADE;
DROP TABLE IF EXISTS work_order_operations       CASCADE;
DROP TABLE IF EXISTS work_orders                 CASCADE;
DROP TABLE IF EXISTS plan_approvals              CASCADE;
DROP TABLE IF EXISTS capacity_checks             CASCADE;
DROP TABLE IF EXISTS material_availability_checks CASCADE;
DROP TABLE IF EXISTS production_plans            CASCADE;
DROP TABLE IF EXISTS demand_orders               CASCADE;
DROP TABLE IF EXISTS vin_units                   CASCADE;
DROP TABLE IF EXISTS part_master                 CASCADE;
DROP TABLE IF EXISTS machines                    CASCADE;
DROP TABLE IF EXISTS stations                    CASCADE;
DROP TABLE IF EXISTS work_center_calendars       CASCADE;
DROP TABLE IF EXISTS work_centers                CASCADE;
DROP TABLE IF EXISTS shifts                      CASCADE;
DROP TABLE IF EXISTS production_lines            CASCADE;
DROP TABLE IF EXISTS plants                      CASCADE;
DROP TABLE IF EXISTS user_plant_access           CASCADE;
DROP TABLE IF EXISTS user_roles                  CASCADE;
DROP TABLE IF EXISTS login_sessions              CASCADE;
DROP TABLE IF EXISTS audit_log                   CASCADE;
DROP TABLE IF EXISTS role_permissions            CASCADE;
DROP TABLE IF EXISTS permissions                 CASCADE;
DROP TABLE IF EXISTS roles                       CASCADE;
DROP TABLE IF EXISTS profiles                    CASCADE;

-- Confirm
SELECT 'Drop complete — safe to run supabaseSchema.sql now' AS status;
