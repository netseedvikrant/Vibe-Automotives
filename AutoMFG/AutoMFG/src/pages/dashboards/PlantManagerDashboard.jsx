// PlantManagerDashboard — Executive plant overview
// KPIs: OEE, FPY, schedule adherence, scrap rate, downtime, open Andons
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle2, TrendingUp, Truck, BarChart3, RefreshCw, ArrowRight } from 'lucide-react';
import { OEEGauge, MetricCard, IntegBadge, StatusBadge } from './shared';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

const SHIFT_SUMMARY = [
  { shift: 'Shift A', planned: 250, actual: 238, scrap: 5, downtime: 22, oee: 82 },
  { shift: 'Shift B', planned: 240, actual: 241, scrap: 2, downtime: 10, oee: 89 },
  { shift: 'Shift C', planned: 230, actual: 215, scrap: 8, downtime: 35, oee: 74 },
];

const QUALITY_ESCALATIONS = [
  { id: 'QE-001', part: 'BMW-M4-DOOR-LH', issue: 'Dimensional OOT', qty: 3, severity: 'High',   status: 'Open' },
  { id: 'QE-002', part: 'BMW-3-CHASSIS',   issue: 'Weld tensile < LSL', qty: 1, severity: 'Critical', status: 'Escalated' },
  { id: 'QE-003', part: 'BMW-5-ENGINE-MOUNT', issue: 'Porosity UAI pending', qty: 3, severity: 'Medium', status: 'Pending Approval' },
];

const SCM_TRIGGERS = [
  { type: 'to_scm', entity: 'Replenishment — Gasket Seal GS-401', qty: 500, status: 'synced' },
  { type: 'to_scm', entity: 'Scrap Cert SC-0042 — 8 pcs door panel', qty: 8, status: 'sync_pending' },
  { type: 'to_scm', entity: 'EOL Cert EOL-2026-0089 — BMW M4', qty: 1, status: 'synced' },
];

const TREND = [
  { day: 'Mon', oee: 80 }, { day: 'Tue', oee: 83 }, { day: 'Wed', oee: 77 },
  { day: 'Thu', oee: 85 }, { day: 'Fri', oee: 82 }, { day: 'Sat', oee: 78 }, { day: 'Sun', oee: 74 },
];

const mapHandoffToTrigger = (h) => {
  const isFromRnd = h.source_module === 'AutoRnD';
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
  } else if (h.handoff_type === 'MATERIAL_SHORTAGE' || h.handoff_type === 'REPLENISHMENT') {
    entity = `Replenishment — ${entity}`;
  }

  const status = h.status === 'Synced' ? 'synced' : 'sync_pending';

  return {
    id: h.id,
    type,
    entity,
    status
  };
};

export default function PlantManagerDashboard() {
  const { user } = useAuthStore();
  const { oeeMetrics, andonAlerts } = useAppStore();
  const navigate = useNavigate();
  const openAndons = andonAlerts.filter(a => a.status === 'Open');

  const [scmTriggers, setScmTriggers] = useState(SCM_TRIGGERS);
  const [loading, setLoading] = useState(false);

  const fetchScmTriggers = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        setScmTriggers(SCM_TRIGGERS);
        return;
      }
      const { data, error } = await supabase
        .from('scm_handoffs')
        .select('*')
        .eq('target_module', 'AutoSCM')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (data && data.length > 0) {
        setScmTriggers(data.map(mapHandoffToTrigger));
      } else {
        setScmTriggers(SCM_TRIGGERS);
      }
    } catch (err) {
      console.error("Failed to fetch SCM triggers:", err);
      setScmTriggers(SCM_TRIGGERS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScmTriggers();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const channel = supabase.channel('scm_handoffs_plantmanager')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scm_handoffs' }, () => {
        fetchScmTriggers();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Executive Plant Dashboard</h1>
          <div className="page-subtitle">Plant Performance Overview — {user?.plant} · All Shifts</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/oee')}><BarChart3 size={13} /> Full OEE Report</button>
          <span className="badge badge-green"><span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: '50%', display: 'inline-block' }} /> LIVE</span>
        </div>
      </div>

      {/* OEE Gauges */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Overall Equipment Effectiveness — Plant A</span>
          <span className="badge badge-blue">TODAY · ALL SHIFTS</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24, padding: '8px 0', alignItems: 'end' }}>
          <OEEGauge value={oeeMetrics.availability} label="Availability"    color="#1c69d4" size={130} />
          <OEEGauge value={oeeMetrics.performance}  label="Performance"     color="#1c69d4" size={130} />
          <OEEGauge value={oeeMetrics.quality}      label="Quality"         color="#1cd46a" size={130} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border-active)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.25em', color: 'var(--muted-text)', textTransform: 'uppercase' }}>OEE</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 48, fontWeight: 700, color: oeeMetrics.oee >= 85 ? 'var(--green)' : oeeMetrics.oee >= 70 ? 'var(--amber)' : 'var(--red)', lineHeight: 1 }}>
              {oeeMetrics.oee.toFixed(1)}<span style={{ fontSize: 18, color: 'var(--text-secondary)' }}>%</span>
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9, color: 'var(--muted-text)', textAlign: 'center', textTransform: 'uppercase' }}>A × P × Q</div>
          </div>
          <OEEGauge value={oeeMetrics.fpy} label="First Pass Yield" color="#1cd46a" size={130} />
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-4 mb-16">
        <MetricCard label="Schedule Adherence" value={oeeMetrics.scheduleAdherence.toFixed(1)} unit="%" trend={1.2} color="blue" />
        <MetricCard label="Scrap Rate Today"   value="2.1" unit="%" trend={-0.3} color="red" />
        <MetricCard label="Open Andon Alerts"  value={openAndons.length} color={openAndons.length > 0 ? 'red' : 'green'} icon={AlertTriangle} />
        <MetricCard label="Avg MTTR"           value="42" unit=" min" trend={-5} color="amber" subtitle="Mean time to repair" />
      </div>

      <div className="grid grid-2 mb-16">
        {/* OEE 7-day trend */}
        <div className="card">
          <div className="card-header"><span className="card-title">7-Day OEE Trend</span></div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={TREND}>
              <defs>
                <linearGradient id="pmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1c69d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#1c69d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontFamily: 'var(--font-heading)', fontSize: 10, fill: 'var(--muted-text)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[60, 100]} tick={{ fontFamily: 'var(--font-heading)', fontSize: 10, fill: 'var(--muted-text)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-active)', fontFamily: 'var(--font-heading)', fontSize: 12 }} />
              <Area type="monotone" dataKey="oee" stroke="#1c69d4" strokeWidth={2} fill="url(#pmGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Shift summary */}
        <div className="card">
          <div className="card-header"><span className="card-title">Cross-Shift Production Summary</span></div>
          {SHIFT_SUMMARY.map(s => (
            <div key={s.shift} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{s.shift}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>
                  {s.actual}/{s.planned} units · Scrap: {s.scrap} · Downtime: {s.downtime}m
                </span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: s.oee >= 85 ? 'var(--green)' : s.oee >= 75 ? 'var(--amber)' : 'var(--red)' }}>
                  OEE {s.oee}%
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(s.actual / s.planned) * 100}%`, background: s.oee >= 85 ? 'var(--green)' : s.oee >= 75 ? 'var(--amber)' : 'var(--red)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        {/* Quality Escalations */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Quality Escalations</span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/quality-gate')}>View All</button>
          </div>
          {QUALITY_ESCALATIONS.map(q => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: 1, borderLeft: `3px solid ${q.severity === 'Critical' ? 'var(--red)' : q.severity === 'High' ? 'var(--amber)' : 'var(--bmw-blue)'}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)' }}>{q.part}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>{q.issue} · Qty: {q.qty}</div>
              </div>
              <span className={`badge ${q.severity === 'Critical' ? 'badge-red' : q.severity === 'High' ? 'badge-amber' : 'badge-blue'}`}>{q.severity}</span>
              <StatusBadge status={q.status} />
            </div>
          ))}
        </div>

        {/* AutoSCM Supply Chain Impact */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Supply Chain Impact</span>
            <IntegBadge type="to_scm" />
          </div>
          {scmTriggers.map((s, i) => (
            <div key={s.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: 1 }}>
              <IntegBadge type={s.type} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-primary)' }}>{s.entity}</div>
              </div>
              <IntegBadge type={s.status} />
            </div>
          ))}
          <div style={{ padding: '12px 0 0', display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/scrap-rework')}>Scrap Certs <ArrowRight size={11} /></button>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/eol-testing')}>EOL Certs <ArrowRight size={11} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
