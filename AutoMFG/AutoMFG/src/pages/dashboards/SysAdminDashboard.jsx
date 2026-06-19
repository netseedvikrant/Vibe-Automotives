// SysAdminDashboard — System Admin role dashboard
// Shows: user management, RBAC, audit logs, data sync, security alerts
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, MOCK_USERS } from '../../store/authStore';
import { Users, Shield, Settings, FileText, GitMerge, AlertTriangle, CheckCircle2, RefreshCw, Eye, Lock, Database } from 'lucide-react';
import { MetricCard, IntegBadge, WorkflowSteps } from './shared';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import toast from 'react-hot-toast';

const MOCK_AUDIT = [
  { id: 'AUD-001', user: 'prod.manager', action: 'plan_approved', entity: 'PP-2026-002', ts: '2026-06-09 11:42', result: 'success' },
  { id: 'AUD-002', user: 'shift.super',  action: 'andon_resolved', entity: 'AND-001',    ts: '2026-06-09 11:20', result: 'success' },
  { id: 'AUD-003', user: 'qual.inspector', action: 'quality_gate_fail', entity: 'QG-012', ts: '2026-06-09 10:55', result: 'nok' },
  { id: 'AUD-004', user: 'maint.tech',   action: 'ticket_closed',  entity: 'BRK-003',   ts: '2026-06-09 10:30', result: 'success' },
  { id: 'AUD-005', user: 'sys.admin',    action: 'user_created',   entity: 'new.operator', ts: '2026-06-09 09:15', result: 'success' },
  { id: 'AUD-006', user: 'prod.planner', action: 'plan_submitted', entity: 'PP-2026-003', ts: '2026-06-09 08:50', result: 'success' },
];

const MOCK_SYNC = [
  { system: 'AutoRnD → AutoMFG', type: 'from_rnd',  entity: 'MBOM v3.2 — BMW M4',      status: 'synced',       ts: '2026-06-09 07:00' },
  { system: 'AutoRnD → AutoMFG', type: 'from_rnd',  entity: 'Control Plan CP-M4-2026', status: 'synced',       ts: '2026-06-09 06:45' },
  { system: 'AutoMFG → AutoSCM', type: 'to_scm',    entity: 'Scrap Cert SC-0042',       status: 'sync_pending', ts: '2026-06-09 11:30' },
  { system: 'AutoMFG → AutoSCM', type: 'to_scm',    entity: 'Prod Schedule W24',        status: 'synced',       ts: '2026-06-09 08:00' },
  { system: 'AutoMFG → AutoSCM', type: 'to_scm',    entity: 'EOL Cert EOL-2026-0089',   status: 'synced',       ts: '2026-06-09 10:15' },
];

const ROLE_COLORS = {
  sys_admin: '#ff6400', plant_manager: '#9b59b6', production_manager: '#1c69d4',
  production_planner: '#1cd46a', shift_supervisor: '#ffb300', line_leader: '#e74c3c',
  machine_operator: '#3498db', quality_inspector: '#2ecc71', maintenance_tech: '#e67e22',
  ceo: '#1c69d4',
};

const mapHandoffToSyncItem = (h) => {
  const isFromRnd = h.source_module === 'AutoRnD';
  const system = isFromRnd ? 'AutoRnD → AutoMFG' : 'AutoMFG → AutoSCM';
  const type = isFromRnd ? 'from_rnd' : 'to_scm';
  
  let entity = '';
  let qtyInfo = '';
  try {
    const payload = typeof h.payload === 'string' ? JSON.parse(h.payload) : h.payload;
    entity = payload?.entity || payload?.certificate_id || payload?.plan_code || payload?.vin || h.handoff_type || 'Unknown';
    if (payload?.quantity) {
      qtyInfo = ` — ${payload.quantity} pcs`;
    } else if (payload?.materials && Array.isArray(payload.materials)) {
      const totalQty = payload.materials.reduce((acc, m) => acc + (m.quantity || 0), 0);
      if (totalQty > 0) {
        qtyInfo = ` — ${totalQty} pcs`;
      }
    }
  } catch (e) {
    entity = h.handoff_type || 'Unknown';
  }
  
  if (entity.startsWith('SC-') || h.handoff_type === 'SCRAP_CERTIFICATE') {
    entity = `Scrap Cert ${entity.includes('SC-') ? entity : 'SC-0042'}${qtyInfo}`;
  } else if (entity.startsWith('EOL-') || h.handoff_type === 'FINISHED_GOODS_RELEASE' || h.handoff_type === 'EOL_CERTIFICATE') {
    entity = `EOL Cert ${entity.includes('EOL-') ? entity : 'EOL-2026-0089'}`;
  } else if (h.handoff_type === 'PRODUCTION_SCHEDULE' || h.handoff_type === 'FROZEN_PLAN') {
    entity = `Prod Schedule ${entity.includes('PLAN-') || entity.includes('W24') ? entity : 'W24'}`;
  }

  const status = h.status === 'Synced' ? 'synced' : 'sync_pending';
  
  const date = new Date(h.created_at);
  const ts = date.toISOString().slice(0, 16).replace('T', ' ');

  return {
    id: h.id,
    system,
    type,
    entity,
    status,
    ts
  };
};

export default function SysAdminDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [syncItems, setSyncItems] = useState(MOCK_SYNC);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // User management state
  const [usersList, setUsersList] = useState([]);
  const [dbRoles, setDbRoles] = useState([]);

  // Fetch db roles to map role_name to role_id
  const fetchDbRoles = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data, error } = await supabase.from('roles').select('*');
      if (error) throw error;
      if (data) setDbRoles(data);
    } catch (e) {
      console.warn("Failed to fetch database roles:", e);
    }
  };

  const getRoleId = (roleName) => {
    const found = dbRoles.find(r => r.role_name === roleName);
    return found ? found.role_id : null;
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        const saved = localStorage.getItem('mfg_users');
        if (saved) {
          setUsersList(JSON.parse(saved));
        } else {
          setUsersList(MOCK_USERS.filter(u => u.role !== 'ceo'));
        }
        return;
      }

      // Fetch profiles
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .order('username');

      if (pError) throw pError;

      // Fetch user roles
      const { data: userRoles, error: urError } = await supabase
        .from('user_roles')
        .select('user_id, roles(role_name)');

      if (urError) throw urError;

      if (profiles) {
        const roleLabelMap = {
          sys_admin: 'System Admin',
          plant_manager: 'Plant Manager',
          production_manager: 'Production Manager',
          production_planner: 'Production Planner',
          shift_supervisor: 'Shift Supervisor',
          line_leader: 'Line Leader',
          machine_operator: 'Machine Operator',
          quality_inspector: 'Quality Inspector',
          maintenance_tech: 'Maintenance Tech'
        };

        const mapped = profiles.map((u) => {
          const userRoleRecord = userRoles?.find(ur => ur.user_id === u.id);
          const role = userRoleRecord?.roles?.role_name || 'machine_operator';
          return {
            id: u.id,
            name: u.display_name || u.username,
            username: u.username,
            role,
            roleLabel: roleLabelMap[role] || role,
            department: role === 'sys_admin' ? 'Admin' : role === 'plant_manager' || role === 'production_manager' ? 'Management' : 'Production',
            plant: u.plant || 'Plant A',
            email: `${u.username}@automfg.io`
          };
        });
        setUsersList(mapped);
        localStorage.setItem('mfg_users', JSON.stringify(mapped));
      }
    } catch (err) {
      console.warn("Failed to fetch users from database, using fallback:", err);
      const saved = localStorage.getItem('mfg_users');
      if (saved) {
        setUsersList(JSON.parse(saved));
      } else {
        setUsersList(MOCK_USERS.filter(u => u.role !== 'ceo'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDbRoles();
  }, []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('view'); // 'view' | 'edit' | 'add'
  const [selectedUser, setSelectedUser] = useState(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formRole, setFormRole] = useState('machine_operator');
  const [formDepartment, setFormDepartment] = useState('');
  const [formPlant, setFormPlant] = useState('Plant A');
  const [formShift, setFormShift] = useState('Shift A');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');

  const handleOpenAddModal = () => {
    setModalMode('add');
    setSelectedUser(null);
    setFormName('');
    setFormUsername('');
    setFormRole('machine_operator');
    setFormDepartment('');
    setFormPlant('Plant A');
    setFormShift('Shift A');
    setFormEmail('');
    setFormPassword('User123!');
    setIsModalOpen(true);
  };

  const handleViewUser = (u) => {
    setModalMode('view');
    setSelectedUser(u);
    setFormName(u.name || '');
    setFormUsername(u.username || '');
    setFormRole(u.role || 'machine_operator');
    setFormDepartment(u.department || '');
    setFormPlant(u.plant || 'Plant A');
    setFormShift(u.shift || 'Shift A');
    setFormEmail(u.email || '');
    setFormPassword('');
    setIsModalOpen(true);
  };

  const handleEditUser = (u) => {
    setModalMode('edit');
    setSelectedUser(u);
    setFormName(u.name || '');
    setFormUsername(u.username || '');
    setFormRole(u.role || 'machine_operator');
    setFormDepartment(u.department || '');
    setFormPlant(u.plant || 'Plant A');
    setFormShift(u.shift || 'Shift A');
    setFormEmail(u.email || '');
    setFormPassword(u.password || '');
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!formName || !formUsername || !formEmail) {
      toast.error('Please fill in Name, Username, and Email.');
      return;
    }

    const roleLabelMap = {
      sys_admin: 'System Admin',
      plant_manager: 'Plant Manager',
      production_manager: 'Production Manager',
      production_planner: 'Production Planner',
      shift_supervisor: 'Shift Supervisor',
      line_leader: 'Line Leader',
      machine_operator: 'Machine Operator',
      quality_inspector: 'Quality Inspector',
      maintenance_tech: 'Maintenance Tech'
    };

    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        if (modalMode === 'add') {
          if (usersList.some(u => u.username.toLowerCase() === formUsername.toLowerCase())) {
            toast.error('Username already exists!');
            setLoading(false);
            return;
          }

          const newUser = {
            id: Math.random().toString(36).substring(2, 9),
            name: formName,
            username: formUsername.toLowerCase(),
            password: formPassword || 'User123!',
            role: formRole,
            roleLabel: roleLabelMap[formRole] || formRole,
            department: formDepartment,
            plant: formPlant,
            shift: formShift,
            email: formEmail
          };

          const updated = [...usersList, newUser];
          setUsersList(updated);
          localStorage.setItem('mfg_users', JSON.stringify(updated));
          toast.success('User added successfully (Local)!');
        } else if (modalMode === 'edit') {
          if (usersList.some(u => u.id !== selectedUser.id && u.username.toLowerCase() === formUsername.toLowerCase())) {
            toast.error('Username already exists!');
            setLoading(false);
            return;
          }

          const updatedList = usersList.map(u => {
            if (u.id === selectedUser.id) {
              return {
                ...u,
                name: formName,
                username: formUsername.toLowerCase(),
                password: formPassword || u.password,
                role: formRole,
                roleLabel: roleLabelMap[formRole] || formRole,
                department: formDepartment,
                plant: formPlant,
                shift: formShift,
                email: formEmail
              };
            }
            return u;
          });

          setUsersList(updatedList);
          localStorage.setItem('mfg_users', JSON.stringify(updatedList));
          toast.success('User updated successfully (Local)!');
        }
        setIsModalOpen(false);
        setLoading(false);
        return;
      }

      // Supabase mode
      if (modalMode === 'add') {
        if (usersList.some(u => u.username.toLowerCase() === formUsername.toLowerCase())) {
          toast.error('Username already exists in database!');
          setLoading(false);
          return;
        }

        // 1. Sign up user in Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formEmail,
          password: formPassword || 'User123!'
        });

        if (authError) throw authError;

        const newUserId = authData.user?.id;
        if (!newUserId) throw new Error("Could not retrieve user ID from sign up response");

        // 2. Insert profile manually
        const { error: pError } = await supabase.from('profiles').insert({
          id: newUserId,
          username: formUsername.toLowerCase(),
          display_name: formName,
          plant: formPlant,
          status: 'active'
        });

        if (pError) throw pError;

        // 3. Assign role
        const roleId = getRoleId(formRole);
        if (roleId) {
          const { error: urError } = await supabase.from('user_roles').insert({
            user_id: newUserId,
            role_id: roleId
          });
          if (urError) throw urError;
        }

        toast.success('User registered in database successfully!');
      } else if (modalMode === 'edit') {
        // 1. Update profiles table
        const { error: pError } = await supabase
          .from('profiles')
          .update({
            display_name: formName,
            plant: formPlant
          })
          .eq('id', selectedUser.id);

        if (pError) throw pError;

        // 2. Update user_roles
        const roleId = getRoleId(formRole);
        if (roleId) {
          // Delete old role mappings
          await supabase.from('user_roles').delete().eq('user_id', selectedUser.id);
          // Insert new role mapping
          const { error: urError } = await supabase.from('user_roles').insert({
            user_id: selectedUser.id,
            role_id: roleId
          });
          if (urError) throw urError;
        }

        toast.success('User details updated in database successfully!');
      }

      await fetchUsers();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Failed to save user in database:", err);
      toast.error("Database sync failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncItems = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        setSyncItems(MOCK_SYNC);
        return;
      }

      const { data, error } = await supabase
        .from('scm_handoffs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setSyncItems(data.map(mapHandoffToSyncItem));
      } else {
        setSyncItems(MOCK_SYNC);
      }
    } catch (err) {
      console.error("Failed to fetch integration sync logs:", err);
      setSyncItems(MOCK_SYNC);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncItems();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const channel = supabase.channel('scm_handoffs_sysadmin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scm_handoffs' }, () => {
        fetchSyncItems();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      if (!isSupabaseConfigured()) {
        setSyncItems(prev => prev.map(item => ({ ...item, status: 'synced' })));
        toast.success("Successfully synchronized pending data handoffs to AutoSCM!");
        return;
      }

      const { error } = await supabase
        .from('scm_handoffs')
        .update({ status: 'Synced', synced_at: new Date().toISOString() })
        .eq('status', 'Pending');

      if (error) throw error;

      toast.success("Successfully synchronized pending data handoffs to AutoSCM!");
      await fetchSyncItems();
    } catch (err) {
      console.error("Force sync failed:", err);
      toast.error("Failed to sync: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingCount = syncItems.filter(item => item.status === 'sync_pending').length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">System Administration</h1>
          <div className="page-subtitle">User Management · RBAC · Audit · Integration Monitor — {user?.plant}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin')}>
            <Users size={13} /> Manage Users
          </button>
          <span className="badge badge-green"><span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: '50%', display: 'inline-block' }} /> LIVE</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-4 mb-16">
        <MetricCard label="Total Users" value={usersList.length} color="blue" icon={Users} subtitle="All roles · All plants" />
        <MetricCard label="Active Sessions" value={3} color="green" icon={CheckCircle2} subtitle="Currently logged in" />
        <MetricCard label="Sync Pending" value={pendingCount} color={pendingCount > 0 ? "amber" : "green"} icon={GitMerge} subtitle="AutoMFG → AutoSCM" />
        <MetricCard label="Security Alerts" value={0} color="red" icon={AlertTriangle} subtitle="Last 24 hours" />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'users', label: 'Users & Roles', icon: Users },
          { id: 'audit', label: 'Audit Log', icon: FileText },
          { id: 'sync', label: 'Integration Monitor', icon: GitMerge },
          { id: 'rbac', label: 'RBAC Matrix', icon: Shield },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '8px 20px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === id ? 'var(--bmw-blue)' : 'transparent'}`,
            color: activeTab === id ? 'var(--bmw-blue)' : 'var(--muted-text)',
            fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      {/* Users & Roles Tab */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">User Registry</span>
            <button className="btn btn-primary btn-sm" onClick={handleOpenAddModal}><Users size={12} /> Add User</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Username', 'Role', 'Department', 'Plant', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', color: 'var(--muted-text)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usersList.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: ROLE_COLORS[u.role] || 'var(--bmw-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {(u.name || '').split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)' }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)' }}>{u.username}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', background: `${ROLE_COLORS[u.role]}20`, border: `1px solid ${ROLE_COLORS[u.role]}50`, color: ROLE_COLORS[u.role], fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em' }}>
                      {u.roleLabel}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)' }}>{u.department}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)' }}>{u.plant}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-outline" onClick={() => handleViewUser(u)}><Eye size={11} /> View</button>
                      <button className="btn btn-sm btn-outline" onClick={() => handleEditUser(u)}><Settings size={11} /> Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">System Audit Trail</span>
            <button className="btn btn-sm btn-outline"><FileText size={12} /> Export Report</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Timestamp', 'User', 'Action', 'Entity', 'Result'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', color: 'var(--muted-text)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_AUDIT.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>{a.ts}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-primary)' }}>{a.user}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--bmw-blue)' }}>{a.action.replace(/_/g, ' ').toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)' }}>{a.entity}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className={`badge ${a.result === 'success' ? 'badge-green' : a.result === 'nok' ? 'badge-red' : 'badge-amber'}`}>
                      {a.result.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Integration Monitor Tab */}
      {activeTab === 'sync' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">AutoRnD ↔ AutoMFG ↔ AutoSCM Data Sync</span>
            <button 
              className="btn btn-sm btn-outline"
              onClick={handleForceSync}
              disabled={isSyncing}
            >
              <RefreshCw size={12} className={isSyncing ? 'spin-animation' : ''} style={{ marginRight: 6 }} /> 
              {isSyncing ? 'Syncing...' : 'Force Sync'}
            </button>
          </div>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 12 }}>
              Loading integration handoffs...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {syncItems.map((s, i) => (
                <div key={s.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <IntegBadge type={s.type} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>{s.entity}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>{s.system}</div>
                  </div>
                  <IntegBadge type={s.status} />
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)' }}>{s.ts}</span>
                </div>
              ))}
              {syncItems.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 12 }}>
                  No integration data handoffs recorded.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* RBAC Matrix Tab */}
      {activeTab === 'rbac' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Role Permission Matrix</span>
            <span className="badge badge-blue">READ ONLY VIEW</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Module</th>
                  {['Sys Admin', 'Plant Mgr', 'Prod Mgr', 'Planner', 'Supervisor', 'Line Leader', 'Operator', 'QI', 'Maint'].map(r => (
                    <th key={r} style={{ padding: '8px 8px', textAlign: 'center', fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { mod: 'Dashboard',          perms: [1,1,1,1,1,1,1,1,1] },
                  { mod: 'Production Planning', perms: [1,1,1,1,0,0,0,0,0] },
                  { mod: 'Plan Approval',      perms: [1,1,1,0,0,0,0,0,0] },
                  { mod: 'Work Orders',        perms: [1,1,1,1,1,1,1,0,0] },
                  { mod: 'Assembly & Takt',    perms: [1,1,1,0,1,1,1,0,0] },
                  { mod: 'Tooling',            perms: [1,1,0,0,1,1,0,0,1] },
                  { mod: 'Shift Handover',     perms: [1,1,1,0,1,0,0,0,0] },
                  { mod: 'Scrap / Rework',     perms: [1,1,1,0,1,1,0,1,0] },
                  { mod: 'Quality Gate',       perms: [1,1,1,0,0,0,0,1,0] },
                  { mod: 'Maintenance',        perms: [1,1,0,0,1,0,1,0,1] },
                  { mod: 'EOL Testing',        perms: [1,1,1,0,0,0,0,1,0] },
                  { mod: 'OEE Dashboard',      perms: [1,1,1,1,0,0,0,1,0] },
                  { mod: 'Admin / Audit',      perms: [1,0,0,0,0,0,0,0,0] },
                ].map(({ mod, perms }) => (
                  <tr key={mod} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-primary)' }}>{mod}</td>
                    {perms.map((p, i) => (
                      <td key={i} style={{ padding: '9px 8px', textAlign: 'center' }}>
                        <span style={{ color: p ? 'var(--green)' : 'var(--border)', fontWeight: 700, fontSize: 14 }}>{p ? '✓' : '—'}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Management Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <span className="modal-title">
                {modalMode === 'add' ? 'Add New User' : modalMode === 'edit' ? 'Edit User Details' : 'View User Profile'}
              </span>
              <button 
                onClick={() => setIsModalOpen(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--muted-text)', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formName} 
                    onChange={(e) => setFormName(e.target.value)} 
                    disabled={modalMode === 'view'} 
                    placeholder="e.g. John Doe"
                    required
                  />
                </div>
                
                <div className="grid grid-2" style={{ gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formUsername} 
                      onChange={(e) => setFormUsername(e.target.value)} 
                      disabled={modalMode === 'view'} 
                      placeholder="e.g. john.doe"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={formEmail} 
                      onChange={(e) => setFormEmail(e.target.value)} 
                      disabled={modalMode === 'view'} 
                      placeholder="john.doe@automfg.io"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-2" style={{ gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">System Role</label>
                    <select 
                      className="form-select" 
                      value={formRole} 
                      onChange={(e) => setFormRole(e.target.value)} 
                      disabled={modalMode === 'view'}
                    >
                      <option value="sys_admin">System Admin</option>
                      <option value="plant_manager">Plant Manager</option>
                      <option value="production_manager">Production Manager</option>
                      <option value="production_planner">Production Planner</option>
                      <option value="shift_supervisor">Shift Supervisor</option>
                      <option value="line_leader">Line Leader</option>
                      <option value="machine_operator">Machine Operator</option>
                      <option value="quality_inspector">Quality Inspector</option>
                      <option value="maintenance_tech">Maintenance Tech</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formDepartment} 
                      onChange={(e) => setFormDepartment(e.target.value)} 
                      disabled={modalMode === 'view'} 
                      placeholder="e.g. Assembly, Quality"
                    />
                  </div>
                </div>

                <div className="grid grid-2" style={{ gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Plant Assignment</label>
                    <select 
                      className="form-select" 
                      value={formPlant} 
                      onChange={(e) => setFormPlant(e.target.value)} 
                      disabled={modalMode === 'view'}
                    >
                      <option value="Plant A">Plant A</option>
                      <option value="Plant B">Plant B</option>
                      <option value="All Plants">All Plants</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shift Assignment</label>
                    <select 
                      className="form-select" 
                      value={formShift} 
                      onChange={(e) => setFormShift(e.target.value)} 
                      disabled={modalMode === 'view'}
                    >
                      <option value="All">All Shifts</option>
                      <option value="Shift A">Shift A</option>
                      <option value="Shift B">Shift B</option>
                      <option value="Shift C">Shift C</option>
                    </select>
                  </div>
                </div>

                {modalMode !== 'view' && (
                  <div className="form-group">
                    <label className="form-label">Access Password</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      value={formPassword} 
                      onChange={(e) => setFormPassword(e.target.value)} 
                      placeholder={modalMode === 'add' ? 'User123!' : 'Leave blank to keep current password'}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline" 
                  onClick={() => setIsModalOpen(false)}
                >
                  {modalMode === 'view' ? 'Close' : 'Cancel'}
                </button>
                {modalMode !== 'view' && (
                  <button type="submit" className="btn btn-sm btn-primary">
                    Save Changes
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
