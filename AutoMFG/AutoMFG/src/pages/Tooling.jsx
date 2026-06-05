// AutoMFG — Tooling & Equipment (Flow 8) — FIXED
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Upload, Wrench, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseConfigured, writeAuditLog } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

const safeUUID = (id) =>
  id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;

const calibrationSchema = z.object({
  tool_id: z.string().min(1, 'Select tool'),
  certificate_link: z.string().min(1, 'Certificate required'),
  next_due: z.string().min(1, 'Next due date required'),
  requires_maintenance: z.boolean().optional(),
});

const addToolSchema = z.object({
  tool_name: z.string().min(2, 'Tool name required'),
  line_id: z.string().optional(),
  max_life: z.coerce.number().min(100, 'Max life cycles required'),
  status: z.enum(['active', 'inactive', 'in_calibration']),
});

function getCalibrationStatus(nextDue) {
  if (!nextDue) return { label: 'UNKNOWN', badge: 'badge-gray', days: null };
  const days = Math.ceil((new Date(nextDue) - new Date()) / 86400000);
  if (days < 0) return { label: 'OVERDUE', badge: 'badge-red', days };
  if (days <= 7) return { label: `${days}d — CRITICAL`, badge: 'badge-red', days };
  if (days <= 15) return { label: `${days}d — WARNING`, badge: 'badge-amber', days };
  if (days <= 30) return { label: `${days}d — NOTICE`, badge: 'badge-amber', days };
  return { label: `${days}d`, badge: 'badge-green', days };
}

function getLifeStatus(cycleCount, maxLife) {
  if (!maxLife) return { pct: 0, badge: 'badge-gray' };
  const pct = (cycleCount / maxLife) * 100;
  if (pct >= 95) return { pct, badge: 'badge-red', label: 'CRITICAL' };
  if (pct >= 80) return { pct, badge: 'badge-amber', label: 'WARNING' };
  return { pct, badge: 'badge-green', label: 'OK' };
}

function CalibrationModal({ tool, onClose, onSaved }) {
  const { user } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(calibrationSchema),
    defaultValues: { tool_id: tool?.id || '', requires_maintenance: false },
  });

  const onSubmit = async (data) => {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('calibration_records').insert({
        tool_id: data.tool_id,
        certificate_link: data.certificate_link,
        next_due: data.next_due,
        calibrated_at: new Date().toISOString(),
        uploaded_by: safeUUID(user?.id), // ✅ FIXED: safeUUID guard
      });
      if (error) { toast.error('Failed: ' + error.message); return; }

      // If calibration is marked as requiring maintenance
      if (data.requires_maintenance) {
        // 1. Insert tool replacement request
        await supabase.from('tool_replacement_requests').insert({
          tool_id: data.tool_id,
          reason: 'Calibration Failed: Requires Maintenance',
          urgency: 'high',
          status: 'open',
          requested_by: safeUUID(user?.id),
          requested_at: new Date().toISOString(),
        });

        // 2. Insert draft SCM purchase requisition
        await supabase.from('purchase_requisitions').insert({
          material_name: `Calibration Service / Parts for tool: ${tool?.name || data.tool_id}`,
          part_code: `TOOL-CAL-${data.tool_id.substring(0, 8).toUpperCase()}`,
          quantity: 1,
          estimated_cost: 15000,
          procurement_type: 'Spare Parts',
          supplier_category: 'Tooling',
          priority: 'Medium',
          status: 'Draft',
          department: 'Production',
          notes: `Auto-generated draft purchase requisition due to failed calibration: Tool ${tool?.name || data.tool_id} (${data.tool_id})`,
          created_by: safeUUID(user?.id)
        });

        toast.success('Maintenance request and draft SCM purchase requisition generated');
      }

      writeAuditLog(safeUUID(user?.id), 'calibration_records', 'insert', { tool_id: data.tool_id, next_due: data.next_due, requires_maintenance: data.requires_maintenance });
    }
    toast.success('Calibration record uploaded');
    onSaved({ tool_id: data.tool_id, next_due: data.next_due });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Upload Calibration Certificate</span><button className="icon-btn" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group"><label className="form-label">Tool ID</label><input className="form-input" {...register('tool_id')} readOnly={!!tool} /></div>
            <div className="form-group">
              <label className="form-label">Certificate Reference / Link</label>
              <input className="form-input" placeholder="e.g. CERT-2026-001" {...register('certificate_link')} />
              {errors.certificate_link && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.certificate_link.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Next Calibration Due</label>
              <input className="form-input" type="date" {...register('next_due')} />
              {errors.next_due && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.next_due.message}</span>}
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input type="checkbox" id="requires_maintenance" {...register('requires_maintenance')} />
              <label htmlFor="requires_maintenance" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
                Requires Maintenance / Calibration Failed
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}><Upload size={12} /> {isSubmitting ? 'Uploading...' : 'Upload Certificate'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddToolModal({ onClose, onSaved }) {
  const { user } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(addToolSchema),
    defaultValues: { status: 'active', max_life: 10000 },
  });

  const onSubmit = async (data) => {
    if (isSupabaseConfigured()) {
      const { data: newTool, error } = await supabase.from('tools').insert({
        tool_name: data.tool_name,
        line_id: data.line_id || null,
        max_life: data.max_life,
        cycle_count: 0,
        status: data.status,
      }).select().single();
      if (error) { toast.error('Failed: ' + error.message); return; }
      writeAuditLog(safeUUID(user?.id), 'tools', 'insert', { tool_name: data.tool_name });
      toast.success(`Tool "${data.tool_name}" registered`);
      onSaved(newTool);
    } else {
      toast.success(`Tool "${data.tool_name}" added (mock mode)`);
      onSaved({ tool_id: `TOOL-${Date.now()}`, tool_name: data.tool_name, max_life: data.max_life, cycle_count: 0, status: data.status });
    }
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Register New Tool</span><button className="icon-btn" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Tool Name</label>
              <input className="form-input" placeholder="e.g. Torque Wrench TW-200" {...register('tool_name')} />
              {errors.tool_name && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.tool_name.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Max Life Cycles</label>
              <input className="form-input" type="number" placeholder="10000" {...register('max_life')} />
              {errors.max_life && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.max_life.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Line / Location (optional)</label>
              <input className="form-input" placeholder="e.g. Assembly Line 1" {...register('line_id')} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="in_calibration">In Calibration</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}><Plus size={12} /> {isSubmitting ? 'Creating...' : 'Register Tool'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Tooling() {
  const { user } = useAuthStore();
  const { tools: mockTools } = useAppStore();
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCalib, setShowCalib] = useState(null);
  const [showAddTool, setShowAddTool] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchTools = async () => {
    setLoading(true);
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('tools')
        .select('*, calibration_records(next_due, calibrated_at)')
        .order('cycle_count', { ascending: false });
      if (error) { toast.error('Failed to load tools: ' + error.message); }
      else if (data) {
        setTools(data.map((t) => ({
          id: t.tool_id,
          name: t.tool_name || t.tool_id,
          type: 'Tool',
          location: t.line_id || 'Unassigned',
          cycleCount: t.cycle_count || 0,
          maxCycles: t.max_life || 10000,
          nextCalibration: t.calibration_records?.[0]?.next_due || null,
          status: t.status || 'active',
        })));
      }
    } else {
      // Fallback to mock tools with clear label
      setTools(mockTools.map((t) => ({
        id: t.id, name: t.name, type: t.type, location: t.location,
        cycleCount: t.cycleCount, maxCycles: t.maxCycles,
        nextCalibration: t.nextCalibration, status: t.status,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchTools(); }, []);

  // ✅ FIXED: Auto-create replacement requests — use INSERT not upsert to avoid FK conflict
  useEffect(() => {
    tools.forEach(async (tool) => {
      const { pct } = getLifeStatus(tool.cycleCount, tool.maxCycles);
      if (pct >= 95 && isSupabaseConfigured()) {
        // Check if open request already exists before inserting
        const { data: existing } = await supabase
          .from('tool_replacement_requests')
          .select('request_id')
          .eq('tool_id', tool.id)
          .eq('status', 'open')
          .single();
        if (!existing) {
          // 1. Insert tool replacement request
          await supabase.from('tool_replacement_requests').insert({
            tool_id: tool.id,
            reason: 'Auto-generated: tool life ≥95%',
            urgency: 'critical',
            status: 'open',
            requested_by: safeUUID(user?.id), // ✅ FIXED: safeUUID guard
            requested_at: new Date().toISOString(),
          });

          // 2. Insert draft SCM purchase requisition
          await supabase.from('purchase_requisitions').insert({
            material_name: `Replacement parts for tool: ${tool.name}`,
            part_code: `TOOL-REP-${tool.id.substring(0, 8).toUpperCase()}`,
            quantity: 1,
            estimated_cost: 25000,
            procurement_type: 'Spare Parts',
            supplier_category: 'Tooling',
            priority: 'High',
            status: 'Draft',
            department: 'Production',
            notes: `Auto-generated draft purchase requisition for tool replacement due to life cycle limit: ${tool.name} (${tool.id})`,
            created_by: safeUUID(user?.id)
          });
          toast.success(`Draft Purchase Requisition generated in SCM for tool: ${tool.name}`);
        }
      }
    });
  }, [tools, user]);

  const handleCalibSaved = (saved) => {
    setTools((prev) => prev.map((t) => t.id === saved.tool_id ? { ...t, nextCalibration: saved.next_due } : t));
  };

  const handleToolAdded = (newTool) => {
    setTools((prev) => [{
      id: newTool.tool_id,
      name: newTool.tool_name,
      type: 'Tool',
      location: newTool.line_id || 'Unassigned',
      cycleCount: 0,
      maxCycles: newTool.max_life || 10000,
      nextCalibration: null,
      status: newTool.status,
    }, ...prev]);
  };

  const filtered = filterStatus === 'all' ? tools : tools.filter((t) => {
    if (filterStatus === 'critical') { const { pct } = getLifeStatus(t.cycleCount, t.maxCycles); return pct >= 95; }
    if (filterStatus === 'warning') { const { pct } = getLifeStatus(t.cycleCount, t.maxCycles); return pct >= 80 && pct < 95; }
    if (filterStatus === 'calib_due') { const { days } = getCalibrationStatus(t.nextCalibration); return days !== null && days <= 30; }
    return true;
  });

  const critCount = tools.filter((t) => getLifeStatus(t.cycleCount, t.maxCycles).pct >= 95).length;
  const warnCount = tools.filter((t) => { const { pct } = getLifeStatus(t.cycleCount, t.maxCycles); return pct >= 80 && pct < 95; }).length;
  const calibDue = tools.filter((t) => { const { days } = getCalibrationStatus(t.nextCalibration); return days !== null && days <= 30; }).length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block"><h1 className="page-title">Tooling & Equipment</h1><div className="page-subtitle">Tool Register, Life Monitoring & Calibration</div></div>
        <div className="page-actions">
          <button className="icon-btn" onClick={fetchTools}><RefreshCw size={14} /></button>
          <button className="btn btn-outline" onClick={() => setShowCalib({ id: '' })}><Upload size={14} /> Upload Calibration</button>
          <button className="btn btn-primary" onClick={() => setShowAddTool(true)}><Plus size={14} /> Add Tool</button>
        </div>
      </div>

      <div className="grid grid-4 mb-16">
        {[
          { label: 'Total Tools', value: tools.length, color: 'white' },
          { label: 'Critical (≥95%)', value: critCount, color: critCount > 0 ? 'red' : 'green' },
          { label: 'Warning (≥80%)', value: warnCount, color: warnCount > 0 ? 'amber' : 'green' },
          { label: 'Calibration Due', value: calibDue, color: calibDue > 0 ? 'amber' : 'green' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card"><div className="metric-label">{label}</div><div className={`metric-value ${color}`} style={{ fontSize: 32 }}>{value}</div></div>
        ))}
      </div>

      <div className="tabs">
        {[{ id: 'all', label: 'All Tools' }, { id: 'critical', label: `Critical (${critCount})` }, { id: 'warning', label: `Warning (${warnCount})` }, { id: 'calib_due', label: `Calib Due (${calibDue})` }].map((f) => (
          <button key={f.id} className={`tab-btn ${filterStatus === f.id ? 'active' : ''}`} onClick={() => setFilterStatus(f.id)}>{f.label}</button>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Tool Register</span><span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>{filtered.length} TOOLS</span></div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Tool ID</th><th>Name</th><th>Location</th><th>Life Used</th><th>Cycles</th><th>Calibration Due</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? [1, 2, 3].map((i) => <tr key={i}><td colSpan={7}><div style={{ height: 40, background: 'linear-gradient(90deg,#181818,#222,#181818)', animation: 'shimmer 1.5s infinite' }} /></td></tr>)
                : filtered.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>No tools registered</td></tr>
                  : filtered.map((tool) => {
                    const life = getLifeStatus(tool.cycleCount, tool.maxCycles);
                    const calib = getCalibrationStatus(tool.nextCalibration);
                    return (
                      <tr key={tool.id}>
                        <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)', fontSize: 13 }}>{tool.id?.slice?.(0, 8) || tool.id}</td>
                        <td style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>{tool.name}</td>
                        <td style={{ fontFamily: 'var(--font-heading)', fontSize: 12 }}>{tool.location}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                              <div style={{ height: '100%', width: `${Math.min(life.pct, 100)}%`, background: life.pct >= 95 ? 'var(--red)' : life.pct >= 80 ? 'var(--amber)' : 'var(--green)', transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 600, color: life.pct >= 95 ? 'var(--red)' : life.pct >= 80 ? 'var(--amber)' : 'var(--green)', minWidth: 40 }}>{life.pct.toFixed(0)}%</span>
                            {life.pct >= 80 && <span className={`badge ${life.badge}`}>{life.label}</span>}
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-heading)', fontSize: 12 }}>{tool.cycleCount?.toLocaleString()} / {tool.maxCycles?.toLocaleString()}</td>
                        <td><span className={`badge ${calib.badge}`}>{calib.label}</span></td>
                        <td>
                          <button className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); setShowCalib(tool); }}>
                            <Upload size={10} /> Calibrate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {showCalib && <CalibrationModal tool={showCalib} onClose={() => setShowCalib(null)} onSaved={handleCalibSaved} />}
      {showAddTool && <AddToolModal onClose={() => setShowAddTool(false)} onSaved={handleToolAdded} />}
    </div>
  );
}
