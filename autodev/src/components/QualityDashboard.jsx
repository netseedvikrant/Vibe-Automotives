import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckSquare, 
  FileCheck, 
  ShieldCheck, 
  ClipboardList, 
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Eye,
  History,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './QualityDashboard.css';

const QualityDashboard = () => {
  const [ppapSubmissions, setPpapSubmissions] = useState([]);
  const [apqpGates, setApqpGates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mbomReviews, setMbomReviews] = useState([]);
  const [dvprRecords, setDvprRecords] = useState([]);
  const [validationTests, setValidationTests] = useState([]);

  // Phase 4 states
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [apqpElements, setApqpElements] = useState([]);
  const [editedUrls, setEditedUrls] = useState({});
  const [activityLogs, setActivityLogs] = useState([]);

  useEffect(() => {
    fetchQualityData();
  }, []);

  useEffect(() => {
    if (selectedProgramId) {
      fetchApqpElements(selectedProgramId);
    }
  }, [selectedProgramId]);

  const fetchQualityData = async () => {
    try {
      setLoading(true);
      
      // Load all programs
      const { data: progList } = await supabase
        .from('programs')
        .select('*')
        .order('created_at', { ascending: false });
      setPrograms(progList || []);

      let activeProgId = selectedProgramId;
      if (!activeProgId && progList && progList.length > 0) {
        activeProgId = progList[0].id;
        setSelectedProgramId(activeProgId);
      }

      const { data: ppap } = await supabase.from('ppap_submissions').select('*, programs(program_name)');
      const { data: gates } = await supabase.from('apqp_gates').select('*').order('gate_number', { ascending: true });
      const { data: mbom } = await supabase.from('mbom_reviews').select('*, programs(program_name)').order('created_at', { ascending: false });
      const { data: dvpr } = await supabase.from('dvpr_records').select('*, programs(program_name)');
      const { data: tests } = await supabase.from('validation_tests').select('*');
      const { data: logs } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(20);
      
      setPpapSubmissions(ppap || []);
      setActivityLogs(logs || []);
      setApqpGates(gates || []);
      setMbomReviews(mbom || []);
      setDvprRecords(dvpr || []);
      setValidationTests(tests || []);

      if (activeProgId) {
        const { data: elems } = await supabase
          .from('apqp_elements')
          .select('*')
          .eq('program_id', activeProgId)
          .order('element_name', { ascending: true });
        setApqpElements(elems || []);
      }
    } catch (error) {
      console.error("Error fetching quality data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApqpElements = async (progId) => {
    try {
      const { data: elems, error: elemErr } = await supabase
        .from('apqp_elements')
        .select('*')
        .eq('program_id', progId)
        .order('element_name', { ascending: true });
      
      if (elemErr) throw elemErr;
      setApqpElements(elems || []);
    } catch (err) {
      console.warn('Database apqp_elements table not found. Using local memory mock fallback:', err.message);
      const mockElements = [
        'Design Records',
        'Engineering Change Documents',
        'Customer Engineering Approval',
        'Design Failure Mode & Effects Analysis (DFMEA)',
        'Process Flow Diagram',
        'Process Failure Mode & Effects Analysis (PFMEA)',
        'Control Plan',
        'Measurement System Analysis (MSA)',
        'Dimensional Results',
        'Material / Performance Test Results',
        'Initial Process Studies (Capability)',
        'Qualified Laboratory Documentation',
        'Appearance Approval Report (AAR)',
        'Sample Production Product',
        'Master Sample',
        'Checking Aids',
        'Customer-Specific Requirements',
        'Part Submission Warrant (PSW)'
      ].map((name, index) => ({
        id: `mock-elem-${index}`,
        program_id: progId,
        element_name: name,
        status: 'Not Started',
        file_url: ''
      }));
      setApqpElements(mockElements);
    }
  };

  const updateApqpElement = async (elementId, updates) => {
    try {
      if (elementId.startsWith('mock-elem-')) {
        setApqpElements(prev => prev.map(elem => 
          elem.id === elementId ? { ...elem, ...updates } : elem
        ));
        
        const event = new CustomEvent('autodev-toast', {
          detail: {
            title: '🛡️ Mock APQP Updated (Local)',
            message: 'Checklist updated in memory. Run phase4_schema_upgrade.sql for persistence.',
            type: 'success'
          }
        });
        window.dispatchEvent(event);
        return;
      }

      const { error } = await supabase
        .from('apqp_elements')
        .update(updates)
        .eq('id', elementId);
        
      if (error) throw error;
      
      const event = new CustomEvent('autodev-toast', {
        detail: {
          title: '🛡️ APQP Element Updated',
          message: 'Checklist element has been updated successfully.',
          type: 'success'
        }
      });
      window.dispatchEvent(event);

      if (selectedProgramId) {
        fetchApqpElements(selectedProgramId);
      }
    } catch (err) {
      console.error('Error updating APQP element:', err);
      alert('Error updating element: ' + err.message);
    }
  };

  const handleMbomDecision = async (id, decision, reason = '') => {
    try {
      if (decision === 'Rejected' && !reason) return alert('Rejection reason is required.');
      
      await supabase.from('mbom_reviews').update({ 
        status: decision,
        rejection_reason: decision === 'Rejected' ? reason : null
      }).eq('id', id);

      if (decision === 'Rejected') {
        await supabase.from('activity_logs').insert({
          action_type: 'MBOM Rejected',
          action_description: `Manufacturing rejected BOM. Reason: ${reason}`
        });
        alert('MBOM Rejected. Sent back to Design Engineering.');
      } else {
        alert('MBOM Approved successfully.');
      }

      fetchQualityData();
    } catch (err) {
      console.error('Error updating MBOM review:', err);
    }
  };

  const handleDvprReject = async () => {
    try {
      const programId = selectedProgramId;
      if (!programId) return alert('No active program selected.');

      const reason = prompt("Enter DVP&R Rejection Reason:");
      if (!reason) return;

      const { error: updErr } = await supabase
        .from('dvpr_records')
        .update({ status: 'Rejected' })
        .eq('program_id', programId);
      if (updErr && updErr.code !== 'PGRST116') {
        const { error: insErr } = await supabase
          .from('dvpr_records')
          .insert({
            program_id: programId,
            status: 'Rejected',
            approval_date: new Date().toISOString()
          });
        if (insErr) throw insErr;
      }

      const { error: gateErr } = await supabase
        .from('apqp_gates')
        .update({
          gate_status: 'Delayed',
          remarks: `DVP&R Rejected: ${reason}. Retest required.`
        })
        .eq('program_id', programId)
        .eq('gate_number', 3);
      if (gateErr) throw gateErr;

      await supabase.from('activity_logs').insert({
        program_id: programId,
        action_type: 'DVP&R Rejected',
        action_description: `DVP&R Validation rejected. Reason: ${reason}`
      });

      alert('DVP&R Rejected. Program sent back to Validation phase for retest.');
      fetchQualityData();
    } catch (err) {
      console.error('Error rejecting DVP&R:', err);
      alert('Error rejecting DVP&R: ' + err.message);
    }
  };

  const handleDvprApproval = async () => {
    try {
      const programId = selectedProgramId;
      
      if (!programId) {
        alert('Error: No active program selected to link the DVP&R document to.');
        return;
      }

      const { data: existing, error: existErr } = await supabase
        .from('dvpr_records')
        .select('id')
        .eq('program_id', programId)
        .maybeSingle();

      if (existErr) throw existErr;

      if (existing) {
        const { error: updErr } = await supabase
          .from('dvpr_records')
          .update({
            status: 'Approved',
            approval_date: new Date().toISOString()
          })
          .eq('program_id', programId);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('dvpr_records')
          .insert({
            program_id: programId,
            status: 'Approved',
            approval_date: new Date().toISOString()
          });
        if (insErr) throw insErr;
      }

      const { error: gateErr } = await supabase
        .from('apqp_gates')
        .update({
          gate_status: 'Completed',
          completion_percentage: 100,
          remarks: 'DVP&R Approved. Validation Phase successfully closed. Program transitioned to PPAP.'
        })
        .eq('program_id', programId)
        .eq('gate_number', 3);
      if (gateErr) throw gateErr;

      alert('SUCCESS: DVP&R Document approved! Validation phase closed. PPAP phase unlocked.');
      fetchQualityData();
    } catch (err) {
      console.error('Error approving DVP&R:', err);
      alert('Error approving DVP&R: ' + err.message);
    }
  };

  const handlePpapDecision = async (id, status, feedback = '') => {
    try {
      if (status === 'Rejected' && !feedback) return alert('Rejection reason required.');

      const { error: ppapErr } = await supabase
        .from('ppap_submissions')
        .update({ 
          status, 
          rejection_feedback: status === 'Rejected' ? feedback : null 
        })
        .eq('id', id);
      
      if (ppapErr) throw ppapErr;

      if (status === 'Approved') {
        const { error: gateErr } = await supabase
          .from('apqp_gates')
          .update({
            gate_status: 'Completed',
            completion_percentage: 100,
            remarks: 'Supplier PSW and Level 3 PPAP elements officially approved by Quality Assurance. Production release authorized.'
          })
          .eq('program_id', selectedProgramId)
          .eq('gate_number', 4);
        
        if (gateErr) throw gateErr;

        await supabase.from('activity_logs').insert({
          action_type: 'PPAP Approved',
          action_description: `PPAP Approved. Production release authorized.`
        });

        alert('SUCCESS: PPAP submission approved! Stage 14 (PPAP Process) completed and Gate 4 closed.');
      } else {
        await supabase.from('activity_logs').insert({
          action_type: 'PPAP Rejected',
          action_description: `PPAP Rejected. Feedback: ${feedback}`
        });
        alert('PPAP submission marked as Rejected. Feedback sent back to supplier.');
      }

      fetchQualityData();
    } catch (err) {
      console.error('Error updating PPAP decision:', err);
      alert('Error updating PPAP decision: ' + err.message);
    }
  };

  const handlePpapInterimApproval = async (id, conditions) => {
    if (!conditions) return alert('Conditions for interim approval are required.');
    try {
      const { error } = await supabase.from('ppap_submissions').update({
        status: 'Interim Approved',
        interim_conditions: conditions
      }).eq('id', id);

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        action_type: 'PPAP Interim Approved',
        action_description: `PPAP Interim Approval granted. Conditions: ${conditions}`
      });

      alert('Interim Approval granted. Supplier must meet conditions within timeframe.');
      fetchQualityData();
    } catch (err) {
      alert('Error setting interim approval: ' + err.message);
    }
  };

  return (
    <div className="quality-dashboard-container">
      <header className="quality-header">
        <div className="header-info">
          <h1>Quality Assurance & Compliance</h1>
          <p>APQP Lifecycle Management and PPAP Approval Center</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {programs.length > 0 && (
            <div className="program-selector-wrapper">
              <select 
                value={selectedProgramId} 
                onChange={e => setSelectedProgramId(e.target.value)}
                style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,180,216,0.3)', borderRadius: '6px', color: 'white', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
              >
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.program_name} ({p.program_code})</option>
                ))}
              </select>
            </div>
          )}
          <div className="compliance-badge glass-dark">
            <ShieldCheck size={18} />
            <span>IATF 16949 Compliant</span>
          </div>
        </div>
      </header>

      <div className="quality-main-grid">
        <section className="mbom-review-center glass" style={{ gridColumn: '1 / -1', marginBottom: '24px' }}>
          <div className="section-header">
            <h3><FileText size={20} /> eBOM / MBOM Review Queue</h3>
          </div>
          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Submitted By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {mbomReviews.length === 0 ? (
                  <tr><td colSpan="5" className="text-center text-muted">No pending BOM reviews.</td></tr>
                ) : mbomReviews.map(review => (
                  <tr key={review.id}>
                    <td style={{color: 'var(--accent)'}}><strong>{review.programs?.program_name || 'Unknown'}</strong></td>
                    <td>Design Engineering</td>
                    <td>{new Date(review.created_at).toLocaleDateString()}</td>
                    <td><span className={`status-pill ${review.status.toLowerCase()}`}>{review.status}</span></td>
                    <td>
                      {review.status === 'Pending' ? (
                        <div style={{display: 'flex', gap: '8px'}}>
                          <button className="success-btn small" onClick={() => handleMbomDecision(review.id, 'Approved')}>Approve</button>
                          <button className="danger-btn small" onClick={() => {
                            const reason = prompt("Enter rejection reason for Design Engineering:");
                            if(reason) handleMbomDecision(review.id, 'Rejected', reason);
                          }}>Reject</button>
                        </div>
                      ) : (
                        <span style={{color: 'var(--text-muted)'}}>{review.status === 'Rejected' ? 'Returned to Design' : '-'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {(() => {
          const programTests = selectedProgramId
            ? validationTests.filter(t => t.program_id === selectedProgramId)
            : [];
          const programDvpr = selectedProgramId
            ? dvprRecords.filter(d => d.program_id === selectedProgramId)
            : [];
          const passedCount = programTests.filter(t => t.status === 'Passed').length;
          const failedCount = programTests.filter(t => t.status === 'Failed').length;
          const passRate = programTests.length > 0
            ? Math.round((passedCount / programTests.length) * 100)
            : 0;

          return (
        <section className="dvpr-verification-center glass" style={{ gridColumn: '1 / -1', marginBottom: '24px' }}>
          <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={20} color="var(--accent)" />
            <h3 style={{ margin: 0 }}>Stage 13: DVP&R Verification & Approval Center</h3>
          </div>
          
          <div className="dvpr-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', padding: '16px 0', marginBottom: '16px' }}>
            <div className="metric-card glass-dark" style={{ padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', tracking: '0.05em' }}>Program Tests</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent)', marginTop: '4px' }}>{programTests.length}</div>
            </div>
            <div className="metric-card glass-dark" style={{ padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', tracking: '0.05em' }}>Passed (This Program)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#00ff9d', marginTop: '4px' }}>{passedCount}</div>
            </div>
            <div className="metric-card glass-dark" style={{ padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', tracking: '0.05em' }}>Failed (This Program)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--error)', marginTop: '4px' }}>{failedCount}</div>
            </div>
            <div className="metric-card glass-dark" style={{ padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', tracking: '0.05em' }}>Program Pass Rate</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#00ff9d', marginTop: '4px' }}>{passRate}%</div>
            </div>
            <div className="metric-card glass-dark" style={{ padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', tracking: '0.05em' }}>DVP&R Phase Gate Status</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text)', marginTop: '8px' }}>
                <span className={`status-pill ${programDvpr.some(d => d.status === 'Approved') ? 'passed' : 'scheduled'}`}>
                  {programDvpr.some(d => d.status === 'Approved') ? 'APPROVED & CLOSED' : 'PENDING APPROVAL'}
                </span>
              </div>
            </div>
          </div>

          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Vehicle Program</th>
                  <th>Total Tests Run</th>
                  <th>Pass Rate</th>
                  <th>DVP&R Status</th>
                  <th>Validation Phase Sign-Off</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{color: 'var(--accent)'}}>
                    <strong>
                      {programs.find(p => p.id === selectedProgramId)?.program_name || 'Select a Program'}
                      {' '}({programs.find(p => p.id === selectedProgramId)?.program_code || ''})
                    </strong>
                  </td>
                  <td>{programTests.length} Tests</td>
                  <td>
                    <strong>{passRate}%</strong>
                    <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: '6px' }}>
                      ({passedCount}/{programTests.length || 0} passed)
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill ${programDvpr.some(d => d.status === 'Approved') ? 'passed' : programDvpr.some(d => d.status === 'Rejected') ? 'failed' : 'scheduled'}`}>
                      {programDvpr.some(d => d.status === 'Approved') ? 'Approved' : programDvpr.some(d => d.status === 'Rejected') ? 'Rejected' : 'Pending Approval'}
                    </span>
                  </td>
                  <td>
                    {!programDvpr.some(d => d.status === 'Approved') ? (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button className="primary-btn small" onClick={handleDvprApproval}>
                          Approve DVP&R Document
                        </button>
                        <button className="danger-btn small" onClick={handleDvprReject}>
                          Reject / Retest
                        </button>
                      </div>
                    ) : (
                      <span className="text-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                        <CheckCircle2 size={16} /> Validation Phase Closed (Unlocked PPAP)
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
          );
        })()}

        <section className="ppap-center glass">
          <div className="section-header">
            <h3><FileCheck size={20} /> PPAP Submission Queue</h3>
            <div className="header-tools">
              <div className="search-box">
                <Search size={14} />
                <input type="text" placeholder="Search supplier..." />
              </div>
            </div>
          </div>
          <div className="ppap-list">
            {ppapSubmissions.length > 0 ? ppapSubmissions.map(ppap => (
              <div key={ppap.id} className="ppap-item glass-dark">
                <div className="ppap-main">
                  <div className="ppap-info">
                    <h4>{ppap.programs?.program_name} — {ppap.supplier_name || 'Supplier TBD'}</h4>
                    <p>Level {ppap.submission_level} Submission</p>
                  </div>
                  <div className="ppap-status">
                    <span className={`status-pill ${ppap.status.replace(' ', '-').toLowerCase()}`}>{ppap.status}</span>
                  </div>
                </div>
                <div className="ppap-footer">
                  <span className="ppap-date">Submitted: {new Date(ppap.created_at).toLocaleDateString()}</span>
                  <div className="ppap-actions">
                    <button className="action-btn" title="View Documents" onClick={() => alert(`PART SUBMISSION WARRANT (PSW) INSPECTION:\n\nPSW Document URL: ${ppap.psw_url}\n\nDFMEA Document: ${ppap.dfmea_url || 'Not Provided'}\nPFMEA Document: ${ppap.pfmea_url || 'Not Provided'}\nControl Plan: ${ppap.control_plan_url}`)}><Eye size={16} /></button>
                    {ppap.status !== 'Approved' && ppap.status !== 'Rejected' && ppap.status !== 'Interim Approved' && (
                      <>
                        <button className="action-btn" title="Interim Approval" onClick={() => {
                          const conditions = prompt("Enter conditions for Interim Approval:");
                          if (conditions) handlePpapInterimApproval(ppap.id, conditions);
                        }}><Clock size={16} className="yellow-text" style={{ color: 'var(--warning)' }} /></button>
                        <button className="action-btn" title="Approve" onClick={() => handlePpapDecision(ppap.id, 'Approved')}><CheckCircle2 size={16} className="green-text" /></button>
                        <button className="action-btn" title="Reject" onClick={() => {
                          const feedback = prompt("Enter specific reasons for PPAP rejection (this will be sent to the supplier):");
                          if (feedback) handlePpapDecision(ppap.id, 'Rejected', feedback);
                        }}><AlertCircle size={16} className="red-text" /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <div className="empty-state">No pending PPAP submissions</div>
            )}
          </div>
        </section>

        <section className="apqp-tracker glass">
          <div className="section-header">
            <h3><ClipboardList size={20} /> APQP Gate Status</h3>
          </div>
          <div className="gate-timeline">
            {apqpGates.map(gate => (
              <div key={gate.id} className="gate-node">
                <div className="node-marker" data-status={gate.gate_status}>
                  {gate.gate_status === 'Completed' ? <CheckCircle2 size={16} /> : gate.gate_number}
                </div>
                <div className="node-content">
                  <div className="node-header">
                    <h4>Gate {gate.gate_number}: {gate.gate_name}</h4>
                    <span className="node-percentage">{gate.completion_percentage}%</span>
                  </div>
                  <div className="node-progress">
                    <div className="fill" style={{width: `${gate.completion_percentage}%`}}></div>
                  </div>
                  <p className="node-remarks">{gate.remarks || 'No remarks recorded'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      {apqpElements.length > 0 && (
        <section className="glass apqp-compliance-checklist" style={{ marginTop: '24px', marginBottom: '24px', padding: '24px', gridColumn: '1 / -1' }}>
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList size={20} color="var(--accent)" />
              <h3 style={{ margin: 0 }}>18-Element APQP Compliance Checklist (IATF 16949 / ASPICE)</h3>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#888', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px' }}>
              Completed: <strong>{apqpElements.filter(e => e.status === 'Completed').length} / 18</strong>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {apqpElements.map(elem => (
              <div key={elem.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#fff', maxWidth: '70%', lineHeight: '1.4' }}>{elem.element_name}</div>
                  <select
                    value={elem.status}
                    onChange={e => updateApqpElement(elem.id, { status: e.target.value })}
                    style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: elem.status === 'Completed' ? '#00ff9d' : elem.status === 'In Progress' ? 'var(--accent)' : '#fff', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    placeholder="Compliance Document Link..." 
                    value={editedUrls[elem.id] !== undefined ? editedUrls[elem.id] : (elem.file_url || '')} 
                    onChange={e => setEditedUrls({ ...editedUrls, [elem.id]: e.target.value })}
                    onBlur={() => {
                      const val = editedUrls[elem.id];
                      if (val !== undefined && val !== elem.file_url) {
                        updateApqpElement(elem.id, { file_url: val });
                      }
                    }}
                    style={{ flex: 1, padding: '6px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', color: '#ccc', fontSize: '0.8rem', outline: 'none' }}
                  />
                  {elem.file_url ? (
                    <a 
                      href={elem.file_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="primary-btn small"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--accent)', border: 'none', borderRadius: '4px', color: '#fff', fontWeight: 'bold' }}
                    >
                      <Eye size={12} /> View
                    </a>
                  ) : (
                    <button 
                      disabled
                      className="secondary-btn small"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', opacity: 0.5, border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', color: '#666' }}
                    >
                      No Doc
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="audit-section glass">
        <div className="section-header">
          <h3><History size={20} /> Compliance Audit Trail</h3>
          <button className="secondary-btn"><Download size={16} /> Export Audit Log</button>
        </div>
        <div className="audit-table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Subject</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {activityLogs.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign: 'center', color: '#888'}}>No audit events recorded.</td></tr>
              ) : activityLogs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.action_type || 'System'}</td>
                  <td>{log.action_type}</td>
                  <td>{log.action_description?.substring(0, 50)}...</td>
                  <td><span className="audit-pass">LOGGED</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QualityDashboard;
