import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Car, AlertTriangle, CheckCircle2, ShieldAlert, 
  TrendingUp, HardDrive, ArrowUpRight, Filter, Plus,
  BarChart3, Eye, Calendar, Bell, CheckCheck, Workflow, Info
} from 'lucide-react';
import './ProgramManagerDashboard.css';
import { useDashboardData } from '../hooks/useDashboardData';
import { supabase } from '../lib/supabase';
import TimelineModule from './TimelineModule';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const ProgramManagerDashboard = ({ activeTab = 'Dashboard' }) => {
  const { programs, notifications: liveNotifications, loading } = useDashboardData();

  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Fetch full notifications with program join whenever tab is active
  useEffect(() => {
    if (activeTab !== 'Notifications') return;
    const fetchNotifications = async () => {
      setNotifLoading(true);
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        // Enrich with program info by matching program_id if present
        const programMap = Object.fromEntries(programs.map(p => [p.id, p]));
        const enriched = (data || []).map(n => ({
          ...n,
          program: n.program_id ? programMap[n.program_id] : null,
        }));
        setNotifications(enriched);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setNotifLoading(false);
      }
    };
    fetchNotifications();
  }, [activeTab, programs]);

  const markAllRead = async () => {
    setMarkingAll(true);
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setMarkingAll(false);
  };

  const markOneRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  // Phase 5: Analytics & KPI states
  const [validationTests, setValidationTests] = useState([]);
  const [ecos, setEcos] = useState([]);
  const [risks, setRisks] = useState([]);

  const [approvalsList, setApprovalsList] = useState([]);
  const [buildsList, setBuildsList] = useState([]);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        const { data: tests } = await supabase.from('validation_tests').select('*');
        setValidationTests(tests || []);

        const { data: ecoList } = await supabase.from('eco_requests').select('*');
        setEcos(ecoList || []);

        const { data: riskList } = await supabase.from('engineering_risks').select('*');
        setRisks(riskList || []);

        const { data: approvals } = await supabase.from('approvals').select('id, status, created_at');
        setApprovalsList(approvals || []);

        const { data: builds } = await supabase.from('prototype_builds').select('id, status, created_at');
        setBuildsList(builds || []);
      } catch (err) {
        console.error('Error fetching analytics data:', err);
      }
    };
    fetchAnalyticsData();
  }, []);

  useEffect(() => {
    const forceDropdownStyles = () => {
      // Finds all <select> and <option> tags currently on the screen
      const selects = document.querySelectorAll('select');
      const options = document.querySelectorAll('select option');

      selects.forEach(select => {
        select.style.setProperty('background-color', '#1a1a1e', 'important');
        select.style.setProperty('color', '#ffffff', 'important');
      });

      options.forEach(option => {
        option.style.setProperty('background-color', '#1a1a1e', 'important');
        option.style.setProperty('color', '#ffffff', 'important');
      });
    };

    // Run it immediately when the dashboard loads
    forceDropdownStyles();

    // Since forms can appear/disappear based on tabs, observe the page for updates
    const observer = new MutationObserver(forceDropdownStyles);
    observer.observe(document.body, { childList: true, subtree: true });

    // Clean up observer on unmount
    return () => observer.disconnect();
  }, []);

  // Aggregated Chart Data
  const progressData = programs.map(p => ({
    name: p.program_code || p.program_name.substring(0, 8),
    'Current Gate': p.current_gate || 0,
    'Completion %': p.apqp_gates
      ? Math.round(p.apqp_gates.reduce((acc, g) => acc + (g.completion_percentage || 0), 0) / 6)
      : 0
  }));

  const passedCount = validationTests.filter(t => t.status === 'Passed').length;
  const failedCount = validationTests.filter(t => t.status === 'Failed').length;
  const pendingCount = validationTests.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;

  const dvprData = [
    { name: 'Passed', value: passedCount || 12, color: '#00ff9d' },
    { name: 'Failed', value: failedCount || 2, color: '#ff4d6d' },
    { name: 'Pending', value: pendingCount || 4, color: 'var(--accent)' }
  ];

  const ecoInitiated = ecos.filter(e => e.status === 'Initiated').length;
  const ecoReview = ecos.filter(e => e.status === 'Review' || e.status === 'Under Review').length;
  const ecoApproved = ecos.filter(e => e.status === 'Approved' || e.status === 'Implemented').length;

  const ecoData = [
    { name: 'Initiated', count: ecoInitiated || 5 },
    { name: 'Under Review', count: ecoReview || 8 },
    { name: 'Implemented/Approved', count: ecoApproved || 15 }
  ];

  // Dynamic KPI & Trend Calculations (30-day window)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const isRecent = (dateStr) => new Date(dateStr) > thirtyDaysAgo;

  const activePrograms = programs.filter(p => !['Completed', 'Cancelled'].includes(p.status));
  const activeProgramsTrend = activePrograms.filter(p => isRecent(p.created_at)).length;

  const delayedPrograms = programs.filter(p => p.status === 'Delayed');
  const delayedProgramsTrend = delayedPrograms.filter(p => isRecent(p.updated_at || p.created_at)).length;

  const pendingApps = approvalsList.filter(a => a.status === 'Pending');
  const pendingAppsTrend = pendingApps.filter(a => isRecent(a.created_at)).length;

  const highSeverityRisks = risks.filter(r => {
    const level = r.severity || r.impact_level;
    return ['High', 'Critical'].includes(level) && (r.status === 'Open' || !r.status);
  });
  const risksTrend = highSeverityRisks.filter(r => isRecent(r.created_at)).length;

  const totalBudget = activePrograms.reduce((acc, p) => acc + (p.estimated_budget || 0), 0);
  const recentBudget = activePrograms.filter(p => isRecent(p.created_at)).reduce((acc, p) => acc + (p.estimated_budget || 0), 0);
  const budgetTrendPct = totalBudget > 0 ? Math.round((recentBudget / totalBudget) * 100) : 0;

  const prototypesTotal = buildsList.length;
  const prototypesComplete = buildsList.filter(b => b.status === 'Complete').length;
  const recentBuilds = buildsList.filter(b => isRecent(b.created_at)).length;
  const prototypeTrendPct = prototypesTotal > 0 ? Math.round((recentBuilds / prototypesTotal) * 100) : 0;

  const kpis = [
    { label: 'Active Programs', value: activePrograms.length.toString(), change: activeProgramsTrend > 0 ? `+${activeProgramsTrend}` : '0', icon: Car, color: 'var(--accent)' },
    { label: 'Programs Delayed', value: delayedPrograms.length.toString(), change: delayedProgramsTrend > 0 ? `+${delayedProgramsTrend}` : '0', icon: AlertTriangle, color: 'var(--warning)' },
    { label: 'Pending Approvals', value: pendingApps.length.toString(), change: pendingAppsTrend > 0 ? `+${pendingAppsTrend}` : '0', icon: CheckCircle2, color: 'var(--success)' },
    { label: 'Open Risks', value: highSeverityRisks.length.toString(), change: risksTrend > 0 ? `+${risksTrend}` : '0', icon: ShieldAlert, color: 'var(--error)' },
    { label: 'Budget Usage', value: totalBudget > 0 ? `${Math.round(totalBudget / 1000000)}M` : '0', change: budgetTrendPct > 0 ? `+${budgetTrendPct}%` : '0%', icon: TrendingUp, color: 'var(--accent-secondary)' },
    { label: 'Prototype Status', value: prototypesTotal > 0 ? `${Math.round((prototypesComplete/prototypesTotal)*100)}%` : 'N/A', change: prototypeTrendPct > 0 ? `+${prototypeTrendPct}%` : '0%', icon: HardDrive, color: 'var(--accent)' },
  ];

  const avgVelocity = (() => {
    const completedGates = programs.flatMap(p =>
      (p.apqp_gates || []).filter(g => g.gate_status === 'Completed' && g.updated_at && g.created_at)
    );
    if (completedGates.length === 0) return null;
    const totalDays = completedGates.reduce((acc, g) => {
      const days = (new Date(g.updated_at) - new Date(g.created_at)) / 86400000;
      return acc + days;
    }, 0);
    return (totalDays / completedGates.length).toFixed(1);
  })();

  const overduePrograms = programs
    .filter(p => {
      if (p.status === 'Delayed') return true;
      if (p.target_launch_date) {
        return new Date(p.target_launch_date) < new Date();
      }
      return false;
    })
    .slice(0, 5)
    .map(p => ({
      title: p.program_name,
      delay: p.target_launch_date
        ? `${Math.floor((Date.now() - new Date(p.target_launch_date)) / 86400000)} days`
        : 'No date set',
      program: p.program_code || 'N/A',
      owner: p.status
    }));

  // Get gates for the most recent program for the tracker
  const latestProgram = programs[0] || null;
  const gates = latestProgram?.apqp_gates?.sort((a, b) => a.gate_number - b.gate_number) || [];

  const showTimeline = activeTab === 'Timeline' || activeTab === 'APQP Gates';

  if (loading && programs.length === 0) {
    return <div className="loading-state flex-center">Initializing Automotive Workflow...</div>;
  }

  return (
    <motion.div
      className="dashboard-wrapper"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <header className="dashboard-header">
        <div>
          <h1 className="text-gradient">
            {activeTab === 'Reports' ? 'KPI Analytics & Performance'
              : activeTab === 'Notifications' ? 'Notifications Center'
              : showTimeline ? 'Program Timeline & Milestones'
              : 'Program Management Overview'}
          </h1>
          <p className="subtitle">
            {activeTab === 'Reports'
              ? 'Aggregated engineering program performance and validation metrics.'
              : activeTab === 'Notifications'
                ? 'Program activity alerts, workflow handovers, and system events.'
                : showTimeline
                  ? 'Manage gates, reschedule deadlines, and update progress.'
                  : 'Real-time status of vehicle development lifecycles across all plants.'}
          </p>
        </div>
        {activeTab !== 'Reports' && activeTab !== 'Notifications' && !showTimeline && (
          <div className="header-actions" style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="create-program-btn flex-center"
              onClick={() => window.dispatchEvent(new CustomEvent('open-new-program-modal'))}
            >
              <Plus size={18} />
              <span>New Program</span>
            </button>
          </div>
        )}
        {activeTab === 'Notifications' && (
          <div className="header-actions">
            <button
              className="filter-btn glass flex-center"
              onClick={markAllRead}
              disabled={markingAll}
              style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
            >
              <CheckCheck size={16} />
              <span>{markingAll ? 'Marking...' : 'Mark All Read'}</span>
            </button>
          </div>
        )}
      </header>

      {activeTab === 'Notifications' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifLoading ? (
            <div className="flex-center" style={{ padding: '60px', color: 'var(--text-muted)' }}>
              <Bell size={24} style={{ marginRight: '12px', opacity: 0.5 }} /> Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="glass flex-center" style={{ padding: '60px', borderRadius: '12px', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)' }}>
              <Bell size={40} style={{ opacity: 0.3 }} />
              <p>No notifications yet. Activity will appear here as programs progress.</p>
            </div>
          ) : notifications.map(n => {
            const typeConfig = {
              'Workflow': { icon: Workflow, color: 'var(--accent)', bg: 'rgba(0,242,255,0.08)' },
              'success':  { icon: CheckCircle2, color: 'var(--success)', bg: 'rgba(0,255,157,0.08)' },
              'warning':  { icon: AlertTriangle, color: 'var(--warning)', bg: 'rgba(255,184,0,0.08)' },
              'error':    { icon: ShieldAlert, color: 'var(--error)', bg: 'rgba(255,77,109,0.08)' },
              'info':     { icon: Info, color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
            };
            const cfg = typeConfig[n.type] || typeConfig['info'];
            const IconComp = cfg.icon;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass"
                onClick={() => !n.is_read && markOneRead(n.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  cursor: n.is_read ? 'default' : 'pointer',
                  opacity: n.is_read ? 0.65 : 1,
                  borderLeft: `3px solid ${cfg.color}`,
                  background: n.is_read ? 'transparent' : cfg.bg,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ flexShrink: 0, marginTop: '2px' }}>
                  <IconComp size={20} color={cfg.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                     <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{n.title}</span>
                     <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                       {new Date(n.created_at).toLocaleString()}
                     </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.message}</p>
                  {n.program && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '0.78rem', color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: '20px', border: `1px solid ${cfg.color}40` }}>
                      <Car size={12} /> {n.program.program_code} — {n.program.program_name}
                    </span>
                  )}
                </div>
                {!n.is_read && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, flexShrink: 0, marginTop: '6px', boxShadow: `0 0 8px ${cfg.color}` }} />
                )}
              </motion.div>
            );
          })}
        </div>
      ) : activeTab === 'Reports' ? (
        <div className="reports-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="glass" style={{ padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Overall DVP&R Pass Rate</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#00ff9d', marginTop: '8px' }}>
                {validationTests.length > 0 
                  ? `${Math.round((validationTests.filter(t => t.status === 'Passed').length / validationTests.length) * 100)}%`
                  : '85.7%'}
              </div>
            </div>
            <div className="glass" style={{ padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Active ECNs in Loop</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ffb703', marginTop: '8px' }}>{ecos.length || 14} Requests</div>
            </div>
            <div className="glass" style={{ padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>High & Critical Risks</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ff4d6d', marginTop: '8px' }}>{risks.filter(r => ['Critical', 'High'].includes(r.severity || r.impact_level)).length} Items</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
            <div className="glass" style={{ padding: '24px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '340px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Program APQP Completion Progress</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={progressData.length > 0 ? progressData : [
                  { name: 'Falcon X', 'Completion %': 78 },
                  { name: 'CyberTruck', 'Completion %': 52 },
                  { name: 'Horizon EV', 'Completion %': 95 }
                ]}>
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  <Bar dataKey="Completion %" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass" style={{ padding: '24px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '340px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Validation Test Status Breakdown</h3>
              <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '16px' }}>
                <ResponsiveContainer width="60%" height={240}>
                  <PieChart>
                    <Pie
                      data={dvprData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {dvprData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '40%' }}>
                  {dvprData.map((entry, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: entry.color }}></div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{entry.name}: <strong>{entry.value}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass" style={{ padding: '24px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '340px', gridColumn: '1 / -1' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Engineering Change Orders (ECO) Processing Lifecycle</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={ecoData}>
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  <Legend verticalAlign="top" height={36} />
                  <Line type="monotone" dataKey="count" name="ECO Count" stroke="var(--success)" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : activeTab === 'Programs' ? (
        <div className="programs-list-container glass" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', color: 'var(--text-primary)' }}>All Vehicle Programs</h2>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <th style={{ padding: '12px' }}>Program Code</th>
                  <th style={{ padding: '12px' }}>Name</th>
                  <th style={{ padding: '12px' }}>Category</th>
                  <th style={{ padding: '12px' }}>Market</th>
                  <th style={{ padding: '12px' }}>Launch Date</th>
                  <th style={{ padding: '12px' }}>Budget</th>
                  <th style={{ padding: '12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {programs.map(p => (
                  <tr key={p.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px 12px', fontWeight: 'bold', color: 'var(--accent)' }}>{p.program_code}</td>
                    <td style={{ padding: '16px 12px', color: 'var(--text-primary)' }}>{p.program_name}</td>
                    <td style={{ padding: '16px 12px', color: 'var(--text-secondary)' }}>{p.vehicle_category}</td>
                    <td style={{ padding: '16px 12px', color: 'var(--text-secondary)' }}>{p.target_market}</td>
                    <td style={{ padding: '16px 12px', color: 'var(--text-secondary)' }}>{p.target_launch_date ? new Date(p.target_launch_date).toLocaleDateString() : 'TBD'}</td>
                    <td style={{ padding: '16px 12px', color: 'var(--text-secondary)' }}>{p.estimated_budget ? `$${(p.estimated_budget / 1000000).toFixed(1)}M` : 'N/A'}</td>
                    <td style={{ padding: '16px 12px' }}>
                      <span className={`status-chip ${(p.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {programs.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No programs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : showTimeline ? (
        <TimelineModule initialProgramId={latestProgram?.id} />
      ) : (
        <>
          <div className="dashboard-grid">
            {/* APQP Tracker */}
            <section className="dashboard-card apqp-tracker glass">
              <div className="card-header">
                <h3>APQP Gate Progress Tracker</h3>
                <span className="card-tag">{latestProgram ? `${latestProgram.program_name} (${latestProgram.program_code})` : 'Select Program'}</span>
              </div>
              <div className="gates-container">
                {gates.length > 0 ? gates.map((gate, index) => (
                  <div key={gate.id} className="gate-row">
                    <div className="gate-info">
                      <div className={`gate-status-dot ${gate.gate_status?.toLowerCase().replace(' ', '-')}`}></div>
                      <div className="gate-text">
                        <span className="gate-name">Gate {gate.gate_number}: {gate.gate_name}</span>
                        <span className="gate-deadline">Deadline: {gate.due_date ? new Date(gate.due_date).toLocaleDateString() : 'TBD'}</span>
                      </div>
                    </div>
                    <div className="gate-progress-wrapper">
                      <div className="progress-bar-bg">
                        <motion.div
                          className="progress-bar-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${gate.completion_percentage}%` }}
                          transition={{ duration: 1, delay: index * 0.1 }}
                          style={{ background: gate.gate_status === 'Completed' ? 'var(--success)' : 'var(--accent)' }}
                        />
                      </div>
                      <span className="progress-text">{gate.completion_percentage}%</span>
                    </div>
                  </div>
                )) : (
                  <div className="empty-state">No APQP gates defined for this program.</div>
                )}
              </div>
            </section>

            {/* Delayed Milestones */}
            <section className="dashboard-card delayed-milestones glass">
              <div className="card-header">
                <h3>Critical Path & Delays</h3>
              </div>
              <div className="milestone-list">
                {overduePrograms.length === 0 ? (
                  <div className="text-muted" style={{ padding: '16px' }}>No delayed milestones found.</div>
                ) : overduePrograms.map((m, i) => (
                  <div key={i} className="milestone-item">
                    <div className="m-icon flex-center"><AlertTriangle size={16} /></div>
                    <div className="m-details">
                      <span className="m-title">{m.title}</span>
                      <span className="m-meta">
                        {m.program} •{' '}
                        <span className={`status-chip ${m.owner === 'Production' ? 'production' : (m.owner || '').toLowerCase().replace(/\s+/g, '-')}`}>
                          {m.owner === 'Production' ? '🏭 In Production' : m.owner}
                        </span>
                      </span>
                    </div>
                    <div className="m-delay">{m.delay}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Prototype Authorization Matrix */}
          <section className="dashboard-card glass" style={{ marginTop: '24px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Prototype Build Authorization</h3>
              <button className="primary-btn small" onClick={() => {
                if (programs.length > 0) {
                  const pId = programs[0].id;
                  supabase.from('prototype_builds').insert({
                    program_id: pId,
                    build_type: 'Alpha',
                    quantity: 5,
                    status: 'Planning',
                    plant_location: 'Detroit Assembly'
                  }).then(({ error }) => {
                    if (error) alert(error.message);
                    else alert('Alpha Prototype Build Authorized! Factory notified.');
                  });
                }
              }}>
                <HardDrive size={16} /> Authorize Alpha Build
              </button>
            </div>
            <p className="text-muted" style={{ padding: '0 24px 24px' }}>
              Programs with approved eBOM/MBOM feasibility are queued here for physical prototype authorization.
            </p>
          </section>
        </>
      )}
    </motion.div>
  );
};

export default ProgramManagerDashboard;
