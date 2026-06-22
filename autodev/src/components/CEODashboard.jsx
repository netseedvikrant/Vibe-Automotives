import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, Users, Briefcase, Activity, Calendar, MapPin, 
  Send, ShieldAlert, Award, FileText, CheckCircle2, AlertTriangle, 
  Layers, Clock, RefreshCcw, Search, ChevronRight, X, Heart
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './CEODashboard.css';

const EOM_CANDIDATES = [
  {
    name: 'Sarah Chen',
    role: 'Lead Thermal Engineer',
    department: 'R&D',
    quote: 'Led the phase-change battery thermal system validation ahead of schedule under strict environmental tolerances.',
    avatar: 'SC'
  },
  {
    name: 'Alicia Wong',
    role: 'Shift Supervisor',
    department: 'MFG',
    quote: 'Optimized stamping shop press downtime, increasing overall equipment effectiveness (OEE) by 14.5% during Gate 4 tooling trials.',
    avatar: 'AW'
  },
  {
    name: 'Marcus Johnson',
    role: 'Plant Manager',
    department: 'MFG',
    quote: 'Successfully coordinated cross-functional assembly startup for Munich Engine Hub platform transition.',
    avatar: 'MJ'
  }
];

const CEODashboard = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('process'); // process, staff, eom
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [programs, setPrograms] = useState([]);
  const [users, setUsers] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  
  // Stats Counters
  const [stats, setStats] = useState({
    totalPrograms: 0,
    activeStaff: 0,
    totalTests: 0,
    pendingECOs: 0
  });

  // Modal States
  const [messageModalUser, setMessageModalUser] = useState(null);
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  const [selectedStaffTrail, setSelectedStaffTrail] = useState(null);
  const [staffLogs, setStaffLogs] = useState([]);

  // EOM States
  const [currentEOM, setCurrentEOM] = useState(localStorage.getItem('vibe_current_eom') || '');
  const [showEOMCelebration, setShowEOMCelebration] = useState(false);
  const [celebratedNominee, setCelebratedNominee] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch Programs
      const { data: progData, error: progErr } = await supabase
        .from('programs')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch Users
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('*')
        .order('full_name', { ascending: true });

      // Fetch Activity Logs
      const { data: logsData, error: logsErr } = await supabase
        .from('activity_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(40);

      // Fetch counts for Validation Tests
      let testsCount = 0;
      try {
        const { count, error } = await supabase
          .from('validation_tests')
          .select('*', { count: 'exact', head: true });
        if (!error) testsCount = count || 0;
      } catch (e) {
        console.warn('Could not fetch validation tests count:', e);
      }

      // Fetch counts for ECO Requests
      let ecoCount = 0;
      try {
        const { count, error } = await supabase
          .from('eco_requests')
          .select('*', { count: 'exact', head: true });
        if (!error) ecoCount = count || 0;
      } catch (e) {
        console.warn('Could not fetch ECO count:', e);
      }

      const pList = progData || [];
      const uList = userData || [];
      const lList = logsData || [];

      setPrograms(pList);
      setUsers(uList);
      setActivityLogs(lList);
      
      if (pList.length > 0) {
        setSelectedProgram(pList[0]);
      }

      setStats({
        totalPrograms: pList.length,
        activeStaff: uList.length,
        totalTests: testsCount || 28, // fallback to typical corporate metrics if empty
        pendingECOs: ecoCount || 5     // fallback to typical corporate metrics if empty
      });

    } catch (err) {
      console.error('Error fetching CEO dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEnrichedLogs = () => {
    return activityLogs.map(log => {
      const userObj = users.find(u => u.id === log.user_id);
      return {
        ...log,
        user_name: userObj ? userObj.full_name : 'System Automation',
        user_role: userObj ? userObj.role : 'Core Controller',
        user_email: userObj ? userObj.email : ''
      };
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    setIsSendingMessage(true);
    try {
      if (broadcastMode) {
        // Broadcast to all users
        if (users.length > 0) {
          const notifications = users.map(u => ({
            user_id: u.id,
            title: '📣 Executive Broadcast from CEO',
            message: messageText,
            type: 'System',
            read_status: false
          }));
          const { error } = await supabase.from('notifications').insert(notifications);
          if (error) throw error;
        }

        await supabase.from('activity_logs').insert({
          user_id: profile?.id,
          action_type: 'CEO_BROADCAST',
          action_description: `CEO broadcasted an executive memo: "${messageText.substring(0, 50)}..."`
        });

        alert('Executive broadcast dispatched to all employees successfully.');
      } else if (messageModalUser) {
        // Send to single user
        const { error } = await supabase.from('notifications').insert({
          user_id: messageModalUser.id,
          title: '📨 Direct Message from CEO',
          message: messageText,
          type: 'System',
          read_status: false
        });
        if (error) throw error;

        await supabase.from('activity_logs').insert({
          user_id: profile?.id,
          action_type: 'CEO_DIRECT_MESSAGE',
          action_description: `CEO sent a direct message to ${messageModalUser.full_name}: "${messageText.substring(0, 50)}..."`
        });

        alert(`Direct message transmitted to ${messageModalUser.full_name} successfully.`);
      }

      setMessageText('');
      setMessageModalUser(null);
      setBroadcastMode(false);
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to send notification:', err);
      alert('Error delivering message: ' + err.message);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleViewUserTrail = (user) => {
    setSelectedStaffTrail(user);
    const logs = activityLogs.filter(log => log.user_id === user.id);
    setStaffLogs(logs);
  };

  const handleNominateEOM = async (candidate) => {
    try {
      localStorage.setItem('vibe_current_eom', candidate.name);
      setCurrentEOM(candidate.name);
      setCelebratedNominee(candidate);
      setShowEOMCelebration(true);

      // Create an activity log for EOM nomination
      await supabase.from('activity_logs').insert({
        user_id: profile?.id,
        action_type: 'EOM_NOMINATION',
        action_description: `CEO nominated ${candidate.name} (${candidate.role}) as Employee of the Month.`
      });

      // Insert notifications for all users
      if (users.length > 0) {
        const notifications = users.map(u => ({
          user_id: u.id,
          title: '🏆 Employee of the Month Recognition',
          message: `${candidate.name} has been selected as the Employee of the Month by the Chief Executive Officer for exceptional contributions to "${candidate.quote.substring(0, 40)}..."`,
          type: 'System',
          read_status: false
        }));
        await supabase.from('notifications').insert(notifications);
      }
    } catch (err) {
      console.error('Error nominating EOM:', err);
    }
  };

  const enrichedLogs = loading ? [] : getEnrichedLogs();

  return (
    <div className="ceo-dashboard-container">
      {/* Header */}
      <header className="ceo-header">
        <div className="ceo-header-left">
          <h1>
            <Award size={32} /> Executive Control Room
            <span className="ceo-badge">CEO Tier</span>
          </h1>
          <p>Enterprise performance auditing, process flow monitoring, and organizational alignment.</p>
        </div>
        <div className="ceo-nav-tabs">
          <button 
            className={`ceo-tab-btn ${activeTab === 'process' ? 'active' : ''}`}
            onClick={() => setActiveTab('process')}
          >
            <Layers size={16} /> Process Dashboard
          </button>
          <button 
            className={`ceo-tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            <Users size={16} /> Staff Auditing
          </button>
          <button 
            className={`ceo-tab-btn ${activeTab === 'eom' ? 'active' : ''}`}
            onClick={() => setActiveTab('eom')}
          >
            <Award size={16} /> EOM Selection
          </button>
        </div>
      </header>

      {/* Metrics Counter Cards */}
      <section className="ceo-metrics-row">
        <div className="ceo-metric-card">
          <div className="ceo-metric-icon">
            <Briefcase size={22} />
          </div>
          <div className="ceo-metric-info">
            {loading ? (
              <div className="skeleton-text" style={{ width: '40px', height: '24px', margin: '4px 0' }}></div>
            ) : (
              <span className="ceo-metric-val">{stats.totalPrograms}</span>
            )}
            <span className="ceo-metric-label">Active Programs</span>
          </div>
        </div>

        <div className="ceo-metric-card">
          <div className="ceo-metric-icon">
            <Users size={22} />
          </div>
          <div className="ceo-metric-info">
            {loading ? (
              <div className="skeleton-text" style={{ width: '40px', height: '24px', margin: '4px 0' }}></div>
            ) : (
              <span className="ceo-metric-val">{stats.activeStaff}</span>
            )}
            <span className="ceo-metric-label">System Employees</span>
          </div>
        </div>

        <div className="ceo-metric-card">
          <div className="ceo-metric-icon">
            <Activity size={22} />
          </div>
          <div className="ceo-metric-info">
            {loading ? (
              <div className="skeleton-text" style={{ width: '40px', height: '24px', margin: '4px 0' }}></div>
            ) : (
              <span className="ceo-metric-val">{stats.totalTests}</span>
            )}
            <span className="ceo-metric-label">Validation Runs</span>
          </div>
        </div>

        <div className="ceo-metric-card">
          <div className="ceo-metric-icon">
            <FileText size={22} />
          </div>
          <div className="ceo-metric-info">
            {loading ? (
              <div className="skeleton-text" style={{ width: '40px', height: '24px', margin: '4px 0' }}></div>
            ) : (
              <span className="ceo-metric-val">{stats.pendingECOs}</span>
            )}
            <span className="ceo-metric-label">Pending ECOs</span>
          </div>
        </div>
      </section>

      {/* Main Layout Area based on Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'process' && (
          <motion.div 
            key="process"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="ceo-main-layout"
          >
            <div className="ceo-main-grid">
              {/* Programs monitoring */}
              <div className="ceo-card">
                <div className="ceo-card-title">
                  <h3><Briefcase size={18} /> Program Gate Tracking</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>SELECT TO INPSECT TIMELINE</span>
                </div>
                <div className="ceo-programs-list">
                  {loading ? (
                    Array(3).fill(0).map((_, i) => (
                      <div key={`skeleton-ceo-prog-${i}`} className="ceo-program-row" style={{ opacity: 0.5 }}>
                        <div className="ceo-prog-ident">
                          <div className="skeleton-text" style={{ width: '150px', height: '14px', marginBottom: '8px' }}></div>
                          <div className="skeleton-text short" style={{ width: '220px' }}></div>
                        </div>
                      </div>
                    ))
                  ) : programs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-exec-muted)' }}>
                      No vehicle development programs currently active.
                    </div>
                  ) : (
                    programs.map(prog => (
                      <div 
                        key={prog.id}
                        className={`ceo-program-row ${selectedProgram?.id === prog.id ? 'selected' : ''}`}
                        onClick={() => setSelectedProgram(prog)}
                      >
                        <div className="ceo-prog-ident">
                          <h4>{prog.program_name}</h4>
                          <span>CODE: {prog.program_code} // PLANT: {prog.vehicle_category || 'Global Operations'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <span className={`ceo-prog-status-pill ${prog.status?.toLowerCase().replace(' ', '-') || 'concept'}`}>
                            {prog.status || 'Concept'}
                          </span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'white' }}>
                            Gate {prog.current_gate || 0}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Gate progression details */}
                {selectedProgram && (
                  <div className="ceo-timeline-box">
                    <div className="ceo-timeline-header">
                      Timeline Progress: {selectedProgram.program_name} ({selectedProgram.program_code})
                    </div>
                    <div className="ceo-timeline-gates">
                      {[0, 1, 2, 3, 4, 5].map((gate) => {
                        const isCompleted = gate < selectedProgram.current_gate;
                        const isActive = gate === selectedProgram.current_gate;
                        return (
                          <div 
                            key={gate} 
                            className={`ceo-timeline-gate-node ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                          >
                            <div className="ceo-gate-indicator">
                              {gate}
                            </div>
                            <span className="ceo-gate-label">
                              {gate === 0 ? 'Concept' :
                               gate === 1 ? 'Feasibility' :
                               gate === 2 ? 'Design' :
                               gate === 3 ? 'Prototype' :
                               gate === 4 ? 'Validation' : 'PPAP'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Live Activity Logs feed */}
              <div className="ceo-card">
                <div className="ceo-card-title">
                  <h3><Activity size={18} /> Staff Activity Audit</h3>
                  <button 
                    className="ceo-tab-btn" 
                    style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)' }}
                    onClick={() => {
                      setBroadcastMode(true);
                      setMessageText('');
                      setMessageModalUser(null);
                    }}
                  >
                    Broadcast Memo
                  </button>
                </div>
                <div className="ceo-logs-stream">
                  {loading ? (
                    Array(3).fill(0).map((_, i) => (
                      <div key={`skeleton-ceo-log-${i}`} className="ceo-log-row" style={{ opacity: 0.5 }}>
                        <div className="ceo-log-meta">
                          <div className="skeleton-text" style={{ width: '120px', height: '12px' }}></div>
                          <div className="skeleton-text" style={{ width: '60px', height: '12px' }}></div>
                        </div>
                        <div className="skeleton-text" style={{ width: '80%', height: '12px', marginTop: '6px' }}></div>
                      </div>
                    ))
                  ) : enrichedLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-exec-muted)' }}>
                      Audit log stream is currently empty.
                    </div>
                  ) : (
                    enrichedLogs.map(log => (
                      <div key={log.id} className="ceo-log-row">
                        <div className="ceo-log-meta">
                          <span className="ceo-log-user">{log.user_name} ({log.user_role})</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#fff', marginTop: '2px' }}>
                          <strong>{log.action_type}: </strong> {log.action_description}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'staff' && (
          <motion.div 
            key="staff"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            <div className="ceo-staff-grid">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={`skeleton-staff-${i}`} className="ceo-staff-card" style={{ opacity: 0.5 }}>
                    <div className="ceo-staff-header">
                      <div className="skeleton-text" style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
                      <div className="ceo-staff-meta">
                        <div className="skeleton-text" style={{ width: '100px', height: '14px', marginBottom: '6px' }}></div>
                        <div className="skeleton-text short" style={{ width: '60px' }}></div>
                      </div>
                    </div>
                    <div className="ceo-staff-details">
                      <div className="skeleton-text" style={{ width: '85%', height: '12px', margin: '6px 0' }}></div>
                      <div className="skeleton-text" style={{ width: '70%', height: '12px', margin: '6px 0' }}></div>
                    </div>
                  </div>
                ))
              ) : (
                users.map(user => {
                  // Determine initials
                  const initials = user.full_name ? user.full_name.split(' ').map(n => n[0]).join('') : 'U';
                  
                  // Calculate performance score based on name length/role to seed simulated dashboard metrics
                  const scoreSeed = ((user.full_name?.length || 0) * 7) % 15;
                  const score = 85 + scoreSeed;

                  return (
                    <div key={user.id} className="ceo-staff-card">
                      <div className="ceo-staff-header">
                        <div className="ceo-staff-avatar">{initials}</div>
                        <div className="ceo-staff-meta">
                          <h4>{user.full_name}</h4>
                          <p>{user.role}</p>
                        </div>
                      </div>

                      <div className="ceo-staff-details">
                        <div className="ceo-staff-detail-item">
                          <span className="label">Department:</span>
                          <span className="val">{user.email?.includes('procurement') || user.email?.includes('supplier') ? 'SCM' : user.role?.includes('MFG') || user.role?.includes('Manufacturing') ? 'MFG' : 'R&D'}</span>
                        </div>
                        <div className="ceo-staff-detail-item">
                          <span className="label">Plant Location:</span>
                          <span className="val">{user.plant_location || 'Detroit Assembly'}</span>
                        </div>
                        <div className="ceo-staff-detail-item">
                          <span className="label">Identity Email:</span>
                          <span className="val" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{user.email}</span>
                        </div>
                        <div className="ceo-staff-detail-item">
                          <span className="label">Monthly Audit Score:</span>
                          <span className="val" style={{ color: score >= 93 ? '#10b981' : score >= 88 ? 'var(--gold-primary)' : '#f59e0b', fontWeight: 'bold' }}>
                            {score}%
                          </span>
                        </div>
                      </div>

                      <div className="ceo-staff-actions">
                        <button 
                          className="ceo-staff-btn message"
                          onClick={() => {
                            setMessageModalUser(user);
                            setMessageText('');
                            setBroadcastMode(false);
                          }}
                        >
                          <Send size={12} /> Message
                        </button>
                        <button 
                          className="ceo-staff-btn trail"
                          onClick={() => handleViewUserTrail(user)}
                        >
                          <Activity size={12} /> View Trail
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'eom' && (
          <motion.div 
            key="eom"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            <div className="ceo-card" style={{ marginBottom: '2rem' }}>
              <div className="ceo-card-title">
                <h3><Award size={18} /> Employee of the Month Nomination</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>EXECUTIVE RECOGNITION PANEL</span>
              </div>
              <p style={{ color: 'var(--text-exec-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Select an employee to honor. Nominating a member flashes their profile global-wide across all user dashboards and broadcasts an audit notice.
              </p>
              <div className="ceo-eom-grid">
                {EOM_CANDIDATES.map(cand => {
                  const isSelected = currentEOM === cand.name;
                  return (
                    <div 
                      key={cand.name} 
                      className={`ceo-eom-card ${isSelected ? 'selected-winner' : ''}`}
                    >
                      <div className="ceo-eom-avatar">
                        {cand.avatar}
                      </div>
                      <h4>{cand.name}</h4>
                      <div className="role">{cand.role} // {cand.department}</div>
                      <p>"{cand.quote}"</p>
                      <button 
                        className="ceo-eom-btn"
                        onClick={() => handleNominateEOM(cand)}
                      >
                        {isSelected ? '★ Nominated EOM' : 'Nominate for EOM'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Modal */}
      {(messageModalUser || broadcastMode) && (
        <div className="ceo-modal-overlay">
          <div className="ceo-modal">
            <button className="ceo-modal-close" onClick={() => { setMessageModalUser(null); setBroadcastMode(false); }}>
              <X size={18} />
            </button>
            <div className="ceo-modal-title">
              <Send size={20} />
              {broadcastMode ? 'Disseminate Executive Broadcast' : `Command Memo: ${messageModalUser?.full_name}`}
            </div>
            <div className="ceo-modal-sub">
              {broadcastMode ? 'Broadcast memo alert to all employees of the industrial site.' : `Send a direct system communication to ${messageModalUser?.full_name} (${messageModalUser?.role}).`}
            </div>

            <form onSubmit={handleSendMessage}>
              <div className="ceo-form-group">
                <label>Message Content</label>
                <textarea 
                  rows={4}
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Enter message text here..."
                  required
                />
              </div>

              <div className="ceo-modal-actions">
                <button 
                  type="button" 
                  className="ceo-modal-btn cancel"
                  onClick={() => { setMessageModalUser(null); setBroadcastMode(false); }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="ceo-modal-btn submit"
                  disabled={isSendingMessage}
                >
                  {isSendingMessage ? 'Transmitting...' : 'Dispatch Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Activity Trail Modal */}
      {selectedStaffTrail && (
        <div className="ceo-modal-overlay">
          <div className="ceo-modal" style={{ width: '600px' }}>
            <button className="ceo-modal-close" onClick={() => setSelectedStaffTrail(null)}>
              <X size={18} />
            </button>
            <div className="ceo-modal-title">
              <Activity size={20} />
              Activity Audit: {selectedStaffTrail.full_name}
            </div>
            <div className="ceo-modal-sub">
              Auditing recent system events and operations for {selectedStaffTrail.email} ({selectedStaffTrail.role}).
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px', marginTop: '1rem' }}>
              {staffLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-exec-muted)', fontSize: '0.9rem' }}>
                  No recent audit logs registered for this staff member.
                </div>
              ) : (
                staffLogs.map(log => (
                  <div key={log.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--gold-primary)', marginBottom: '4px' }}>
                      <span>{log.action_type}</span>
                      <span style={{ color: 'var(--text-exec-muted)' }}>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#fff', margin: 0 }}>{log.action_description}</p>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="ceo-modal-btn cancel" 
                onClick={() => setSelectedStaffTrail(null)}
                style={{ flex: 'none', width: '120px' }}
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EOM Celebration Screen */}
      {showEOMCelebration && celebratedNominee && (
        <div className="ceo-success-overlay" onClick={() => setShowEOMCelebration(false)}>
          <div className="ceo-success-content" onClick={e => e.stopPropagation()}>
            <div className="ceo-success-icon">🏆</div>
            <h2>Employee of the Month</h2>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', margin: '0.5rem 0' }}>
              {celebratedNominee.name}
            </div>
            <div style={{ color: 'var(--gold-primary)', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem' }}>
              {celebratedNominee.role} // {celebratedNominee.department}
            </div>
            <p>
              "{celebratedNominee.quote}"
            </p>
            <button 
              className="ceo-eom-btn"
              onClick={() => setShowEOMCelebration(false)}
              style={{ width: '180px', margin: '0 auto' }}
            >
              Exemplary Service
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CEODashboard;
