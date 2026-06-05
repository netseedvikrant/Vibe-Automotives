// AutoMFG — Production Planning (Flow 2) — FIXED
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, CheckCircle2, XCircle, RefreshCw, Calendar } from 'lucide-react';
import { supabase, isSupabaseConfigured, writeAuditLog } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const safeUUID = (id) =>
  id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;

const planSchema = z.object({
  part_number: z.string().min(1, 'Part number required'),
  line_id: z.string().min(1, 'Line required'),
  planned_qty: z.coerce.number().min(1, 'Qty must be > 0'),
  start_date: z.string().min(1, 'Start date required'),
  end_date: z.string().min(1, 'End date required'),
  vin_range: z.string().optional(),
});

const STATUS_COLOR = { draft: 'badge-gray', pending_approval: 'badge-amber', approved: 'badge-blue', frozen: 'badge-blue' };
const STATUS_LABEL = { draft: 'DRAFT', pending_approval: 'PENDING', approved: 'APPROVED', frozen: 'FROZEN' };

const MOCK_PLANS = [
  { plan_id: 'PP-001', part_number: 'BMW-M4-DOOR-LH', line_id: 'line-1', line_name: 'Line 1', planned_qty: 100, start_date: '2026-05-18', end_date: '2026-05-20', status: 'approved', vin_range: 'WBS...001-100', capacity_util: 85, material_ok: true },
  { plan_id: 'PP-002', part_number: 'BMW-3-CHASSIS', line_id: 'line-2', line_name: 'Line 2', planned_qty: 60, start_date: '2026-05-18', end_date: '2026-05-19', status: 'pending_approval', vin_range: 'WBS...201-260', capacity_util: 72, material_ok: false },
  { plan_id: 'PP-003', part_number: 'BMW-5-ENGINE-MOUNT', line_id: 'line-3', line_name: 'Line 3', planned_qty: 45, start_date: '2026-05-19', end_date: '2026-05-21', status: 'draft', vin_range: 'WBS...301-345', capacity_util: 90, material_ok: true },
  { plan_id: 'PP-004', part_number: 'BMW-7-DASH-PANEL', line_id: 'line-4', line_name: 'Line 4', planned_qty: 100, start_date: '2026-05-19', end_date: '2026-05-22', status: 'frozen', vin_range: 'WBS...401-500', capacity_util: 78, material_ok: true },
];

function GanttChart({ plans }) {
  // ✅ FIXED: Dynamic dates — show 4 days before today through 4 days after
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ganttStart = new Date(today); ganttStart.setDate(today.getDate() - 4);
  const totalDays = 9;
  const dayLabels = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(ganttStart); d.setDate(d.getDate() + i); return d;
  });
  const lines = [...new Set(plans.map((p) => p.line_name || p.line_id))];
  const statusColors = { draft: '#3a3a3a', pending_approval: '#d4841c', approved: '#1c69d4', frozen: '#1450a3' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 700 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '8px 12px', fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.15em' }}>LINE</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${totalDays}, 1fr)` }}>
            {dayLabels.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              return (
                <div key={i} style={{ padding: '8px 4px', textAlign: 'center', fontFamily: 'var(--font-heading)', fontSize: 10, color: isToday ? 'var(--bmw-blue)' : 'var(--muted-text)', borderLeft: '1px solid var(--border)', background: isToday ? 'rgba(28,105,212,0.06)' : 'transparent' }}>
                  {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </div>
              );
            })}
          </div>
        </div>
        {lines.map((lineName) => {
          const linePlans = plans.filter((p) => (p.line_name || p.line_id) === lineName);
          return (
            <div key={lineName} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--border)', minHeight: 52 }}>
              <div style={{ padding: '16px 12px', fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>{lineName}</div>
              <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${totalDays}, 1fr)` }}>
                {dayLabels.map((_, i) => <div key={i} style={{ borderLeft: '1px solid var(--border)', minHeight: 52 }} />)}
                {linePlans.map((plan) => {
                  const start = new Date(plan.start_date);
                  const end = new Date(plan.end_date);
                  const startOffset = Math.max(0, Math.ceil((start - ganttStart) / 86400000));
                  const spanDays = Math.min(totalDays - startOffset, Math.ceil((end - start) / 86400000) + 1);
                  const left = (startOffset / totalDays) * 100;
                  const width = (spanDays / totalDays) * 100;
                  return (
                    <div key={plan.plan_id} title={`${plan.part_number} — ${plan.planned_qty} units`} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: `${left}%`, width: `${width}%`, background: statusColors[plan.status] || '#3a3a3a', height: 28, display: 'flex', alignItems: 'center', paddingLeft: 8, cursor: 'pointer', zIndex: 1 }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.part_number} ({plan.planned_qty})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {Object.entries(statusColors).map(([s, c]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 8, background: c }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SEEDED_PARTS = [
  'BMW-M4-DOOR-LH',
  'BMW-3-CHASSIS',
  'BMW-5-ENGINE-MOUNT',
  'BMW-7-DASH-PANEL',
  'BMW-M3-EXHAUST',
];

function CreatePlanModal({ onClose, onCreated }) {
  const { user } = useAuthStore();
  const [dbLines, setDbLines] = useState([]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(planSchema) });

  // Fetch real production_lines UUIDs from DB
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    supabase.from('production_lines').select('line_id, line_name').eq('status', 'active')
      .then(({ data }) => { if (data) setDbLines(data); });
  }, []);

  const onSubmit = async (data) => {
    const selectedLine = dbLines.find(l => l.line_id === data.line_id);
    const newPlan = {
      plan_id: `PP-${Date.now()}`,
      part_number: data.part_number,
      line_id: data.line_id,
      line_name: selectedLine?.line_name || data.line_id,
      planned_qty: data.planned_qty,
      start_date: data.start_date,
      end_date: data.end_date,
      vin_range: data.vin_range || '',
      status: 'draft',
      capacity_util: Math.floor(Math.random() * 40) + 60,
      material_ok: Math.random() > 0.3,
    };
    if (isSupabaseConfigured()) {
      const insertPayload = {
        part_number: data.part_number,       // FK to part_master — seeded values only
        planned_qty: data.planned_qty,
        start_date: data.start_date,
        end_date: data.end_date,
        vin_range: data.vin_range || null,
        status: 'draft',
        created_by: safeUUID(user?.id),
      };
      // Only attach line_id if it's a real UUID from the DB
      if (selectedLine) insertPayload.line_id = selectedLine.line_id;
      const { error } = await supabase.from('production_plans').insert(insertPayload);
      if (error) { toast.error('Failed: ' + error.message); return; }
      writeAuditLog(safeUUID(user?.id), 'production_plans', 'insert', { part_number: data.part_number });
    }
    toast.success('Production plan created');
    onCreated(newPlan);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Create Production Plan</span><button className="icon-btn" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Part Number</label>
              <select className="form-select" {...register('part_number')}>
                <option value="">Select part...</option>
                {SEEDED_PARTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.part_number && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.part_number.message}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Production Line</label>
                <select className="form-select" {...register('line_id')}>
                  <option value="">Select line...</option>
                  {dbLines.length > 0
                    ? dbLines.map(l => <option key={l.line_id} value={l.line_id}>{l.line_name}</option>)
                    : ['Line 1','Line 2','Line 3','Line 4'].map(n => <option key={n} value={n}>{n}</option>)
                  }
                </select>
                {errors.line_id && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.line_id.message}</span>}
                {dbLines.length === 0 && <span style={{ color: 'var(--amber)', fontSize: 10, marginTop: 2, display: 'block' }}>⚠ Run seed_production_lines.sql in Supabase to enable line tracking</span>}
              </div>
              <div className="form-group"><label className="form-label">Planned Qty</label><input className="form-input" type="number" placeholder="100" {...register('planned_qty')} />{errors.planned_qty && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.planned_qty.message}</span>}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" {...register('start_date')} /></div>
              <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" {...register('end_date')} /></div>
            </div>
            <div className="form-group"><label className="form-label">VIN Range (optional)</label><input className="form-input" placeholder="e.g. WBS...001-100" {...register('vin_range')} /></div>
          </div>
          <div className="modal-footer"><button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Plan'}</button></div>
        </form>
      </div>
    </div>
  );
}

export default function ProductionPlanning() {
  const { user } = useAuthStore();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  const canApprove = ['production_manager', 'plant_manager'].includes(user?.role);
  const canCreate = ['production_planner', 'production_manager', 'plant_manager', 'sys_admin'].includes(user?.role);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('production_plans')
          .select('*, production_lines ( line_name )')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) setPlans(data.map(p => ({
          ...p,
          line_name: p.production_lines?.line_name || p.line_name || '—',
        })));
      } else {
        setPlans([]);
      }
    } catch (err) {
      toast.error('Failed to load plans: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  const autoGenerateWorkOrders = async (plan) => {
    const { count } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true });

    const woNumber = `WO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String((count || 0) + 1).padStart(4,'0')}`;

    const woPayload = {
      wo_number: woNumber,
      plan_id: plan.plan_id,
      planned_qty: plan.planned_qty,
      actual_qty: 0,
      scrap_qty: 0,
      status: 'created',
      created_at: new Date().toISOString(),
    };
    // Carry part_number only if it's a seeded value (FK constraint)
    if (plan.part_number && SEEDED_PARTS.includes(plan.part_number)) {
      woPayload.part_number = plan.part_number;
    }
    // Carry line_id only if it's a valid UUID (from DB seed)
    if (plan.line_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan.line_id)) {
      woPayload.line_id = plan.line_id;
    }

    const { error } = await supabase.from('work_orders').insert(woPayload);
    if (error) {
      toast.error('Plan frozen but WO generation failed: ' + error.message);
      console.error('WO generation error:', error);
    }
  }

  const handleFreezePlan = async (plan) => {
    // 1. Update plan status to frozen in Supabase
    const { error: freezeError } = await supabase
      .from('production_plans')
      .update({ status: 'frozen' })
      .eq('plan_id', plan.plan_id)

    if (freezeError) {
      toast.error('Failed to freeze plan')
      return
    }

    // 2. Auto-generate Work Orders immediately after freezing
    await autoGenerateWorkOrders(plan)

    // 3. Only now update local state
    setPlans(prev => prev.map(p =>
      p.plan_id === plan.plan_id ? { ...p, status: 'frozen' } : p
    ))
    toast.success('Plan frozen → Work Orders generated')
  }

  const handleStatusChange = async (plan, newStatus) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('production_plans')
          .update({ status: newStatus })
          .eq('plan_id', plan.plan_id);

        if (error) throw error;

        if (newStatus === 'approved') {
          const { error: appErr } = await supabase.from('plan_approvals').insert({
            plan_id: plan.plan_id,
            approver_user_id: safeUUID(user?.id), // ✅ FIXED: safeUUID guard
            decision: 'approved',
            decided_at: new Date().toISOString()
          });
          if (appErr) throw appErr;
        } else if (newStatus === 'draft' && plan.status === 'pending_approval') {
          const { error: appErr } = await supabase.from('plan_approvals').insert({
            plan_id: plan.plan_id,
            approver_user_id: safeUUID(user?.id), // ✅ FIXED: safeUUID guard
            decision: 'rejected',
            decided_at: new Date().toISOString()
          });
          if (appErr) throw appErr;
        }

        await writeAuditLog(user?.id, 'production_plans', 'update', { plan_id: plan.plan_id, status: newStatus });
      }

      // Only update local state after Supabase confirms success
      setPlans((prev) => prev.map((p) => p.plan_id === plan.plan_id ? { ...p, status: newStatus } : p));
      toast.success(`Plan → ${STATUS_LABEL[newStatus] || newStatus}`);
    } catch (err) {
      toast.error('Failed to save. Please try again.');
      // Do NOT update local state on error
    } finally {
      setLoading(false);
    }
  };

  const stats = { total: plans.length, draft: plans.filter((p) => p.status === 'draft').length, pending: plans.filter((p) => p.status === 'pending_approval').length, frozen: plans.filter((p) => p.status === 'frozen').length };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block"><h1 className="page-title">Production Planning</h1><div className="page-subtitle">Master Production Schedule & Plan Approval</div></div>
        <div className="page-actions">
          <button className="icon-btn" onClick={fetchPlans} title="Refresh"><RefreshCw size={14} /></button>
          {canCreate && <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> Create Plan</button>}
        </div>
      </div>

      <div className="grid grid-4 mb-16">
        {[{ label: 'Total Plans', value: stats.total, color: 'white' }, { label: 'Draft', value: stats.draft, color: '' }, { label: 'Pending Approval', value: stats.pending, color: 'amber' }, { label: 'Frozen', value: stats.frozen, color: 'blue' }].map(({ label, value, color }) => (
          <div key={label} className="card"><div className="metric-label">{label}</div><div className={`metric-value ${color}`} style={{ fontSize: 36 }}>{value}</div></div>
        ))}
      </div>

      <div className="tabs">
        {[{ id: 'list', label: 'Plan List' }, { id: 'gantt', label: 'Gantt View' }].map((t) => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'gantt' && (
        <div className="card mb-16"><div className="card-header"><span className="card-title">Master Production Schedule — Gantt</span><span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)' }}><Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />May 17–24, 2026</span></div><GanttChart plans={plans} /></div>
      )}

      {activeTab === 'list' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Production Plans</span><span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>{plans.length} PLANS</span></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Plan ID</th><th>Part Number</th><th>Line</th><th>Qty</th><th>Dates</th><th>Capacity</th><th>Material</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.plan_id}>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)', fontSize: 13 }}>{plan.plan_code || plan.plan_id}</td>
                    <td style={{ fontSize: 12 }}>{plan.part_number}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontSize: 12 }}>{plan.line_name || plan.line_id}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{plan.planned_qty}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)' }}>{plan.start_date} → {plan.end_date}</td>
                    <td>
                      {plan.capacity_util !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', maxWidth: 80 }}>
                            <div style={{ height: '100%', width: `${plan.capacity_util}%`, background: plan.capacity_util > 90 ? 'var(--red)' : plan.capacity_util > 80 ? 'var(--amber)' : 'var(--bmw-blue)' }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11 }}>{plan.capacity_util}%</span>
                        </div>
                      )}
                    </td>
                    <td>{plan.material_ok !== undefined ? (plan.material_ok ? <span className="badge badge-green">OK</span> : <span className="badge badge-red">SHORTAGE</span>) : '—'}</td>
                    <td><span className={`badge ${STATUS_COLOR[plan.status] || 'badge-gray'}`}>{STATUS_LABEL[plan.status] || plan.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {plan.status === 'draft' && canCreate && <button className="btn btn-sm btn-outline" onClick={() => handleStatusChange(plan, 'pending_approval')}>Submit</button>}
                        {plan.status === 'pending_approval' && canApprove && (
                          <>
                            <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(plan, 'approved')}><CheckCircle2 size={10} /> Approve</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleStatusChange(plan, 'draft')}><XCircle size={10} /></button>
                          </>
                        )}
                        {plan.status === 'approved' && canApprove && <button className="btn btn-sm btn-primary" onClick={() => handleFreezePlan(plan)}>Freeze</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <CreatePlanModal onClose={() => setShowCreate(false)} onCreated={(plan) => setPlans((prev) => [plan, ...prev])} />}
    </div>
  );
}
