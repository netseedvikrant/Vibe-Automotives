import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Upload, 
  CheckCircle, 
  Clock, 
  MessageSquare, 
  FileText, 
  AlertTriangle,
  Info,
  ChevronRight,
  ExternalLink,
  Plus,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './SupplierDashboard.css';

const SupplierDashboard = ({ activeTab = 'Dashboard' }) => {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [activePrograms, setActivePrograms] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [programId, setProgramId] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [submissionLevel, setSubmissionLevel] = useState('3');
  const [pswUrl, setPswUrl] = useState('');
  const [dfmeaUrl, setDfmeaUrl] = useState('');
  const [pfmeaUrl, setPfmeaUrl] = useState('');
  const [controlPlanUrl, setControlPlanUrl] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [processFlowUrl, setProcessFlowUrl] = useState('');
  const [msaUrl, setMsaUrl] = useState('');
  const [cpkValue, setCpkValue] = useState('');
  const [resubmitTarget, setResubmitTarget] = useState(null);
  const [resubmitCpk, setResubmitCpk] = useState('');

  useEffect(() => {
    if (profile?.id) fetchSupplierData();
  }, [profile?.id]);

  const fetchSupplierData = async () => {
    try {
      let query = supabase
        .from('ppap_submissions')
        .select('*, programs(program_name, program_code)')
        .order('created_at', { ascending: false });

      if (profile?.id) {
        query = query.eq('supplier_id', profile.id);
      }

      const { data: subData } = await query;
      setSubmissions(subData || []);

      const { data: progData } = await supabase
        .from('programs')
        .select('*')
        .order('created_at', { ascending: false });
      setActivePrograms(progData || []);
      if (progData && progData.length > 0) {
        setProgramId(progData[0].id);
      }
    } catch (error) {
      console.error("Error fetching supplier data:", error);
    }
  };

  const handleResubmitPpap = async (submissionId, newCpk) => {
    if (!newCpk || isNaN(parseFloat(newCpk))) return alert('Please enter a valid Cpk value.');
    try {
      const { error } = await supabase.from('ppap_submissions').update({
        cpk_value: parseFloat(newCpk),
        status: 'Pending',
        interim_conditions: null
      }).eq('id', submissionId);
      if (error) throw error;

      const submission = submissions.find(s => s.id === submissionId);
      const { data: qualityEngineers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'Quality Engineer');

      const qualityNotifications = (qualityEngineers || []).map(qe => ({
        user_id: qe.id,
        title: 'PPAP Resubmitted — Quality Review Required',
        message: `Supplier ${profile?.full_name || 'Unknown'} resubmitted PPAP for ${submission?.part_number || 'part'} with updated Cpk ${newCpk}. Please re-review.`,
        type: 'warning'
      }));

      if (qualityNotifications.length > 0) {
        await supabase.from('notifications').insert(qualityNotifications);
      } else {
        await supabase.from('notifications').insert({
          title: 'PPAP Resubmitted for Quality Review',
          message: `Supplier updated Cpk to ${newCpk} and resubmitted PPAP package.`,
          type: 'warning'
        });
      }

      setResubmitTarget(null);
      setResubmitCpk('');
      fetchSupplierData();
      alert('PPAP resubmitted with updated Cpk. Quality Engineer will re-review.');
    } catch (err) {
      alert('Failed to resubmit PPAP: ' + err.message);
    }
  };

  const [uploadingField, setUploadingField] = useState(null);

  const handleDocUpload = async (e, setUrlField, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingField(fieldName);
    try {
      const fileExt = file.name.split('.').pop();
      const uniqueFileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${programId || 'general'}/${uniqueFileName}`;

      const { data, error } = await supabase.storage
        .from('ppap_documents')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('ppap_documents')
        .getPublicUrl(filePath);

      setUrlField(publicUrl);
    } catch (err) {
      console.error(err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmitPpap = async (e) => {
    e.preventDefault();
    if (!pswUrl || !controlPlanUrl) {
      return alert('PSW and Control Plan documents are required.');
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('ppap_submissions').insert({
        program_id: programId,
        supplier_id: profile?.id || null,
        part_number: partNumber,
        submission_level: parseInt(submissionLevel),
        status: 'Pending',
        psw_url: pswUrl,
        dfmea_url: dfmeaUrl,
        pfmea_url: pfmeaUrl,
        control_plan_url: controlPlanUrl,
        supplier_name: supplierName || profile?.full_name || null,
        process_flow_url: processFlowUrl || null,
        msa_url: msaUrl || null,
        cpk_value: cpkValue ? parseFloat(cpkValue) : null
      });

      if (error) throw error;

      await supabase.from('notifications').insert({
        title: 'New PPAP Submission',
        message: `PPAP package submitted for ${partNumber}. Awaiting Quality review.`,
        type: 'info'
      });

      alert('SUCCESS: PPAP Submission packages uploaded successfully and dispatched to Quality Assurance!');
      setIsModalOpen(false);
      // Reset form
      setPartNumber('');
      setPswUrl('');
      setDfmeaUrl('');
      setPfmeaUrl('');
      setControlPlanUrl('');
      setSupplierName('');
      setProcessFlowUrl('');
      setMsaUrl('');
      setCpkValue('');
      
      fetchSupplierData();
    } catch (err) {
      console.error('Error submitting PPAP:', err);
      alert('Error submitting PPAP: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="supplier-portal-container">
      <header className="portal-header">
        <div className="header-info">
          <h1>
            {activeTab === 'My PPAP' ? 'PPAP Submissions Center' : 
             activeTab === 'Specs' ? 'Technical Specifications' : 
             activeTab === 'Notifications' ? 'Supplier Bulletins & Notifications' : 
             'Supplier Collaboration Portal'}
          </h1>
          <p>{profile?.full_name || 'Supplier Portal'} (ID: {profile?.id?.substring(0, 8).toUpperCase() || 'N/A'})</p>
        </div>
        {activeTab === 'My PPAP' && (
          <div className="portal-actions">
            <button className="primary-btn" onClick={() => setIsModalOpen(true)}><Plus size={18} /> New PPAP Submission</button>
          </div>
        )}
      </header>

      {activeTab === 'Dashboard' && (
        <section className="portal-summary">
          <div className="summary-card glass">
            <div className="card-header">
              <Clock size={20} className="warning-text" />
              <h3>Action Required</h3>
            </div>
            <div className="action-item">
              <p>PPAP Package for <strong>CH-229-Front-Axle</strong> was rejected. Please review comments and resubmit.</p>
              <button className="text-btn">Review Comments <ChevronRight size={14} /></button>
            </div>
          </div>
          
          <div className="summary-card glass">
            <div className="card-header">
              <CheckCircle size={20} className="green-text" />
              <h3>Quality Rating</h3>
            </div>
            <div className="rating-display">
              <span className="rating-value">4.8</span>
              <span className="rating-label">Tier 1 Strategic Partner</span>
            </div>
          </div>
        </section>
      )}

      <div className="portal-main-grid" style={{ display: 'grid', gridTemplateColumns: activeTab === 'Dashboard' ? '2fr 1fr' : '1fr', gap: '24px' }}>
        {activeTab === 'My PPAP' && (
          <section className="submissions-grid glass">
            <div className="section-header">
              <h3><Package size={20} /> My PPAP Submissions</h3>
            </div>
            <div className="submissions-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Part / Program</th>
                    <th>Level</th>
                    <th>Status</th>
                    <th>Last Update</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(sub => (
                    <React.Fragment key={sub.id}>
                      <tr>
                        <td>
                          <div className="part-cell">
                            <strong>{sub.part_number || `Part #${sub.id.substring(0,8).toUpperCase()}`}</strong>
                            <span>{sub.programs?.program_name}</span>
                          </div>
                        </td>
                        <td>Level {sub.submission_level}</td>
                        <td>
                          <span className={`status-pill ${sub.status.toLowerCase().replace(' ', '-')}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td>{new Date(sub.created_at).toLocaleDateString()}</td>
                        <td>
                          {sub.status === 'Interim Approved' && (
                            <button
                              className="primary-btn small"
                              style={{ marginRight: '8px', fontSize: '0.75rem' }}
                              onClick={() => {
                                setResubmitTarget(sub);
                                setResubmitCpk(sub.cpk_value?.toString() || '');
                              }}
                            >
                              Update & Resubmit
                            </button>
                          )}
                          <button className="icon-btn"><FileText size={16} /></button>
                          <button className="icon-btn"><MessageSquare size={16} /></button>
                        </td>
                      </tr>
                      {(sub.rejection_feedback || sub.interim_conditions) && (
                        <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                          <td colSpan="5" style={{ padding: '12px 16px', borderTop: 'none', borderLeft: sub.status === 'Rejected' ? '3px solid var(--error)' : '3px solid var(--warning)' }}>
                            {sub.status === 'Rejected' && (
                              <div style={{ color: 'var(--error)', fontSize: '0.85rem' }}>
                                <strong style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={14}/> Quality Assurance Feedback:</strong> 
                                <p style={{ margin: '4px 0 0 0', color: '#ffaaaa' }}>{sub.rejection_feedback}</p>
                              </div>
                            )}
                            {sub.status === 'Interim Approved' && (
                              <div style={{ color: 'var(--warning)', fontSize: '0.85rem' }}>
                                <strong style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14}/> Interim Approval Conditions:</strong> 
                                <p style={{ margin: '4px 0 0 0', color: '#ffd580' }}>{sub.interim_conditions}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'Dashboard' && (
          <section className="glass" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ color: 'var(--accent)', margin: 0 }}>Supplier Collaboration Dashboard</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Welcome to the Vibe Automotives Supplier Portal. This secure portal enables tier-1 partners to manage engineering deliverables, execute Part Submission Warrants (PSW), and monitor real-time approval status for assigned automotive program components.
            </p>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
              <div className="glass-dark" style={{ padding: '16px', borderRadius: '8px', flex: 1, border: '1px solid rgba(255,255,255,0.04)' }}>
                <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--accent)' }}>{submissions.length}</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Submissions</span>
              </div>
              <div className="glass-dark" style={{ padding: '16px', borderRadius: '8px', flex: 1, border: '1px solid rgba(255,255,255,0.04)' }}>
                <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--success)' }}>
                  {submissions.filter(s => s.status === 'Approved').length}
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Approved Parts</span>
              </div>
              <div className="glass-dark" style={{ padding: '16px', borderRadius: '8px', flex: 1, border: '1px solid rgba(255,255,255,0.04)' }}>
                <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--warning)' }}>
                  {submissions.filter(s => s.status === 'Pending' || s.status === 'Interim Approved').length}
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>In Review</span>
              </div>
            </div>
          </section>
        )}



        {activeTab === 'Notifications' && (
          <section className="glass" style={{ padding: '24px', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18} /> Supplier Bulletins &amp; Notifications</h3>
            <div className="portal-notifications" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="notif" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '4px solid var(--accent)' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>New design freeze for EV-X Program. Check revised drawings and updated CAD model links.</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>2 hours ago</span>
              </div>
              <div className="notif" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '4px solid var(--accent)' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Reminder: Q3 IATF 16949 audit schedules are now published. Please review your readiness checklists.</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>1 day ago</span>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'Dashboard' && (
          <aside className="portal-sidebar">
            <div className="side-card glass">
              <h3><AlertTriangle size={18} /> Notifications</h3>
              <div className="portal-notifications">
                <div className="notif">
                  <p>New design freeze for EV-X Program. Check revised drawings.</p>
                  <span>2 hours ago</span>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {resubmitTarget && (
        <div className="modal-backdrop flex-center" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 1000, backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <motion.div className="modal-content glass p-xl" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ width: '100%', maxWidth: '420px', background: 'rgba(20, 20, 25, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--accent)' }}>Update & Resubmit PPAP</h3>
            <p style={{ fontSize: '0.85rem', color: '#a0a0b0', marginBottom: '12px' }}>
              Part: {resubmitTarget.part_number} — Interim conditions: {resubmitTarget.interim_conditions || 'N/A'}
            </p>
            <label style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>Updated Cpk Value</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={resubmitCpk}
              onChange={e => setResubmitCpk(e.target.value)}
              style={{ width: '100%', padding: '10px', margin: '8px 0 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="primary-btn" onClick={() => handleResubmitPpap(resubmitTarget.id, resubmitCpk)}>Resubmit</button>
              <button className="secondary-btn" onClick={() => setResubmitTarget(null)}>Cancel</button>
            </div>
          </motion.div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-backdrop flex-center" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 1000, backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <motion.div className="modal-content glass p-xl" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', background: 'rgba(20, 20, 25, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}><Upload size={20}/> Stage 14: Submit PPAP Package</h3>
              <button className="text-btn" onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            
            <form onSubmit={handleSubmitPpap} className="flex-col gap-md" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group flex-col gap-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>Supplier / Company Name</label>
                <input type="text" className="form-input" placeholder="e.g. Continental Engineering" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }} />
              </div>

              <div className="form-group flex-col gap-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>Vehicle Program</label>
                <select className="form-input" value={programId} onChange={(e) => setProgramId(e.target.value)} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }}>
                  {activePrograms.map(p => (
                    <option key={p.id} value={p.id}>{p.program_name} ({p.program_code})</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group flex-col gap-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>Part Number / Component Name</label>
                <input type="text" className="form-input" placeholder="e.g. Continental-Front-Axle-V3" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }} />
              </div>
              
              <div className="form-group flex-col gap-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>PPAP Submission Level</label>
                <select className="form-input" value={submissionLevel} onChange={(e) => setSubmissionLevel(e.target.value)} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }}>
                  <option value="1">Level 1 - PSW Only</option>
                  <option value="2">Level 2 - PSW + Product Samples</option>
                  <option value="3">Level 3 - PSW + Full Supporting Data (Default)</option>
                  <option value="4">Level 4 - PSW + Customer Requirements</option>
                  <option value="5">Level 5 - PSW + Full Onsite Audit</option>
                </select>
              </div>
              
              <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginTop: '12px', color: 'var(--accent)' }}>Required Technical Documentation</h4>
              
              <div className="form-group flex-col gap-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>Part Submission Warrant (PSW) Document</label>
                {pswUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2ecc71', background: 'rgba(46, 204, 113, 0.05)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(46, 204, 113, 0.15)' }}>
                    <CheckCircle size={16} /> <span style={{ fontSize: '0.85rem' }}>PSW Uploaded</span>
                    <button type="button" className="text-btn" onClick={() => setPswUrl('')} style={{ color: '#ff4d4d', marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                  </div>
                ) : (
                  <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => handleDocUpload(e, setPswUrl, 'psw')} disabled={uploadingField !== null} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }} />
                )}
                {uploadingField === 'psw' && <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>Uploading file...</span>}
              </div>
              
              <div className="form-group flex-col gap-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>DFMEA Document (Design Failure Mode & Effects Analysis)</label>
                {dfmeaUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2ecc71', background: 'rgba(46, 204, 113, 0.05)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(46, 204, 113, 0.15)' }}>
                    <CheckCircle size={16} /> <span style={{ fontSize: '0.85rem' }}>DFMEA Uploaded</span>
                    <button type="button" className="text-btn" onClick={() => setDfmeaUrl('')} style={{ color: '#ff4d4d', marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                  </div>
                ) : (
                  <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => handleDocUpload(e, setDfmeaUrl, 'dfmea')} disabled={uploadingField !== null} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }} />
                )}
                {uploadingField === 'dfmea' && <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>Uploading file...</span>}
              </div>
              
              <div className="form-group flex-col gap-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>PFMEA Document (Process Failure Mode & Effects Analysis)</label>
                {pfmeaUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2ecc71', background: 'rgba(46, 204, 113, 0.05)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(46, 204, 113, 0.15)' }}>
                    <CheckCircle size={16} /> <span style={{ fontSize: '0.85rem' }}>PFMEA Uploaded</span>
                    <button type="button" className="text-btn" onClick={() => setPfmeaUrl('')} style={{ color: '#ff4d4d', marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                  </div>
                ) : (
                  <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => handleDocUpload(e, setPfmeaUrl, 'pfmea')} disabled={uploadingField !== null} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }} />
                )}
                {uploadingField === 'pfmea' && <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>Uploading file...</span>}
              </div>
              
              <div className="form-group flex-col gap-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>Control Plan Document</label>
                {controlPlanUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2ecc71', background: 'rgba(46, 204, 113, 0.05)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(46, 204, 113, 0.15)' }}>
                    <CheckCircle size={16} /> <span style={{ fontSize: '0.85rem' }}>Control Plan Uploaded</span>
                    <button type="button" className="text-btn" onClick={() => setControlPlanUrl('')} style={{ color: '#ff4d4d', marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                  </div>
                ) : (
                  <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => handleDocUpload(e, setControlPlanUrl, 'controlPlan')} disabled={uploadingField !== null} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }} />
                )}
                {uploadingField === 'controlPlan' && <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>Uploading file...</span>}
              </div>

              <div className="form-group flex-col gap-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>Process Flow Diagram</label>
                {processFlowUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2ecc71', background: 'rgba(46, 204, 113, 0.05)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(46, 204, 113, 0.15)' }}>
                    <CheckCircle size={16} /> <span style={{ fontSize: '0.85rem' }}>Process Flow Uploaded</span>
                    <button type="button" className="text-btn" onClick={() => setProcessFlowUrl('')} style={{ color: '#ff4d4d', marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                  </div>
                ) : (
                  <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => handleDocUpload(e, setProcessFlowUrl, 'processFlow')} disabled={uploadingField !== null} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }} />
                )}
                {uploadingField === 'processFlow' && <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>Uploading file...</span>}
              </div>

              <div className="form-group flex-col gap-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>MSA Studies Document</label>
                {msaUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2ecc71', background: 'rgba(46, 204, 113, 0.05)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(46, 204, 113, 0.15)' }}>
                    <CheckCircle size={16} /> <span style={{ fontSize: '0.85rem' }}>MSA Uploaded</span>
                    <button type="button" className="text-btn" onClick={() => setMsaUrl('')} style={{ color: '#ff4d4d', marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                  </div>
                ) : (
                  <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => handleDocUpload(e, setMsaUrl, 'msa')} disabled={uploadingField !== null} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }} />
                )}
                {uploadingField === 'msa' && <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>Uploading file...</span>}
              </div>

              <div className="form-group flex-col gap-xs" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#a0a0b0' }}>Capability Study Cpk Value</label>
                <input type="number" step="0.01" min="0" placeholder="e.g. 1.67" value={cpkValue} onChange={(e) => setCpkValue(e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }} />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <button type="button" className="secondary-btn" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={loading || uploadingField !== null} style={{ padding: '10px 18px', background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}>
                  {loading ? 'Uploading Package...' : 'Submit PPAP Package'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SupplierDashboard;
