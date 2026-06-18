// ============================================
// AutoMFG — Auth Store (Zustand + Supabase)
// Comprehensive RBAC for all 9 manufacturing roles
// ============================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured, writeAuditLog } from '../lib/supabase';

// ── Fallback mock users for non-Supabase mode ───────────────────
export const MOCK_USERS = [
  { id: '1',  name: 'Production Manager',  username: 'prod.manager',   password: 'Prod1234', role: 'production_manager',  roleLabel: 'Production Manager',  department: 'Management',   plant: 'Plant A', shift: 'All',     email: 'prod.manager@automfg.io' },
  { id: '2',  name: 'Shift Supervisor',    username: 'shift.super',     password: 'Shift123', role: 'shift_supervisor',    roleLabel: 'Shift Supervisor',    department: 'Assembly',     plant: 'Plant A', shift: 'Shift A', email: 'shift.super@automfg.io' },
  { id: '3',  name: 'Line Leader',         username: 'line.leader',     password: 'Line1234', role: 'line_leader',         roleLabel: 'Line Leader',         department: 'Line 1',       plant: 'Plant A', shift: 'Shift A', email: 'line.leader@automfg.io' },
  { id: '4',  name: 'Machine Operator',    username: 'mach.operator',   password: 'Mach1234', role: 'machine_operator',    roleLabel: 'Machine Operator',    department: 'Station 3',    plant: 'Plant A', shift: 'Shift A', email: 'mach.operator@automfg.io' },
  { id: '5',  name: 'Production Planner',  username: 'prod.planner',    password: 'Plan1234', role: 'production_planner',  roleLabel: 'Production Planner',  department: 'Planning',     plant: 'Plant A', shift: 'All',     email: 'prod.planner@automfg.io' },
  { id: '6',  name: 'Maintenance Tech',    username: 'maint.tech',      password: 'Main1234', role: 'maintenance_tech',    roleLabel: 'Maintenance Tech',    department: 'Maintenance',  plant: 'Plant A', shift: 'Shift A', email: 'maint.tech@automfg.io' },
  { id: '7',  name: 'Quality Inspector',   username: 'qual.inspector',  password: 'Qual1234', role: 'quality_inspector',   roleLabel: 'Quality Inspector',   department: 'Quality',      plant: 'Plant A', shift: 'Shift A', email: 'qual.inspector@automfg.io' },
  { id: '8',  name: 'Plant Manager',       username: 'plant.manager',   password: 'Plant123', role: 'plant_manager',       roleLabel: 'Plant Manager',       department: 'Management',   plant: 'Plant A', shift: 'All',     email: 'plant.manager@automfg.io' },
  { id: '9',  name: 'System Admin',        username: 'sys.admin',       password: 'Admin123', role: 'sys_admin',           roleLabel: 'System Admin',        department: 'Admin',        plant: 'All Plants', shift: 'All', email: 'sys.admin@automfg.io' },
  { id: '10', name: 'VIBE CEO',            username: 'ceo',             password: 'admin123', role: 'ceo',                 roleLabel: 'Chief Executive Officer', department: 'Executive', plant: 'All Plants', shift: 'All', email: 'ceo@vibe.com' },
];

// Keep old USERS export for backward compatibility
export const USERS = MOCK_USERS;

// ── RBAC permission map — defines which sidebar modules each role can access ──
// Keys match NAV_ITEMS id fields in AppShell
export const ROLE_PERMISSIONS = {
  // SYSTEM ADMIN — full access + admin/audit modules
  sys_admin: [
    'admin_dashboard', 'users_roles', 'master_config', 'audit_logs',
    'integration_monitor',
    // also read-all access to everything
    'production_planning', 'plan_approval', 'work_orders', 'assembly_line',
    'tooling', 'shift_handover', 'scrap_rework', 'quality_gate',
    'maintenance', 'eol', 'oee', 'admin', 'ceo_dashboard',
  ],

  // PLANT MANAGER — executive KPIs, all modules in read mode
  plant_manager: [
    'exec_dashboard', 'oee', 'production_summary', 'quality_escalations',
    'shift_reports', 'scm_impact',
    // also access
    'production_planning', 'work_orders', 'assembly_line', 'tooling',
    'shift_handover', 'scrap_rework', 'quality_gate', 'maintenance', 'eol',
  ],

  // PRODUCTION MANAGER — approval, WO release, monitoring
  production_manager: [
    'mgr_dashboard', 'plan_approval', 'work_orders', 'quality_holds',
    'shift_handover', 'oee',
    // also
    'production_planning', 'assembly_line', 'scrap_rework', 'quality_gate', 'eol',
  ],

  // PRODUCTION PLANNER — planning, R&D inputs, scheduling
  production_planner: [
    'planner_dashboard', 'rnd_inputs', 'production_planning', 'capacity_check',
    'material_check', 'work_orders',
  ],

  // SHIFT SUPERVISOR — live floor control, handover, Andon
  shift_supervisor: [
    'supervisor_dashboard', 'live_floor', 'assembly_line', 'maintenance',
    'scrap_rework', 'shift_handover',
    // also
    'work_orders', 'tooling',
  ],

  // LINE LEADER — WO, tooling, defects
  line_leader: [
    'leader_dashboard', 'my_line', 'work_orders', 'tooling', 'scrap_rework',
    // also
    'assembly_line',
  ],

  // MACHINE OPERATOR — station-focused
  machine_operator: [
    'operator_dashboard', 'my_work_order', 'assembly_line',
  ],

  // QUALITY INSPECTOR — gate, defects, rework, scrap, EOL
  quality_inspector: [
    'qi_dashboard', 'quality_gate', 'scrap_rework', 'eol',
    // also
    'oee',
  ],

  // MAINTENANCE TECHNICIAN — breakdowns, machines, tools, calibration
  maintenance_tech: [
    'maint_dashboard', 'maintenance', 'tooling',
  ],

  // CEO — everything
  ceo: [
    'admin_dashboard', 'exec_dashboard', 'mgr_dashboard', 'planner_dashboard',
    'supervisor_dashboard', 'leader_dashboard', 'operator_dashboard',
    'qi_dashboard', 'maint_dashboard', 'users_roles', 'master_config',
    'audit_logs', 'integration_monitor',
    'production_planning', 'plan_approval', 'work_orders', 'assembly_line',
    'tooling', 'shift_handover', 'scrap_rework', 'quality_gate',
    'maintenance', 'eol', 'oee', 'admin', 'ceo_dashboard',
  ],
};

// Legacy module access check — maps old module ids to role check
export const LEGACY_ROLE_MODULES = {
  production_manager: [
    'dashboard', 'production_planning', 'work_orders', 'assembly_line',
    'shift_handover', 'scrap_rework', 'quality_gate', 'oee', 'eol',
  ],
  shift_supervisor: [
    'dashboard', 'work_orders', 'assembly_line', 'shift_handover',
    'scrap_rework', 'tooling', 'maintenance',
  ],
  line_leader: [
    'dashboard', 'work_orders', 'assembly_line', 'scrap_rework', 'tooling',
  ],
  machine_operator: [
    'dashboard', 'work_orders', 'assembly_line', 'maintenance',
  ],
  production_planner: [
    'dashboard', 'production_planning', 'work_orders', 'oee',
  ],
  maintenance_tech: [
    'dashboard', 'tooling', 'maintenance',
  ],
  quality_inspector: [
    'dashboard', 'scrap_rework', 'quality_gate', 'eol', 'oee',
  ],
  plant_manager: [
    'dashboard', 'production_planning', 'work_orders', 'assembly_line',
    'tooling', 'shift_handover', 'scrap_rework', 'quality_gate',
    'maintenance', 'eol', 'oee',
  ],
  sys_admin: [
    'dashboard', 'production_planning', 'work_orders', 'assembly_line',
    'tooling', 'shift_handover', 'scrap_rework', 'quality_gate',
    'maintenance', 'eol', 'oee', 'admin',
  ],
  ceo: [
    'dashboard', 'production_planning', 'work_orders', 'assembly_line',
    'tooling', 'shift_handover', 'scrap_rework', 'quality_gate',
    'maintenance', 'eol', 'oee', 'admin', 'ceo_dashboard',
  ],
};

// Map email prefix to role (for Supabase mode)
const EMAIL_ROLE_MAP = {
  'prod.manager':  'production_manager',
  'shift.super':   'shift_supervisor',
  'line.leader':   'line_leader',
  'mach.operator': 'machine_operator',
  'prod.planner':  'production_planner',
  'maint.tech':    'maintenance_tech',
  'qual.inspector':'quality_inspector',
  'plant.manager': 'plant_manager',
  'sys.admin':     'sys_admin',
  'ceo':           'ceo',
};

const EMAIL_DISPLAY_MAP = {
  'prod.manager':  { name: 'Production Manager', roleLabel: 'Production Manager',       department: 'Management',  plant: 'Plant A',    shift: 'All' },
  'shift.super':   { name: 'Shift Supervisor',   roleLabel: 'Shift Supervisor',         department: 'Assembly',    plant: 'Plant A',    shift: 'Shift A' },
  'line.leader':   { name: 'Line Leader',        roleLabel: 'Line Leader',              department: 'Line 1',      plant: 'Plant A',    shift: 'Shift A' },
  'mach.operator': { name: 'Machine Operator',   roleLabel: 'Machine Operator',         department: 'Station 3',   plant: 'Plant A',    shift: 'Shift A' },
  'prod.planner':  { name: 'Production Planner', roleLabel: 'Production Planner',       department: 'Planning',    plant: 'Plant A',    shift: 'All' },
  'maint.tech':    { name: 'Maintenance Tech',   roleLabel: 'Maintenance Tech',         department: 'Maintenance', plant: 'Plant A',    shift: 'Shift A' },
  'qual.inspector':{ name: 'Quality Inspector',  roleLabel: 'Quality Inspector',        department: 'Quality',     plant: 'Plant A',    shift: 'Shift A' },
  'plant.manager': { name: 'Plant Manager',      roleLabel: 'Plant Manager',            department: 'Management',  plant: 'Plant A',    shift: 'All' },
  'sys.admin':     { name: 'System Admin',       roleLabel: 'System Admin',             department: 'Admin',       plant: 'All Plants', shift: 'All' },
  'ceo':           { name: 'VIBE CEO',           roleLabel: 'Chief Executive Officer',  department: 'Executive',   plant: 'All Plants', shift: 'All' },
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      sessionId: null,

      // ── Login ────────────────────────────────────────────────
      login: async (username, password) => {
        const cleanUsername = username.includes('@') ? username.split('@')[0].toLowerCase() : username.toLowerCase();
        
        let email = '';
        if (cleanUsername === 'ceo') {
          email = 'ceo@vibe.com';
        } else {
          email = username.includes('@') ? username.toLowerCase() : `${username.toLowerCase()}@automfg.io`;
        }

        if (isSupabaseConfigured()) {
          // Supabase Auth mode
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            // Fallback to Mock mode if Supabase credentials are not found/configured in Auth
            const found = MOCK_USERS.find(
              (u) => (u.username === cleanUsername || u.email === username.toLowerCase()) && u.password === password
            );
            if (found) {
              const { password: _, ...safeUser } = found;
              set({ user: safeUser, isAuthenticated: true });
              return { success: true };
            }
            return { success: false, error: error.message };
          }

          // Derive role from email prefix
          const prefix = cleanUsername;
          const role = EMAIL_ROLE_MAP[prefix] || 'machine_operator';
          const display = EMAIL_DISPLAY_MAP[prefix] || { name: username, roleLabel: role, department: 'Shop Floor', plant: 'Plant A', shift: 'Shift A' };

          const safeUser = {
            id: data.user.id,
            name: display.name,
            username: cleanUsername,
            role,
            roleLabel: display.roleLabel,
            department: display.department,
            plant: display.plant,
            shift: display.shift,
            email,
          };

          // Write login_sessions
          try {
            await supabase.from('login_sessions').insert({
              user_id: data.user.id,
              terminal: navigator.userAgent.slice(0, 50),
              device: navigator.platform || 'unknown',
              login_time: new Date().toISOString(),
            });
          } catch (e) { /* non-critical */ }

          // Write audit log
          writeAuditLog(data.user.id, 'auth', 'login', { username: cleanUsername, timestamp: new Date().toISOString() });

          set({ user: safeUser, isAuthenticated: true });
          return { success: true };
        } else {
          // Mock mode (no Supabase configured)
          const found = MOCK_USERS.find(
            (u) => (u.username === cleanUsername || u.email === username.toLowerCase()) && u.password === password
          );
          if (found) {
            const { password: _, ...safeUser } = found;
            set({ user: safeUser, isAuthenticated: true });
            return { success: true };
          }
          return { success: false, error: 'Invalid credentials' };
        }
      },

      // ── Logout ───────────────────────────────────────────────
      logout: async () => {
        const { user } = get();
        // 1. Clear the Zustand-persisted localStorage key BEFORE state update
        //    to prevent rehydration race conditions on re-render.
        try { localStorage.removeItem('automfg-auth'); } catch (_) {}
        // 2. Clear all session/auth-related storage keys used across the VIBE ecosystem
        try { sessionStorage.removeItem('vibe_user'); } catch (_) {}
        // 3. Clear any legacy keys written by the corporate portal's script.js
        try {
          localStorage.removeItem('automfg_user');
          localStorage.removeItem('automfg_role');
          localStorage.removeItem('activeRole');
          localStorage.removeItem('selectedUser');
        } catch (_) {}
        // 4. Clear Zustand state immediately
        set({ user: null, isAuthenticated: false, sessionId: null });
        // 5. Sign out of Supabase (do this last to avoid async race with state)
        if (isSupabaseConfigured() && user) {
          try {
            writeAuditLog(user.id, 'auth', 'logout', { timestamp: new Date().toISOString() });
            await supabase.auth.signOut();
          } catch (e) {
            console.warn('[AuthStore] Supabase signOut error (non-critical):', e.message);
          }
        }
      },

      // ── Sync session from Supabase (on app init) ─────────────
      syncSession: async () => {
        if (!isSupabaseConfigured()) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const email = session.user.email || '';
          const prefix = email.split('@')[0];
          const role = EMAIL_ROLE_MAP[prefix] || 'machine_operator';
          const display = EMAIL_DISPLAY_MAP[prefix] || { name: prefix, roleLabel: role, department: 'Shop Floor', plant: 'Plant A', shift: 'Shift A' };
          set({
            user: {
              id: session.user.id,
              name: display.name,
              username: prefix,
              role,
              roleLabel: display.roleLabel,
              department: display.department,
              plant: display.plant,
              shift: display.shift,
              email,
            },
            isAuthenticated: true,
          });
        }
      },
    }),
    { name: 'automfg-auth', version: 4 }
  )
);

// ── Permission hook — checks if user can access a given page module ──────────
export const useHasPermission = (module) => {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  // Check both new ROLE_PERMISSIONS and legacy module list
  const newPerms = ROLE_PERMISSIONS[user.role] ?? [];
  const legacyPerms = LEGACY_ROLE_MODULES[user.role] ?? [];
  return newPerms.includes(module) || legacyPerms.includes(module);
};
