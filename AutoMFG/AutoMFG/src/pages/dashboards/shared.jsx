// AutoMFG — Shared dashboard components used across role dashboards
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ── OEE semi-circle gauge ────────────────────────────────────────
export function OEEGauge({ value, label, color = '#1c69d4', size = 120 }) {
  const data = [{ value, fill: color }, { value: 100 - value, fill: '#1a1a1a' }];
  return (
    <div className="gauge-wrapper">
      <div style={{ position: 'relative', width: size, height: size / 2 + 20 }}>
        <PieChart width={size} height={size / 2 + 10}>
          <Pie data={data} cx={size / 2} cy={size / 2 - 5} startAngle={180} endAngle={0} innerRadius={size / 2 - 18} outerRadius={size / 2 - 8} dataKey="value" stroke="none">
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
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

// ── KPI metric card ──────────────────────────────────────────────
export function MetricCard({ label, value, unit = '', trend, color = 'blue', icon: Icon, subtitle }) {
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
      {subtitle && <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)', marginTop: 4 }}>{subtitle}</div>}
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

// ── Quick action buttons ─────────────────────────────────────────
export function QuickActions({ actions, title }) {
  const navigate = useNavigate();
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">{title || 'Quick Actions'}</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {actions.map(({ label, path, icon: Icon, badge, badgeColor }) => (
          <button key={label} className="btn btn-outline" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => navigate(path)}>
            {Icon && <Icon size={14} />}
            <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
            {badge && <span className={`badge badge-${badgeColor || 'blue'}`}>{badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Integration data badge ───────────────────────────────────────
export function IntegBadge({ type }) {
  const configs = {
    from_rnd:    { label: 'FROM AUTORND',    bg: 'rgba(28,105,212,0.15)', border: 'rgba(28,105,212,0.4)', color: '#1c69d4' },
    mfg:         { label: 'MFG GENERATED',   bg: 'rgba(28,212,106,0.12)', border: 'rgba(28,212,106,0.4)', color: '#1cd46a' },
    to_scm:      { label: 'SENT TO AUTOSCM', bg: 'rgba(255,179,0,0.12)',  border: 'rgba(255,179,0,0.4)',  color: '#ffb300' },
    sync_pending:{ label: 'SYNC PENDING',    bg: 'rgba(255,100,0,0.12)',  border: 'rgba(255,100,0,0.4)',  color: '#ff6400' },
    synced:      { label: 'SYNCED',          bg: 'rgba(28,212,106,0.12)', border: 'rgba(28,212,106,0.4)', color: '#1cd46a' },
  };
  const c = configs[type] || configs.mfg;
  return (
    <span style={{ fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', padding: '2px 6px', background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      {c.label}
    </span>
  );
}

// ── Workflow stage progress bar ──────────────────────────────────
export function WorkflowSteps({ steps, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', padding: '8px 0' }}>
      {steps.map((step, i) => {
        const isDone = i < current;
        const isActive = i === current;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{
              padding: '4px 12px', fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              background: isDone ? 'var(--green)' : isActive ? 'var(--bmw-blue)' : 'var(--bg-elevated)',
              color: isDone || isActive ? 'white' : 'var(--muted-text)',
              border: `1px solid ${isDone ? 'var(--green)' : isActive ? 'var(--bmw-blue)' : 'var(--border)'}`,
            }}>
              {isDone ? '✓ ' : isActive ? '▶ ' : ''}{step}
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 20, height: 1, background: isDone ? 'var(--green)' : 'var(--border)', flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Reusable table row ───────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    'Draft':           'badge-white',
    'Pending Approval':'badge-amber',
    'Pending':         'badge-amber',
    'Approved':        'badge-green',
    'Frozen':          'badge-blue',
    'Released':        'badge-blue',
    'In Progress':     'badge-blue',
    'Open':            'badge-red',
    'Acknowledged':    'badge-amber',
    'Resolved':        'badge-green',
    'Completed':       'badge-green',
    'Closed':          'badge-white',
    'PASS':            'badge-green',
    'FAIL':            'badge-red',
    'P1':              'badge-red',
    'P2':              'badge-amber',
    'P3':              'badge-blue',
    'P4':              'badge-white',
  };
  return <span className={`badge ${map[status] || 'badge-white'}`}>{status}</span>;
}
