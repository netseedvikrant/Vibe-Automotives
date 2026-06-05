import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TestTube, FileCheck, AlertOctagon, CheckCircle, Clock, PlayCircle, UserCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './ValidationDashboard.css';

const ValidationDashboard = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('test-schedule');
  const [tests, setTests] = useState([]);
  const [ecos, setEcos] = useState([]);
  const [dvprRecords, setDvprRecords] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPrograms(),
        fetchTests(),
        fetchDvprRecords()
      ]);
    } catch (err) {
      console.error('Error loading initial validation dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase.from('programs').select('id, program_name');
      if (error) throw error;
      setPrograms(data || []);
    } catch (err) {
      console.error('Error fetching programs:', err);
    }
  };

  const fetchDvprRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('dvpr_records')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setDvprRecords(data || []);
    } catch (err) {
      console.error('Error fetching DVP&R records:', err);
    }
  };

  const fetchTests = async () => {
    try {
      // 1. Fetch raw validation tests
      const { data: rawTests, error } = await supabase
        .from('validation_tests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        alert(`Validation Fetch Error: ${error.message}`);
        throw error;
      }

      if (!rawTests || rawTests.length === 0) {
        setTests([]);
        return;
      }

      // 2. Safely enrich the data using manual joins to avoid PGRST200 schema cache errors
      const enrichedTests = await Promise.all(rawTests.map(async (test) => {
        let protoData = null;

        if (test.prototype_id) {
          // Fetch prototype details and its program
          const { data: pData } = await supabase
            .from('prototype_builds')
            .select('*, programs(*)')
            .eq('id', test.prototype_id)
            .single();
            
          protoData = pData;
        }

        return {
          ...test,
          prototype_builds: protoData
        };
      }));

      // 3. Fetch ECOs
      const { data: rawEcos, error: ecoFetchError } = await supabase.from('eco_requests').select('*').order('created_at', { ascending: false });
      
      if (ecoFetchError) {
        alert('ECO Fetch Error: ' + ecoFetchError.message);
      }
      
      setEcos(rawEcos || []);
      setTests(enrichedTests);
    } catch (err) {
      console.error('Error fetching tests:', err);
    }
  };

  const updateTestStatus = async (id, status, isConditional = false) => {
    try {
      let failureReason = null;
      if (isConditional) {
        failureReason = prompt("Enter conditions for conditional pass:");
        if (!failureReason) return;
      }
      
      const payload = { status };
      if (isConditional) {
        payload.failure_reason = `Conditional: ${failureReason}`;
      }

      await supabase.from('validation_tests').update(payload).eq('id', id);
      await fetchTests();
      await fetchDvprRecords(); // Sync potential trigger outcome
    } catch (err) {
      console.error('Error updating test:', err);
    }
  };

  const failTestTriggerECO = async (test) => {
    const failureReason = prompt('Enter failure reason (ECO will be created automatically):');
    if (!failureReason) return;

    try {
      await supabase.from('validation_tests')
        .update({ status: 'Failed', failure_reason: failureReason })
        .eq('id', test.id);

      const programId = test.program_id || test.prototype_builds?.program_id || null;
      const { data: eco, error: ecoError } = await supabase.from('eco_requests').insert({
        program_id: programId,
        title: `Auto-ECO: ${test.test_name} Failed`,
        description: `Test "${test.test_name}" failed. Reason: ${failureReason}. Redesign required.`,
        priority: 'Urgent',
        status: 'Pending',
        change_type: 'Design'
      }).select().single();

      if (ecoError) {
        alert(`Test marked Failed, but ECO creation failed: ${ecoError.message}`);
        console.error('ECO Insert Error:', ecoError);
        return;
      }

      await supabase.from('notifications').insert({
        title: 'Validation Failure — ECO Auto-Created',
        message: `Test "${test.test_name}" failed. ECO ${eco?.id?.substring(0, 8).toUpperCase() || ''} created for CFRB review.`,
        type: 'error'
      });

      const ecoRef = eco?.id ? `ECO-${eco.id.substring(0, 6).toUpperCase()}` : 'new ECO';
      alert(`Test marked Failed. ${ecoRef} automatically created for CFRB review.`);
      await fetchTests();
      await fetchDvprRecords();
    } catch (err) {
      console.error('Error failing test:', err);
      alert('Failed to mark test and create ECO: ' + err.message);
    }
  };

  const handleMapTest = async (dvprId, validationTestId) => {
    try {
      let initialResult = 'Pending';
      if (validationTestId) {
        const testObj = tests.find(t => t.id === validationTestId);
        if (testObj) {
          if (testObj.status === 'Passed') initialResult = 'Pass';
          else if (testObj.status === 'Failed') initialResult = 'Fail';
        }
      }

      const { error } = await supabase
        .from('dvpr_records')
        .update({ 
          validation_test_id: validationTestId || null,
          result: initialResult
        })
        .eq('id', dvprId);

      if (error) throw error;
      alert('DVP&R record successfully mapped.');
      await fetchDvprRecords();
    } catch (err) {
      console.error('Error mapping test:', err);
      alert('Failed to map validation test: ' + err.message);
    }
  };

  const handleSignoff = async (id) => {
    try {
      const { error } = await supabase
        .from('dvpr_records')
        .update({ 
          signoff_status: 'Signed Off',
          approved_by: profile?.id || null,
          approval_date: new Date().toISOString(),
          status: 'Approved'
        })
        .eq('id', id);

      if (error) throw error;
      alert('DVP&R record signed off successfully!');
      await fetchDvprRecords();
    } catch (err) {
      console.error('Error signing off DVP&R:', err);
      alert('Failed to sign off: ' + err.message);
    }
  };

  if (loading) return <div className="flex-center h-100">Loading Validation Systems...</div>;

  return (
    <div className="validation-dashboard">
      <header className="val-header">
        <div className="header-left">
          <div className="status-badge-val">VALIDATION PHASE ACTIVE</div>
          <h1>Test Engineering & DVP&R</h1>
          <p className="technical-meta">PROTOTYPE TESTING // FAILURE LOGGING // ECO TRIGGERS</p>
        </div>
      </header>

      <div className="val-content">
        <div className="val-tabs">
          <button className={`tab-btn ${activeTab === 'test-schedule' ? 'active' : ''}`} onClick={() => setActiveTab('test-schedule')}>
            <Clock size={16} /> Test Schedule
          </button>
          <button className={`tab-btn ${activeTab === 'dvpr' ? 'active' : ''}`} onClick={() => setActiveTab('dvpr')}>
            <FileCheck size={16} /> DVP&R Matrix
          </button>
          <button className={`tab-btn ${activeTab === 'failures' ? 'active' : ''}`} onClick={() => setActiveTab('failures')}>
            <AlertOctagon size={16} /> Critical Failures
          </button>
        </div>

        <div className="val-tab-content glass">
          {activeTab === 'test-schedule' && (
            <div className="test-list">
              <h3>Active Validation Tests</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Test Protocol</th>
                    <th>Program</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.length === 0 ? (
                    <tr><td colSpan="5">No tests scheduled. Waiting for Prototype Build completion.</td></tr>
                  ) : (
                    tests.map(test => (
                      <tr key={test.id}>
                        <td><strong>{test.test_name}</strong></td>
                        <td>{test.prototype_builds?.programs?.program_name}</td>
                        <td>{test.test_category}</td>
                        <td>
                          <span className={`status-pill ${test.status.toLowerCase().replace(' ', '-')}`}>
                            {test.status}
                          </span>
                        </td>
                        <td>
                          {test.status === 'Scheduled' && (
                            <button className="secondary-btn small" onClick={() => updateTestStatus(test.id, 'In Progress')}>
                              <PlayCircle size={14} /> Start Execution
                            </button>
                          )}
                          {test.status === 'In Progress' && (
                            <div style={{display: 'flex', gap: '8px'}}>
                              <button className="success-btn small" onClick={() => updateTestStatus(test.id, 'Passed')}>Pass</button>
                              <button className="secondary-btn small" style={{background: 'rgba(255, 160, 50, 0.2)', color: '#ffaa33', border: '1px solid #ffaa33'}} onClick={() => updateTestStatus(test.id, 'Conditional Pass', true)}>Conditional Pass</button>
                              <button className="danger-btn small" onClick={() => failTestTriggerECO(test)}>Fail Test</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {activeTab === 'dvpr' && (
            <div className="dvpr-view">
              <div className="dvpr-filter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.9rem', color: '#a0a0b0' }}>Filter by Vehicle Program:</span>
                  <select value={selectedProgramId} onChange={e => setSelectedProgramId(e.target.value)} style={{ padding: '6px 12px', background: 'rgba(20,20,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text)' }}>
                    <option value="All">All Programs</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.program_name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Total DVP&R Items: {
                    dvprRecords.filter(r => selectedProgramId === 'All' || r.program_id === selectedProgramId).length
                  }
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Program</th>
                      <th>Test Requirement</th>
                      <th>Test Method</th>
                      <th>Acceptance Criteria</th>
                      <th>Size</th>
                      <th>Mapped Validation Test</th>
                      <th>Result</th>
                      <th>Signoff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dvprRecords.filter(r => selectedProgramId === 'All' || r.program_id === selectedProgramId).length === 0 ? (
                      <tr><td colSpan="8" className="text-center text-muted" style={{ padding: '24px' }}>No DVP&R records found. Ensure program is in Feasibility stage to generate records.</td></tr>
                    ) : (
                      dvprRecords
                        .filter(r => selectedProgramId === 'All' || r.program_id === selectedProgramId)
                        .map(item => {
                          const prog = programs.find(p => p.id === item.program_id);
                          const programTests = tests.filter(t => t.program_id === item.program_id);
                          return (
                            <tr key={item.id}>
                              <td><strong>{prog ? prog.program_name : 'Loading...'}</strong></td>
                              <td>{item.test_item || 'N/A'}</td>
                              <td><code style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '2px 4px', borderRadius: '4px' }}>{item.test_method || 'N/A'}</code></td>
                              <td style={{ fontSize: '0.85rem', maxWidth: '200px' }}>{item.acceptance_criteria || 'N/A'}</td>
                              <td>{item.sample_size || 1}</td>
                              <td>
                                <select 
                                  value={item.validation_test_id || ''} 
                                  onChange={e => handleMapTest(item.id, e.target.value || null)}
                                  style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'white', fontSize: '0.8rem', width: '100%', maxWidth: '180px' }}
                                >
                                  <option value="">-- Unmapped --</option>
                                  {programTests.map(t => (
                                    <option key={t.id} value={t.id}>{t.test_name} ({t.status})</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <span className={`status-pill ${
                                  item.result === 'Pass' ? 'passed' : item.result === 'Fail' ? 'failed' : 'scheduled'
                                }`}>
                                  {item.result || 'Pending'}
                                </span>
                              </td>
                              <td>
                                {item.signoff_status === 'Signed Off' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2ecc71', fontSize: '0.85rem', fontWeight: 600 }}>
                                    <CheckCircle size={14} /> <span>Signed Off</span>
                                  </div>
                                ) : (
                                  <button 
                                    className="primary-btn small" 
                                    onClick={() => handleSignoff(item.id)} 
                                    disabled={item.result !== 'Pass'}
                                    style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <UserCheck size={12} /> Sign Off
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'failures' && (
            <div className="failures-view">
              <h3>Triggered ECOs</h3>
              <p className="text-muted" style={{ marginBottom: '16px' }}>A list of all Engineering Change Orders automatically triggered by validation failures.</p>
              
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ECO Title</th>
                    <th>Description</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ecos.length === 0 ? (
                    <tr><td colSpan="4" className="text-center text-muted">No ECOs triggered yet.</td></tr>
                  ) : ecos.map(eco => (
                    <tr key={eco.id}>
                      <td style={{color: 'var(--accent)'}}><strong>{eco.title}</strong></td>
                      <td style={{maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{eco.description}</td>
                      <td><span className="status-pill rejected">{eco.priority}</span></td>
                      <td><span className="status-pill scheduled">{eco.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ValidationDashboard;
