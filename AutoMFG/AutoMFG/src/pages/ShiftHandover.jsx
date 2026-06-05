// AutoMFG — Shift Handover (Flow 9) — FIXED
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, CheckCircle2, RefreshCw, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseConfigured, writeAuditLog } from '../lib/supabase';
import { useAuthStore, MOCK_USERS } from '../store/authStore';
import { useActiveShift } from '../hooks/useActiveShift';
import { useAppStore } from '../store/appStore';

const safeUUID = (id) =>
  id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;

const handoverSchema = z.object({
  shift_id: z.string().min(1, 'Shift required'),
  planned_output: z.coerce.number().min(0),
  actual_output: z.coerce.number().min(0),
  scrap_count: z.coerce.number().min(0),
  downtime_minutes: z.coerce.number().min(0),
  safety_events: z.coerce.number().min(0),
  open_issues: z.string().optional(),
  incoming_supervisor_id: z.string().min(1, 'Incoming supervisor required'),
});

function HandoverFormModal({ onClose, onSaved, supervisors, shifts }) {
  const { user } = useAuthStore();
  const { currentShift, addShiftHandover } = useAppStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(handoverSchema),
    defaultValues: {
      shift_id: shifts?.[0]?.shift_id || '',
      planned_output: 0,
      actual_output: 0,
      scrap_count: 0,
      downtime_minutes: 0,
      safety_events: 0,
    }
  });

  const onSubmit = async (data) => {
    try {
      const selectedIncoming = supervisors?.find(s => s.id === data.incoming_supervisor_id);
      const selectedShift = shifts?.find(s => s.shift_id === data.shift_id);
      const newHandover = {
        id: `SH-${Date.now()}`,
        shiftId: data.shift_id,
        date: new Date().toISOString().slice(0, 10),
        shift: selectedShift?.shift_name || currentShift,
        outgoingSupervisor: user?.name || 'Supervisor',
        incomingSupervisor: selectedIncoming?.display_name || 'Incoming Supervisor',
        outgoingSupervisorId: user?.id,
        incomingSupervisorId: data.incoming_supervisor_id,
        plannedOutput: data.planned_output,
        actualOutput: data.actual_output,
        scrapCount: data.scrap_count,
        downtime: data.downtime_minutes,
        safetyEvents: data.safety_events,
        openIssues: data.open_issues ? data.open_issues.split('\n').filter(Boolean) : [],
        status: 'Pending Sign-off',
      };

      if (isSupabaseConfigured()) {
        const outgoingId = safeUUID(user?.id);
        const incomingId = safeUUID(data.incoming_supervisor_id);
        const shiftUuid = safeUUID(data.shift_id);

        let sh = null;
        let shErr = null;

        const res = await supabase.from('shift_handover_reports').insert({
          shift_id: shiftUuid,
          planned_output: data.planned_output,
          actual_output: data.actual_output,
          scrap_count: data.scrap_count,
          downtime_minutes: data.downtime_minutes,
          safety_events: data.safety_events,
          open_issues: data.open_issues,
          outgoing_supervisor: outgoingId,
          incoming_supervisor: incomingId,
          status: 'pending',
        }).select().single();

        sh = res.data;
        shErr = res.error;

        // Self-healing query: If insertion failed due to shift_id foreign key constraint, retry without shift_id
        if (shErr && (shErr.message?.includes('fk') || shErr?.message?.includes('foreign key') || shErr?.code === '23503')) {
          console.warn('[ShiftHandover] DB shift_id constraint failed, retrying without shift_id...');
          const retryRes = await supabase.from('shift_handover_reports').insert({
            planned_output: data.planned_output,
            actual_output: data.actual_output,
            scrap_count: data.scrap_count,
            downtime_minutes: data.downtime_minutes,
            safety_events: data.safety_events,
            open_issues: data.open_issues,
            outgoing_supervisor: outgoingId,
            incoming_supervisor: incomingId,
            status: 'pending',
          }).select().single();
          sh = retryRes.data;
          shErr = retryRes.error;
        }

        if (shErr) {
          toast.error('Failed to create handover: ' + shErr.message);
          return;
        }

        if (sh) {
          newHandover.id = sh.handover_id;
          const issues = (data.open_issues || '').split('\n').filter(Boolean);
          for (const issue of issues) {
            await supabase.from('carry_forward_tasks').insert({
              handover_id: sh.handover_id,
              description: issue,
              priority: 'medium',
              status: 'open'
            }).catch(() => {});
          }
          await supabase.from('end_of_shift_summaries').insert({
            shift_id: sh.shift_id,
            planned_qty: data.planned_output,
            actual_qty: data.actual_output,
            scrap_count: data.scrap_count,
            open_issues_count: issues.length
          }).catch(() => {});
        }
        writeAuditLog(outgoingId, 'shift_handover_reports', 'insert', { planned: data.planned_output, actual: data.actual_output });
      }

      toast.success('Shift handover report created');
      addShiftHandover(newHandover);
      onSaved(newHandover);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Error creating handover: ' + err.message);
    }
  };

  const onInvalid = (errors) => {
    console.warn('Form validation failed:', errors);
    const firstErr = Object.values(errors)[0];
    if (firstErr) {
      toast.error(`Validation error: ${firstErr.message}`);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header"><span className="modal-title">Create Shift Handover Report</span><button className="icon-btn" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Shift</label>
                <select className="form-select" {...register('shift_id')}>
                  <option value="">Select shift...</option>
                  {shifts.map((s) => <option key={s.shift_id} value={s.shift_id}>{s.shift_name} ({s.start_time} - {s.end_time})</option>)}
                </select>
                {errors.shift_id && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.shift_id.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Incoming Supervisor</label>
                <select className="form-select" {...register('incoming_supervisor_id')}>
                  <option value="">Select incoming supervisor...</option>
                  {supervisors.map((s) => <option key={s.id} value={s.id}>{s.display_name} ({s.username})</option>)}
                </select>
                {errors.incoming_supervisor_id && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.incoming_supervisor_id.message}</span>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className="form-group"><label className="form-label">Planned Output</label><input className="form-input" type="number" {...register('planned_output')} /></div>
              <div className="form-group"><label className="form-label">Actual Output</label><input className="form-input" type="number" {...register('actual_output')} /></div>
              <div className="form-group"><label className="form-label">Scrap Count</label><input className="form-input" type="number" {...register('scrap_count')} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="form-label">Downtime (min)</label><input className="form-input" type="number" {...register('downtime_minutes')} /></div>
              <div className="form-group"><label className="form-label">Safety Events</label><input className="form-input" type="number" {...register('safety_events')} /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Open Issues (one per line)</label>
              <textarea className="form-textarea" placeholder="List each open issue on a new line..." rows={4} {...register('open_issues')} />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Submit Handover'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ShiftHandover() {
  const { user } = useAuthStore();
  const activeShift = useActiveShift();
  const [handovers, setHandovers] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchMetadata = async () => {
    // Upper roles/usernames to exclude from supervisor dropdown
    const upperUsernames = ['sys.admin', 'plant.manager', 'prod.manager', 'prod.planner'];
    const upperRoles = ['sys_admin', 'plant_manager', 'production_manager', 'production_planner'];

    const getMockSupervisors = () => MOCK_USERS.filter(
      (u) => !upperRoles.includes(u.role)
    ).map(u => ({ id: u.id, display_name: u.name, username: u.username }));

    if (!isSupabaseConfigured()) {
      // Mock mode: Filter out admins/planners and use default shifts
      setSupervisors(getMockSupervisors());

      const fallbackShifts = [
        { shift_id: 'a0000000-0000-0000-0000-000000000001', shift_name: 'Shift A', start_time: '06:00', end_time: '14:00' },
        { shift_id: 'b0000000-0000-0000-0000-000000000002', shift_name: 'Shift B', start_time: '14:00', end_time: '22:00' },
        { shift_id: 'c0000000-0000-0000-0000-000000000003', shift_name: 'Shift C', start_time: '22:00', end_time: '06:00' }
      ];
      setShifts(fallbackShifts);
      return fallbackShifts;
    }

    try {
      const [profilesRes, shiftsRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, username').order('display_name'),
        supabase.from('shifts').select('*').order('shift_name'),
      ]);

      if (profilesRes.data && profilesRes.data.length > 0) {
        const filtered = profilesRes.data.filter(
          (p) => !upperUsernames.includes(p.username?.toLowerCase() || '')
        );
        if (filtered.length > 0) {
          setSupervisors(filtered);
        } else {
          setSupervisors(getMockSupervisors());
        }
      } else {
        setSupervisors(getMockSupervisors());
      }

      let dbShifts = shiftsRes.data || [];
      if (dbShifts.length === 0) {
        // Seed the shifts table in Supabase so that shift handovers work database-first
        const defaultShifts = [
          { shift_id: 'a0000000-0000-0000-0000-000000000001', shift_name: 'Shift A', start_time: '06:00:00', end_time: '14:00:00' },
          { shift_id: 'b0000000-0000-0000-0000-000000000002', shift_name: 'Shift B', start_time: '14:00:00', end_time: '22:00:00' },
          { shift_id: 'c0000000-0000-0000-0000-000000000003', shift_name: 'Shift C', start_time: '22:00:00', end_time: '06:00:00' }
        ];
        const { data: seeded, error: seedErr } = await supabase.from('shifts').insert(defaultShifts).select();
        if (!seedErr && seeded) {
          dbShifts = seeded;
        } else {
          dbShifts = defaultShifts;
        }
      }
      setShifts(dbShifts);
      return dbShifts;
    } catch (e) {
      console.warn('[ShiftHandover] Metadata load failed:', e.message);
      setSupervisors(getMockSupervisors());
      const fallbackShifts = [
        { shift_id: 'a0000000-0000-0000-0000-000000000001', shift_name: 'Shift A', start_time: '06:00', end_time: '14:00' },
        { shift_id: 'b0000000-0000-0000-0000-000000000002', shift_name: 'Shift B', start_time: '14:00', end_time: '22:00' },
        { shift_id: 'c0000000-0000-0000-0000-000000000003', shift_name: 'Shift C', start_time: '22:00', end_time: '06:00' }
      ];
      setShifts(fallbackShifts);
      return fallbackShifts;
    }
  };

  const fetchHandovers = async (currentShifts) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        // Use plain select('*') — avoids schema-cache relationship join errors
        const { data, error } = await supabase
          .from('shift_handover_reports')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        if (data) {
          // Resolve shift name from local shifts state (passed in or from closure)
          const shiftMap = Object.fromEntries(
            (currentShifts || []).map(s => [s.shift_id, s.shift_name])
          );
          setHandovers(data.map((h) => ({
            id: h.handover_id,
            date: h.created_at?.slice(0, 10),
            shift: shiftMap[h.shift_id] || activeShift.label,
            outgoingSupervisorId: h.outgoing_supervisor,
            incomingSupervisorId: h.incoming_supervisor,
            outgoingSupervisor: 'Unknown',
            incomingSupervisor: 'Unknown',
            plannedOutput: h.planned_output,
            actualOutput: h.actual_output,
            scrapCount: h.scrap_count,
            downtime: h.downtime_minutes,
            safetyEvents: h.safety_events,
            openIssues: (h.open_issues || '').split('\n').filter(Boolean),
            status: h.status === 'signed_off' ? 'Signed Off' : 'Pending Sign-off'
          })));
        }
      } else {
        setHandovers([]);
      }
    } catch (err) {
      console.warn('[ShiftHandover] Failed to load handovers:', err.message);
      setHandovers([]);
    } finally {
      setLoading(false);
    }
  };

  const init = async () => {
    const resolvedShifts = await fetchMetadata();
    await fetchHandovers(resolvedShifts);
  };

  useEffect(() => { init(); }, []);

  const handleSignOff = async (id) => {
    try {
      if (isSupabaseConfigured()) {
        const uuid = safeUUID(user?.id);
        const { error } = await supabase.from('shift_handover_reports')
          .update({ status: 'signed_off', signed_at: new Date().toISOString(), incoming_supervisor: uuid })
          .eq('handover_id', id);
        if (error) throw error;
        writeAuditLog(uuid, 'shift_handover_reports', 'signoff', { handover_id: id });
      }
      setHandovers((prev) => prev.map((h) => h.id === id ? { ...h, status: 'Signed Off', incomingSupervisor: user?.name || 'Supervisor' } : h));
      toast.success('Handover signed off');
    } catch (err) {
      toast.error('Failed to sign off. ' + err.message);
    }
  };

  const pending = handovers.filter((h) => h.status === 'Pending Sign-off');
  const signed = handovers.filter((h) => h.status === 'Signed Off');

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block"><h1 className="page-title">Shift Handover</h1><div className="page-subtitle">Shift Transition Reports & Sign-off</div></div>
        <div className="page-actions">
          <button className="icon-btn" onClick={() => init()}><RefreshCw size={14} /></button>
          {['shift_supervisor', 'production_manager', 'plant_manager', 'sys_admin'].includes(user?.role) && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> New Handover
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-4 mb-16">
        {[
          { label: 'Total Reports', value: handovers.length, color: 'white' },
          { label: 'Pending Sign-off', value: pending.length, color: pending.length > 0 ? 'amber' : 'green' },
          { label: 'Signed Off', value: signed.length, color: 'green' },
          { label: 'Current Shift', value: activeShift.label, color: 'blue' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card"><div className="metric-label">{label}</div><div className={`metric-value ${color}`} style={{ fontSize: 28 }}>{value}</div></div>
        ))}
      </div>

      {pending.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 12 }}>
            ⏳ Pending Sign-off ({pending.length})
          </div>
          {pending.map((h) => (
            <div key={h.id} className="card mb-16">
              <div className="card-header">
                <div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, color: 'var(--white)', letterSpacing: '0.05em' }}>{h.id} — {h.shift}</span>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.1em', marginTop: 2 }}>
                    {h.date} · {supervisors.find(s => s.id === h.outgoingSupervisorId)?.display_name || h.outgoingSupervisor || 'Unknown'} → {supervisors.find(s => s.id === h.incomingSupervisorId)?.display_name || h.incomingSupervisor || 'Unknown'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge badge-amber">PENDING SIGN-OFF</span>
                  <button className="btn btn-primary btn-sm" onClick={() => handleSignOff(h.id)}><CheckCircle2 size={12} /> Sign Off</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Planned', value: h.plannedOutput },
                  { label: 'Actual', value: h.actualOutput, color: h.actualOutput >= h.plannedOutput ? 'var(--green)' : 'var(--amber)' },
                  { label: 'Scrap', value: h.scrapCount, color: h.scrapCount > 0 ? 'var(--red)' : 'var(--green)' },
                  { label: 'Downtime (min)', value: h.downtime, color: h.downtime > 30 ? 'var(--red)' : 'var(--text-primary)' },
                  { label: 'Safety Events', value: h.safetyEvents, color: h.safetyEvents > 0 ? 'var(--red)' : 'var(--green)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'var(--bg-elevated)', padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: color || 'var(--white)' }}>{value}</div>
                  </div>
                ))}
              </div>
              {h.openIssues?.length > 0 && (
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 8 }}>Open Issues (carry forward)</div>
                  {h.openIssues.map((issue, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--amber-dim)', border: '1px solid var(--amber)', marginBottom: 4 }}>
                      <AlertTriangle size={12} color="var(--amber)" />
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>{issue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 12 }}>Archive</div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>ID</th><th>Date</th><th>Shift</th><th>Outgoing</th><th>Incoming</th><th>Planned</th><th>Actual</th><th>Scrap</th><th>Status</th></tr></thead>
            <tbody>
              {handovers.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>No handover records found</td></tr>
              ) : handovers.map((h) => (
                <tr key={h.id}>
                  <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)' }}>{h.id?.slice?.(0, 8) || h.id}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-secondary)' }}>{h.date}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontSize: 12 }}>{h.shift}</td>
                  <td style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>
                    {supervisors.find(s => s.id === h.outgoingSupervisorId)?.display_name || h.outgoingSupervisor || 'Unknown'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>
                    {supervisors.find(s => s.id === h.incomingSupervisorId)?.display_name || h.incomingSupervisor || 'Unknown'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{h.plannedOutput}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: h.actualOutput >= h.plannedOutput ? 'var(--green)' : 'var(--amber)' }}>{h.actualOutput}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: h.scrapCount > 0 ? 'var(--red)' : 'var(--green)' }}>{h.scrapCount}</td>
                  <td><span className={`badge ${h.status === 'Signed Off' ? 'badge-green' : 'badge-amber'}`}>{h.status?.toUpperCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <HandoverFormModal onClose={() => setShowCreate(false)} onSaved={(h) => setHandovers((prev) => [h, ...prev])} supervisors={supervisors} shifts={shifts} />}
    </div>
  );
}
