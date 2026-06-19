-- ============================================================
-- SQL Migration: Update andon_events schema to support full sync
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add missing text and audit columns if they do not exist
ALTER TABLE andon_events ADD COLUMN IF NOT EXISTS line text;
ALTER TABLE andon_events ADD COLUMN IF NOT EXISTS station text;
ALTER TABLE andon_events ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE andon_events ADD COLUMN IF NOT EXISTS priority text DEFAULT 'high';
ALTER TABLE andon_events ADD COLUMN IF NOT EXISTS plant text DEFAULT 'Plant A';
ALTER TABLE andon_events ADD COLUMN IF NOT EXISTS shift text DEFAULT 'Shift A';
ALTER TABLE andon_events ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE andon_events ADD COLUMN IF NOT EXISTS resolved_by text;
ALTER TABLE andon_events ADD COLUMN IF NOT EXISTS raised_by_role text DEFAULT 'machine_operator';
ALTER TABLE andon_events ADD COLUMN IF NOT EXISTS assigned_to_role text DEFAULT 'shift_supervisor';

-- 2. Drop existing restrictive status check constraint and create updated one
ALTER TABLE andon_events DROP CONSTRAINT IF EXISTS andon_events_status_check;
ALTER TABLE andon_events ADD CONSTRAINT andon_events_status_check CHECK (status IN ('open', 'acknowledged', 'resolved', 'active'));

-- 3. Drop existing restrictive issue_type check constraint to allow more dynamic types
ALTER TABLE andon_events DROP CONSTRAINT IF EXISTS andon_events_issue_type_check;

-- 4. Ensure RLS is enabled and policies are permissive
ALTER TABLE andon_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "andon_events_select" ON andon_events;
DROP POLICY IF EXISTS "andon_events_insert" ON andon_events;
DROP POLICY IF EXISTS "andon_events_update" ON andon_events;

CREATE POLICY "andon_events_select" ON andon_events FOR SELECT USING (true);
CREATE POLICY "andon_events_insert" ON andon_events FOR INSERT WITH CHECK (true);
CREATE POLICY "andon_events_update" ON andon_events FOR UPDATE USING (true);

-- 5. Enable full realtime replication identity
ALTER TABLE andon_events REPLICA IDENTITY FULL;
