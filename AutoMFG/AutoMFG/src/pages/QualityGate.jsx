// AutoMFG — Quality Gate (Flow 5) — FIXED
// Inspections, Defects, Dispositions, UAI approvals, Batch holds
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Shield, AlertTriangle, Check, X } from 'lucide-react';
import { supabase, isSupabaseConfigured, writeAuditLog } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const safeUUID = (id) =>
  id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;

const inspSchema = z.object({
  wo_number: z.string().min(1, 'WO required'),
  characteristic: z.string().min(1, 'Characteristic required'),
  measurement: z.coerce.number(),
  usl: z.coerce.number(),
  lsl: z.coerce.number(),
});

const defectSchema = z.object({
  wo_number: z.string().min(1, 'WO required'),
  defect_type: z.string().min(1, 'Defect type required'),
  qty: z.coerce.number().min(1),
  disposition: z.enum(['scrap', 'rework', 'uai', 'pending']),
});

const DISPOSITION_COLOR = { scrap: 'badge-red', rework: 'badge-amber', uai: 'badge-blue', pending: 'badge-gray' };
const RESULT_COLOR = { pass: 'badge-green', fail: 'badge-red', pending: 'badge-gray' };

// ─── Add Inspection Modal ────────────────────────────────────────────────────
function AddInspectionModal({ onClose, onSaved, workOrders = [] }) {
  const { user } = useAuthStore();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(inspSchema) });
  const measurement = watch('measurement');
  const usl = watch('usl');
  const lsl = watch('lsl');
  const isNOK = measurement !== undefined && usl !== undefined && lsl !== undefined && (Number(measurement) > Number(usl) || Number(measurement) < Number(lsl));

  const onSubmit = async (data) => {
    if (!isSupabaseConfigured()) {
      toast.error('Supabase not configured');
      return;
    }

    const result = Number(data.measurement) > Number(data.usl) || Number(data.measurement) < Number(data.lsl) ? 'fail' : 'pass';
    const inspectorId = safeUUID(user?.id);

    try {
      const { data: ins, error: inspError } = await supabase
        .from('quality_inspections')
        .insert({
          wo_number: data.wo_number,
          control_plan_ref: 'CP-001',
          result,
          inspected_at: new Date().toISOString(),
          inspector_id: inspectorId, // ✅ FIXED: safeUUID guard
        })
        .select()
        .single();

      if (inspError) throw inspError;

      const { error: checkError } = await supabase.from('inspection_checks').insert({
        inspection_id: ins.inspection_id,
        characteristic: data.characteristic,
        measurement: Number(data.measurement),
        usl: Number(data.usl),
        lsl: Number(data.lsl),
        status: result === 'fail' ? 'nok' : 'ok',
      });

      if (checkError) throw checkError;

      if (result === 'fail') {
        await supabase.from('batch_holds').insert({
          inspection_id: ins.inspection_id,
          reason: `NOK measurement: ${data.characteristic}`,
          status: 'active',
          held_at: new Date().toISOString(),
        });
        toast.error('Inspection FAIL — Batch hold created');
      } else {
        toast.success('Inspection recorded — PASS');
      }

      writeAuditLog(inspectorId, 'quality_inspections', 'insert', { wo_number: data.wo_number, result });
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to save inspection: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Record Inspection</span><button className="icon-btn" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Work Order</label>
              {workOrders.length > 0 ? (
                <select className="form-select" {...register('wo_number')} required>
                  <option value="">Select Work Order...</option>
                  {workOrders.map((w) => <option key={w.wo_number} value={w.wo_number}>{w.wo_number}</option>)}
                </select>
              ) : (
                <input className="form-input" placeholder="e.g. WO-2024-0001" {...register('wo_number')} required />
              )}
              {errors.wo_number && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.wo_number.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Characteristic</label>
              <input className="form-input" placeholder="e.g. Gap Flush LH Fender" {...register('characteristic')} />
              {errors.characteristic && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.characteristic.message}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="form-label">Measurement</label><input className="form-input" type="number" step="0.001" {...register('measurement')} /></div>
              <div className="form-group"><label className="form-label">USL</label><input className="form-input" type="number" step="0.001" {...register('usl')} /></div>
              <div className="form-group"><label className="form-label">LSL</label><input className="form-input" type="number" step="0.001" {...register('lsl')} /></div>
            </div>
            {isNOK && <div style={{ padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid var(--red)' }}><span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--red)', letterSpacing: '0.08em' }}>⚠ Measurement OUT OF TOLERANCE — will create batch hold</span></div>}
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>Record Inspection</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Log Defect Modal ────────────────────────────────────────────────────────
function LogDefectModal({ onClose, onSaved, workOrders = [] }) {
  const { user } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(defectSchema), defaultValues: { disposition: 'pending' } });

  const onSubmit = async (data) => {
    if (!isSupabaseConfigured()) {
      toast.error('Supabase not configured');
      return;
    }

    const userId = safeUUID(user?.id);
    try {
      const { data: inserted, error } = await supabase.from('defect_records').insert({
        wo_number: data.wo_number,
        defect_type: data.defect_type,
        qty: Number(data.qty),
        disposition: data.disposition,
        logged_by: userId, // ✅ FIXED: safeUUID guard
        logged_at: new Date().toISOString(),
      }).select('defect_id').single();

      if (error) throw error;

      // ✅ AUTO-CREATE UAI Record if disposition is UAI
      if (data.disposition === 'uai' && inserted) {
        await supabase.from('uai_approvals').insert({
          defect_id: inserted.defect_id,
          status: 'pending_qe',
        });
      }

      writeAuditLog(userId, 'defect_records', 'insert', { defect_id: inserted?.defect_id, wo_number: data.wo_number });
      toast.success('Defect logged');
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to log defect: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Log Defect</span><button className="icon-btn" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Work Order</label>
              {workOrders.length > 0 ? (
                <select className="form-select" {...register('wo_number')} required>
                  <option value="">Select Work Order...</option>
                  {workOrders.map((w) => <option key={w.wo_number} value={w.wo_number}>{w.wo_number}</option>)}
                </select>
              ) : (
                <input className="form-input" placeholder="e.g. WO-2024-0001" {...register('wo_number')} required />
              )}
              {errors.wo_number && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.wo_number.message}</span>}
            </div>
            <div className="form-group"><label className="form-label">Defect Type</label><input className="form-input" placeholder="e.g. Surface Scratch" {...register('defect_type')} />{errors.defect_type && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.defect_type.message}</span>}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="form-label">Quantity</label><input className="form-input" type="number" {...register('qty')} /></div>
              <div className="form-group">
                <label className="form-label">Disposition</label>
                <select className="form-select" {...register('disposition')}><option value="pending">Pending</option><option value="scrap">Scrap</option><option value="rework">Rework</option><option value="uai">UAI</option></select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>Log Defect</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function QualityGate() {
  const { user } = useAuthStore();
  const [inspections, setInspections] = useState([]);
  const [defects, setDefects] = useState([]);
  const [uaiApprovals, setUaiApprovals] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('inspections');
  const [showAddInsp, setShowAddInsp] = useState(false);
  const [showLogDefect, setShowLogDefect] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchInspections = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('quality_inspections').select('*, inspection_checks(*)').order('inspected_at', { ascending: false }).limit(50);
    if (data) setInspections(data.map((i) => ({ ...i, checks: i.inspection_checks || [] })));
  };

  const fetchDefects = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('defect_records').select('*').order('logged_at', { ascending: false }).limit(50);
    if (data) setDefects(data);
  };

  const fetchUaiApprovals = async () => {
    if (!isSupabaseConfigured()) return;
    // Join defect_records to see which defect it belongs to
    const { data } = await supabase.from('uai_approvals').select('*, defect_records(wo_number, defect_type, qty)').order('status');
    if (data) setUaiApprovals(data);
  };

  const fetchWorkOrders = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('work_orders').select('wo_number').order('created_at', { ascending: false });
    if (data) setWorkOrders(data);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchInspections(), fetchDefects(), fetchUaiApprovals(), fetchWorkOrders()]);
    } catch (err) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleUaiApprove = async (uaiId, currentStatus) => {
    if (!isSupabaseConfigured()) return;
    const userId = safeUUID(user?.id);
    let nextStatus = 'approved';
    let updatePayload = {};

    if (currentStatus === 'pending_qe') {
      nextStatus = 'pending_qm';
      updatePayload = { qe_approved_by: userId, qe_approved_at: new Date().toISOString(), status: nextStatus };
    } else if (currentStatus === 'pending_qm') {
      nextStatus = 'approved';
      updatePayload = { qm_approved_by: userId, qm_approved_at: new Date().toISOString(), status: nextStatus };
    }

    try {
      const { error } = await supabase.from('uai_approvals').update(updatePayload).eq('uai_id', uaiId);
      if (error) throw error;

      // If fully approved, we update the main defect record to UAI
      if (nextStatus === 'approved') {
        const uaiRec = uaiApprovals.find(u => u.uai_id === uaiId);
        if (uaiRec) {
          await supabase.from('defect_records').update({ disposition: 'uai' }).eq('defect_id', uaiRec.defect_id);
        }
      }

      toast.success(`UAI workflow advanced: ${nextStatus.replace('_', ' ').toUpperCase()}`);
      fetchAll();
    } catch (err) {
      toast.error('Failed: ' + err.message);
    }
  };

  const handleUaiReject = async (uaiId) => {
    if (!isSupabaseConfigured()) return;
    try {
      const { error } = await supabase.from('uai_approvals').update({ status: 'rejected' }).eq('uai_id', uaiId);
      if (error) throw error;
      toast.error('UAI Request Rejected');
      fetchAll();
    } catch (err) {
      toast.error('Failed to reject: ' + err.message);
    }
  };

  const passCount = inspections.filter((i) => i.result === 'pass').length;
  const failCount = inspections.filter((i) => i.result === 'fail').length;
  const fpy = inspections.length > 0 ? ((passCount / inspections.length) * 100).toFixed(1) : '—';

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block"><h1 className="page-title">Quality Gate</h1><div className="page-subtitle">Inspection Entry, Defect Logging &amp; Disposition</div></div>
        <div className="page-actions">
          <button className="icon-btn" onClick={fetchAll}><RefreshCw size={14} /></button>
          <button className="btn btn-outline" onClick={() => setShowLogDefect(true)}><Plus size={14} /> Log Defect</button>
          <button className="btn btn-primary" onClick={() => setShowAddInsp(true)}><Shield size={14} /> Record Inspection</button>
        </div>
      </div>

      <div className="grid grid-4 mb-16">
        {[
          { label: 'Total Inspections', value: inspections.length, color: 'white' },
          { label: 'Pass', value: passCount, color: 'green' },
          { label: 'Fail / Hold', value: failCount, color: 'red' },
          { label: 'First Pass Yield', value: fpy !== '—' ? `${fpy}%` : '—', color: fpy >= 95 ? 'green' : fpy >= 85 ? 'amber' : 'red' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card"><div className="metric-label">{label}</div><div className={`metric-value ${color}`} style={{ fontSize: 32 }}>{value}</div></div>
        ))}
      </div>

      <div className="tabs">
        {[
          { id: 'inspections', label: 'Inspections' },
          { id: 'defects', label: 'Defects & Disposition' },
          { id: 'uai', label: `UAI Approvals (${uaiApprovals.filter(u => ['pending_qe', 'pending_qm'].includes(u.status)).length})` }
        ].map((t) => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'inspections' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Inspection Records</span></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Inspection ID</th><th>Work Order</th><th>Control Plan</th><th>Checks</th><th>Result</th><th>Inspected At</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{ textAlign: 'center' }}>Loading...</td></tr> : inspections.map((insp) => (
                  <tr key={insp.inspection_id}>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)', fontSize: 13 }}>{insp.inspection_id?.slice(0, 8)}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontSize: 12 }}>{insp.wo_number}</td>
                    <td style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)' }}>{insp.control_plan_ref || '—'}</td>
                    <td>
                      {(insp.checks || []).map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span className={`badge ${c.status === 'ok' ? 'badge-green' : 'badge-red'}`}>{c.status?.toUpperCase()}</span>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)' }}>{c.characteristic}: {c.measurement}</span>
                        </div>
                      ))}
                    </td>
                    <td><span className={`badge ${RESULT_COLOR[insp.result] || 'badge-gray'}`}>{(insp.result || 'pending').toUpperCase()}</span></td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)' }}>{insp.inspected_at?.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'defects' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Defect Records &amp; Disposition</span></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Defect ID</th><th>Work Order</th><th>Defect Type</th><th>Qty</th><th>Disposition</th><th>Logged At</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{ textAlign: 'center' }}>Loading...</td></tr> : defects.map((def) => (
                  <tr key={def.defect_id}>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)', fontSize: 13 }}>{def.defect_id?.slice(0, 8)}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontSize: 12 }}>{def.wo_number}</td>
                    <td style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>{def.defect_type || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--red)' }}>{def.qty}</td>
                    <td><span className={`badge ${DISPOSITION_COLOR[def.disposition] || 'badge-gray'}`}>{(def.disposition || 'pending').toUpperCase()}</span></td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)' }}>{def.logged_at?.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'uai' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Use-As-Is (UAI) Multi-Level Approvals</span></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>UAI ID</th><th>Defect Info</th><th>Status</th><th>QE Approval</th><th>QM Approval</th><th>Actions</th></tr></thead>
              <tbody>
                {uaiApprovals.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted-text)' }}>No UAI approval records</td></tr>
                ) : uaiApprovals.map((uai) => {
                  const isQEPending = uai.status === 'pending_qe';
                  const isQMPending = uai.status === 'pending_qm';
                  const isQM = ['plant_manager', 'production_manager', 'sys_admin'].includes(user?.role);
                  const isQE = ['quality_inspector', 'production_manager', 'sys_admin'].includes(user?.role);

                  return (
                    <tr key={uai.uai_id}>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)' }}>{uai.uai_id?.slice(0, 8)}</td>
                      <td>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--white)' }}>WO: {uai.defect_records?.wo_number}</div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)' }}>{uai.defect_records?.defect_type} (qty: {uai.defect_records?.qty})</div>
                      </td>
                      <td><span className={`badge ${uai.status === 'approved' ? 'badge-green' : uai.status === 'rejected' ? 'badge-red' : 'badge-amber'}`}>{uai.status?.toUpperCase().replace('_', ' ')}</span></td>
                      <td style={{ fontSize: 11 }}>{uai.qe_approved_at ? `✓ approved` : 'Pending QE'}</td>
                      <td style={{ fontSize: 11 }}>{uai.qm_approved_at ? `✓ approved` : 'Pending QM'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {isQEPending && isQE && (
                            <>
                              <button className="btn btn-sm btn-primary" onClick={() => handleUaiApprove(uai.uai_id, 'pending_qe')}><Check size={10} /> Approve QE</button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleUaiReject(uai.uai_id)}><X size={10} /> Reject</button>
                            </>
                          )}
                          {isQMPending && isQM && (
                            <>
                              <button className="btn btn-sm btn-primary" onClick={() => handleUaiApprove(uai.uai_id, 'pending_qm')}><Check size={10} /> Approve QM</button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleUaiReject(uai.uai_id)}><X size={10} /> Reject</button>
                            </>
                          )}
                          {!isQEPending && !isQMPending && <span style={{ fontSize: 11, color: 'var(--muted-text)' }}>Finalized</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddInsp && <AddInspectionModal onClose={() => setShowAddInsp(false)} onSaved={fetchAll} workOrders={workOrders} />}
      {showLogDefect && <LogDefectModal onClose={() => setShowLogDefect(false)} onSaved={fetchAll} workOrders={workOrders} />}
    </div>
  );
}
