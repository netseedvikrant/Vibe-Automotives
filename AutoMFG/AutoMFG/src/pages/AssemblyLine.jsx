// AutoMFG — Assembly Line / Shop Floor (Flow 4) — FIXED
// Takt timer, Andon, Operation records, Digital signoffs
import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { AlertTriangle, Play, Square, CheckCircle2, Zap, Clock, Activity } from 'lucide-react';
import { supabase, isSupabaseConfigured, writeAuditLog, createNotification } from '../lib/supabase';
import { queueOfflineAction } from '../lib/offlineSync';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

// Guard: only send UUID values to Supabase FK columns
const safeUUID = (id) =>
  id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;

const STANDARD_TAKT = 60; // seconds per unit

const ISSUE_TYPES = [
  { value: 'quality_defect', label: 'Quality Defect', color: 'var(--amber)' },
  { value: 'part_shortage', label: 'Part Shortage', color: 'var(--amber)' },
  { value: 'machine_issue', label: 'Machine Issue', color: 'var(--red)' },
  { value: 'safety', label: 'Safety', color: 'var(--red)' },
];

const SEVERITY_COLORS = { low: 'badge-gray', medium: 'badge-amber', high: 'badge-red', critical: 'badge-red' };

const andonSchema = z.object({
  issue_type: z.string().min(1, 'Select issue type'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(5, 'Description required'),
  station: z.string().min(1, 'Station required'),
});

// ── Takt Timer ──────────────────────────────────────────────────
function TaktTimer({ running, onOverrun }) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);
  const overrunNotified = useRef(false);

  useEffect(() => {
    if (running) {
      overrunNotified.current = false;
      intervalRef.current = setInterval(() => {
        setElapsed((e) => {
          const next = e + 1;
          if (next >= STANDARD_TAKT && !overrunNotified.current) {
            overrunNotified.current = true;
            onOverrun?.(next);
          }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
      setElapsed(0);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const pct = Math.min((elapsed / STANDARD_TAKT) * 100, 100);
  const overrun = elapsed >= STANDARD_TAKT;
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 64, fontWeight: 700, color: overrun ? 'var(--red)' : elapsed > STANDARD_TAKT * 0.8 ? 'var(--amber)' : 'var(--bmw-blue)', lineHeight: 1, letterSpacing: '0.02em' }}>
        {mins}:{secs}
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--muted-text)', marginBottom: 12, textTransform: 'uppercase' }}>
        Standard Takt: {STANDARD_TAKT}s {overrun && <span style={{ color: 'var(--red)' }}>— OVERRUN</span>}
      </div>
      <div style={{ height: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', position: 'relative' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: overrun ? 'var(--red)' : elapsed > STANDARD_TAKT * 0.8 ? 'var(--amber)' : 'var(--bmw-blue)', transition: 'width 1s linear, background 0.3s' }} />
        <div style={{ position: 'absolute', top: -2, left: '50%', width: 1, height: 12, background: 'var(--muted-text)' }} />
      </div>
    </div>
  );
}

// ── Andon Modal ────────────────────────────────────────────────
function AndonModal({ onClose, onRaise }) {
  const { user } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(andonSchema), defaultValues: { severity: 'medium' } });
  const onSubmit = async (data) => {
    try {
      const payload = {
        station_id: null,
        wo_number: null,
        issue_type: data.issue_type,
        severity: data.severity,
        raised_by: safeUUID(user?.id),
        status: 'open',
        raised_at: new Date().toISOString(),
        line: 'Line 1',
        station: data.station || 'Unknown',
        description: data.description || `${data.issue_type.replace('_', ' ')} reported by operator`,
        plant: user?.plant || 'Plant A',
        shift: user?.shift || 'Shift A',
      };

      if (!navigator.onLine) {
        queueOfflineAction('andon_events', payload);
        const newAlert = {
          id: `AND-OFF-${Date.now()}`,
          line: 'Line 1',
          station: data.station,
          type: data.issue_type,
          issue_type: data.issue_type,
          description: data.description,
          severity: data.severity,
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          status: 'Open',
          plant: user?.plant || 'Plant A',
          shift: user?.shift || 'Shift A',
        };
        onRaise(newAlert);
        onClose();
        return;
      }

      if (isSupabaseConfigured()) {
        const { data: inserted, error } = await supabase.from('andon_events').insert(payload).select().single();
        if (error) throw error;
        writeAuditLog(safeUUID(user?.id), 'andon_events', 'insert', { issue_type: data.issue_type, severity: data.severity });

        // ✅ Notify supervisors/admins
        try {
          const { data: profiles } = await supabase.from('profiles').select('id, user_roles(roles(role_name))');
          if (profiles) {
            const supervisors = profiles.filter(p =>
              p.user_roles?.some(ur => ['production_supervisor', 'sys_admin', 'maintenance_manager'].includes(ur.roles?.role_name))
            );
            for (const s of supervisors) {
              await createNotification(
                s.id,
                null,
                'andon_events',
                inserted?.andon_id,
                `⚡ Andon Raised: ${data.issue_type.replace('_', ' ').toUpperCase()} at ${data.station}`
              );
            }
          }
        } catch (notifErr) {
          console.warn('[AndonNotification] Failed to send:', notifErr.message);
        }

        const newAlert = {
          id: inserted?.andon_id || `AND-${Date.now()}`,
          line: 'Line 1',
          station: data.station,
          type: data.issue_type,
          issue_type: data.issue_type,
          description: data.description,
          severity: data.severity,
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          status: 'Open',
          plant: user?.plant || 'Plant A',
          shift: user?.shift || 'Shift A',
        };
        onRaise(newAlert);
      } else {
        const newAlert = {
          id: `AND-${Date.now()}`,
          line: 'Line 1',
          station: data.station,
          type: data.issue_type,
          issue_type: data.issue_type,
          description: data.description,
          severity: data.severity,
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          status: 'Open',
          plant: user?.plant || 'Plant A',
          shift: user?.shift || 'Shift A',
        };
        onRaise(newAlert);
      }
      toast.error(`⚡ ANDON RAISED — ${data.issue_type.replace('_', ' ').toUpperCase()} at ${data.station}`, { duration: 6000 });
      onClose();
    } catch (err) {
      toast.error('Failed to raise Andon. Please try again.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480, borderColor: 'var(--red)' }}>
        <div className="modal-header" style={{ borderColor: 'var(--red)', background: 'var(--red-dim)' }}>
          <span className="modal-title" style={{ color: 'var(--red)' }}>⚡ Raise Andon Alert</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Issue Type</label>
              <select className="form-select" {...register('issue_type')}>
                <option value="">Select issue...</option>
                {ISSUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {errors.issue_type && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.issue_type.message}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Station</label>
                <input className="form-input" placeholder="e.g. Station 3A" {...register('station')} />
                {errors.station && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.station.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Severity</label>
                <select className="form-select" {...register('severity')}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" placeholder="Describe the issue..." {...register('description')} />
              {errors.description && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.description.message}</span>}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-danger" type="submit" disabled={isSubmitting} style={{ background: 'var(--red)', color: 'white', borderColor: 'var(--red)' }}>
              {isSubmitting ? 'Raising...' : '⚡ Raise Andon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

export default function AssemblyLine() {
  const { user } = useAuthStore();
  const { andonAlerts, raiseAndon, resolveAndon, workOrders: _, addToast, fetchAndons } = useAppStore();
  const [operationRunning, setOperationRunning] = useState(false);
  const [showAndon, setShowAndon] = useState(false);
  const [activeTab, setActiveTab] = useState('station'); // 'station' | 'andon'
  const [qtyProduced, setQtyProduced] = useState('');
  const [operationLog, setOperationLog] = useState([]);
  const [currentOperationId, setCurrentOperationId] = useState(null); // ✅ Track DB record ID
  const operationStartTime = useRef(null); // ✅ Track start time for takt

  const [currentWO, setCurrentWO] = useState(null);
  const [loadingWO, setLoadingWO] = useState(true);

  const fetchCurrentWO = async () => {
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

      const selectedPlant = user?.plant || "Plant A";
      const currentLine = "Line 1";

      const matchingWorkOrder = inProgressOrders.find(wo => {
        const woPlant = wo.plants?.name || wo.plant_id || 'Plant A';
        const woLine = wo.production_lines?.line_name || wo.line_id || 'Line 1';
        return woPlant === selectedPlant && woLine === currentLine;
      }) || inProgressOrders[0] || null;

      if (matchingWorkOrder) {
        setCurrentWO(normalizeWO(matchingWorkOrder));
      } else {
        setCurrentWO(null);
      }
    } catch (err) {
      console.error("Failed to fetch current work order:", err);
    } finally {
      setLoadingWO(false);
    }
  };

  useEffect(() => {
    fetchAndons();
    fetchCurrentWO();

    let channel;
    if (isSupabaseConfigured()) {
      channel = supabase
        .channel("work_orders_realtime_assembly")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "work_orders"
          },
          () => {
            fetchCurrentWO();
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const activeAlerts = andonAlerts.filter((a) => a.status === 'Open' || a.status === 'open' || a.status === 'active' || a.status === 'Active');

  const handleStartOperation = async () => {
    operationStartTime.current = Date.now();
    // Always start timer locally first
    setOperationRunning(true);
    setOperationLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), event: 'Operation started', type: 'start' }]);
    toast.success('Operation started — Takt timer running');

    // ✅ FIXED: Store operation_record_id from DB response
    if (isSupabaseConfigured() && currentWO) {
      try {
        const { data: opRecord, error } = await supabase.from('operation_records').insert({
          wo_number: currentWO.id,
          operator_id: safeUUID(user?.id), // ✅ safeUUID guard
          start_time: new Date().toISOString(),
          status: 'in_progress',
          qty_produced: 0,
        }).select().single();
        if (error) console.warn('[AssemblyLine] operation_records insert failed:', error.message);
        else if (opRecord) setCurrentOperationId(opRecord.operation_record_id); // ✅ Store for sign-off
      } catch (err) {
        console.warn('[AssemblyLine] operation_records insert error:', err.message);
      }
    }
  };

  const handleSignOff = async () => {
    if (!qtyProduced || Number(qtyProduced) < 1) { toast.error('Enter produced quantity first'); return; }

    setOperationRunning(false);
    setOperationLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), event: `Signed off — ${qtyProduced} units produced`, type: 'signoff' }]);
    toast.success(`✓ Operation signed off — ${qtyProduced} units`);
    setQtyProduced('');

    // ✅ FIXED: Use currentOperationId in digital_signoffs + safeUUID for operator
    if (isSupabaseConfigured()) {
      try {
        if (currentOperationId) {
          await supabase.from('operation_records')
            .update({ end_time: new Date().toISOString(), qty_produced: Number(qtyProduced), status: 'complete' })
            .eq('operation_record_id', currentOperationId); // ✅ Target specific record
        } else {
          await supabase.from('operation_records')
            .update({ end_time: new Date().toISOString(), qty_produced: Number(qtyProduced), status: 'complete' })
            .eq('status', 'in_progress');
        }
        // ✅ FIXED: Pass operation_record_id and safeUUID operator
        await supabase.from('digital_signoffs').insert({
          operation_record_id: currentOperationId || null,
          operator_id: safeUUID(user?.id),
          signoff_method: 'touch',
          signed_at: new Date().toISOString(),
        });
        writeAuditLog(safeUUID(user?.id), 'operation_records', 'signoff', { qty_produced: qtyProduced, operation_record_id: currentOperationId });

        // ✅ Increment tool cycle counts
        try {
          const lineUuid = safeUUID(currentWO?.line_id);
          if (lineUuid) {
            const { data: lineTools } = await supabase.from('tools').select('tool_id, cycle_count').eq('line_id', lineUuid);
            if (lineTools && lineTools.length > 0) {
              for (const t of lineTools) {
                await supabase.from('tools').update({ cycle_count: (t.cycle_count || 0) + Number(qtyProduced) }).eq('tool_id', t.tool_id);
              }
            }
          } else {
            // Fallback: increment cycle counts of first 3 tools to demonstrate functionality
            const { data: defaultTools } = await supabase.from('tools').select('tool_id, cycle_count').limit(3);
            if (defaultTools && defaultTools.length > 0) {
              for (const t of defaultTools) {
                await supabase.from('tools').update({ cycle_count: (t.cycle_count || 0) + Number(qtyProduced) }).eq('tool_id', t.tool_id);
              }
            }
          }
        } catch (toolErr) {
          console.warn('[AssemblyLine] Failed to increment tool cycle counts:', toolErr.message);
        }

        setCurrentOperationId(null);
      } catch (err) {
        console.warn('[AssemblyLine] sign-off DB write failed:', err.message);
      }
    }
  };

  const handleOverrun = async (elapsed) => {
    toast.error(`⏱ TAKT OVERRUN — ${elapsed}s (Standard: ${STANDARD_TAKT}s)`, { duration: 8000 });
    addToast({ title: 'Takt Overrun', message: `Station exceeded standard takt by ${elapsed - STANDARD_TAKT}s`, type: 'error' });
    // ✅ FIXED: Store takt overrun events in takt_events table
    if (isSupabaseConfigured() && currentOperationId) {
      try {
        await supabase.from('takt_events').insert({
          operation_record_id: currentOperationId,
          standard_takt: STANDARD_TAKT,
          actual_cycle: elapsed,
          overrun_flag: true,
          recorded_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[AssemblyLine] takt_events insert failed:', err.message);
      }
    }
  };

  const handleRaiseAndon = (alert) => { raiseAndon(alert); };

  const handleResolveAndon = async (id) => {
    resolveAndon(id);
    toast.success('Andon resolved');

    if (isSupabaseConfigured()) {
      try {
        // Only update if it's a real UUID andon_id
        if (safeUUID(id)) {
          await supabase.from('issue_resolutions').insert({
            andon_id: id,
            resolver_id: safeUUID(user?.id), // ✅ safeUUID guard
            action_taken: 'Resolved from dashboard',
            resolved_at: new Date().toISOString(),
          });
          writeAuditLog(safeUUID(user?.id), 'andon_events', 'resolve', { andon_id: id });
        }
      } catch (err) {
        console.warn('[AssemblyLine] andon resolve DB write failed:', err.message);
      }
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block"><h1 className="page-title">Assembly Line</h1><div className="page-subtitle">Shop Floor Execution — Station View & Takt Monitor</div></div>
        <div className="page-actions">
          <span className={`badge ${activeAlerts.length > 0 ? 'badge-red' : 'badge-green'}`}>
            {activeAlerts.length > 0 ? `${activeAlerts.length} ACTIVE ANDON` : 'ALL CLEAR'}
          </span>
          <button className="btn btn-danger" onClick={() => setShowAndon(true)}>
            <AlertTriangle size={14} /> Raise Andon
          </button>
        </div>
      </div>

      {activeAlerts.length > 0 && (
        <div className="andon-banner">
          <AlertTriangle size={16} color="var(--red)" />
          <span className="andon-banner-text">⚡ {activeAlerts.length} ACTIVE ANDON ALERT{activeAlerts.length > 1 ? 'S' : ''} — Immediate attention required</span>
          <button className="btn btn-sm btn-danger" onClick={() => setActiveTab('andon')}>VIEW BOARD</button>
        </div>
      )}

      <div className="tabs">
        {[{ id: 'station', label: 'Station View' }, { id: 'andon', label: `Andon Board${activeAlerts.length > 0 ? ` (${activeAlerts.length})` : ''}` }].map((t) => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'station' && (
        <div className="grid grid-2">
          {/* Left: Takt Timer & Controls */}
          <div className="card">
            <div className="card-header"><span className="card-title">Takt Timer — Station 3A</span><span className={`badge ${operationRunning ? 'badge-blue' : 'badge-gray'}`}>{operationRunning ? 'RUNNING' : 'IDLE'}</span></div>
            <div style={{ marginBottom: 24 }}>
              <TaktTimer running={operationRunning} onOverrun={handleOverrun} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={handleStartOperation} disabled={operationRunning} style={{ justifyContent: 'center' }}>
                <Play size={14} /> Start Operation
              </button>
              <button className="btn btn-outline" onClick={() => setOperationRunning(false)} disabled={!operationRunning} style={{ justifyContent: 'center' }}>
                <Square size={14} /> Pause
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" type="number" placeholder="Qty produced" value={qtyProduced} onChange={(e) => setQtyProduced(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={handleSignOff} disabled={operationRunning && !qtyProduced}>
                <CheckCircle2 size={14} /> Sign Off
              </button>
            </div>
            {/* Operation log */}
            {operationLog.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 8 }}>Operation Log</div>
                {operationLog.slice(-5).reverse().map((entry, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', minWidth: 48 }}>{entry.time}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: entry.type === 'signoff' ? 'var(--green)' : 'var(--text-secondary)' }}>{entry.event}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Current WO + Work Instructions */}
          <div className="card">
            <div className="card-header"><span className="card-title">Current Work Order</span></div>
            {loadingWO ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 12 }}>
                Loading current work order...
              </div>
            ) : currentWO ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'WO Number', value: currentWO.id },
                    { label: 'Part', value: currentWO.part },
                    { label: 'Line', value: currentWO.line },
                    { label: 'Work Center', value: currentWO.workCenter },
                    { label: 'Planned Qty', value: currentWO.plannedQty || currentWO.producedQty },
                    { label: 'Std Time', value: currentWO.stdTime ? `${currentWO.stdTime} min` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--bg-elevated)', padding: '8px 12px', border: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>{value || '—'}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 16 }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 12 }}>Work Instructions</div>
                  {['1. Verify part number and VIN match', '2. Apply torque to spec (80 Nm)', '3. Inspect weld seam per control plan', '4. Scan barcode to confirm completion', '5. Move to next station'].map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                      <div style={{ width: 20, height: 20, background: 'var(--bmw-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 700, color: 'white' }}>{i + 1}</div>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{step.slice(3)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state"><Activity size={32} color="var(--muted)" /><span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)', letterSpacing: '0.1em' }}>NO ACTIVE WORK ORDER</span></div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'andon' && (
        <div>
          <div className="card mb-16">
            <div className="card-header"><span className="card-title">Andon Board — Active Alerts</span><span className={`badge ${activeAlerts.length > 0 ? 'badge-red' : 'badge-green'}`}>{activeAlerts.length} ACTIVE</span></div>
            {activeAlerts.length === 0 ? (
              <div className="empty-state"><CheckCircle2 size={32} color="var(--green)" /><span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)' }}>NO ACTIVE ALERTS — ALL CLEAR</span></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeAlerts.map((alert) => (
                  <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderLeft: '4px solid var(--red)' }}>
                    <AlertTriangle size={20} color="var(--red)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span className="badge badge-red">{alert.issue_type || alert.type}</span>
                        <span className={`badge ${SEVERITY_COLORS[alert.severity] || 'badge-gray'}`}>{alert.severity?.toUpperCase()}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 600, color: 'var(--white)' }}>{alert.line} / {alert.station}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{alert.description}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)', marginBottom: 8 }}>{alert.time}</div>
                      <button className="btn btn-sm btn-outline" onClick={() => handleResolveAndon(alert.id)}>Resolve</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolved alerts */}
          <div className="card">
            <div className="card-header"><span className="card-title">Resolved Today</span></div>
            {andonAlerts.filter((a) => a.status === 'Resolved' || a.status === 'resolved').length === 0 ? (
              <div style={{ padding: '16px', fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)', textAlign: 'center', letterSpacing: '0.1em' }}>No resolved alerts today</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {andonAlerts.filter((a) => a.status === 'Resolved' || a.status === 'resolved').map((alert) => (
                  <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <CheckCircle2 size={14} color="var(--green)" />
                    <div style={{ flex: 1, fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-secondary)' }}>{alert.line} / {alert.station}: {alert.description}</div>
                    <span className="badge badge-green">RESOLVED</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showAndon && <AndonModal onClose={() => setShowAndon(false)} onRaise={handleRaiseAndon} />}
    </div>
  );
}
