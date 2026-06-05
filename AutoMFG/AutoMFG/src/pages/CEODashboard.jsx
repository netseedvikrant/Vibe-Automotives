import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Award, Shield, Users, Layers, AlertTriangle, Cpu, CheckCircle2,
  TrendingUp, TrendingDown, RefreshCw, Send, Radio, UserCheck, MessageSquare, Clock
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { supabase, isSupabaseConfigured, createNotification } from '../lib/supabase';
import toast from 'react-hot-toast';

const MOCK_HISTORICAL_OEE = [
  { date: 'Mon', oee: 84.2 },
  { date: 'Tue', oee: 85.7 },
  { date: 'Wed', oee: 87.1 },
  { date: 'Thu', oee: 86.4 },
  { date: 'Fri', oee: 88.9 },
  { date: 'Sat', oee: 88.2 },
  { date: 'Sun', oee: 89.4 }
];

export default function CEODashboard() {
  const { user } = useAuthStore();
  const { oeeMetrics } = useAppStore();
  
  const [activeTab, setActiveTab] = useState('overview'); // overview, operations, staff, eom
  const [loading, setLoading] = useState(false);
  
  // Dynamic metrics from DB
  const [dbStats, setDbStats] = useState({
    activeWOs: 0,
    openAndons: 0,
    scrapToday: 0,
    openBreakdowns: 0,
    averageOee: 88.4
  });

  // DB Lists
  const [workOrders, setWorkOrders] = useState([]);
  const [andonEvents, setAndonEvents] = useState([]);
  const [breakdowns, setBreakdowns] = useState([]);
  const [historicalOEE, setHistoricalOEE] = useState(MOCK_HISTORICAL_OEE);
  const [auditLogs, setAuditLogs] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // Modal / Form states
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [msgText, setMsgText] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // EOM nomination states
  const [currentEom, setCurrentEom] = useState(localStorage.getItem('vibe_current_eom') || 'Sarah Chen');

  const fetchCEODashData = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        // Fallback or seed some mock data for local testing
        setStaffList([
          { id: '1', display_name: 'Production Manager', username: 'prod.manager', role: 'production_manager' },
          { id: '2', display_name: 'Shift Supervisor', username: 'shift.super', role: 'shift_supervisor' },
          { id: '3', display_name: 'Line Leader', username: 'line.leader', role: 'line_leader' },
          { id: '4', display_name: 'Machine Operator', username: 'mach.operator', role: 'machine_operator' }
        ]);
        setAuditLogs([
          { audit_id: 1, action: 'login', entity: 'auth', timestamp: new Date().toISOString(), payload: { username: 'shift.super' } },
          { audit_id: 2, action: 'override_takt', entity: 'assembly_line', timestamp: new Date(Date.now() - 100000).toISOString(), payload: { line_id: 'Line A', original_val: 60, override_val: 75 } }
        ]);
        setLoading(false);
        return;
      }

      const [wosRes, andonsRes, defectsRes, bkRes, oeeRes, auditRes, profilesRes] = await Promise.all([
        supabase.from('work_orders').select('wo_number, status, planned_qty, actual_qty, created_at').order('created_at', { ascending: false }),
        supabase.from('andon_events').select('andon_id, issue_type, severity, status, raised_at, station_id').order('raised_at', { ascending: false }),
        supabase.from('defect_records').select('qty, logged_at, severity, disposition'),
        supabase.from('breakdown_tickets').select('ticket_id, machine_id, description, severity, status, created_at').order('created_at', { ascending: false }),
        supabase.from('oee_kpis').select('*').order('date', { ascending: true }),
        supabase.from('audit_log').select('*').order('timestamp', { ascending: false }).limit(40),
        supabase.from('profiles').select('*').order('username', { ascending: true })
      ]);

      // Calculate stats
      const activeWOsCount = wosRes.data?.filter(w => ['released', 'in_progress'].includes(w.status)).length || 0;
      const openAndonsCount = andonsRes.data?.filter(a => a.status === 'open' || a.status === 'Open').length || 0;
      const openBkCount = bkRes.data?.filter(b => b.status !== 'closed').length || 0;
      const scrapSum = defectsRes.data?.reduce((acc, curr) => acc + (curr.qty || 0), 0) || 0;

      // Calculate dynamic average OEE score if available
      let currentOeeVal = oeeMetrics.oee;
      if (oeeRes.data && oeeRes.data.length > 0) {
        const lastRecord = oeeRes.data[oeeRes.data.length - 1];
        if (lastRecord.oee_pct) currentOeeVal = lastRecord.oee_pct;
        const trendMapped = oeeRes.data.map(k => ({ date: k.date || 'Day', oee: k.oee_pct || 0 }));
        setHistoricalOEE(trendMapped);
      }

      setDbStats({
        activeWOs: activeWOsCount,
        openAndons: openAndonsCount,
        scrapToday: scrapSum,
        openBreakdowns: openBkCount,
        averageOee: currentOeeVal
      });

      if (wosRes.data) setWorkOrders(wosRes.data.slice(0, 10));
      if (andonsRes.data) setAndonEvents(andonsRes.data.slice(0, 10));
      if (bkRes.data) setBreakdowns(bkRes.data.slice(0, 10));
      if (auditRes.data) setAuditLogs(auditRes.data);
      if (profilesRes.data) setStaffList(profilesRes.data);

    } catch (err) {
      console.warn('[CEODashboard] Fetch failed:', err.message);
      toast.error('Failed to load database metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCEODashData();
  }, []);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    setIsSending(true);
    try {
      // Broadcast to all active roles
      const message = `[CEO GLOBAL BROADCAST] ${broadcastText}`;
      if (isSupabaseConfigured()) {
        // Find all profiles or send notification with null user id (role wide / global)
        await createNotification(null, 'global', 'ceo_broadcast', 'global', message);
        
        // Log the CEO action in audit trail
        await supabase.from('audit_log').insert({
          user_id: user?.id || 'ceo-temp',
          entity: 'global',
          action: 'ceo_broadcast',
          payload: { message: broadcastText, timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString()
        });
      }
      
      toast.success('Executive broadcast dispatched successfully!');
      setBroadcastText('');
      fetchCEODashData();
    } catch (err) {
      toast.error('Failed to dispatch broadcast');
    } finally {
      setIsSending(false);
    }
  };

  const handleDirectMessage = async (e) => {
    e.preventDefault();
    if (!msgText.trim() || !selectedStaff) return;
    setIsSending(true);
    try {
      const message = `[CEO EXECUTIVE ORDER] ${msgText}`;
      if (isSupabaseConfigured()) {
        await createNotification(selectedStaff.id, null, 'ceo_direct', user?.id || 'ceo-temp', message);
        await supabase.from('audit_log').insert({
          user_id: user?.id || 'ceo-temp',
          entity: 'staff_oversight',
          action: 'ceo_direct_message',
          payload: { target_user: selectedStaff.username, message: msgText },
          timestamp: new Date().toISOString()
        });
      }
      toast.success(`Executive order sent to ${selectedStaff.display_name || selectedStaff.username}`);
      setMsgText('');
      setSelectedStaff(null);
      fetchCEODashData();
    } catch (err) {
      toast.error('Failed to send direct message');
    } finally {
      setIsSending(false);
    }
  };

  const nominateEOM = (name) => {
    localStorage.setItem('vibe_current_eom', name);
    setCurrentEom(name);
    toast.success(`${name} nominated as Employee of the Month!`);
    
    // Broadcast notification of nominee
    if (isSupabaseConfigured()) {
      createNotification(null, 'global', 'eom_nomination', 'global', `🏆 CEO has nominated ${name} as Employee of the Month!`);
      supabase.from('audit_log').insert({
        user_id: user?.id || 'ceo-temp',
        entity: 'recognition',
        action: 'eom_nomination',
        payload: { nominee: name },
        timestamp: new Date().toISOString()
      });
    }
  };

  return (
    <div style={{ paddingBottom: 40 }} className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Award color="var(--corp-blue)" size={28} /> VIBE Executive Operations Panel
          </h1>
          <div className="page-subtitle">Unified Shop Floor oversight & real-time administrative auditing</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={fetchCEODashData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} style={{ marginRight: 6 }} />
            {loading ? 'Aggregating...' : 'Refresh Logs'}
          </button>
          <span className="badge badge-amber">
            👑 EXECUTIVE MODE
          </span>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-4 mb-24">
        <div className="card" style={{ borderLeft: '3px solid var(--green)' }}>
          <div className="card-header">
            <span className="card-title">Aggregated Plant OEE</span>
            <div style={{ padding: 6, borderRadius: 6, background: 'var(--green-dim)', display: 'flex', alignItems: 'center' }}>
              <Shield size={16} color="var(--green)" />
            </div>
          </div>
          <div className="metric-value green" style={{ fontSize: 36 }}>
            {dbStats.averageOee.toFixed(1)}<span className="metric-unit">%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <TrendingUp size={12} color="var(--green)" />
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--green)', letterSpacing: '0.1em' }}>
              Optimal target met
            </span>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '3px solid var(--corp-blue)' }}>
          <div className="card-header">
            <span className="card-title">Active Work Orders</span>
            <div style={{ padding: 6, borderRadius: 6, background: 'var(--bmw-blue-subtle)', display: 'flex', alignItems: 'center' }}>
              <Layers size={16} color="var(--corp-blue)" />
            </div>
          </div>
          <div className="metric-value" style={{ fontSize: 36, color: 'var(--corp-blue)' }}>
            {dbStats.activeWOs}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.1em' }}>
              Lines operating at takt
            </span>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '3px solid var(--red)' }}>
          <div className="card-header">
            <span className="card-title">Active Andon Stops</span>
            <div style={{ padding: 6, borderRadius: 6, background: 'var(--red-dim)', display: 'flex', alignItems: 'center' }}>
              <AlertTriangle size={16} color="var(--red)" />
            </div>
          </div>
          <div className="metric-value red" style={{ fontSize: 36 }}>
            {dbStats.openAndons}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: dbStats.openAndons > 0 ? 'var(--red)' : 'var(--green)', letterSpacing: '0.1em' }}>
              {dbStats.openAndons > 0 ? 'Urgent attention required' : 'All assembly lanes clear'}
            </span>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '3px solid var(--amber)' }}>
          <div className="card-header">
            <span className="card-title">Accumulated Defects</span>
            <div style={{ padding: 6, borderRadius: 6, background: 'var(--amber-dim)', display: 'flex', alignItems: 'center' }}>
              <AlertTriangle size={16} color="var(--amber)" />
            </div>
          </div>
          <div className="metric-value amber" style={{ fontSize: 36 }}>
            {dbStats.scrapToday} <span className="metric-unit">pcs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.1em' }}>
              Across all quality gates
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Production Overview
        </button>
        <button className={`tab-btn ${activeTab === 'operations' ? 'active' : ''}`} onClick={() => setActiveTab('operations')}>
          Live Operations Feed
        </button>
        <button className={`tab-btn ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => setActiveTab('staff')}>
          Staff Oversight & Audit
        </button>
        <button className={`tab-btn ${activeTab === 'eom' ? 'active' : ''}`} onClick={() => setActiveTab('eom')}>
          Employee of the Month
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="grid grid-2">
          {/* Historical Trend */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Weekly Plant OEE Trend</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={historicalOEE}>
                <defs>
                  <linearGradient id="ceoOeeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="gold" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="gold" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontFamily: 'var(--font-heading)', fontSize: 10, fill: 'var(--muted-text)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[70, 100]} tick={{ fontFamily: 'var(--font-heading)', fontSize: 10, fill: 'var(--muted-text)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-active)', borderRadius: 0, fontFamily: 'var(--font-heading)', fontSize: 12 }} />
                <Area type="monotone" dataKey="oee" stroke="gold" strokeWidth={2} fill="url(#ceoOeeGrad)" dot={true} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Broadcast Center */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="card-header">
                <span className="card-title">CEO Global Broadcast Channel</span>
                <Radio size={16} color="gold" />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                Dispatch administrative alerts directly to the notification centers of all users across all shifts.
              </p>
              <form onSubmit={handleBroadcast}>
                <div className="form-group mb-16">
                  <label className="form-label">Broadcast Message</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Enter urgent operational directive or plant-wide announcement..."
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    style={{ minHeight: 100 }}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', background: 'gold', color: 'black', border: 'none' }} disabled={isSending || !broadcastText.trim()}>
                  <Send size={14} style={{ marginRight: 6 }} />
                  {isSending ? 'Dispatching...' : 'Broadcast Directive'}
                </button>
              </form>
            </div>
          </div>

          {/* Recent Andons */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Live Andon Cord Alerts</span>
              <button className="btn btn-sm btn-outline" onClick={fetchCEODashData}>Refresh</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {andonEvents.length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}>
                  <CheckCircle2 size={24} color="var(--green)" />
                  <span style={{ color: 'var(--muted-text)' }}>All stations operating normally</span>
                </div>
              ) : (
                andonEvents.slice(0, 5).map(e => (
                  <div key={e.andon_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span className={`badge ${e.status === 'open' ? 'badge-red' : 'badge-green'}`}>{e.status}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{e.issue_type?.toUpperCase().replace('_', ' ')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Station: {e.station_id || 'Unknown'} · Severity: {e.severity}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--muted-text)' }}>{new Date(e.raised_at).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Maintenance/Breakdown list */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Active Plant Equipment Breakdowns</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {breakdowns.length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}>
                  <Cpu size={24} color="var(--green)" />
                  <span style={{ color: 'var(--muted-text)' }}>Zero equipment breakdowns reported</span>
                </div>
              ) : (
                breakdowns.slice(0, 5).map(b => (
                  <div key={b.ticket_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{b.machine_id}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{b.description}</div>
                    </div>
                    <span className={`badge ${b.severity === 'P1' ? 'badge-red' : 'badge-amber'}`}>{b.severity}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'operations' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Global Audit Trail & Operations Log</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
            Comprehensive, read-only system log capturing actions executed by all manufacturing shift members.
          </p>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Staff Member</th>
                  <th>Entity</th>
                  <th>Action executed</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted-text)' }}>
                      No audit log records found in Database.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log, idx) => (
                    <tr key={log.audit_id || idx}>
                      <td style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {log.user_id || 'System'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-heading)', color: 'var(--bmw-blue)' }}>
                        {log.entity}
                      </td>
                      <td>
                        <span className="badge badge-white" style={{ borderColor: 'var(--border-active)' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {JSON.stringify(log.payload)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="grid grid-2">
          {/* Staff List Table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Staff Registry</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Display Name</th>
                    <th>Username</th>
                    <th>System Role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted-text)' }}>
                        No profiles returned.
                      </td>
                    </tr>
                  ) : (
                    staffList.map((staff) => (
                      <tr key={staff.id}>
                        <td style={{ fontWeight: 600 }}>{staff.display_name || staff.username}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>@{staff.username}</td>
                        <td>
                          <span className="badge badge-blue">
                            {staff.role || 'operator'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-sm btn-outline" onClick={() => setSelectedStaff(staff)}>
                            Message
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DM Panel */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Direct Executive Action</span>
              <MessageSquare size={16} color="gold" />
            </div>
            {selectedStaff ? (
              <form onSubmit={handleDirectMessage}>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted-text)' }}>Recipient:</span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'gold', marginTop: 2 }}>
                    {selectedStaff.display_name || selectedStaff.username} (@{selectedStaff.username})
                  </div>
                </div>
                <div className="form-group mb-16">
                  <label className="form-label">Direct Directive / Message</label>
                  <textarea
                    className="form-textarea"
                    placeholder={`Enter message to send directly to ${selectedStaff.display_name}...`}
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    style={{ minHeight: 120 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, background: 'gold', color: 'black', border: 'none' }} disabled={isSending || !msgText.trim()}>
                    Send Directive
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setSelectedStaff(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="empty-state" style={{ height: '80%' }}>
                <Users size={32} color="var(--muted-text)" />
                <span style={{ color: 'var(--muted-text)', fontSize: 13 }}>
                  Select a staff member from the Registry to issue direct orders.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'eom' && (
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 200, height: 200, background: 'radial-gradient(circle, rgba(255, 215, 0, 0.08), transparent 60%)', pointerEvents: 'none' }} />
          
          <div className="card-header">
            <span className="card-title">Employee of the Month (EOM) Recognition</span>
            <span className="badge badge-amber" style={{ color: 'gold', borderColor: 'gold' }}>
              🏆 Current Nominee: {currentEom}
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24, maxWidth: 700 }}>
            Nominate this month's top performer. The selected employee will be featured globally across the VIBE enterprise dashboards and portal instances.
          </p>

          <div className="grid grid-3">
            <div className="card" style={{ background: 'var(--bg-elevated)', textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, gold, #ff8c00)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, margin: '0 auto 12px' }}>
                SC
              </div>
              <h3 style={{ fontSize: 16 }}>Sarah Chen</h3>
              <p style={{ color: 'gold', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Lead Thermal Engineer</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', minHeight: 60, marginBottom: 16 }}>
                "Led fast-charging validation under extreme specs 3 weeks ahead of schedule."
              </p>
              <button className="btn btn-sm btn-outline" style={{ width: '100%', borderColor: currentEom === 'Sarah Chen' ? 'gold' : 'var(--border-active)', color: currentEom === 'Sarah Chen' ? 'gold' : 'var(--text-secondary)' }} onClick={() => nominateEOM('Sarah Chen')}>
                {currentEom === 'Sarah Chen' ? '🏆 Nominated' : 'Select Sarah'}
              </button>
            </div>

            <div className="card" style={{ background: 'var(--bg-elevated)', textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, gold, #ff8c00)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, margin: '0 auto 12px' }}>
                AW
              </div>
              <h3 style={{ fontSize: 16 }}>Alicia Wong</h3>
              <p style={{ color: 'gold', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Shift Supervisor</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', minHeight: 60, marginBottom: 16 }}>
                "Reduced stamping shop downtime by 14.5% during assembly trials."
              </p>
              <button className="btn btn-sm btn-outline" style={{ width: '100%', borderColor: currentEom === 'Alicia Wong' ? 'gold' : 'var(--border-active)', color: currentEom === 'Alicia Wong' ? 'gold' : 'var(--text-secondary)' }} onClick={() => nominateEOM('Alicia Wong')}>
                {currentEom === 'Alicia Wong' ? '🏆 Nominated' : 'Select Alicia'}
              </button>
            </div>

            <div className="card" style={{ background: 'var(--bg-elevated)', textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, gold, #ff8c00)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, margin: '0 auto 12px' }}>
                MJ
              </div>
              <h3 style={{ fontSize: 16 }}>Marcus Johnson</h3>
              <p style={{ color: 'gold', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Plant Manager</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', minHeight: 60, marginBottom: 16 }}>
                "Coordinated cross-functional transition for Munich Engine Hub platform."
              </p>
              <button className="btn btn-sm btn-outline" style={{ width: '100%', borderColor: currentEom === 'Marcus Johnson' ? 'gold' : 'var(--border-active)', color: currentEom === 'Marcus Johnson' ? 'gold' : 'var(--text-secondary)' }} onClick={() => nominateEOM('Marcus Johnson')}>
                {currentEom === 'Marcus Johnson' ? '🏆 Nominated' : 'Select Marcus'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border-active)' }}>
            <span style={{ fontSize: 10, letterSpacing: '0.1em', color: 'gold', fontWeight: 700, textTransform: 'uppercase' }}>Custom Recognition Nominee</span>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Enter custom employee full name..."
                id="custom-eom-input"
              />
              <button className="btn btn-primary" style={{ background: 'gold', color: 'black', border: 'none' }} onClick={() => {
                const val = document.getElementById('custom-eom-input').value;
                if (val.trim()) {
                  nominateEOM(val.trim());
                  document.getElementById('custom-eom-input').value = '';
                } else {
                  toast.error('Please enter a name');
                }
              }}>
                Nominate Custom
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
