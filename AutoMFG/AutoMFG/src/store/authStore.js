// ============================================
// AutoMFG — Auth Store (Zustand + Supabase)
// ============================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured, writeAuditLog } from '../lib/supabase';

// ── Fallback mock users for non-Supabase mode ───────────────────
export const MOCK_USERS = [
  { id: '1', name: 'Production Manager', username: 'prod.manager', password: 'Prod1234', role: 'production_manager', roleLabel: 'Production Manager', plant: 'Plant A', email: 'prod.manager@automfg.io' },
  { id: '2', name: 'Shift Supervisor', username: 'shift.super', password: 'Shift123', role: 'shift_supervisor', roleLabel: 'Shift Supervisor', plant: 'Plant A', email: 'shift.super@automfg.io' },
  { id: '3', name: 'Line Leader', username: 'line.leader', password: 'Line1234', role: 'line_leader', roleLabel: 'Line Leader', plant: 'Plant A', email: 'line.leader@automfg.io' },
  { id: '4', name: 'Machine Operator', username: 'mach.operator', password: 'Mach1234', role: 'machine_operator', roleLabel: 'Machine Operator', plant: 'Plant A', email: 'mach.operator@automfg.io' },
  { id: '5', name: 'Production Planner', username: 'prod.planner', password: 'Plan1234', role: 'production_planner', roleLabel: 'Production Planner', plant: 'Plant A', email: 'prod.planner@automfg.io' },
  { id: '6', name: 'Maintenance Tech', username: 'maint.tech', password: 'Main1234', role: 'maintenance_tech', roleLabel: 'Maintenance Tech', plant: 'Plant A', email: 'maint.tech@automfg.io' },
  { id: '7', name: 'Quality Inspector', username: 'qual.inspector', password: 'Qual1234', role: 'quality_inspector', roleLabel: 'Quality Inspector', plant: 'Plant A', email: 'qual.inspector@automfg.io' },
  { id: '8', name: 'Plant Manager', username: 'plant.manager', password: 'Plant123', role: 'plant_manager', roleLabel: 'Plant Manager', plant: 'Plant A', email: 'plant.manager@automfg.io' },
  { id: '9', name: 'System Admin', username: 'sys.admin', password: 'Admin123', role: 'sys_admin', roleLabel: 'System Admin', plant: 'Plant A', email: 'sys.admin@automfg.io' },
  { id: '10', name: 'VIBE CEO', username: 'ceo', password: 'admin123', role: 'ceo', roleLabel: 'Chief Executive Officer', plant: 'All Plants', email: 'ceo@vibe.com' },
];

// Keep old USERS export for backward compatibility
export const USERS = MOCK_USERS;

// ── RBAC permission map ──────────────────────────────────────────
export const ROLE_PERMISSIONS = {
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
  CEO: [
    'dashboard', 'production_planning', 'work_orders', 'assembly_line',
    'tooling', 'shift_handover', 'scrap_rework', 'quality_gate',
    'maintenance', 'eol', 'oee', 'admin', 'ceo_dashboard',
  ],
};

// Map email prefix to role (for Supabase mode)
const EMAIL_ROLE_MAP = {
  'prod.manager': 'production_manager',
  'shift.super': 'shift_supervisor',
  'line.leader': 'line_leader',
  'mach.operator': 'machine_operator',
  'prod.planner': 'production_planner',
  'maint.tech': 'maintenance_tech',
  'qual.inspector': 'quality_inspector',
  'plant.manager': 'plant_manager',
  'sys.admin': 'sys_admin',
  'ceo': 'ceo',
};

const EMAIL_DISPLAY_MAP = {
  'prod.manager': { name: 'Production Manager', roleLabel: 'Production Manager', plant: 'Plant A' },
  'shift.super': { name: 'Shift Supervisor', roleLabel: 'Shift Supervisor', plant: 'Plant A' },
  'line.leader': { name: 'Line Leader', roleLabel: 'Line Leader', plant: 'Plant A' },
  'mach.operator': { name: 'Machine Operator', roleLabel: 'Machine Operator', plant: 'Plant A' },
  'prod.planner': { name: 'Production Planner', roleLabel: 'Production Planner', plant: 'Plant A' },
  'maint.tech': { name: 'Maintenance Tech', roleLabel: 'Maintenance Tech', plant: 'Plant A' },
  'qual.inspector': { name: 'Quality Inspector', roleLabel: 'Quality Inspector', plant: 'Plant A' },
  'plant.manager': { name: 'Plant Manager', roleLabel: 'Plant Manager', plant: 'Plant A' },
  'sys.admin': { name: 'System Admin', roleLabel: 'System Admin', plant: 'Plant A' },
  'ceo': { name: 'VIBE CEO', roleLabel: 'Chief Executive Officer', plant: 'All Plants' },
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
          const display = EMAIL_DISPLAY_MAP[prefix] || { name: username, roleLabel: role, plant: 'Plant A' };

          const safeUser = {
            id: data.user.id,
            name: display.name,
            username: cleanUsername,
            role,
            roleLabel: display.roleLabel,
            plant: display.plant,
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
        if (isSupabaseConfigured() && user) {
          writeAuditLog(user.id, 'auth', 'logout', { timestamp: new Date().toISOString() });
          await supabase.auth.signOut();
        }
        set({ user: null, isAuthenticated: false, sessionId: null });
      },

      // ── Sync session from Supabase (on app init) ─────────────
      syncSession: async () => {
        if (!isSupabaseConfigured()) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const email = session.user.email || '';
          const prefix = email.split('@')[0];
          const role = EMAIL_ROLE_MAP[prefix] || 'machine_operator';
          const display = EMAIL_DISPLAY_MAP[prefix] || { name: prefix, roleLabel: role, plant: 'Plant A' };
          set({
            user: {
              id: session.user.id,
              name: display.name,
              username: prefix,
              role,
              roleLabel: display.roleLabel,
              plant: display.plant,
              email,
            },
            isAuthenticated: true,
          });
        }
      },
    }),
    { name: 'automfg-auth', version: 2 }
  )
);

// ── Permission hook ──────────────────────────────────────────────
export const useHasPermission = (module) => {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(module) ?? false;
};
