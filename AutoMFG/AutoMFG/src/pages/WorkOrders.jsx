// AutoMFG — Work Orders (Flow 3) — TanStack Table v8 + Supabase
import { useState, useEffect, useMemo } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Search, ChevronRight, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured, writeAuditLog } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

const STATUS_FLOW = ['created', 'released', 'in_progress', 'completed', 'closed'];
const STATUS_COLOR = { created: 'badge-gray', released: 'badge-white', in_progress: 'badge-blue', completed: 'badge-green', closed: 'badge-gray' };
const STATUS_LABEL = { created: 'CREATED', released: 'RELEASED', in_progress: 'IN PROGRESS', completed: 'COMPLETED', closed: 'CLOSED' };

// Normalize from both mock and DB format
function normalizeWO(wo) {
  return {
    id: wo.wo_number || wo.id,
    wo_number: wo.wo_number || wo.id,
    plan_id: wo.plan_id || null,
    parent: wo.production_plans?.plan_code || wo.production_plans?.plan_id?.slice(0,8) || wo.plan_id?.slice(0,8) || '—',
    part: wo.part_number || wo.part || '—',
    vin: wo.vin || '—',
    // Resolve plant name — prefer joined name over raw UUID
    plant: wo.plants?.name || (!wo.plant_id || wo.plant_id?.includes('-') ? 'Plant A' : wo.plant_id) || '—',
    // Resolve line name — prefer joined name over raw UUID
    line: wo.production_lines?.line_name || (!wo.line_id || wo.line_id?.includes('-') ? '—' : wo.line_id) || '—',
    line_id: wo.line_id || null,
    workCenter: wo.workCenter || '—',
    operation: wo.operation || '—',
    stdTime: wo.stdTime || 0,
    actualTime: wo.actualTime || null,
    plannedQty: wo.planned_qty ?? wo.producedQty ?? 0,
    actualQty: wo.actual_qty ?? wo.producedQty ?? 0,
    scrapQty: wo.scrap_qty ?? wo.scrapQty ?? 0,
    status: (wo.status || 'created').toLowerCase().replace(' ', '_'),
    created: wo.created_at?.slice(0, 10) || wo.created || '—',
  };
}

const EDITABLE_ROLES = ['production_planner', 'production_manager'];
const SEEDED_PARTS = ['BMW-M4-DOOR-LH','BMW-3-CHASSIS','BMW-5-ENGINE-MOUNT','BMW-7-DASH-PANEL','BMW-M3-EXHAUST'];

function WODetailModal({ wo, onClose, onStatusChange, onUpdated }) {
  const { user } = useAuthStore();
  const canEdit = EDITABLE_ROLES.includes(user?.role);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dbLines, setDbLines] = useState([]);
  const [form, setForm] = useState({
    vin: wo.vin === '—' ? '' : wo.vin,
    planned_qty: wo.plannedQty ?? 0,
    line_id: wo.line_id || '',
    part_number: wo.part === '—' ? '' : wo.part,
  });

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(wo.status) + 1];
  const variance = wo.actualTime && wo.stdTime ? ((wo.actualTime - wo.stdTime) / wo.stdTime * 100).toFixed(1) : null;

  useEffect(() => {
    if (editMode && isSupabaseConfigured()) {
      supabase.from('production_lines').select('line_id, line_name').eq('status', 'active')
        .then(({ data }) => { if (data) setDbLines(data); });
    }
  }, [editMode]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vinValue = form.vin.trim();
      const payload = { planned_qty: Number(form.planned_qty) };

      if (form.part_number) payload.part_number = form.part_number;
      if (form.line_id && /^[0-9a-f-]{36}$/i.test(form.line_id)) payload.line_id = form.line_id;

      // VIN has a FK constraint → work_orders.vin REFERENCES vin_units(vin)
      // Must upsert into vin_units first, then attach to work_order.
      if (vinValue) {
        const vinPayload = { vin: vinValue, current_status: 'planned' };
        // part_number on vin_units is also a FK — only set if a seeded part is selected
        if (form.part_number) vinPayload.part_number = form.part_number;

        const { error: vinErr } = await supabase
          .from('vin_units')
          .upsert(vinPayload, { onConflict: 'vin' });

        if (vinErr) throw new Error('VIN registration failed: ' + vinErr.message);
        payload.vin = vinValue;
      }

      const { error } = await supabase
        .from('work_orders')
        .update(payload)
        .eq('wo_number', wo.id);

      if (error) throw error;
      toast.success('Work Order updated');
      setEditMode(false);
      onUpdated?.();
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = { background: 'var(--bg-elevated)', padding: '10px 12px', border: '1px solid var(--border)' };
  const labelStyle = { fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 4 };
  const valueStyle = { fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 600, color: 'var(--white)' };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div>
            <span className="modal-title">{wo.id}</span>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)', letterSpacing: '0.1em', marginTop: 2 }}>{wo.part}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`badge ${STATUS_COLOR[wo.status] || 'badge-gray'}`}>{STATUS_LABEL[wo.status] || wo.status}</span>
            {canEdit && !editMode && (
              <button className="btn btn-sm btn-outline" onClick={() => setEditMode(true)}>✎ Edit</button>
            )}
            <button className="icon-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body">
          {/* Status Flow */}
          <div style={{ marginBottom: 20 }}>
            <div className="status-flow">
              {STATUS_FLOW.map((s, i) => {
                const idx = STATUS_FLOW.indexOf(wo.status);
                return <div key={s} className={`status-step ${i === idx ? 'active' : i < idx ? 'done' : ''}`}>{STATUS_LABEL[s] || s}</div>;
              })}
            </div>
          </div>

          {editMode ? (
            /* ── EDIT MODE ── only production_planner / production_manager */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '8px 12px', background: 'rgba(28,105,212,0.08)', border: '1px solid rgba(28,105,212,0.3)', fontSize: 11, color: 'var(--bmw-blue)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em' }}>
                ✎ EDIT MODE — changes will save to database
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Part Number</label>
                  <select className="form-select" value={form.part_number} onChange={e => setForm(f => ({ ...f, part_number: e.target.value }))}>
                    <option value="">Select part...</option>
                    {SEEDED_PARTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Production Line</label>
                  <select className="form-select" value={form.line_id} onChange={e => setForm(f => ({ ...f, line_id: e.target.value }))}>
                    <option value="">Select line...</option>
                    {dbLines.map(l => <option key={l.line_id} value={l.line_id}>{l.line_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">VIN / Serial Number</label>
                  <input className="form-input" placeholder="e.g. WBS3R9C57FK999001" value={form.vin} onChange={e => setForm(f => ({ ...f, vin: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Planned Qty</label>
                  <input className="form-input" type="number" value={form.planned_qty} onChange={e => setForm(f => ({ ...f, planned_qty: e.target.value }))} />
                </div>
              </div>
              <div style={{ ...fieldStyle, opacity: 0.5 }}>
                <div style={labelStyle}>Parent Plan</div>
                <div style={valueStyle}>{wo.parent}</div>
              </div>
            </div>
          ) : (
            /* ── READ-ONLY MODE ── all roles */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Parent Plan', value: wo.parent },
                { label: 'VIN', value: wo.vin },
                { label: 'Plant', value: wo.plant },
                { label: 'Line', value: wo.line },
                { label: 'Work Center', value: wo.workCenter },
                { label: 'Operation #', value: wo.operation },
                { label: 'Standard Time', value: wo.stdTime ? `${wo.stdTime} min` : '—' },
                { label: 'Actual Time', value: wo.actualTime ? `${wo.actualTime} min` : '—' },
                { label: 'Variance', value: variance ? `${variance > 0 ? '+' : ''}${variance}%` : '—' },
                { label: 'Planned Qty', value: wo.plannedQty },
                { label: 'Actual Qty', value: wo.actualQty },
                { label: 'Scrap Qty', value: wo.scrapQty },
              ].map(({ label, value }) => (
                <div key={label} style={fieldStyle}>
                  <div style={labelStyle}>{label}</div>
                  <div style={{ ...valueStyle, color: label === 'Variance' && variance > 0 ? 'var(--red)' : label === 'Variance' && variance <= 0 ? 'var(--green)' : 'var(--white)' }}>{value ?? '—'}</div>
                </div>
              ))}
            </div>
          )}

          {wo.actualTime && !editMode && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>Time vs Standard</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: wo.actualTime > wo.stdTime ? 'var(--red)' : 'var(--green)' }}>{wo.actualTime} / {wo.stdTime} min</span>
              </div>
              <div style={{ position: 'relative', height: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ height: '100%', width: `${Math.min((wo.stdTime / wo.actualTime) * 100, 100)}%`, background: wo.actualTime > wo.stdTime ? 'var(--red)' : 'var(--green)' }} />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {editMode ? (
            <>
              <button className="btn btn-outline" onClick={() => setEditMode(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={onClose}>Close</button>
              {nextStatus && (
                <button className="btn btn-primary" onClick={() => { onStatusChange(wo.id, nextStatus); onClose(); }}>
                  Advance to {STATUS_LABEL[nextStatus] || nextStatus}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateWOModal({ onClose, onCreated }) {
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [vin, setVin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchFrozenPlans = async () => {
      setLoadingPlans(true);
      const { data, error } = await supabase
        .from('production_plans')
        .select('*')
        .eq('status', 'frozen');
      setLoadingPlans(false);
      if (error) {
        toast.error('Failed to load frozen plans: ' + error.message);
      } else {
        setPlans(data || []);
        if (data && data.length > 0) {
          setSelectedPlanId(data[0].plan_id);
        }
      }
    };
    fetchFrozenPlans();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlanId) {
      toast.error('Please select a production plan');
      return;
    }
    const selectedPlan = plans.find(p => p.plan_id === selectedPlanId);
    if (!selectedPlan) {
      toast.error('Selected plan not found');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Generate a sequential WO number
      const { count } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })

      const woNumber = `WO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String((count || 0) + 1).padStart(4,'0')}`

      // 2. Insert into Supabase
      // NOTE: Omit FK-constrained fields (vin, plant_id, line_id, part_number)
      // as they require pre-existing rows in vin_units, plants, production_lines,
      // and part_master tables respectively.
      const { error } = await supabase
        .from('work_orders')
        .insert({
          wo_number: woNumber,
          plan_id: selectedPlan.plan_id,
          planned_qty: selectedPlan.planned_qty,
          actual_qty: 0,
          scrap_qty: 0,
          status: 'created',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success(`Work Order ${woNumber} created successfully!`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error('Failed to create Work Order: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPlan = plans.find(p => p.plan_id === selectedPlanId);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <span className="modal-title">Create Work Order</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {loadingPlans ? (
              <div style={{ color: 'var(--muted-text)', fontSize: 13 }}>Loading frozen plans...</div>
            ) : plans.length === 0 ? (
              <div style={{ color: 'var(--red)', fontSize: 13 }}>No frozen production plans available. Please freeze a plan first.</div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Select Frozen Plan</label>
                  <select
                    className="form-select"
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    required
                  >
                    {plans.map(p => (
                      <option key={p.plan_id} value={p.plan_id}>
                        {p.plan_code || p.plan_id.slice(0, 8)} — {p.part_number} (Qty: {p.planned_qty})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPlan && (
                  <div style={{ background: 'var(--bg-elevated)', padding: 12, border: '1px solid var(--border)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div><span style={{ color: 'var(--muted-text)' }}>Part Number:</span> <strong style={{ color: 'var(--white)' }}>{selectedPlan.part_number}</strong></div>
                    <div><span style={{ color: 'var(--muted-text)' }}>Planned Qty:</span> <strong style={{ color: 'var(--white)' }}>{selectedPlan.planned_qty}</strong></div>
                    <div><span style={{ color: 'var(--muted-text)' }}>Plant:</span> <strong style={{ color: 'var(--white)' }}>Plant A</strong></div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">VIN / Serial Number (optional)</label>
                  <input
                    className="form-input"
                    placeholder="e.g. WBS3R9C57FK999001"
                    value={vin}
                    onChange={(e) => setVin(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={isSubmitting || plans.length === 0}>
              {isSubmitting ? 'Creating...' : 'Create WO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorkOrders() {
  const { user } = useAuthStore();
  const { workOrders: _, updateWOStatus, addToast } = useAppStore();
  const [workOrders, setWorkOrders] = useState([]);
  const [showCreateWOModal, setShowCreateWOModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const checkFrozenPlanExists = async () => {
    const { data } = await supabase
      .from('production_plans')
      .select('plan_id')
      .eq('status', 'frozen')
      .limit(1)
    return data && data.length > 0
  }

  const handleCreateWO = async () => {
    const hasFrozenPlan = await checkFrozenPlanExists()
    if (!hasFrozenPlan) {
      toast.error('WO creation requires a frozen production plan')
      return
    }
    setShowCreateWOModal(true)
  }

  // Fetch from Supabase or use empty state
  const fetchWOs = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data: rows, error } = await supabase
          .from('work_orders')
          .select(`
            *,
            production_plans ( plan_id, plan_code, part_number, line_id, start_date, end_date ),
            production_lines ( line_name ),
            plants ( name )
          `)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (rows) setWorkOrders(rows.map(normalizeWO));
      } else {
        setWorkOrders([]);
      }
    } catch (err) {
      toast.error('Failed to load work orders: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => { fetchWOs(); }, []);

  const handleStatusChange = async (id, status) => {
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('work_orders').update({
          status,
          ...(status === 'released' ? { released_at: new Date().toISOString() } : {}),
          ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
        }).eq('wo_number', id);
        if (error) throw error;
        writeAuditLog(user?.id, 'work_orders', 'update', { wo_number: id, status });
      }
      // Only update local state after Supabase confirms
      setWorkOrders((prev) => prev.map((wo) => wo.id === id ? { ...wo, status } : wo));
      updateWOStatus(id, status);
      toast.success(`WO ${id} → ${STATUS_LABEL[status] || status}`);
    } catch (err) {
      toast.error('Failed to save. Please try again.');
      // Do NOT update local state on error
    }
  };

  const filtered = useMemo(() =>
    filterStatus === 'all' ? workOrders : workOrders.filter((w) => w.status === filterStatus),
    [workOrders, filterStatus]
  );

  const columns = useMemo(() => [
    { accessorKey: 'wo_number', header: 'WO Number', cell: ({ row }) => <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)', fontSize: 13 }}>{row.original.wo_number || row.original.id}</span> },
    { accessorKey: 'part', header: 'Part / VIN', cell: ({ row }) => <div><div style={{ fontSize: 12 }}>{row.original.part}</div><div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)' }}>{row.original.vin}</div></div> },
    { accessorKey: 'line', header: 'Plant · Line', cell: ({ row }) => <div><div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)' }}>{row.original.plant}</div><div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600 }}>{row.original.line}</div></div> },
    { accessorKey: 'plannedQty', header: 'Planned Qty', cell: ({ getValue }) => <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{getValue()}</span> },
    { accessorKey: 'actualQty', header: 'Actual Qty', cell: ({ getValue }) => <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{getValue()}</span> },
    { accessorKey: 'scrapQty', header: 'Scrap', cell: ({ getValue }) => <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: getValue() > 0 ? 'var(--red)' : 'var(--green)' }}>{getValue()}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <span className={`badge ${STATUS_COLOR[getValue()] || 'badge-gray'}`}>{STATUS_LABEL[getValue()] || getValue()}</span> },
    { accessorKey: 'created', header: 'Created', cell: ({ getValue }) => <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)' }}>{getValue()}</span> },
    { id: 'actions', header: '', cell: ({ row }) => <ChevronRight size={14} color="var(--muted-text)" /> },
  ], []);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const allWOs        = workOrders.length
  const createdCount  = workOrders.filter(w => w.status === 'created').length
  const releasedCount = workOrders.filter(w => w.status === 'released').length
  const inProgCount   = workOrders.filter(w => w.status === 'in_progress').length
  const completedCount= workOrders.filter(w => w.status === 'completed').length
  const closedCount   = workOrders.filter(w => w.status === 'closed').length

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block"><h1 className="page-title">Work Orders</h1><div className="page-subtitle">Production Work Order Management</div></div>
        <div className="page-actions">
          <button className="icon-btn" onClick={fetchWOs} title="Refresh"><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={handleCreateWO}>
            <Plus size={14} /> Create WO
          </button>
        </div>
      </div>

      {/* Summary Chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <div style={{ flex: 1, padding: 12, background: 'var(--bg-surface)', border: `1px solid ${filterStatus === 'all' ? 'var(--bmw-blue)' : 'var(--border)'}`, cursor: 'pointer' }} onClick={() => setFilterStatus('all')}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 700, color: filterStatus === 'all' ? 'var(--bmw-blue)' : 'var(--white)', lineHeight: 1 }}>{allWOs}</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-text)', marginTop: 4 }}>All</div>
        </div>
        {[
          { status: 'created', label: 'CREATED', count: createdCount },
          { status: 'released', label: 'RELEASED', count: releasedCount },
          { status: 'in_progress', label: 'IN PROGRESS', count: inProgCount },
          { status: 'completed', label: 'COMPLETED', count: completedCount },
          { status: 'closed', label: 'CLOSED', count: closedCount }
        ].map(({ status, label, count }) => (
          <div key={status} style={{ flex: 1, padding: 12, background: 'var(--bg-surface)', border: `1px solid ${filterStatus === status ? 'var(--bmw-blue)' : 'var(--border)'}`, cursor: 'pointer' }} onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 700, color: filterStatus === status ? 'var(--bmw-blue)' : 'var(--white)', lineHeight: 1 }}>{count}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-text)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-text)' }} />
          <input className="form-input" placeholder="Search WO, part, VIN..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => { setGlobalFilter(''); setFilterStatus('all'); }}>Clear</button>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)', letterSpacing: '0.1em' }}>{table.getRowModel().rows.length} / {workOrders.length} ORDERS</span>
      </div>

      {/* TanStack Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} onClick={header.column.getToggleSortingHandler()} style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && <ChevronUp size={10} />}
                      {header.column.getIsSorted() === 'desc' && <ChevronDown size={10} />}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              [1,2,3,4].map((i) => <tr key={i}><td colSpan={9}><div style={{ height: 40, background: 'linear-gradient(90deg,#181818,#222,#181818)', animation: 'shimmer 1.5s infinite' }} /></td></tr>)
            ) : table.getRowModel().rows.map((row) => (
              <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(row.original)}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <WODetailModal wo={selected} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} onUpdated={() => { fetchWOs(); setSelected(null); }} />}
      {showCreateWOModal && <CreateWOModal onClose={() => setShowCreateWOModal(false)} onCreated={fetchWOs} />}
    </div>
  );
}
