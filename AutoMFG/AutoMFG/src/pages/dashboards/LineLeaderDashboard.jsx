// LineLeaderDashboard — Line Leader
// Focus: assigned line, WO, tooling checklist, station readiness, defects
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { Wrench, CheckCircle2, AlertTriangle, Activity, ArrowRight, ChevronUp } from 'lucide-react';
import { MetricCard, WorkflowSteps, StatusBadge } from './shared';
import toast from 'react-hot-toast';

const MY_WO = { id: 'WO-2024-0001', part: 'BMW-M4-DOOR-LH', line: 'Line 1', planned: 100, actual: 72, status: 'In Progress', vin: 'WBS3R9C57FK999001' };

const TOOLING_CHECKLIST = [
  { id: 'TL-001', name: 'Torque Wrench 80Nm',   station: 'St.1', calibrated: true,  linked: true,  cycleCount: 4250, maxCycles: 5000 },
  { id: 'TL-003', name: 'Pneumatic Drill 18V',   station: 'St.3', calibrated: false, linked: true,  cycleCount: 8900, maxCycles: 10000 },
  { id: 'TL-004', name: 'Digital Caliper 150mm', station: 'St.2', calibrated: true,  linked: false, cycleCount: 3200, maxCycles: 20000 },
];

const STATION_STATUS = [
  { station: 'Station 1', ready: true,  op: 'Door Welding',  operator: 'James M.', status: 'Running' },
  { station: 'Station 2', ready: true,  op: 'Sealing',       operator: 'Priya R.', status: 'Running' },
  { station: 'Station 3', ready: false, op: 'Robot Welding',  operator: '—',        status: 'BLOCKED' },
];

const LOCAL_DEFECTS = [
  { id: 'LD-001', part: 'BMW-M4-DOOR-LH', defect: 'Surface scratch', qty: 2, disposition: 'Rework', status: 'In Progress' },
];

export default function LineLeaderDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [tools, setTools] = useState(TOOLING_CHECKLIST);

  const linkTool = (id) => {
    setTools(prev => prev.map(t => t.id === id ? { ...t, linked: true } : t));
    toast.success('Tool linked to station');
  };

  const progress = Math.round((MY_WO.actual / MY_WO.planned) * 100);
  const toolsReady = tools.every(t => t.calibrated && t.linked);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Line Leader Dashboard</h1>
          <div className="page-subtitle">WO Progress · Tooling · Station Readiness — {user?.plant} · {user?.department}</div>
        </div>
        <div className="page-actions">
          <span className={`badge ${toolsReady ? 'badge-green' : 'badge-amber'}`}>
            {toolsReady ? '✓ LINE READY' : '⚠ CHECK TOOLING'}
          </span>
        </div>
      </div>

      {/* Workflow */}
      <div className="card mb-16" style={{ padding: '12px 16px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Line Workflow</div>
        <WorkflowSteps steps={['WO Receipt', 'Tooling Check', 'Assembly Readiness', 'Operations', 'Defect Log', 'WO Completion']} current={2} />
      </div>

      {/* My Active WO */}
      <div className="card mb-16" style={{ borderLeft: '3px solid var(--bmw-blue)' }}>
        <div className="card-header">
          <span className="card-title">Active Work Order — {MY_WO.id}</span>
          <StatusBadge status={MY_WO.status} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 12 }}>
          {[
            ['Part', MY_WO.part],
            ['Line', MY_WO.line],
            ['VIN', MY_WO.vin],
          ].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)' }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>Progress: {MY_WO.actual}/{MY_WO.planned} units</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--bmw-blue)' }}>{progress}%</span>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/work-orders')}><Activity size={12} /> View Full WO</button>
          <button className="btn btn-sm btn-outline" onClick={() => { toast.success('WO WO-2024-0001 marked complete'); }}><CheckCircle2 size={12} /> Confirm Completion</button>
        </div>
      </div>

      <div className="grid grid-2 mb-16">
        {/* Tooling Checklist */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tooling Checklist</span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/tooling')}><Wrench size={12} /> Tooling</button>
          </div>
          {tools.map(t => (
            <div key={t.id} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: `3px solid ${t.calibrated && t.linked ? 'var(--green)' : 'var(--red)'}`, marginBottom: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)' }}>{t.name}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>{t.station}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <span className={`badge ${t.calibrated ? 'badge-green' : 'badge-red'}`}>{t.calibrated ? 'Calibrated ✓' : 'Not Calibrated ✗'}</span>
                <span className={`badge ${t.linked ? 'badge-green' : 'badge-amber'}`}>{t.linked ? 'Linked ✓' : 'Not Linked'}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--muted-text)', marginBottom: t.linked ? 0 : 6 }}>
                Cycles: {t.cycleCount.toLocaleString()} / {t.maxCycles.toLocaleString()}
              </div>
              {!t.linked && (
                <button className="btn btn-sm btn-primary" onClick={() => linkTool(t.id)}><Wrench size={11} /> Link to Station</button>
              )}
            </div>
          ))}
        </div>

        {/* Station Readiness */}
        <div className="card">
          <div className="card-header"><span className="card-title">Station Readiness</span></div>
          {STATION_STATUS.map(s => (
            <div key={s.station} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: `3px solid ${s.ready ? 'var(--green)' : 'var(--red)'}`, marginBottom: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{s.station}</span>
                <span className={`badge ${s.status === 'Running' ? 'badge-green' : 'badge-red'}`}>{s.status}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>{s.op} · Operator: {s.operator}</div>
            </div>
          ))}
          <button className="btn btn-sm btn-outline" style={{ marginTop: 10, width: '100%' }} onClick={() => navigate('/scrap-rework')}>
            <AlertTriangle size={12} /> Report Local Defect
          </button>
        </div>
      </div>

      {/* Local Defects */}
      {LOCAL_DEFECTS.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Local Defects</span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/scrap-rework')}>View All</button>
          </div>
          {LOCAL_DEFECTS.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: '3px solid var(--amber)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)' }}>{d.defect}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>{d.part} · Qty: {d.qty} · {d.disposition}</div>
              </div>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
