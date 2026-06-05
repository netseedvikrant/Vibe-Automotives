// AutoMFG — Admin Panel (Users + Audit Trail) — FIXED
import { useState, useEffect } from 'react';
import { Search, RefreshCw, Shield, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { MOCK_USERS, ROLE_PERMISSIONS } from '../store/authStore';

const MOCK_AUDIT = [
  { audit_id: '1', user_id: 'prod.manager', entity: 'production_plans', action: 'update', payload: { status: 'frozen' }, timestamp: '2026-05-17T10:30:00Z' },
  { audit_id: '2', user_id: 'qual.inspector', entity: 'quality_inspections', action: 'insert', payload: { wo_number: 'WO-2024-0001', result: 'pass' }, timestamp: '2026-05-17T11:00:00Z' },
  { audit_id: '3', user_id: 'maint.tech', entity: 'breakdown_tickets', action: 'insert', payload: { severity: 'P1', machine: 'Press Machine P1' }, timestamp: '2026-05-17T18:20:00Z' },
  { audit_id: '4', user_id: 'qual.inspector', entity: 'defect_records', action: 'insert', payload: { defect_type: 'Dimensional OOT', disposition: 'scrap' }, timestamp: '2026-05-17T11:30:00Z' },
  { audit_id: '5', user_id: 'prod.planner', entity: 'production_plans', action: 'insert', payload: { part_number: 'BMW-M4-DOOR-LH', planned_qty: 100 }, timestamp: '2026-05-17T09:00:00Z' },
];

const ENTITY_COLOR = { production_plans: 'badge-blue', quality_inspections: 'badge-green', defect_records: 'badge-red', breakdown_tickets: 'badge-amber', work_orders: 'badge-white', auth: 'badge-gray' };
const ACTION_COLOR = { insert: 'badge-green', update: 'badge-blue', delete: 'badge-red', login: 'badge-gray', logout: 'badge-gray', signoff: 'badge-green' };

export default function AdminPanel() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('audit');
  const [auditLog, setAuditLog] = useState(MOCK_AUDIT);
  const [users, setUsers] = useState(MOCK_USERS);
  const [auditSearch, setAuditSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState(null);

  const fetchAudit = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*, profiles:user_id(display_name, username)')
        .order('timestamp', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (data) setAuditLog(data);
    } catch (e) {
      console.warn('[AdminPanel] Failed to load audit logs:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, user_roles(roles(role_name))')
        .order('username');
      if (error) throw error;
      if (data) {
        setUsers(data.map((u) => ({
          ...u,
          id: u.id,
          name: u.display_name || u.username,
          roleLabel: u.user_roles?.[0]?.roles?.role_name || 'Operator',
          role: u.user_roles?.[0]?.roles?.role_name || 'machine_operator',
          email: `${u.username}@automfg.io`,
          plant: u.plant || 'Plant A'
        })));
      }
    } catch (e) {
      console.warn('[AdminPanel] Failed to load users:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudit(); fetchUsers(); }, []);

  const filteredAudit = auditLog.filter((a) => {
    if (!auditSearch) return true;
    const s = auditSearch.toLowerCase();
    const username = (a.profiles?.display_name || a.profiles?.username || a.user_id || '').toLowerCase();
    return a.entity?.toLowerCase().includes(s) || a.action?.toLowerCase().includes(s) || username.includes(s);
  });

  if (user?.role !== 'sys_admin') {
    return (
      <div className="card" style={{ margin: 'auto', maxWidth: 400, textAlign: 'center', padding: 40 }}>
        <Shield size={32} color="var(--red)" style={{ margin: '0 auto 16px' }} />
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, color: 'var(--red)' }}>Access Denied</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted-text)', marginTop: 8 }}>System Admin role required</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block"><h1 className="page-title">Admin Panel</h1><div className="page-subtitle">User Management & Audit Trail</div></div>
        <div className="page-actions">
          <button className="icon-btn" onClick={() => { fetchAudit(); fetchUsers(); }}><RefreshCw size={14} /></button>
          <span className="badge badge-red">RESTRICTED ACCESS</span>
        </div>
      </div>

      <div className="tabs">
        {[{ id: 'audit', label: 'Audit Trail' }, { id: 'users', label: 'Users & Roles' }, { id: 'masters', label: 'System Info' }].map((t) => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Audit Log</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-text)' }} />
                <input className="form-input" placeholder="Search entity, action, user..." value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} style={{ paddingLeft: 28, width: 220 }} />
              </div>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)', alignSelf: 'center' }}>{filteredAudit.length} ENTRIES</span>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Timestamp</th><th>User</th><th>Entity</th><th>Action</th><th>Payload</th></tr></thead>
              <tbody>
                {loading ? [1,2,3,4,5].map((i) => <tr key={i}><td colSpan={5}><div style={{ height: 36, background: 'linear-gradient(90deg,#181818,#222,#181818)', animation: 'shimmer 1.5s infinite' }} /></td></tr>) :
                  filteredAudit.map((entry) => (
                    <tr key={entry.audit_id}>
                      <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{entry.timestamp?.slice(0, 16).replace('T', ' ')}</td>
                      <td style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, color: 'var(--white)' }}>{entry.profiles?.display_name || entry.profiles?.username || entry.user_id || 'System'}</td>
                      <td><span className={`badge ${ENTITY_COLOR[entry.entity] || 'badge-gray'}`}>{entry.entity}</span></td>
                      <td><span className={`badge ${ACTION_COLOR[entry.action] || 'badge-gray'}`}>{entry.action?.toUpperCase()}</span></td>
                      <td>
                        {entry.payload && (
                          <button className="btn btn-sm btn-outline" onClick={() => setSelectedPayload(entry.payload)} style={{ padding: '2px 8px' }}>
                            <Eye size={10} /> View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USERS */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Users & Roles</span><span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>{users.length} USERS</span></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Username</th><th>Name</th><th>Email</th><th>Role</th><th>Permissions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)', fontSize: 13 }}>{u.username}</td>
                    <td style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>{u.name}</td>
                    <td style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)' }}>{u.email || `${u.username}@automfg.io`}</td>
                    <td><span className="badge badge-blue">{u.roleLabel || u.role}</span></td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(ROLE_PERMISSIONS[u.role] || []).slice(0, 4).map((perm) => (
                          <span key={perm} className="badge badge-gray" style={{ fontSize: 9 }}>{perm}</span>
                        ))}
                        {(ROLE_PERMISSIONS[u.role] || []).length > 4 && <span className="badge badge-gray" style={{ fontSize: 9 }}>+{(ROLE_PERMISSIONS[u.role] || []).length - 4}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MASTERS */}
      {activeTab === 'masters' && (
        <div>
          <div className="grid grid-2">
            <div className="card">
              <div className="card-header"><span className="card-title">Role Permissions Map</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => (
                  <div key={role} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700, color: 'var(--white)', marginBottom: 6 }}>{role.replace(/_/g, ' ').toUpperCase()}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {perms.map((p) => <span key={p} className="badge badge-blue" style={{ fontSize: 9 }}>{p}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">System Configuration</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { key: 'Supabase Mode', value: isSupabaseConfigured() ? 'Connected' : 'Mock Mode', color: isSupabaseConfigured() ? 'var(--green)' : 'var(--amber)' },
                  { key: 'Realtime', value: 'Enabled (andon, notifications, breakdowns)', color: 'var(--green)' },
                  { key: 'Offline Queue', value: 'IndexedDB sync enabled', color: 'var(--bmw-blue)' },
                  { key: 'Audit Trail', value: 'All entities tracked', color: 'var(--green)' },
                  { key: 'PDF Generation', value: '@react-pdf/renderer', color: 'var(--bmw-blue)' },
                  { key: 'Table Engine', value: 'TanStack Table v8', color: 'var(--bmw-blue)' },
                  { key: 'Form Validation', value: 'React Hook Form + Zod', color: 'var(--bmw-blue)' },
                ].map(({ key, value, color }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)', letterSpacing: '0.08em' }}>{key}</span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 600, color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payload viewer modal */}
      {selectedPayload && (
        <div className="modal-overlay" onClick={() => setSelectedPayload(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Payload Data</span><button className="icon-btn" onClick={() => setSelectedPayload(null)}>✕</button></div>
            <div className="modal-body">
              <pre style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)', background: 'var(--bg-elevated)', padding: 16, overflowX: 'auto', border: '1px solid var(--border)' }}>
                {JSON.stringify(selectedPayload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
