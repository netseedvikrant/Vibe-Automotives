// AutoMFG — Dashboard — FIXED: Live Supabase data
import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ClipboardList, Layers, Activity, Cpu, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

function OEEGauge({ value, label, color = '#1c69d4', size = 120 }) {
  const data = [{ value, fill: color }, { value: 100 - value, fill: '#1a1a1a' }];
  return (
    <div className="gauge-wrapper">
      <div style={{ position: 'relative', width: size, height: size / 2 + 20 }}>
        <PieChart width={size} height={size / 2 + 10}>
          <Pie data={data} cx={size / 2} cy={size / 2 - 5} startAngle={180} endAngle={0} innerRadius={size / 2 - 18} outerRadius={size / 2 - 8} dataKey="value" stroke="none">
            {data.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
          </Pie>
        </PieChart>
        <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: size / 5, fontWeight: 700, color, lineHeight: 1 }}>
            {value.toFixed(1)}<span style={{ fontSize: size / 8, color: 'var(--text-secondary)' }}>%</span>
          </div>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-text)', textAlign: 'center' }}>{label}</div>
    </div>
  );
}

function MetricCard({ label, value, unit, trend, color = 'blue', icon: Icon }) {
  const colorMap = { blue: 'var(--bmw-blue)', green: 'var(--green)', red: 'var(--red)', amber: 'var(--amber)', white: 'var(--white)' };
  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: '100%', background: colorMap[color] }} />
      <div className="card-header">
        <span className="card-title">{label}</span>
        {Icon && <Icon size={16} color="var(--muted-text)" />}
      </div>
      <div className="metric-value" style={{ color: colorMap[color], fontSize: 36 }}>
        {value}<span className="metric-unit">{unit}</span>
      </div>
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
          {trend >= 0 ? <TrendingUp size={12} color="var(--green)" /> : <TrendingDown size={12} color="var(--red)" />}
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: trend >= 0 ? 'var(--green)' : 'var(--red)', letterSpacing: '0.1em' }}>
            {trend >= 0 ? '+' : ''}{trend}% vs yesterday
          </span>
        </div>
      )}
    </div>
  );
}

const ROLE_QUICK_ACTIONS = {
  production_manager: [
    { label: 'Approve Plans', path: '/production-planning', icon: ClipboardList },
    { label: 'View Work Orders', path: '/work-orders', icon: Layers },
    { label: 'OEE Report', path: '/oee', icon: Activity },
  ],
  shift_supervisor: [
    { label: 'Start Handover', path: '/shift-handover', icon: ArrowRight },
    { label: 'Raise Andon', path: '/assembly-line', icon: AlertTriangle },
    { label: 'Log Defect', path: '/scrap-rework', icon: AlertTriangle },
  ],
  machine_operator: [
    { label: 'My Work Order', path: '/work-orders', icon: Layers },
    { label: 'Report Issue', path: '/assembly-line', icon: AlertTriangle },
    { label: 'Breakdown Log', path: '/maintenance', icon: Cpu },
  ],
  quality_inspector: [
    { label: 'Quality Gate', path: '/quality-gate', icon: CheckCircle2 },
    { label: 'Log Defect', path: '/scrap-rework', icon: AlertTriangle },
    { label: 'EOL Testing', path: '/eol-testing', icon: Activity },
  ],
  production_planner: [
    { label: 'Create Plan', path: '/production-planning', icon: ClipboardList },
    { label: 'OEE Dashboard', path: '/oee', icon: Activity },
    { label: 'Work Orders', path: '/work-orders', icon: Layers },
  ],
  maintenance_tech: [
    { label: 'Breakdowns', path: '/maintenance', icon: Cpu },
    { label: 'Tool Status', path: '/tooling', icon: Activity },
  ],
  line_leader: [
    { label: 'Assembly Line', path: '/assembly-line', icon: Activity },
    { label: 'Work Orders', path: '/work-orders', icon: Layers },
    { label: 'Scrap Entry', path: '/scrap-rework', icon: AlertTriangle },
  ],
  plant_manager: [
    { label: 'OEE Dashboard', path: '/oee', icon: Activity },
    { label: 'Production Plans', path: '/production-planning', icon: ClipboardList },
    { label: 'Quality Gate', path: '/quality-gate', icon: CheckCircle2 },
  ],
  sys_admin: [
    { label: 'Admin Panel', path: '/admin', icon: Cpu },
    { label: 'OEE Dashboard', path: '/oee', icon: Activity },
    { label: 'Audit Trail', path: '/admin', icon: ClipboardList },
  ],
};

const FALLBACK_TREND = [
  { time: '06:00', oee: 72 }, { time: '08:00', oee: 78 }, { time: '10:00', oee: 81 },
  { time: '12:00', oee: 76 }, { time: '14:00', oee: 83 }, { time: '16:00', oee: 79 },
  { time: '18:00', oee: 77 }, { time: '20:00', oee: 82 }, { time: '22:00', oee: 85 },
];

export default function Dashboard() {
  const { user } = useAuthStore();
  const { oeeMetrics, andonAlerts } = useAppStore();
  const navigate = useNavigate();

  // ✅ FIXED: Live Supabase data instead of mock store
  const [liveWOs, setLiveWOs] = useState([]);
  const [liveBreakdowns, setLiveBreakdowns] = useState([]);
  const [liveAndons, setLiveAndons] = useState([]);
  const [liveScrapQty, setLiveScrapQty] = useState(0);
  const [trendData, setTrendData] = useState(FALLBACK_TREND);
  const [upcomingCalibrations, setUpcomingCalibrations] = useState([]);
  const [loadingLive, setLoadingLive] = useState(false);

  const fetchLiveData = async () => {
    if (!isSupabaseConfigured()) return;
    setLoadingLive(true);
    try {
      const [wosRes, bkRes, andonsRes, defectsRes, oeeRes, toolsRes] = await Promise.all([
        supabase.from('work_orders').select('wo_number, status, planned_qty, actual_qty').in('status', ['released', 'in_progress']).order('created_at', { ascending: false }).limit(10),
        supabase.from('breakdown_tickets').select('ticket_id, machine_id, description, severity, status, created_at, machines(machine_name)').neq('status', 'closed').order('created_at', { ascending: false }).limit(10),
        supabase.from('andon_events').select('andon_id, issue_type, severity, status, raised_at').eq('status', 'open').order('raised_at', { ascending: false }),
        supabase.from('defect_records').select('qty, logged_at').gte('logged_at', new Date(Date.now() - 86400000).toISOString()),
        supabase.from('oee_kpis').select('*').order('date', { ascending: false }).limit(7),
        supabase.from('tools').select('*, calibration_records(next_due)').eq('status', 'active'),
      ]);

      if (wosRes.data) setLiveWOs(wosRes.data);
      if (bkRes.data) setLiveBreakdowns(bkRes.data.map((t) => ({ ...t, id: t.ticket_id, machine: t.machines?.machine_name || 'Unknown Machine' })));
      if (andonsRes.data) setLiveAndons(andonsRes.data);
      if (defectsRes.data) setLiveScrapQty(defectsRes.data.reduce((s, d) => s + (d.qty || 0), 0));
      if (oeeRes.data && oeeRes.data.length > 0) {
        const trend = oeeRes.data.reverse().map((k, i) => ({ time: k.date || `Day ${i + 1}`, oee: k.oee_pct || 0 }));
        setTrendData(trend);
      }
      if (toolsRes.data) {
        const today = new Date();
        const fiveDaysFromNow = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
        const urgentCals = toolsRes.data.filter(t => {
          const nextDue = t.calibration_records?.[0]?.next_due;
          if (!nextDue) return false;
          const due = new Date(nextDue);
          return due >= today && due <= fiveDaysFromNow;
        });
        setUpcomingCalibrations(urgentCals);
      }
    } catch (err) {
      console.warn('[Dashboard] Live fetch failed:', err.message);
    } finally {
      setLoadingLive(false);
    }
  };

  useEffect(() => { fetchLiveData(); }, []);

  // Combine live andons with mock store (for cases where Supabase isn't configured)
  const activeAlerts = isSupabaseConfigured()
    ? liveAndons
    : andonAlerts.filter((a) => a.status === 'Open');

  const quickActions = ROLE_QUICK_ACTIONS[user?.role] || [];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Command Center</h1>
          <div className="page-subtitle">Production Intelligence Dashboard — {user?.plant}</div>
        </div>
        <div className="page-actions">
          <button className="icon-btn" onClick={fetchLiveData} title="Refresh live data"><RefreshCw size={14} /></button>
          <span className="badge badge-green">
            <span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: '50%', display: 'inline-block' }} />
            LIVE
          </span>
        </div>
      </div>

      {/* Andon Active Banner */}
      {activeAlerts.length > 0 && (
        <div className="andon-banner">
          <AlertTriangle size={16} color="var(--red)" />
          <span className="andon-banner-text" style={{ fontSize: 13 }}>
            ⚡ {activeAlerts.length} ANDON ALERT{activeAlerts.length > 1 ? 'S' : ''} ACTIVE — Immediate attention required
          </span>
          <button className="btn btn-sm btn-danger" onClick={() => navigate('/assembly-line')}>VIEW</button>
        </div>
      )}

      {/* Calibration Warning Banner */}
      {upcomingCalibrations.length > 0 && (
        <div className="andon-banner" style={{ background: 'rgba(255, 179, 0, 0.1)', border: '1px solid rgba(255, 179, 0, 0.3)', marginTop: 8 }}>
          <AlertTriangle size={16} color="var(--amber)" />
          <span className="andon-banner-text" style={{ fontSize: 13, color: '#ffb300' }}>
            ⚠️ {upcomingCalibrations.length} TOOL{upcomingCalibrations.length > 1 ? 'S' : ''} REQUIRE CALIBRATION WITHIN 5 DAYS
          </span>
          <button className="btn btn-sm" style={{ background: '#ffb300', color: 'black', border: 'none', marginLeft: 'auto' }} onClick={() => navigate('/tooling')}>CALIBRATE</button>
        </div>
      )}

      {/* OEE Gauges */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Overall Equipment Effectiveness</span>
          <span className="badge badge-blue">SHIFT A · LIVE</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24, padding: '8px 0', alignItems: 'end' }}>
          <OEEGauge value={oeeMetrics.availability} label="Availability" color="#1c69d4" size={140} />
          <OEEGauge value={oeeMetrics.performance} label="Performance" color="#1c69d4" size={140} />
          <OEEGauge value={oeeMetrics.quality} label="Quality" color="#1cd46a" size={140} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border-active)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.25em', color: 'var(--muted-text)', textTransform: 'uppercase' }}>OEE Score</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 52, fontWeight: 700, color: oeeMetrics.oee >= 85 ? 'var(--green)' : oeeMetrics.oee >= 70 ? 'var(--amber)' : 'var(--red)', lineHeight: 1 }}>
              {oeeMetrics.oee.toFixed(1)}<span style={{ fontSize: 20, color: 'var(--text-secondary)' }}>%</span>
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--muted-text)', textAlign: 'center', textTransform: 'uppercase' }}>A × P × Q Combined</div>
          </div>
          <OEEGauge value={oeeMetrics.fpy} label="First Pass Yield" color="#1cd46a" size={140} />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-4 mb-16">
        <MetricCard label="Active Work Orders" value={liveWOs.length || 0} unit="" trend={2} color="blue" icon={Layers} />
        <MetricCard label="Schedule Adherence" value={oeeMetrics.scheduleAdherence.toFixed(1)} unit="%" trend={-1.2} color="amber" icon={ClipboardList} />
        <MetricCard label="Today's Scrap" value={liveScrapQty} unit=" pcs" trend={-3} color="red" icon={AlertTriangle} />
        <MetricCard label="Andon Response Avg" value={oeeMetrics.andonResponseTime.toFixed(1)} unit=" min" trend={1.5} color="green" icon={CheckCircle2} />
      </div>

      {/* OEE Trend + Quick Actions */}
      <div className="grid grid-2 mb-16">
        <div className="card">
          <div className="card-header">
            <span className="card-title">OEE Trend</span>
            <span className="text-muted text-sm">{trendData === FALLBACK_TREND ? 'Mock data — no DB records' : 'From oee_kpis table'}</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="oeeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1c69d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#1c69d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontFamily: 'var(--font-heading)', fontSize: 10, fill: 'var(--muted-text)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[60, 100]} tick={{ fontFamily: 'var(--font-heading)', fontSize: 10, fill: 'var(--muted-text)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-active)', borderRadius: 0, fontFamily: 'var(--font-heading)', fontSize: 12 }} />
              <Area type="monotone" dataKey="oee" stroke="#1c69d4" strokeWidth={2} fill="url(#oeeGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Quick Actions — {user?.roleLabel}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {quickActions.map(({ label, path, icon: Icon }) => (
              <button key={label} className="btn btn-outline" style={{ justifyContent: 'flex-start', width: '100%', marginBottom: 4 }} onClick={() => navigate(path)}>
                <Icon size={14} />{label}<ArrowRight size={12} style={{ marginLeft: 'auto' }} />
              </button>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>Schedule Adherence</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, color: 'var(--amber)' }}>{oeeMetrics.scheduleAdherence.toFixed(1)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill amber" style={{ width: `${oeeMetrics.scheduleAdherence}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ✅ FIXED: Active Breakdowns from Supabase */}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Active Breakdowns</span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/maintenance')}>View All</button>
          </div>
          {liveBreakdowns.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <CheckCircle2 size={24} color="var(--green)" />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)', letterSpacing: '0.1em' }}>NO ACTIVE BREAKDOWNS</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {liveBreakdowns.map((bk) => (
                <div key={bk.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: `3px solid ${bk.severity === 'P1' ? 'var(--red)' : bk.severity === 'P2' ? 'var(--amber)' : 'var(--bmw-blue)'}` }}>
                  <span className={`badge ${bk.severity === 'P1' ? 'badge-red' : bk.severity === 'P2' ? 'badge-amber' : 'badge-blue'}`}>{bk.severity}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, color: 'var(--white)', letterSpacing: '0.05em' }}>{bk.machine}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{bk.description}</div>
                  </div>
                  <span className={`badge ${bk.status === 'open' ? 'badge-red' : 'badge-amber'}`}>{bk.status?.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ✅ FIXED: Active Work Orders from Supabase */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Active Work Orders</span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/work-orders')}>View All</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {liveWOs.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>No active work orders</div>
            ) : liveWOs.map((wo) => (
              <div key={wo.wo_number} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, color: 'var(--white)' }}>{wo.wo_number}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)' }}>Planned: {wo.planned_qty} · Actual: {wo.actual_qty}</div>
                </div>
                <span className={`badge ${wo.status === 'in_progress' ? 'badge-blue' : 'badge-white'}`}>{wo.status?.replace('_', ' ').toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
