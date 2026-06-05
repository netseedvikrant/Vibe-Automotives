// AutoMFG — Scrap & Rework Management (Quality Flow 5 — disposition tracking) — FIXED
import { useState, useEffect, Fragment } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { RefreshCw, FileText, ChevronDown, ChevronRight, Play, CheckCircle2, AlertOctagon, UserPlus } from 'lucide-react';
import { supabase, isSupabaseConfigured, writeAuditLog } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

const DISPOSITION_COLOR = { scrap: 'badge-red', rework: 'badge-amber', uai: 'badge-blue', pending: 'badge-gray' };

const safeUUID = (id) =>
  id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;

// ─── Scrap Certificate PDF ───────────────────────────────────────────────────
const scrapPdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#d4261c', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#666', marginBottom: 24, borderBottom: '1px solid #eee', paddingBottom: 12 },
  row: { flexDirection: 'row', paddingVertical: 6, borderBottom: '1px solid #f5f5f5' },
  label: { flex: 1, fontSize: 10, color: '#555' },
  value: { flex: 2, fontSize: 10, color: '#111', fontWeight: 'bold' },
  footer: { marginTop: 30, fontSize: 9, color: '#999' },
});

function ScrapCertPDF({ defect }) {
  return (
    <Document>
      <Page size="A4" style={scrapPdfStyles.page}>
        <Text style={scrapPdfStyles.title}>SCRAP CERTIFICATE</Text>
        <Text style={scrapPdfStyles.subtitle}>AutoMFG Manufacturing Suite — {new Date().toLocaleDateString('en-GB')}</Text>
        {[
          { label: 'Defect ID', value: defect.defect_id },
          { label: 'Work Order', value: defect.wo_number },
          { label: 'Part Number', value: defect.work_orders?.part_number || defect.wo_number },
          { label: 'Defect Type', value: defect.defect_type || '—' },
          { label: 'Quantity Scrapped', value: String(defect.qty) },
          { label: 'Cost Impact', value: (() => { const c = Array.isArray(defect.scrap_certificates) && defect.scrap_certificates[0]?.cost_impact; return c ? `₹${c.toLocaleString()}` : 'TBD'; })() },
          { label: 'Date', value: defect.logged_at?.slice(0, 10) },
        ].map(({ label, value }) => (
          <View key={label} style={scrapPdfStyles.row}>
            <Text style={scrapPdfStyles.label}>{label}</Text>
            <Text style={scrapPdfStyles.value}>{value}</Text>
          </View>
        ))}
        <Text style={scrapPdfStyles.footer}>This scrap certificate is system-generated and requires Quality Manager authorization.</Text>
      </Page>
    </Document>
  );
}

// ─── RCA Modal ───────────────────────────────────────────────────────────────
const rcaSchema = z.object({
  method: z.enum(['5why', 'ishikawa']),
  root_cause: z.string().min(10, 'Describe the root cause'),
  corrective_action: z.string().min(10, 'Describe corrective action'),
  owner: z.string().min(1, 'Assign owner'),
  due_date: z.string().min(1, 'Due date required'),
});

function RCAModal({ defect, onClose, onSaved }) {
  const { user } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(rcaSchema),
    defaultValues: { method: '5why' },
  });

  const onSubmit = async (data) => {
    if (!isSupabaseConfigured()) {
      toast.error('Supabase not configured');
      return;
    }

    const { data: rca, error: rcaError } = await supabase
      .from('root_cause_analyses')
      .insert({
        source_type: 'defect',
        source_id: defect.defect_id,
        method: data.method,
        root_cause: data.root_cause,
        created_by: safeUUID(user?.id),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (rcaError) {
      toast.error('Failed to create RCA: ' + rcaError.message);
      return;
    }

    const { error: caError } = await supabase.from('corrective_actions').insert({
      rca_id: rca.rca_id,
      description: data.corrective_action,
      due_date: data.due_date,
      owner_id: safeUUID(user?.id),
      status: 'open',
    });

    if (caError) {
      toast.error('RCA saved but corrective action failed: ' + caError.message);
    } else {
      toast.success('RCA and corrective action recorded');
    }

    if (safeUUID(user?.id)) writeAuditLog(safeUUID(user.id), 'root_cause_analyses', 'insert', { defect_id: defect.defect_id });
    onSaved();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header"><span className="modal-title">Root Cause Analysis — {defect.defect_id?.slice(0, 8)}</span><button className="icon-btn" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>{defect.wo_number} — {defect.defect_type || 'N/A'} ({defect.qty} pcs)</div>
            </div>
            <div className="form-group">
              <label className="form-label">RCA Method</label>
              <select className="form-select" {...register('method')}><option value="5why">5 Why</option><option value="ishikawa">Ishikawa (Fishbone)</option></select>
            </div>
            <div className="form-group">
              <label className="form-label">Root Cause</label>
              <textarea className="form-textarea" placeholder="Describe the root cause..." {...register('root_cause')} rows={3} />
              {errors.root_cause && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.root_cause.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Corrective Action</label>
              <textarea className="form-textarea" placeholder="Describe the corrective action..." {...register('corrective_action')} rows={3} />
              {errors.corrective_action && <span style={{ color: 'var(--red)', fontSize: 11 }}>{errors.corrective_action.message}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="form-label">Action Owner</label><input className="form-input" placeholder="Name" {...register('owner')} /></div>
              <div className="form-group"><label className="form-label">Due Date</label><input className="form-input" type="date" {...register('due_date')} /></div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>Submit RCA</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Scrap Cost Impact Modal ────────────────────────────────────────────────
function ScrapCostModal({ onClose, onSubmit, suppliers = [] }) {
  const [cost, setCost] = useState(5000);
  const [supplierId, setSupplierId] = useState('');
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <span className="modal-title">Scrap Cost Impact</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Cost Impact (₹)</label>
            <input className="form-input" type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label className="form-label">Attributed to Supplier? (Optional)</label>
            <select 
              className="form-select" 
              value={supplierId} 
              onChange={(e) => setSupplierId(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
            >
              <option value="">-- No Supplier (Internal / Raw Material OK) --</option>
              {suppliers.map(s => (
                <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSubmit(cost, supplierId || null)}>Confirm Scrap</button>
        </div>
      </div>
    </div>
  );
}

const CA_STATUS_COLOR = { open: 'badge-amber', in_progress: 'badge-blue', closed: 'badge-green', overdue: 'badge-red' };

// ─── RCA Tracker Tab ─────────────────────────────────────────────────────────
function RCATrackerTab({ rcas, loading, onUpdateCAStatus }) {
  const [expandedRca, setExpandedRca] = useState(null);
  const today = new Date().toISOString().slice(0, 10);

  if (loading) {
    return (
      <div className="card">
        <div className="card-header"><span className="card-title">RCA &amp; Corrective Actions</span></div>
        <div style={{ padding: 24 }}>
          {[1, 2].map((i) => <div key={i} style={{ height: 48, background: 'linear-gradient(90deg,#181818,#222,#181818)', marginBottom: 8, animation: 'shimmer 1.5s infinite' }} />)}
        </div>
      </div>
    );
  }

  if (rcas.length === 0) {
    return (
      <div className="card">
        <div className="card-header"><span className="card-title">RCA &amp; Corrective Actions</span></div>
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)', letterSpacing: '0.1em' }}>
            No RCAs created yet — log a defect and click RCA from the Defect Register tab
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">RCA &amp; Corrective Actions</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>{rcas.length} RCAs</span>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>RCA ID</th>
              <th>Source Defect</th>
              <th>Method</th>
              <th>Root Cause</th>
              <th>CAs</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {rcas.map((rca) => {
              const isExpanded = expandedRca === rca.rca_id;
              const cas = rca.corrective_actions || [];
              return (
                <Fragment key={rca.rca_id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedRca(isExpanded ? null : rca.rca_id)}>
                    <td>
                      {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--muted-text)' }} /> : <ChevronRight size={14} style={{ color: 'var(--muted-text)' }} />}
                    </td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)', fontSize: 13 }}>{rca.rca_id?.slice(0, 8)}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontSize: 12 }}>{rca.source_id?.slice(0, 8) || '—'}</td>
                    <td><span className="badge badge-blue" style={{ textTransform: 'uppercase' }}>{rca.method}</span></td>
                    <td style={{ fontFamily: 'var(--font-body)', fontSize: 12, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rca.root_cause}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)' }}>{cas.length}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)' }}>{rca.created_at?.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} style={{ padding: 0, background: 'var(--bg-elevated)' }}>
                        <div style={{ padding: '12px 24px' }}>
                          {cas.length === 0 ? (
                            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)', padding: '8px 0' }}>No corrective actions linked to this RCA.</div>
                          ) : (
                            <table style={{ width: '100%' }}>
                              <thead>
                                <tr>
                                  <th style={{ fontSize: 10 }}>CA ID</th>
                                  <th style={{ fontSize: 10 }}>Description</th>
                                  <th style={{ fontSize: 10 }}>Due Date</th>
                                  <th style={{ fontSize: 10 }}>Status</th>
                                  <th style={{ fontSize: 10 }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cas.map((ca) => {
                                  const isOverdue = ca.due_date < today && ca.status !== 'closed';
                                  const displayStatus = isOverdue ? 'overdue' : ca.status;
                                  return (
                                    <tr key={ca.ca_id}>
                                      <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--white)' }}>{ca.ca_id?.slice(0, 8)}</td>
                                      <td style={{ fontFamily: 'var(--font-body)', fontSize: 11 }}>{ca.description}</td>
                                      <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: isOverdue ? 'var(--red)' : 'var(--text-secondary)' }}>{ca.due_date}</td>
                                      <td><span className={`badge ${CA_STATUS_COLOR[displayStatus] || 'badge-gray'}`}>{displayStatus.replace('_', ' ').toUpperCase()}</span></td>
                                      <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                          {ca.status !== 'in_progress' && ca.status !== 'closed' && (
                                            <button className="btn btn-sm btn-outline" style={{ fontSize: 9 }} onClick={() => onUpdateCAStatus(ca.ca_id, 'in_progress')}>In Progress</button>
                                          )}
                                          {ca.status !== 'closed' && (
                                            <button className="btn btn-sm btn-outline" style={{ fontSize: 9 }} onClick={() => onUpdateCAStatus(ca.ca_id, 'closed')}>Close</button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ScrapRework() {
  const { user } = useAuthStore();
  const [defects, setDefects] = useState([]);
  const [rcas, setRcas] = useState([]);
  const [reworkOrders, setReworkOrders] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rcaLoading, setRcaLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('defects');
  const [filterDisposition, setFilterDisposition] = useState('all');
  const [rcaTarget, setRcaTarget] = useState(null);
  const [scrapCostTarget, setScrapCostTarget] = useState(null);
  const [suppliers, setSuppliers] = useState([]);

  const getParetoData = () => {
    const groups = {};
    let totalQty = 0;
    
    const sourceData = defects.length > 0 ? defects : [
      { defect_type: 'Surface Scratch', qty: 15 },
      { defect_type: 'Dimensional OOT', qty: 10 },
      { defect_type: 'Porosity', qty: 6 },
      { defect_type: 'Color Deviation', qty: 4 },
      { defect_type: 'Weld Crack', qty: 2 }
    ];

    sourceData.forEach(d => {
      const type = d.defect_type || 'Unknown / General';
      const q = Number(d.qty) || 1;
      groups[type] = (groups[type] || 0) + q;
      totalQty += q;
    });

    if (totalQty === 0) return [];

    const sorted = Object.keys(groups)
      .map(type => ({ defect_type: type, qty: groups[type] }))
      .sort((a, b) => b.qty - a.qty);

    let cumulativeSum = 0;
    return sorted.map(item => {
      cumulativeSum += item.qty;
      const cumulativePercentage = parseFloat(((cumulativeSum / totalQty) * 100).toFixed(1));
      return {
        defect_type: item.defect_type,
        qty: item.qty,
        cumulativePercentage
      };
    });
  };

  const fetchDefectRegister = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('defect_records')
        .select(`
          defect_id,
          wo_number,
          qty,
          disposition,
          logged_at,
          logged_by,
          defect_type,
          scrap_certificates ( cost_impact )
        `)
        .order('logged_at', { ascending: false });

      if (error) throw error;
      setDefects(data || []);
    } catch (e) {
      toast.error('Failed to load defects: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRCAs = async () => {
    if (!isSupabaseConfigured()) return;
    setRcaLoading(true);
    try {
      const { data } = await supabase
        .from('root_cause_analyses')
        .select('*, corrective_actions (*)')
        .order('created_at', { ascending: false });
      if (data) setRcas(data);
    } finally {
      setRcaLoading(false);
    }
  };

  const fetchReworkOrders = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data } = await supabase
        .from('rework_orders')
        .select('*, defect_records(*)')
        .order('start_time', { ascending: false, nullsFirst: true });
      if (data) setReworkOrders(data);
    } catch (e) {
      console.warn('[ScrapRework] Rework fetch error:', e.message);
    }
  };

  const fetchOperators = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data } = await supabase.from('profiles').select('id, display_name, username').order('display_name');
      if (data) setOperators(data);
    } catch (e) {
      console.warn('[ScrapRework] Operators fetch error:', e.message);
    }
  };

  const fetchSuppliers = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data } = await supabase.from('suppliers').select('supplier_id, supplier_name');
      if (data) setSuppliers(data);
    } catch (e) {
      console.warn('[ScrapRework] Suppliers fetch error:', e.message);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchDefectRegister(), fetchRCAs(), fetchReworkOrders(), fetchOperators(), fetchSuppliers()]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleUpdateDisposition = async (defectId, disposition, cost = 0, supplierId = null) => {
    if (!isSupabaseConfigured()) {
      toast.error('Supabase not configured');
      return;
    }

    try {
      const updatePayload = { disposition };
      if (supplierId) {
        updatePayload.supplier_id = supplierId;
      }

      const { error } = await supabase
        .from('defect_records')
        .update(updatePayload)
        .eq('defect_id', defectId);

      if (error) throw error;

      if (disposition === 'scrap') {
        await supabase.from('scrap_certificates').insert({
          defect_id: defectId,
          cost_impact: cost,
          issued_by: safeUUID(user?.id),
          issued_at: new Date().toISOString(),
        });

        // Bridge 3: Scrap-to-CAPA Flow
        if (supplierId) {
          // Fetch all scrap defects for this supplier to recalculate Quality Score
          const { data: supplierScraps } = await supabase
            .from('defect_records')
            .select('defect_id')
            .eq('supplier_id', supplierId)
            .eq('disposition', 'scrap');

          const scrapCount = supplierScraps ? supplierScraps.length : 0;
          const newScore = Math.max(0, 100 - (scrapCount * 5));

          // Update supplier's quality score in suppliers table
          await supabase
            .from('suppliers')
            .update({ quality_score: newScore })
            .eq('supplier_id', supplierId);

          // If Quality Score falls below 90%, generate CAPA notification
          if (newScore < 90) {
            const supplierObj = suppliers.find(s => s.supplier_id === supplierId);
            const supplierName = supplierObj ? supplierObj.supplier_name : 'Unknown Supplier';

            await supabase.from('notifications').insert({
              user_role: 'supplier_quality_engineer',
              title: `CAPA Required: ${supplierName}`,
              message: `Quality Score for ${supplierName} has dropped to ${newScore}%. Immediate corrective action is required.`,
              priority: 'High',
              read_status: false
            });
            toast.success(`CAPA notification triggered for SQE (Quality Score: ${newScore}%)`);
          }
        }
      }

      if (disposition === 'rework') {
        await supabase.from('rework_orders').insert({
          defect_id: defectId,
          status: 'open',
        });
      }

      if (disposition === 'uai') {
        await supabase.from('uai_approvals').insert({
          defect_id: defectId,
          status: 'pending_qe',
        });
      }

      if (safeUUID(user?.id)) writeAuditLog(safeUUID(user.id), 'defect_records', 'update', { defect_id: defectId, disposition, supplier_id: supplierId });
      toast.success(`Disposition set: ${disposition.toUpperCase()}`);
      fetchAll();
    } catch (err) {
      toast.error('Failed to update: ' + err.message);
    }
  };

  const handleUpdateCAStatus = async (caId, newStatus) => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from('corrective_actions').update({ status: newStatus }).eq('ca_id', caId);
    if (!error) {
      fetchRCAs();
    } else {
      toast.error('Failed to update CA status');
    }
  };

  // ─── Rework Order updates ──────────────────────────────────────────────────
  const handleAssignRework = async (reworkId, operatorId) => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from('rework_orders').update({ assigned_operator: safeUUID(operatorId) }).eq('rework_id', reworkId);
    if (!error) {
      toast.success('Operator assigned');
      fetchReworkOrders();
    } else {
      toast.error('Failed to assign operator');
    }
  };

  const handleStartRework = async (reworkId) => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from('rework_orders').update({ status: 'in_progress', start_time: new Date().toISOString() }).eq('rework_id', reworkId);
    if (!error) {
      toast.success('Rework started');
      fetchReworkOrders();
    }
  };

  const handleCompleteRework = async (reworkId, defectId) => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from('rework_orders').update({ status: 'completed', end_time: new Date().toISOString() }).eq('rework_id', reworkId);
    if (!error) {
      // Automatically resolve disposition back to PASS or Rework-resolved
      await supabase.from('defect_records').update({ disposition: 'pending' }).eq('defect_id', defectId);
      toast.success('Rework completed');
      fetchAll();
    }
  };

  const handleFailRework = async (reworkId) => {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from('rework_orders').update({ status: 'failed', end_time: new Date().toISOString() }).eq('rework_id', reworkId);
    if (!error) {
      toast.error('Rework failed');
      fetchReworkOrders();
    }
  };

  const filtered = filterDisposition === 'all' ? defects : defects.filter((d) => d.disposition === filterDisposition);

  const scrapQty = defects.filter((d) => d.disposition === 'scrap').reduce((sum, d) => sum + (d.qty || 0), 0);
  const reworkCount = defects.filter((d) => d.disposition === 'rework').length;
  const uaiCount = defects.filter((d) => d.disposition === 'uai').length;
  const totalCost = defects.reduce((sum, d) => {
    const certCost = Array.isArray(d.scrap_certificates) ? d.scrap_certificates.reduce((s, c) => s + (c.cost_impact || 0), 0) : 0;
    return sum + certCost;
  }, 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block"><h1 className="page-title">Scrap &amp; Rework</h1><div className="page-subtitle">Defect Disposition &amp; Root Cause Analysis</div></div>
        <div className="page-actions">
          <button className="icon-btn" onClick={fetchAll}><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="grid grid-4 mb-16">
        {[
          { label: 'Scrap Qty', value: scrapQty, color: 'red' },
          { label: 'Rework Orders', value: reworkCount, color: 'amber' },
          { label: 'UAI Pending', value: uaiCount, color: 'blue' },
          { label: 'Scrap Cost Impact', value: totalCost > 0 ? `₹${totalCost.toLocaleString()}` : '—', color: 'red' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card"><div className="metric-label">{label}</div><div className={`metric-value ${color}`} style={{ fontSize: 28 }}>{value}</div></div>
        ))}
      </div>

      <div className="tabs">
        {[
          { id: 'defects', label: 'Defect Register' },
          { id: 'rework', label: `Rework Orders (${reworkOrders.filter(r => ['open', 'in_progress'].includes(r.status)).length})` },
          { id: 'rca', label: 'RCA Tracker' },
          { id: 'pareto', label: 'Pareto Analysis' }
        ].map((t) => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'defects' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Defect Records</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'pending', 'scrap', 'rework', 'uai'].map((d) => (
                <button key={d} className={`btn btn-sm ${filterDisposition === d ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilterDisposition(d)}>
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Defect ID</th><th>Work Order</th><th>Defect Type</th><th>Qty</th><th>Disposition</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{ textAlign: 'center' }}>Loading...</td></tr> :
                  filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted-text)' }}>No defects found</td></tr>
                  ) :
                  filtered.map((def) => (
                    <tr key={def.defect_id}>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)', fontSize: 13 }}>{def.defect_id?.slice(0, 8)}</td>
                      <td style={{ fontFamily: 'var(--font-heading)', fontSize: 12 }}>{def.wo_number}</td>
                      <td style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>{def.defect_type || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--red)' }}>{def.qty}</td>
                      <td><span className={`badge ${DISPOSITION_COLOR[def.disposition] || 'badge-gray'}`}>{def.disposition?.toUpperCase()}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {def.disposition !== 'scrap' && (
                            <button className="btn btn-sm btn-danger" onClick={() => setScrapCostTarget(def.defect_id)} style={{ fontSize: 9 }}>Scrap</button>
                          )}
                          {def.disposition !== 'rework' && (
                            <button className="btn btn-sm btn-outline" onClick={() => handleUpdateDisposition(def.defect_id, 'rework')} style={{ fontSize: 9 }}>Rework</button>
                          )}
                          {def.disposition !== 'uai' && (
                            <button className="btn btn-sm btn-outline" onClick={() => handleUpdateDisposition(def.defect_id, 'uai')} style={{ fontSize: 9 }}>UAI</button>
                          )}
                          {def.disposition === 'scrap' && (
                            <PDFDownloadLink document={<ScrapCertPDF defect={def} />} fileName={`SCRAP-${def.defect_id}.pdf`}>
                              {({ loading: l }) => (
                                <button className="btn btn-sm btn-outline" style={{ fontSize: 9 }}>
                                  <FileText size={9} /> {l ? '...' : 'Cert'}
                                </button>
                              )}
                            </PDFDownloadLink>
                          )}
                          <button className="btn btn-sm btn-outline" onClick={() => setRcaTarget(def)} style={{ fontSize: 9 }}>+ RCA</button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'rework' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Rework Order Tracking</span></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Rework ID</th><th>Defect Info</th><th>Assigned Operator</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {reworkOrders.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted-text)' }}>No rework orders</td></tr>
                ) : reworkOrders.map((ro) => {
                  const isOpen = ro.status === 'open';
                  const isInProgress = ro.status === 'in_progress';
                  return (
                    <tr key={ro.rework_id}>
                      <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)' }}>{ro.rework_id?.slice(0, 8)}</td>
                      <td>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--white)' }}>WO: {ro.defect_records?.wo_number}</div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)' }}>{ro.defect_records?.defect_type} ({ro.defect_records?.qty} units)</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 12 }}>
                            {operators.find((op) => op.id === ro.assigned_operator)?.display_name || 'Unassigned'}
                          </span>
                          {(isOpen || isInProgress) && (
                            <select
                              style={{ width: 120, fontSize: 10, padding: '2px 4px' }}
                              className="form-select"
                              value={ro.assigned_operator || ''}
                              onChange={(e) => handleAssignRework(ro.rework_id, e.target.value)}
                            >
                              <option value="">Assign...</option>
                              {operators.map((op) => (
                                <option key={op.id} value={op.id}>{op.display_name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${ro.status === 'completed' ? 'badge-green' : ro.status === 'in_progress' ? 'badge-blue' : ro.status === 'failed' ? 'badge-red' : 'badge-amber'}`}>
                          {ro.status?.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {isOpen && ro.assigned_operator && (
                            <button className="btn btn-sm btn-primary" onClick={() => handleStartRework(ro.rework_id)}><Play size={10} /> Start</button>
                          )}
                          {isInProgress && (
                            <>
                              <button className="btn btn-sm btn-primary" onClick={() => handleCompleteRework(ro.rework_id, ro.defect_id)}><CheckCircle2 size={10} /> Complete</button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleFailRework(ro.rework_id)}><AlertOctagon size={10} /> Fail</button>
                            </>
                          )}
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

      {activeTab === 'rca' && (
        <RCATrackerTab rcas={rcas} loading={rcaLoading} onUpdateCAStatus={handleUpdateCAStatus} />
      )}

      {activeTab === 'pareto' && (
        <div className="card animate-fade-in">
          <div className="card-header">
            <div>
              <span className="card-title">Defect Pareto Analysis (80/20 Rule)</span>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)', marginTop: 2 }}>
                Identifies vital few defect types causing the majority of quality issues
              </div>
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <div className="grid grid-3" style={{ gridTemplateColumns: '2fr 1fr', gap: 24 }}>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 16, minHeight: 350 }}>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={getParetoData()} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis 
                      dataKey="defect_type" 
                      tick={{ fontFamily: 'var(--font-heading)', fontSize: 11, fill: 'var(--muted-text)' }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                    />
                    <YAxis 
                      yAxisId="left" 
                      tick={{ fontFamily: 'var(--font-heading)', fontSize: 11, fill: 'var(--muted-text)' }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                      label={{ value: 'Defect Quantity', angle: -90, position: 'insideLeft', offset: 0, style: { textAnchor: 'middle', fill: 'var(--muted-text)', fontSize: 11, fontFamily: 'var(--font-heading)' } }}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      domain={[0, 100]} 
                      tick={{ fontFamily: 'var(--font-heading)', fontSize: 11, fill: 'var(--muted-text)' }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                      label={{ value: 'Cumulative %', angle: 90, position: 'insideRight', offset: 0, style: { textAnchor: 'middle', fill: 'var(--muted-text)', fontSize: 11, fontFamily: 'var(--font-heading)' } }}
                    />
                    <Tooltip 
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-active)', fontFamily: 'var(--font-heading)', fontSize: 12 }} 
                    />
                    <Legend wrapperStyle={{ fontFamily: 'var(--font-heading)', fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="qty" name="Defect Qty" fill="#1c69d4" barSize={30} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" name="Cumulative %" stroke="#d4261c" strokeWidth={2.5} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 16 }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700, color: 'var(--white)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pareto Data Table</div>
                  <div className="table-wrapper" style={{ maxHeight: 220, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ fontSize: 9, padding: '6px 4px', textAlign: 'left' }}>Defect Type</th>
                          <th style={{ fontSize: 9, padding: '6px 4px', textAlign: 'right' }}>Qty</th>
                          <th style={{ fontSize: 9, padding: '6px 4px', textAlign: 'right' }}>Cum. %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getParetoData().map((item, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '8px 4px', color: 'var(--text-secondary)' }}>{item.defect_type}</td>
                            <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>{item.qty}</td>
                            <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, padding: '8px 4px', textAlign: 'right', color: item.cumulativePercentage <= 80 ? 'var(--green)' : 'var(--muted-text)', fontWeight: 600 }}>{item.cumulativePercentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber)', padding: 14 }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>💡 Quality Manager Tip</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Focus corrective actions (RCAs) on categories below the <strong>80% threshold</strong>. Fixing these vital few types will resolve the vast majority of your overall defects.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {rcaTarget && <RCAModal defect={rcaTarget} onClose={() => setRcaTarget(null)} onSaved={() => { fetchRCAs(); setRcaTarget(null); }} />}
      
      {scrapCostTarget && (
        <ScrapCostModal
          suppliers={suppliers}
          onClose={() => setScrapCostTarget(null)}
          onSubmit={(cost, supplierId) => {
            handleUpdateDisposition(scrapCostTarget, 'scrap', cost, supplierId);
            setScrapCostTarget(null);
          }}
        />
      )}
    </div>
  );
}
