// OperatorDashboard — Machine Operator
// Focus: my station, active WO, takt timer, operations checklist, Raise Andon
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { AlertTriangle, CheckCircle2, Play, Pause, Square, Clock, Activity } from 'lucide-react';
import { WorkflowSteps, StatusBadge } from './shared';
import toast from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

function normalizeWO(wo) {
  return {
    id: wo.wo_number || wo.id,
    wo_number: wo.wo_number || wo.id,
    plan_id: wo.plan_id || null,
    parent: wo.production_plans?.plan_code || wo.production_plans?.plan_id?.slice(0,8) || wo.plan_id?.slice(0,8) || '—',
    part: wo.part_number || wo.part || '—',
    vin: wo.vin || '—',
    plant: wo.plants?.name || (!wo.plant_id || wo.plant_id?.includes('-') ? 'Plant A' : wo.plant_id) || '—',
    line: wo.production_lines?.line_name || (!wo.line_id || wo.line_id?.includes('-') ? '—' : wo.line_id) || '—',
    line_id: wo.line_id || null,
    workCenter: wo.workCenter || '—',
    operation: wo.operation || '—',
    stdTime: wo.stdTime || 24,
    actualTime: wo.actualTime || null,
    plannedQty: wo.planned_qty ?? wo.producedQty ?? 0,
    actualQty: wo.actual_qty ?? wo.producedQty ?? 0,
    scrapQty: wo.scrap_qty ?? wo.scrapQty ?? 0,
    status: (wo.status || 'created').toLowerCase().replace(' ', '_'),
    created: wo.created_at?.slice(0, 10) || wo.created || '—',
  };
}

const STATION_INFO = { id: 'Station 3', line: 'Line 1', defaultTakt: 24 };

const OPS_CHECKLIST = [
  { id: 1, step: 'Confirm VIN scan',         done: true },
  { id: 2, step: 'Position door panel',       done: true },
  { id: 3, step: 'Apply weld marks (4 pts)',  done: false },
  { id: 4, step: 'Torque bolt sequence 1–6',  done: false },
  { id: 5, step: 'Visual inspection',         done: false },
  { id: 6, step: 'Sign-off scan',             done: false },
];

const ANDON_TYPES = ['Quality', 'Safety', 'Parts Shortage', 'Machine Fault'];

export default function OperatorDashboard() {
  const { user } = useAuthStore();
  const { raiseAndon, fetchAndons } = useAppStore();
  const navigate = useNavigate();

  const [ops, setOps] = useState(OPS_CHECKLIST);
  const [opStatus, setOpStatus] = useState('idle'); // idle | running | paused
  const [elapsed, setElapsed] = useState(0);
  const [showAndon, setShowAndon] = useState(false);
  const [andonType, setAndonType] = useState('');

  const [activeWO, setActiveWO] = useState(null);
  const [loadingWO, setLoadingWO] = useState(true);

  const fetchWorkOrders = async () => {
    if (!isSupabaseConfigured()) {
      setLoadingWO(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          production_plans ( plan_id, plan_code, part_number, line_id, start_date, end_date ),
          production_lines ( line_name ),
          plants ( name )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const allOrders = data || [];
      const normalizeStatus = (status) =>
        String(status || "")
          .toLowerCase()
          .replaceAll(" ", "_")
          .replaceAll("-", "_");

      const inProgressOrders = allOrders.filter(
        (wo) => normalizeStatus(wo.status) === "in_progress"
      );

      console.log("Fetched work orders:", allOrders);
      console.log("In-progress work orders:", inProgressOrders);

      const selectedPlant = user?.plant || "Plant A";
      const currentLine = STATION_INFO.line;

      const matchingWorkOrder = inProgressOrders.find(wo => {
        const woPlant = wo.plants?.name || wo.plant_id || 'Plant A';
        const woLine = wo.production_lines?.line_name || wo.line_id || 'Line 1';
        return woPlant === selectedPlant && woLine === currentLine;
      }) || inProgressOrders[0] || null;

      console.log("Selected active work order:", matchingWorkOrder);
      console.log("Current plant/line filters:", selectedPlant, currentLine);

      if (matchingWorkOrder) {
        setActiveWO(normalizeWO(matchingWorkOrder));
      } else {
        setActiveWO(null);
      }
    } catch (err) {
      console.error("Failed to fetch work orders:", err);
    } finally {
      setLoadingWO(false);
    }
  };

  useEffect(() => {
    fetchAndons();
    fetchWorkOrders();

    let channel;
    if (isSupabaseConfigured()) {
      channel = supabase
        .channel("work_orders_realtime_operator")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "work_orders"
          },
          () => {
            fetchWorkOrders();
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Takt timer
  useEffect(() => {
    let interval;
    if (opStatus === 'running') {
      interval = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [opStatus]);

  const toggleStep = (id) => {
    setOps(prev => prev.map(op => op.id === id ? { ...op, done: !op.done } : op));
  };

  const allDone = ops.every(o => o.done);
  const donePct = Math.round((ops.filter(o => o.done).length / ops.length) * 100);

  const handleAndon = () => {
    if (!andonType) { toast.error('Select Andon type'); return; }
    raiseAndon({
      line: STATION_INFO.line,
      station: STATION_INFO.id,
      type: andonType.toLowerCase().replace(' ', '_'),
      description: `${andonType} reported by operator`,
      severity: andonType === 'Safety' ? 'high' : 'medium',
      plant: user?.plant || 'Plant A',
      shift: user?.shift || 'Shift A'
    });
    toast.error(`Andon raised — ${andonType}`);
    setShowAndon(false);
    setAndonType('');
    navigate('/assembly-line');
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  
  const taktTime = activeWO ? activeWO.stdTime || STATION_INFO.defaultTakt : STATION_INFO.defaultTakt;
  const taktPct = Math.min(Math.round((elapsed / taktTime) * 100), 100);
  const overTakt = elapsed > taktTime;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">{STATION_INFO.id} — {STATION_INFO.line}</h1>
          <div className="page-subtitle">My Station · Active Work Order · Assembly & Takt — {user?.plant}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm" style={{ background: 'var(--red)', border: 'none', color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.1em' }} onClick={() => setShowAndon(true)}>
            <AlertTriangle size={13} /> RAISE ANDON
          </button>
        </div>
      </div>

      {/* Andon modal */}
      {showAndon && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 400, padding: 24 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Raise Andon Alert</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)', marginBottom: 8 }}>SELECT ISSUE TYPE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {ANDON_TYPES.map(t => (
                <button key={t} onClick={() => setAndonType(t)} style={{ padding: '12px', background: andonType === t ? 'var(--red)' : 'var(--bg-elevated)', border: `2px solid ${andonType === t ? 'var(--red)' : 'var(--border)'}`, color: andonType === t ? 'white' : 'var(--text-primary)', fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.06em' }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleAndon}><AlertTriangle size={13} /> Raise Andon</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAndon(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow */}
      <div className="card mb-16" style={{ padding: '12px 16px' }}>
        <WorkflowSteps steps={['WO Released', 'Assembly', 'Takt Timer', 'Checklist', 'Sign-off']} current={2} />
      </div>

      {/* Station + WO info */}
      {loadingWO ? (
        <div className="card mb-16" style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 12 }}>
          Loading active work order...
        </div>
      ) : activeWO ? (
        <div className="card mb-16" style={{ borderLeft: '3px solid var(--bmw-blue)' }}>
          <div className="card-header">
            <span className="card-title">Active Work Order</span>
            <StatusBadge status="In Progress" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 12 }}>
            {[
              ['WO', activeWO.wo_number],
              ['Part', activeWO.part],
              ['VIN', activeWO.vin],
              ['Operation', activeWO.operation || '040 — Final Welding & Inspection']
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{l}</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-primary)' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card mb-16" style={{ borderLeft: '3px solid var(--red)' }}>
          <div className="card-header">
            <span className="card-title">Active Work Order</span>
            <span className="badge badge-red">None</span>
          </div>
          <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)' }}>
            No in-progress work order assigned to this station.
          </div>
        </div>
      )}

      <div className="grid grid-2 mb-16">
        {/* Takt Timer */}
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-header"><span className="card-title">Takt Timer</span></div>
          <div style={{ padding: '16px 0' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 56, fontWeight: 700, color: overTakt ? 'var(--red)' : elapsed > taktTime * 0.8 ? 'var(--amber)' : 'var(--green)', lineHeight: 1, marginBottom: 8 }}>
              {fmt(elapsed)}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)', marginBottom: 12 }}>Standard Takt: {taktTime}s</div>
            <div className="progress-bar" style={{ marginBottom: 16 }}>
              <div className="progress-fill" style={{ width: `${taktPct}%`, background: overTakt ? 'var(--red)' : taktPct > 80 ? 'var(--amber)' : 'var(--green)' }} />
            </div>
            {overTakt && <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>⚠ OVER TAKT — Consider raising Andon</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {opStatus === 'idle' && <button className="btn btn-primary" onClick={() => setOpStatus('running')}><Play size={14} /> Start</button>}
              {opStatus === 'running' && <button className="btn btn-outline" onClick={() => setOpStatus('paused')}><Pause size={14} /> Pause</button>}
              {opStatus === 'paused' && <button className="btn btn-primary" onClick={() => setOpStatus('running')}><Play size={14} /> Resume</button>}
              {opStatus !== 'idle' && (
                <button className="btn" style={{ background: 'var(--green)', borderColor: 'var(--green)', color: 'white' }} onClick={() => { setOpStatus('idle'); setElapsed(0); toast.success('Operation completed'); }}>
                  <Square size={14} /> Complete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Operations Checklist */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Operations Checklist</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: donePct === 100 ? 'var(--green)' : 'var(--bmw-blue)' }}>{donePct}%</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 12 }}>
            <div className="progress-fill" style={{ width: `${donePct}%`, background: donePct === 100 ? 'var(--green)' : 'var(--bmw-blue)' }} />
          </div>
          {ops.map(op => (
            <div key={op.id} onClick={() => toggleStep(op.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', background: op.done ? 'rgba(28,212,106,0.08)' : 'var(--bg-elevated)', border: `1px solid ${op.done ? 'rgba(28,212,106,0.3)' : 'var(--border)'}`, marginBottom: 1, cursor: 'pointer' }}>
              <div style={{ width: 18, height: 18, border: `2px solid ${op.done ? 'var(--green)' : 'var(--border)'}`, background: op.done ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {op.done && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: op.done ? 'var(--muted-text)' : 'var(--text-primary)', textDecoration: op.done ? 'line-through' : 'none' }}>{op.step}</span>
            </div>
          ))}
          {allDone && (
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => toast.success('Operation signed off')}>
              <CheckCircle2 size={13} /> Sign Off Operation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
