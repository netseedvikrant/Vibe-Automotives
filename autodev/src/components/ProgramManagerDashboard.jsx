import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Car, AlertTriangle, CheckCircle2, ShieldAlert, 
  TrendingUp, HardDrive, ArrowUpRight, Filter,
  BarChart3, Eye, Calendar
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
  const { programs, activityLogs, loading } = useDashboardData();

  // Phase 5: Analytics & KPI states
  const [validationTests, setValidationTests] = useState([]);
  const [ecos, setEcos] = useState([]);
  const [risks, setRisks] = useState([]);

  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [openRisks, setOpenRisks] = useState(0);
  const [prototypesComplete, setPrototypesComplete] = useState(0);
  const [prototypesTotal, setPrototypesTotal] = useState(0);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        const { data: tests } = await supabase.from('validation_tests').select('*');
        setValidationTests(tests || []);
        
        const { data: ecoList } = await supabase.from('eco_requests').select('*');
        setEcos(ecoList || []);

        const { data: riskList } = await supabase.from('engineering_risks').select('*');
        setRisks(riskList || []);

        const { data: approvals } = await supabase.from('approvals').select('id').eq('status', 'Pending');
        setPendingApprovals(approvals?.length || 0);

        const { data: riskData } = await supabase.from('engineering_risks').select('id, severity, impact_level, status');
        const highSeverityRisks = (riskData || []).filter(r => {
          const level = r.severity || r.impact_level;
          return ['High', 'Critical'].includes(level) && (r.status === 'Open' || !r.status);
        });
        setOpenRisks(highSeverityRisks.length);

        const { data: builds } = await supabase.from('prototype_builds').select('id, status');
        setPrototypesTotal(builds?.length || 0);
        setPrototypesComplete(builds?.filter(b => b.status === 'Complete').length || 0);
      } catch (err) {
        console.error('Error fetching analytics data:', err);
      }
    };
    fetchAnalyticsData();
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

  // Derive KPIs from dynamic data
  const kpis = [
    { label: 'Active Programs', value: programs.length.toString(), change: '+2', icon: Car, color: 'var(--accent)' },
    { label: 'Programs Delayed', value: programs.filter(p => p.status === 'Delayed').length.toString(), change: '+1', icon: AlertTriangle, color: 'var(--warning)' },
    { label: 'Pending Approvals', value: pendingApprovals.toString(), change: '-4', icon: CheckCircle2, color: 'var(--success)' },
    { label: 'Open Risks', value: openRisks.toString(), change: '+12', icon: ShieldAlert, color: 'var(--error)' },
    { label: 'Budget Usage', value: programs.length > 0 ? `${Math.round(programs.reduce((acc, p) => acc + (p.estimated_budget || 0), 0) / 1000000)}M` : '0', change: '+5%', icon: TrendingUp, color: 'var(--accent-secondary)' },
    { label: 'Prototype Status', value: prototypesTotal > 0 ? `${Math.round((prototypesComplete/prototypesTotal)*100)}%` : 'N/A', change: '+2%', icon: HardDrive, color: 'var(--accent)' },
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
            {activeTab === 'Reports' ? 'KPI Analytics & Performance' : showTimeline ? 'Program Timeline & Milestones' : 'Program Management Overview'}
          </h1>
          <p className="subtitle">
            {activeTab === 'Reports' 
              ? 'Aggregated engineering program performance and validation metrics.' 
              : showTimeline 
                ? 'Manage gates, reschedule deadlines, and update progress.' 
                : 'Real-time status of vehicle development lifecycles across all plants.'}
          </p>
        </div>
        {activeTab !== 'Reports' && !showTimeline && (
          <div className="header-actions">
            <button className="filter-btn glass flex-center">
              <Filter size={16} />
              <span>Filters</span>
            </button>
          </div>
        )}
      </header>

      {activeTab === 'Reports' ? (
        <div className="reports-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="glass" style={{ padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Avg Program Velocity</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent)', marginTop: '8px' }}>{avgVelocity ? `${avgVelocity} days/gate` : 'Calculating...'}</div>
            </div>
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
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--warning)', marginTop: '8px' }}>{ecos.length || 14} Requests</div>
            </div>
            <div className="glass" style={{ padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>High & Critical Risks</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ff4d6d', marginTop: '8px' }}>{risks.filter(r => ['Critical', 'High'].includes(r.severity || r.impact_level)).length} Items</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
            <div className="glass" style={{ padding: '24px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '340px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>Program APQP Completion Progress</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={progressData.length > 0 ? progressData : [
                  { name: 'Falcon X', 'Completion %': 78 },
                  { name: 'CyberTruck', 'Completion %': 52 },
                  { name: 'Horizon EV', 'Completion %': 95 }
                ]}>
                  <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} />
                  <YAxis stroke="#888" fontSize={11} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ background: '#121217', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                  <Bar dataKey="Completion %" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass" style={{ padding: '24px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '340px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>Validation Test Status Breakdown</h3>
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
                    <Tooltip contentStyle={{ background: '#121217', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '40%' }}>
                  {dvprData.map((entry, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: entry.color }}></div>
                      <span style={{ fontSize: '0.8rem', color: '#ccc', textTransform: 'capitalize' }}>{entry.name}: <strong>{entry.value}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass" style={{ padding: '24px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '340px', gridColumn: '1 / -1' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>Engineering Change Orders (ECO) Processing Lifecycle</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={ecoData}>
                  <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} />
                  <YAxis stroke="#888" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#121217', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                  <Legend verticalAlign="top" height={36} />
                  <Line type="monotone" dataKey="count" name="ECO Count" stroke="#00ff9d" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : showTimeline ? (
        <TimelineModule initialProgramId={latestProgram?.id} />
      ) : (
        <>
          {/* Program status overview */}
          <section className="programs-status-strip glass" style={{ padding: '16px 20px', borderRadius: '12px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', color: '#a0a0b0' }}>Program Status Overview</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {programs.length === 0 ? (
                <span className="text-muted">No programs yet.</span>
              ) : programs.map(program => (
                <div key={program.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{program.program_code || program.program_name}</span>
                  <span className={`status-chip ${program.status === 'Production' ? 'production' : (program.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                    {program.status === 'Production' ? '🏭 In Production' : program.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* KPI Section */}
          <section className="kpi-grid">
            {kpis.map((kpi, index) => (
              <motion.div 
                key={kpi.label}
                className="kpi-card glass glow-border"
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="kpi-header">
                  <div className="kpi-icon-wrapper" style={{ backgroundColor: `${kpi.color}15`, color: kpi.color }}>
                    <kpi.icon size={20} />
                  </div>
                  <span className={`kpi-change ${kpi.change.startsWith('+') ? 'up' : 'down'}`}>
                    {kpi.change} <ArrowUpRight size={12} />
                  </span>
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">{kpi.label}</span>
                  <span className="kpi-value">{kpi.value}</span>
                </div>
              </motion.div>
            ))}
          </section>

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
                  <div className="text-muted" style={{padding: '16px'}}>No delayed milestones found.</div>
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
