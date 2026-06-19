-- ============================================================
-- FIX: RLS policies and constraints for Scrap & Rework
-- Run this in Supabase SQL Editor to resolve RLS and status constraints
-- ============================================================

-- ── 1. UPDATE REWORK STATUS CONSTRAINT ────────────────────────
ALTER TABLE rework_orders DROP CONSTRAINT IF EXISTS rework_orders_status_check;
ALTER TABLE rework_orders ADD CONSTRAINT rework_orders_status_check CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'failed'));

-- ── 2. PROFILES POLICIES ──────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (true);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (true);

-- ── 3. ROLES POLICIES ─────────────────────────────────────────
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_select" ON roles;
DROP POLICY IF EXISTS "roles_insert" ON roles;
DROP POLICY IF EXISTS "roles_update" ON roles;
DROP POLICY IF EXISTS "roles_delete" ON roles;

CREATE POLICY "roles_select" ON roles FOR SELECT USING (true);
CREATE POLICY "roles_insert" ON roles FOR INSERT WITH CHECK (true);
CREATE POLICY "roles_update" ON roles FOR UPDATE USING (true);
CREATE POLICY "roles_delete" ON roles FOR DELETE USING (true);

-- ── 4. USER_ROLES POLICIES ────────────────────────────────────
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;

CREATE POLICY "user_roles_select" ON user_roles FOR SELECT USING (true);
CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT WITH CHECK (true);
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE USING (true);
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE USING (true);
