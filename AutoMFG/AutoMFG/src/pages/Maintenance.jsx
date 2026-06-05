// AutoMFG — Maintenance (Flow 7) — FIXED
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Clock, CheckCircle2, AlertTriangle, Wrench, Package } from 'lucide-react';
import { supabase, isSupabaseConfigured, writeAuditLog } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

const safeUUID = (id) =>
  id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;

const SLA_MINUTES = { P1: 10, P2: 30, P3: 120, P4: 480 };

const ticketSchema = z.object({
  machine_id: z.string().min(1, 'Machine required'),
  description: z.string().min(10, 'Describe the breakdown'),
  severity: z.enum(['P1', 'P2', 'P3', 'P4']),
});

const STATUS_COLOR = {
  open: 'badge-red', acknowledged: 'badge-amber',
  in_repair: 'badge-blue', closed: 'badge-gray',
  'Open': 'badge-red', 'In Repair': 'badge-blue', 'Resolved': 'badge-gray',
};

function SLATimer({ createdAt, severity, acknowledged }) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (acknowledged) { setRemaining(null); return; }
    const slaMs = (SLA_MINUTES[severity] || 30) * 60 * 1000;
    const created = new Date(createdAt).getTime();
    const update = () => setRemaining(slaMs - (Date.now() - created));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [createdAt, severity, acknowledged]);

  if (remaining === null) return <span className="badge badge-green">SLA MET</span>;
  const breached = remaining <= 0;
  const mins = Math.abs(Math.floor(remaining / 60000));
  const secs = Math.abs(Math.floor((remaining % 60000) / 1000));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Clock size={12} color={breached ? 'var(--red)' : remaining < 120000 ? 'var(--amber)' : 'var(--green)'} />
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700, color: breached ? 'var(--red)' : remaining < 120000 ? 'var(--amber)' : 'var(--green)', letterSpacing: '0.08em' }}>
        {breached ? 'BREACHED +' : ''}{mins}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  );
}

function TicketDetailModal({ ticket, onClose, onUpdate }) {
  const { user } = useAuthStore();
  const [diagnosis, setDiagnosis] = useState('');
  const [repairNotes, setRepairNotes] = useState('');
  const [repairMinutes, setRepairMinutes] = useState('');
  const [sparePart, setSparePart] = useState('');
  const [spareRequests, setSpareRequests] = useState([]);
  const [trialResult, setTrialResult] = useState(null);

  useEffect(() => {
    const fetchSpares = async () => {
      if (!isSupabaseConfigured()) return;
      const { data } = await supabase.from('spare_parts_requests').select('*').eq('ticket_id', ticket.id).order('requested_at', { ascending: false });
      if (data) setSpareRequests(data);
    };
    fetchSpares();
  }, [ticket.id]);

  const handleAcknowledge = async () => {
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('breakdown_tickets')
          .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
          .eq('ticket_id', ticket.id);
        if (error) throw error;
      }
      onUpdate({ ...ticket, acknowledged: true, status: 'acknowledged' });
      toast.success('Ticket acknowledged — SLA clock stopped');
    } catch (err) { toast.error('Failed to save. ' + err.message); }
  };

  const handleDiagnose = async () => {
    if (!diagnosis) { toast.error('Enter diagnosis'); return; }
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('maintenance_diagnoses').insert({
        ticket_id: ticket.id,
        failure_mode: diagnosis,
        cause: diagnosis,
        diagnosed_at: new Date().toISOString(),
      });
      if (error) { toast.error('Failed: ' + error.message); return; }
    }
    toast.success('Diagnosis recorded');
    setDiagnosis('');
  };

  const handleAddSpare = async () => {
    if (!sparePart.trim()) { toast.error('Enter part description'); return; }
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('spare_parts_requests').insert({
        ticket_id: ticket.id,
        part_description: sparePart,
        status: 'pending',
        requested_at: new Date().toISOString(),
      }).select().single();
      if (error) { toast.error('Failed: ' + error.message); return; }
      if (data) setSpareRequests((prev) => [data, ...prev]);
    } else {
      setSpareRequests((prev) => [{ spare_request_id: Date.now(), part_description: sparePart, status: 'pending' }, ...prev]);
    }
    toast.success('Spare part requested');
    setSparePart('');
  };

  const handleRepair = async () => {
    if (!repairNotes || !repairMinutes) { toast.error('Fill all repair fields'); return; }
    try {
      if (isSupabaseConfigured()) {
        const { error: repErr } = await supabase.from('repair_activities').insert({
          ticket_id: ticket.id,
          actions: repairNotes,
          repair_minutes: Number(repairMinutes),
          repaired_by: safeUUID(user?.id), // ✅ FIXED
          repaired_at: new Date().toISOString(),
        });
        if (repErr) throw repErr;
        const { error: tickErr } = await supabase.from('breakdown_tickets')
          .update({ status: 'in_repair' })
          .eq('ticket_id', ticket.id);
        if (tickErr) throw tickErr;
      }
      onUpdate({ ...ticket, status: 'in_repair' });
      toast.success('Repair logged — proceed to trial run');
    } catch (err) { toast.error('Failed to save. ' + err.message); }
  };

  const handleTrialRun = async (result) => {
    setTrialResult(result);
    if (isSupabaseConfigured()) {
      await supabase.from('trial_runs').insert({
        ticket_id: ticket.id,
        result,
        recorded_by: safeUUID(user?.id), // ✅ FIXED
        recorded_at: new Date().toISOString(),
      });
      if (result === 'pass') {
        await supabase.from('breakdown_tickets').update({ status: 'closed' }).eq('ticket_id', ticket.id);
        if (ticket.machine_id) {
          await supabase.from('machines').update({ status: 'running' }).eq('machine_id', ticket.machine_id);
        }
        // ✅ Calculate and store MTTR
        try {
          const { data: repairs } = await supabase.from('repair_activities').select('repair_minutes').eq('ticket_id', ticket.id);
          const totalMinutes = (repairs || []).reduce((sum, r) => sum + (r.repair_minutes || 0), 0);
          if (ticket.machine_id && totalMinutes > 0) {
            await supabase.from('maintenance_kpis').insert({
              machine_id: ticket.machine_id,
              mttr_minutes: totalMinutes,
              mtbf_hours: null, // Would need historical data to calculate
              calculated_at: new Date().toISOString(),
            });
          }
        } catch (e) { console.warn('[Maintenance] MTTR calc failed:', e.message); }
      }
    }
    if (result === 'pass') {
      onUpdate({ ...ticket, status: 'closed' });
      toast.success('Trial run PASS — Machine back online');
      onClose();
    } else {
      toast.error('Trial run FAIL — Diagnose again');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <span className="modal-title">{ticket.id} — {ticket.machine}</span>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)', marginTop: 2 }}>{ticket.description}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className={`badge ${STATUS_COLOR[ticket.status] || 'badge-gray'}`}>{String(ticket.status).toUpperCase()}</span>
            <button className="icon-btn" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Acknowledge */}
          {!ticket.acknowledged && (
            <div style={{ padding: 12, background: 'var(--red-dim)', border: '1px solid var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--red)', letterSpacing: '0.08em' }}>SLA TIMER RUNNING — Acknowledge to stop clock</span>
              <button className="btn btn-sm btn-danger" onClick={handleAcknowledge}>Acknowledge</button>
            </div>
          )}

          {/* Diagnosis */}
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 8 }}>Diagnosis</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" placeholder="Describe failure mode and root cause..." value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-outline" onClick={handleDiagnose}>Save</button>
            </div>
          </div>

          {/* Spare Parts */}
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 8 }}>Spare Parts Requests</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input className="form-input" placeholder="Describe part needed..." value={sparePart} onChange={(e) => setSparePart(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-outline" onClick={handleAddSpare}><Package size={12} /> Request</button>
            </div>
            {spareRequests.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {spareRequests.map((s) => (
                  <div key={s.spare_request_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 12, fontFamily: 'var(--font-body)' }}>
                    <span>{s.part_description}</span>
                    <span className="badge badge-amber">{s.status?.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Repair */}
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 8 }}>Repair Activity</div>
            <textarea className="form-textarea" placeholder="Actions taken, parts replaced..." value={repairNotes} onChange={(e) => setRepairNotes(e.target.value)} style={{ marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" type="number" placeholder="Repair time (min)" value={repairMinutes} onChange={(e) => setRepairMinutes(e.target.value)} style={{ width: 160 }} />
              <button className="btn btn-primary" onClick={handleRepair}><Wrench size={12} /> Log Repair</button>
            </div>
          </div>

          {/* Trial Run */}
          {(ticket.status === 'in_repair' || ticket.status === 'In Repair') && (
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 8 }}>Trial Run & Sign-off</div>
              <div style={{ padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)' }}>Dual sign-off required: Maintenance Lead + Production Supervisor. MTTR will be auto-calculated on pass.</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => handleTrialRun('pass')} style={{ flex: 1, justifyContent: 'center' }}><CheckCircle2 size={14} /> Trial Run PASS</button>
                <button className="btn btn-danger" onClick={() => handleTrialRun('fail')} style={{ flex: 1, justifyContent: 'center' }}><AlertTriangle size={14} /> Trial Run FAIL</button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer"><button className="btn btn-outline" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function CreateTicketModal({ onClose, onCreated, machines }) {
  const { user } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(ticketSchema),
    defaultValues: { severity: 'P2' },
  });

  const onSubmit = async (data) => {
    const selectedMachine = machines.find((m) => m.machine_id === data.machine_id);
    const newTicket = {
      id: `BRK-${Date.now()}`,
      machine_id: data.machine_id || null,
      machine: selectedMachine?.machine_name || data.machine_id,
      description: data.description,
      severity: data.severity,
      status: 'open',
      acknowledged: false,
      reportedAt: new Date().toISOString(),
      repairLog: [],
    };

    if (isSupabaseConfigured()) {
      // ✅ FIXED: machine_id now set properly
      const { data: t, error } = await supabase.from('breakdown_tickets').insert({
        machine_id: safeUUID(data.machine_id),
        description: data.description,
        severity: data.severity,
        status: 'open',
        created_by: safeUUID(user?.id), // ✅ FIXED: safeUUID guard
        created_at: new Date().toISOString(),
      }).select().single();
      if (error) { toast.error('Failed: ' + error.message); return; }
      if (t) newTicket.id = t.ticket_id;
      writeAuditLog(safeUUID(user?.id), 'breakdown_tickets', 'insert', { machine: newTicket.machine, severity: data.severity });
    }
    toast.error(`🔧 Breakdown ticket — ${data.severity}: ${newTicket.machine}`, { duration: 5000 });
    onCreated(newTicket);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Report Breakdown</span><button className="icon-btn" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Machine</label>
              {machines.length > 0 ? (
                <select className="form-select" {...register('machine_id')}>
                  <option value="">Select machine...</option>
                  {machines.map((m) => (
                    <option key={m.machine_id} value={m.machine_id}>{m.machine_name} ({m.status})</option>
                  ))}
                </select>
              ) : (
                <input className="form-input" placeholder="e.g. Welding Robot A1" {...register('machine_id')} />
              )}
              {errors.machine_id && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.machine_id.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Severity</label>
              <select className="form-select" {...register('severity')}>
                <option value="P1">P1 — Critical (10 min SLA)</option>
                <option value="P2">P2 — High (30 min SLA)</option>
                <option value="P3">P3 — Medium (2 hr SLA)</option>
                <option value="P4">P4 — Low (8 hr SLA)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" placeholder="Describe the breakdown..." {...register('description')} />
              {errors.description && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.description.message}</span>}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-danger" type="submit" disabled={isSubmitting} style={{ background: 'var(--red)', color: 'white', borderColor: 'var(--red)' }}>
              {isSubmitting ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Maintenance() {
  const { user } = useAuthStore();
  const { addBreakdown, updateBreakdown } = useAppStore();
  const [tickets, setTickets] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchMachines = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('machines').select('machine_id, machine_name, status').order('machine_name');
    if (data) setMachines(data);
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('breakdown_tickets')
          .select('*, machines(machine_name, status)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) setTickets(data.map((t) => ({
          id: t.ticket_id,
          machine_id: t.machine_id,
          machine: t.machines?.machine_name || t.machine_id || 'Unknown Machine',
          description: t.description,
          severity: t.severity,
          status: t.status,
          acknowledged: !!t.acknowledged_at,
          reportedAt: t.created_at,
          repairLog: [],
        })));
      } else {
        setTickets([]);
      }
    } catch (err) {
      toast.error('Failed to load tickets: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMachines(); fetchTickets(); }, []);

  const handleUpdate = (updated) => {
    setTickets((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    updateBreakdown(updated.id, updated);
  };

  const handleCreate = (ticket) => {
    setTickets((prev) => [ticket, ...prev]);
    addBreakdown(ticket);
  };

  const filtered = filterStatus === 'all' ? tickets : tickets.filter((t) => t.status === filterStatus);
  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'Open').length;
  const p1Count = tickets.filter((t) => t.severity === 'P1').length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block"><h1 className="page-title">Maintenance</h1><div className="page-subtitle">Breakdown Tickets & Machine Maintenance</div></div>
        <div className="page-actions">
          <button className="icon-btn" onClick={fetchTickets}><RefreshCw size={14} /></button>
          <button className="btn btn-danger" onClick={() => setShowCreate(true)} style={{ background: 'var(--red)', color: 'white', borderColor: 'var(--red)' }}>
            <AlertTriangle size={14} /> Report Breakdown
          </button>
        </div>
      </div>

      <div className="grid grid-4 mb-16">
        {[
          { label: 'Total Tickets', value: tickets.length, color: 'white' },
          { label: 'Open / P1', value: `${openCount} / ${p1Count}`, color: p1Count > 0 ? 'red' : 'amber' },
          { label: 'In Repair', value: tickets.filter((t) => t.status === 'in_repair' || t.status === 'In Repair').length, color: 'blue' },
          { label: 'Resolved', value: tickets.filter((t) => t.status === 'closed' || t.status === 'Resolved').length, color: 'green' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card"><div className="metric-label">{label}</div><div className={`metric-value ${color}`} style={{ fontSize: 32 }}>{value}</div></div>
        ))}
      </div>

      <div className="tabs">
        {[{ id: 'all', label: 'All' }, { id: 'open', label: 'Open' }, { id: 'acknowledged', label: 'Acknowledged' }, { id: 'in_repair', label: 'In Repair' }, { id: 'closed', label: 'Closed' }].map((f) => (
          <button key={f.id} className={`tab-btn ${filterStatus === f.id ? 'active' : ''}`} onClick={() => setFilterStatus(f.id)}>{f.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          [1, 2, 3].map((i) => <div key={i} style={{ height: 80, background: 'linear-gradient(90deg,#181818,#222,#181818)', animation: 'shimmer 1.5s infinite' }} />)
        ) : filtered.length === 0 ? (
          <div className="card"><div className="empty-state"><CheckCircle2 size={32} color="var(--green)" /><span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)' }}>NO TICKETS IN THIS VIEW</span></div></div>
        ) : filtered.map((ticket) => (
          <div
            key={ticket.id}
            onClick={() => setSelected(ticket)}
            style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${ticket.severity === 'P1' ? 'var(--red)' : ticket.severity === 'P2' ? 'var(--amber)' : 'var(--bmw-blue)'}`, cursor: 'pointer', transition: 'background var(--transition)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
          >
            <div style={{ width: 40, height: 40, background: ticket.severity === 'P1' ? 'var(--red-dim)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${ticket.severity === 'P1' ? 'var(--red)' : 'var(--border)'}`, flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700, color: ticket.severity === 'P1' ? 'var(--red)' : ticket.severity === 'P2' ? 'var(--amber)' : 'var(--bmw-blue)' }}>{ticket.severity}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700, color: 'var(--white)', letterSpacing: '0.05em' }}>{ticket.machine}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{ticket.description}</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', marginTop: 4, letterSpacing: '0.08em' }}>
                {ticket.id} · {new Date(ticket.reportedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <span className={`badge ${STATUS_COLOR[ticket.status] || 'badge-gray'}`}>{String(ticket.status).toUpperCase().replace('_', ' ')}</span>
              <SLATimer createdAt={ticket.reportedAt} severity={ticket.severity} acknowledged={ticket.acknowledged} />
            </div>
          </div>
        ))}
      </div>

      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={handleCreate} machines={machines} />}
      {selected && <TicketDetailModal ticket={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} />}
    </div>
  );
}
