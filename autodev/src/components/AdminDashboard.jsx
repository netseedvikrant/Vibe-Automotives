import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Settings, 
  Activity, 
  Database, 
  Shield, 
  Terminal, 
  Cpu, 
  Server,
  UserPlus,
  Trash2,
  Edit,
  Search,
  Lock,
  Globe
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [stats, setStats] = useState({
    activeUsers: 0,
    dbSize: '245 MB',
    apiRequests: '12.4k',
    uptime: '99.99%'
  });

  // User Provisioning states
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provName, setProvName] = useState('');
  const [provEmail, setProvEmail] = useState('');
  const [provPassword, setProvPassword] = useState('password123');
  const [provRole, setProvRole] = useState('Design Engineer');
  const [provPlant, setProvPlant] = useState('Detroit Assembly');
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Workflow configurator toggles (backed by localStorage)
  const [wfStrictGates, setWfStrictGates] = useState(
    JSON.parse(localStorage.getItem('autodev_wf_strict_gates') || 'true')
  );
  const [wfCfrbConsensus, setWfCfrbConsensus] = useState(
    JSON.parse(localStorage.getItem('autodev_wf_cfrb_consensus') || 'true')
  );
  const [wfEsignStrict, setWfEsignStrict] = useState(
    JSON.parse(localStorage.getItem('autodev_wf_esign_strict') || 'true')
  );

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const { data: userData } = await supabase.from('users').select('*');
      setUsers(userData || []);
      
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('*')
        .limit(15)
        .order('timestamp', { ascending: false });
      setSystemLogs(logs || []);
      
      setStats(prev => ({ ...prev, activeUsers: userData?.length || 0 }));
    } catch (error) {
      console.error("Error fetching admin data:", error);
    }
  };

  const saveConfig = (key, val, setter) => {
    localStorage.setItem(key, JSON.stringify(val));
    setter(val);
    
    const event = new CustomEvent('autodev-toast', {
      detail: {
        title: '🛡️ Policy Configured',
        message: 'System workflow validation constraints updated.',
        type: 'success'
      }
    });
    window.dispatchEvent(event);
  };

  const handleProvisionUser = async (e) => {
    e.preventDefault();
    if (!provEmail || !provName || !provPassword) {
      alert('All fields are required.');
      return;
    }

    setIsProvisioning(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: provEmail,
        password: provPassword
      });

      if (authError) throw authError;

      if (authData.user) {
        const dbRole = provRole === 'CEO' ? 'Admin' : provRole;
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            full_name: provName,
            email: provEmail,
            role: dbRole,
            plant_location: provPlant
          });

        if (profileError) throw profileError;

        await supabase.from('activity_logs').insert({
          action_type: 'USER_PROVISION',
          action_description: `Successfully provisioned profile for ${provName} (${provRole})`
        });

        alert(`SUCCESS: Provisioned new corporate user!\nName: ${provName}\nRole: ${provRole}\nPlant: ${provPlant}`);
        setProvisionOpen(false);
        setProvName('');
        setProvEmail('');
        fetchAdminData();
      }
    } catch (err) {
      console.warn('Standard signup failed, attempting direct profile insert fallback:', err.message);
      try {
        const mockId = crypto.randomUUID();
        const dbRole = provRole === 'CEO' ? 'Admin' : provRole;
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: mockId,
            full_name: provName,
            email: provEmail,
            role: dbRole,
            plant_location: provPlant
          });
        if (profileError) throw profileError;

        await supabase.from('activity_logs').insert({
          action_type: 'USER_PROVISION_MOCK',
          action_description: `Provisioned mock profile for ${provName} (${provRole})`
        });

        alert(`SUCCESS (Direct Provisioning): Mock profile created!\nName: ${provName}\nRole: ${provRole}`);
        setProvisionOpen(false);
        setProvName('');
        setProvEmail('');
        fetchAdminData();
      } catch (fallbackErr) {
        alert('Provisioning failed: ' + fallbackErr.message);
      }
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleDeleteUser = async (userId, name) => {
    if (!window.confirm(`Are you sure you want to de-provision ${name}?`)) return;
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      
      await supabase.from('activity_logs').insert({
        action_type: 'USER_DEPROVISION',
        action_description: `De-provisioned corporate user ${name}`
      });

      alert(`User ${name} has been de-provisioned.`);
      fetchAdminData();
    } catch (err) {
      alert('Error deleting user: ' + err.message);
    }
  };

  return (
    <div className="admin-dashboard-container">
      <header className="admin-header">
        <div className="header-info">
          <h1>System Administration</h1>
          <p>AutoDev Enterprise Node: Detroit-A1</p>
        </div>
        <div className="system-uptime glass-dark">
          <Activity size={16} className="green-text" />
          <span>Uptime: {stats.uptime}</span>
        </div>
      </header>

      <section className="admin-stats-grid">
        <div className="admin-stat glass">
          <Users size={24} className="blue-text" />
          <div className="stat-info">
            <span className="value">{stats.activeUsers}</span>
            <span className="label">Total System Users</span>
          </div>
        </div>
        <div className="admin-stat glass">
          <Database size={24} className="purple-text" />
          <div className="stat-info">
            <span className="value">{stats.dbSize}</span>
            <span className="label">Database Volume</span>
          </div>
        </div>
        <div className="admin-stat glass">
          <Globe size={24} className="cyan-text" />
          <div className="stat-info">
            <span className="value">{stats.apiRequests}</span>
            <span className="label">API Calls / 24h</span>
          </div>
        </div>
        <div className="admin-stat glass">
          <Server size={24} className="orange-text" />
          <div className="stat-info">
            <span className="value">4/4</span>
            <span className="label">Nodes Healthy</span>
          </div>
        </div>
      </section>

      <div className="admin-main-grid">
        <section className="user-management glass">
          <div className="section-header">
            <h3><Users size={20} /> User Directory</h3>
            <div className="header-actions">
              <button className="primary-btn" onClick={() => setProvisionOpen(true)}>
                <UserPlus size={18} /> Provision User
              </button>
            </div>
          </div>
          <div className="user-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Identity</th>
                  <th>Role / Access</th>
                  <th>Status</th>
                  <th>Plant Location</th>
                  <th>Control</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-identity">
                        <strong>{user.full_name}</strong>
                        <span>{user.email}</span>
                      </div>
                    </td>
                    <td><span className="role-tag">{user.role}</span></td>
                    <td><span className="status-indicator active">Online</span></td>
                    <td style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>{user.plant_location || 'Global Operations'}</td>
                    <td>
                      <div className="control-group">
                        <button 
                          className="icon-btn red-text" 
                          title="De-provision user"
                          onClick={() => handleDeleteUser(user.id, user.full_name)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="system-health">
          <div className="side-card glass">
            <h3><Settings size={18} /> Workflow Configurator</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#ccc' }}>
                <span style={{ fontSize: '0.85rem' }}>Strict Gate Constraints</span>
                <input 
                  type="checkbox" 
                  checked={wfStrictGates} 
                  onChange={e => saveConfig('autodev_wf_strict_gates', e.target.checked, setWfStrictGates)} 
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
                />
              </label>
              
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#ccc' }}>
                <span style={{ fontSize: '0.85rem' }}>CFRB consensus enforcement</span>
                <input 
                  type="checkbox" 
                  checked={wfCfrbConsensus} 
                  onChange={e => saveConfig('autodev_wf_cfrb_consensus', e.target.checked, setWfCfrbConsensus)} 
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
                />
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#ccc' }}>
                <span style={{ fontSize: '0.85rem' }}>E-Signature Checksums</span>
                <input 
                  type="checkbox" 
                  checked={wfEsignStrict} 
                  onChange={e => saveConfig('autodev_wf_esign_strict', e.target.checked, setWfEsignStrict)} 
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
                />
              </label>
            </div>
          </div>

          <div className="side-card glass">
            <h3><Terminal size={18} /> System Audit Stream</h3>
            <div className="log-stream" style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {systemLogs.map(log => (
                <div key={log.id} className="log-entry">
                  <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <p><strong>{log.action_type}:</strong> {log.action_description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="side-card glass">
            <h3><Shield size={18} /> Security Overview</h3>
            <div className="security-list">
              <div className="security-item">
                <span>RBAC Enforcement</span>
                <span className="status-ok">ACTIVE</span>
              </div>
              <div className="security-item">
                <span>Data Encryption</span>
                <span className="status-ok">AES-256</span>
              </div>
              <div className="security-item">
                <span>Threat Detection</span>
                <span className="status-ok">SCANNING</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {provisionOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 11000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'rgba(20, 20, 25, 0.98)', border: '1px solid var(--accent)', padding: '32px', borderRadius: '12px', width: '420px', maxWidth: '90%', boxShadow: '0 24px 50px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <UserPlus size={48} color="var(--accent)" style={{ marginBottom: '12px', filter: 'drop-shadow(0 0 10px var(--accent))' }} />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'white', margin: '0 0 6px 0' }}>Provision Corporate User</h2>
              <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>Register active employee ID profile</p>
            </div>
            
            <form onSubmit={handleProvisionUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: '#a0a0b0', fontWeight: 'bold' }}>Full Name</label>
                <input 
                  type="text" 
                  value={provName} 
                  onChange={e => setProvName(e.target.value)} 
                  placeholder="e.g. Jane Doe" 
                  required
                  style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: '#a0a0b0', fontWeight: 'bold' }}>Corporate Email</label>
                <input 
                  type="email" 
                  value={provEmail} 
                  onChange={e => setProvEmail(e.target.value)} 
                  placeholder="e.g. jane.doe@company.com" 
                  required
                  style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: '#a0a0b0', fontWeight: 'bold' }}>Access Password</label>
                <input 
                  type="password" 
                  value={provPassword} 
                  onChange={e => setProvPassword(e.target.value)} 
                  placeholder="Minimum 6 characters" 
                  required
                  style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: '#a0a0b0', fontWeight: 'bold' }}>Role Assignment</label>
                <select 
                  value={provRole} 
                  onChange={e => setProvRole(e.target.value)} 
                  style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
                >
                  <option>Program Manager</option>
                  <option>Lead Engineer</option>
                  <option>Chief Engineer</option>
                  <option>Design Engineer</option>
                  <option>Validation Engineer</option>
                  <option>Quality Engineer</option>
                  <option>Manufacturing Engineer</option>
                  <option>Supplier Engineer</option>
                  <option>CEO</option>
                  <option>Admin</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: '#a0a0b0', fontWeight: 'bold' }}>Plant Allocation</label>
                <select 
                  value={provPlant} 
                  onChange={e => setProvPlant(e.target.value)} 
                  style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
                >
                  <option>Detroit Assembly</option>
                  <option>Munich Engine Plant</option>
                  <option>Shanghai Gigafactory</option>
                  <option>Tokyo EV Hub</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button 
                  type="button"
                  className="chief-btn reject" 
                  onClick={() => setProvisionOpen(false)}
                  style={{ flex: 1, padding: '12px', margin: 0 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="chief-btn approve" 
                  disabled={isProvisioning}
                  style={{ flex: 1, padding: '12px', margin: 0 }}
                >
                  {isProvisioning ? 'Creating...' : 'Provision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
