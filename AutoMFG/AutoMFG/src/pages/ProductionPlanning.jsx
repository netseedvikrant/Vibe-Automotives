// AutoMFG — Production Planning — Supabase-driven, no mock data
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, CheckCircle2, XCircle, RefreshCw, Calendar } from 'lucide-react';
import { supabase, isSupabaseConfigured, writeAuditLog } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { freezeProductionPlan } from '../lib/dbIntegration';

const safeUUID = (id) =>
  id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;

const STATUS_COLOR = { draft: 'badge-gray', pending_approval: 'badge-amber', approved: 'badge-blue', frozen: 'badge-blue' };
const STATUS_LABEL = { draft: 'DRAFT', pending_approval: 'PENDING', approved: 'APPROVED', frozen: 'FROZEN' };

function GanttChart({ plans }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ganttStart = new Date(today); ganttStart.setDate(today.getDate() - 4);
  const totalDays = 9;
  const dayLabels = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(ganttStart); d.setDate(d.getDate() + i); return d;
  });
  const lines = [...new Set(plans.map((p) => p.line_name || p.line_id || 'Unassigned'))];
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
          const linePlans = plans.filter((p) => (p.line_name || p.line_id || 'Unassigned') === lineName);
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
                  const label = plan.product_name || plan.part_number || plan.plan_id;
                  return (
                    <div key={plan.plan_id} title={`${label} — ${plan.planned_qty} units`} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: `${left}%`, width: `${width}%`, background: statusColors[plan.status] || '#3a3a3a', height: 28, display: 'flex', alignItems: 'center', paddingLeft: 8, cursor: 'pointer', zIndex: 1 }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label} ({plan.planned_qty})</span>
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

// Fetch R&D BOM items from gate5_bom_cad_handoffs using anon key (no admin login needed)
async function fetchRndBomItems() {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('gate5_bom_cad_handoffs')
      .select('id, program_id, program_name, ebom_payload, cad_payload')
      .order('program_name', { ascending: true });

    if (error) {
      console.error("Failed to fetch gate5_bom_cad_handoffs:", error);
      toast.error("Unable to load AutoRND BOM handoffs. Check Supabase table access or RLS policy.");
      return [];
    }

    console.log("AutoRND handoffs from Supabase:", data);

    return (data || []).map((row) => {
      let ebom = row.ebom_payload || [];
      if (typeof ebom === 'string') {
        try { ebom = JSON.parse(ebom); } catch (_) { ebom = []; }
      }
      let cad = row.cad_payload || [];
      if (typeof cad === 'string') {
        try { cad = JSON.parse(cad); } catch (_) { cad = []; }
      }
      return {
        id: row.id,
        program_id: row.program_id,
        name: row.program_name,
        product_name: row.program_name,
        program_name: row.program_name,
        ebom_payload: ebom,
        cad_payload: cad,
        bom_item_count: Array.isArray(ebom) ? ebom.length : 0,
        cad_item_count: Array.isArray(cad) ? cad.length : 0,
        source: "AutoRND",
        status: "SYNCED"
      };
    });
  } catch (err) {
    console.error("Failed to fetch gate5_bom_cad_handoffs:", err);
    toast.error("Unable to load AutoRND BOM handoffs. Check Supabase table access or RLS policy.");
    return [];
  }
}

function CreatePlanModal({ onClose, onCreated, prefillRnd }) {
  const { user } = useAuthStore();
  const [dbLines, setDbLines] = useState([]);
  const [rndItems, setRndItems] = useState([]);
  const [loadingRnd, setLoadingRnd] = useState(true);
  const [selectedRnd, setSelectedRnd] = useState(prefillRnd || null);
  const [form, setForm] = useState({
    line_id: '',
    planned_qty: 100,
    start_date: '',
    end_date: '',
    vin_range: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isSupabaseConfigured()) {
      supabase.from('production_lines').select('line_id, line_name').eq('status', 'active')
        .then(({ data }) => { if (data) setDbLines(data); });
    }
    fetchRndBomItems().then(items => {
      setRndItems(items);
      setLoadingRnd(false);
    });
  }, []);

  useEffect(() => {
    if (prefillRnd) {
      setSelectedRnd(prefillRnd);
    }
  }, [prefillRnd]);

  const validate = () => {
    const e = {};
    if (!selectedRnd) e.rnd = 'Select an AutoRND BOM/Product before creating a production plan.';
    if (!form.line_id) e.line_id = 'Select a production line.';
    if (!form.planned_qty || Number(form.planned_qty) < 1) e.planned_qty = 'Planned quantity must be greater than 0.';
    if (!form.start_date) e.start_date = 'Start date required.';
    if (!form.end_date) e.end_date = 'End date required.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const selectedLine = dbLines.find(l => l.line_id === form.line_id);
      const planId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });

      const newPlan = {
        plan_id: planId,
        product_name: selectedRnd.program_name,
        part_number: selectedRnd.program_name,
        bom_id: selectedRnd.program_id,
        line_id: form.line_id,
        line_name: selectedLine?.line_name || form.line_id,
        planned_qty: Number(form.planned_qty),
        start_date: form.start_date,
        end_date: form.end_date,
        vin_range: form.vin_range || '',
        status: 'draft',
      };

      if (isSupabaseConfigured()) {
        // Ensure the part number exists in part_master to satisfy foreign key constraint
        const { error: partMasterError } = await supabase
          .from('part_master')
          .upsert({
            part_number: selectedRnd.program_name,
            model: selectedRnd.program_name.slice(0, 50).trim(),
            variant: 'R&D Handoff'
          }, { onConflict: 'part_number' });

        if (partMasterError) {
          console.error("Failed to register part in part_master:", partMasterError);
        }

        // Ensure the BOM exists in bom_master to satisfy foreign key constraint
        const { error: bomMasterError } = await supabase
          .from('bom_master')
          .upsert({
            bom_id: selectedRnd.program_id,
            product_name: selectedRnd.program_name,
            product_code: 'AD-' + selectedRnd.program_id.slice(0, 5).toUpperCase(),
            version: 'v1.0',
            status: 'Active'
          }, { onConflict: 'bom_id' });

        if (bomMasterError) {
          console.error("Failed to register BOM in bom_master:", bomMasterError);
        }

        const insertPayload = {
          plan_id: planId,
          part_number: selectedRnd.program_name,
          bom_id: selectedRnd.program_id,
          planned_qty: Number(form.planned_qty),
          start_date: form.start_date,
          end_date: form.end_date,
          vin_range: form.vin_range || null,
          status: 'draft',
          created_by: safeUUID(user?.id),
        };
        if (selectedLine) insertPayload.line_id = selectedLine.line_id;

        const { data, error } = await supabase.from('production_plans').insert(insertPayload).select();
        if (error) {
          console.error("Failed to insert production plan:", error);
          toast.error("Failed to save production plan: " + error.message);
          setSubmitting(false);
          return;
        }
        if (data && data[0]) {
          newPlan.plan_id = data[0].plan_id;
          newPlan.plan_code = data[0].plan_code;
          newPlan.created_at = data[0].created_at;
        }
        writeAuditLog(safeUUID(user?.id), 'production_plans', 'insert', { part_number: selectedRnd.program_name });
      }

      toast.success('Production plan created');
      onCreated(newPlan);
      onClose();
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Create Production Plan</span><button className="icon-btn" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* R&D BOM / Product selector */}
            <div className="form-group">
              <label className="form-label">Product / Part to Produce</label>
              {loadingRnd ? (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted-text)', padding: '8px 0' }}>Loading AutoRND BOMs...</div>
              ) : (() => {
                const allRndOptions = [...rndItems];
                if (selectedRnd && !rndItems.some(item => item.id === selectedRnd.id)) {
                  allRndOptions.unshift(selectedRnd);
                }
                return (
                  <select
                    className="form-select"
                    value={selectedRnd?.id || ''}
                    onChange={e => {
                      const item = allRndOptions.find(r => r.id === e.target.value) || null;
                      setSelectedRnd(item);
                      setErrors(prev => ({ ...prev, rnd: undefined }));
                    }}
                  >
                    <option value="">Select AutoRND BOM / Product...</option>
                    {allRndOptions.length === 0 && (
                      <option disabled value="">No AutoRND BOMs available for planning</option>
                    )}
                    {allRndOptions.map(item => (
                      <option key={item.id} value={item.id}>{item.program_name}</option>
                    ))}
                  </select>
                );
              })()}
              {selectedRnd && (
                <div style={{ marginTop: 4, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>
                  Source: AutoRND · BOM items: {selectedRnd.bom_item_count}
                </div>
              )}
              {errors.rnd && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.rnd}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Production Line</label>
                <select className="form-select" value={form.line_id} onChange={e => { setForm(f => ({ ...f, line_id: e.target.value })); setErrors(p => ({ ...p, line_id: undefined })); }}>
                  <option value="">Select line...</option>
                  {dbLines.length > 0
                    ? dbLines.map(l => <option key={l.line_id} value={l.line_id}>{l.line_name}</option>)
                    : ['Line 1', 'Line 2', 'Line 3', 'Line 4'].map(n => <option key={n} value={n}>{n}</option>)
                  }
                </select>
                {errors.line_id && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.line_id}</span>}
                {dbLines.length === 0 && <span style={{ color: 'var(--amber)', fontSize: 10, marginTop: 2, display: 'block' }}>⚠ Run seed_production_lines.sql in Supabase to enable line tracking</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Planned Qty</label>
                <input className="form-input" type="number" placeholder="100" value={form.planned_qty} onChange={e => { setForm(f => ({ ...f, planned_qty: e.target.value })); setErrors(p => ({ ...p, planned_qty: undefined })); }} />
                {errors.planned_qty && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.planned_qty}</span>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-input" type="date" value={form.start_date} onChange={e => { setForm(f => ({ ...f, start_date: e.target.value })); setErrors(p => ({ ...p, start_date: undefined })); }} />
                {errors.start_date && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.start_date}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input className="form-input" type="date" value={form.end_date} onChange={e => { setForm(f => ({ ...f, end_date: e.target.value })); setErrors(p => ({ ...p, end_date: undefined })); }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">VIN Range (optional)</label>
              <input className="form-input" placeholder="e.g. WBS...001-100" value={form.vin_range} onChange={e => setForm(f => ({ ...f, vin_range: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Plan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProductionPlanning() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [prefillRnd, setPrefillRnd] = useState(null);
  const [activeTab, setActiveTab] = useState('list');

  // Handle prefill passed via navigate state from PlannerDashboard
  useEffect(() => {
    if (location.state?.prefillRnd) {
      setPrefillRnd(location.state.prefillRnd);
      setShowCreate(true);
      try { window.history.replaceState(null, ''); } catch (_) {}
    }
  }, [location.state]);

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

  // Realtime subscription
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const channel = supabase
      .channel('production-plans-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_plans' }, () => {
        fetchPlans();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleFreezePlan = async (plan) => {
    setLoading(true);
    try {
      const res = await freezeProductionPlan(plan.plan_id);
      if (res.success) {
        setPlans(prev => prev.map(p => p.plan_id === plan.plan_id ? { ...p, status: 'frozen' } : p));
        toast.success('Plan frozen → Work Orders generated & SCM Handoff sent');
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast.error('Failed to freeze plan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (plan, newStatus) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('production_plans').update({ status: newStatus }).eq('plan_id', plan.plan_id);
        if (error) throw error;
        if (newStatus === 'approved') {
          await supabase.from('plan_approvals').insert({ plan_id: plan.plan_id, approver_user_id: safeUUID(user?.id), decision: 'approved', decided_at: new Date().toISOString() });
        } else if (newStatus === 'draft' && plan.status === 'pending_approval') {
          await supabase.from('plan_approvals').insert({ plan_id: plan.plan_id, approver_user_id: safeUUID(user?.id), decision: 'rejected', decided_at: new Date().toISOString() });
        }
        await writeAuditLog(user?.id, 'production_plans', 'update', { plan_id: plan.plan_id, status: newStatus });
      }
      setPlans((prev) => prev.map((p) => p.plan_id === plan.plan_id ? { ...p, status: newStatus } : p));
      toast.success(`Plan → ${STATUS_LABEL[newStatus] || newStatus}`);
    } catch (err) {
      toast.error('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: plans.length,
    draft: plans.filter((p) => p.status === 'draft').length,
    pending: plans.filter((p) => p.status === 'pending_approval').length,
    frozen: plans.filter((p) => p.status === 'frozen').length,
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block"><h1 className="page-title">Production Planning</h1><div className="page-subtitle">Master Production Schedule & Plan Approval</div></div>
        <div className="page-actions">
          <button className="icon-btn" onClick={fetchPlans} title="Refresh"><RefreshCw size={14} /></button>
          {canCreate && <button className="btn btn-primary" onClick={() => { setPrefillRnd(null); setShowCreate(true); }}><Plus size={14} /> Create Plan</button>}
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
        <div className="card mb-16"><div className="card-header"><span className="card-title">Master Production Schedule — Gantt</span><span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)' }}><Calendar size={11} style={{ display: 'inline', marginRight: 4 }} />Rolling 9 Days</span></div><GanttChart plans={plans} /></div>
      )}

      {activeTab === 'list' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Production Plans</span><span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>{plans.length} PLANS</span></div>
          {loading && <div style={{ padding: 16, color: 'var(--muted-text)', fontSize: 12 }}>Loading...</div>}
          {!loading && plans.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 12 }}>
              No production plans yet. Click <strong>Create Plan</strong> to get started.
            </div>
          )}
          {!loading && plans.length > 0 && (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Plan ID</th><th>Product / Part</th><th>Line</th><th>Qty</th><th>Dates</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.plan_id}>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)', fontSize: 13 }}>{plan.plan_code || plan.plan_id?.slice(0, 12)}</td>
                      <td style={{ fontSize: 12 }}>{plan.product_name || plan.part_number || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-heading)', fontSize: 12 }}>{plan.line_name || plan.line_id || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{plan.planned_qty}</td>
                      <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)' }}>{plan.start_date} → {plan.end_date}</td>
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
          )}
        </div>
      )}

      {showCreate && (
        <CreatePlanModal
          prefillRnd={prefillRnd}
          onClose={() => { setShowCreate(false); setPrefillRnd(null); }}
          onCreated={(plan) => { setPlans((prev) => [plan, ...prev]); }}
        />
      )}
    </div>
  );
}
