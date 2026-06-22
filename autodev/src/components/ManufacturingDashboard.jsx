import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, CheckCircle2, AlertCircle, Wrench, Factory } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './ProcurementDashboard.css'; // Reuse basic styles

const ManufacturingDashboard = () => {
  const [mbomReviews, setMbomReviews] = useState([]);
  const [prototypeBuilds, setPrototypeBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inspectingBom, setInspectingBom] = useState(null); // { programId, programName }
  const [bomParts, setBomParts] = useState([]);
  const [loadingBom, setLoadingBom] = useState(false);

  useEffect(() => {
    fetchMfgData();
  }, []);

  const openBomInspector = async (programId, programName) => {
    setInspectingBom({ programId, programName });
    setLoadingBom(true);
    try {
      const { data, error } = await supabase
        .from('ebom')
        .select('*')
        .eq('program_id', programId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setBomParts(data || []);
    } catch (err) {
      console.error('Error fetching BOM details:', err);
      setBomParts([]);
    } finally {
      setLoadingBom(false);
    }
  };

  const fetchMfgData = async () => {
    try {
      const { data: mbom } = await supabase.from('mbom_reviews').select('*, programs(program_name)').order('created_at', { ascending: false });
      const { data: protos } = await supabase.from('prototype_builds').select('*, programs(program_name)').order('created_at', { ascending: false });
      
      setMbomReviews(mbom || []);
      setPrototypeBuilds(protos || []);
    } catch (error) {
      console.error("Error fetching mfg data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMbomDecision = async (id, decision) => {
    try {
      await supabase.from('mbom_reviews').update({ status: decision }).eq('id', id);
      fetchMfgData();
    } catch (err) {
      console.error('Error updating review:', err);
    }
  };

  const advanceBuildStatus = async (id, currentStatus) => {
    const statuses = ['Planning', 'Parts Sourcing', 'Assembly', 'Inspection', 'Complete'];
    const nextIdx = statuses.indexOf(currentStatus) + 1;
    if (nextIdx >= statuses.length) return;
    
    try {
      await supabase.from('prototype_builds').update({ status: statuses[nextIdx] }).eq('id', id);
      
      // APQP AUTOMATION: Automatically schedule DVP&R tests when the physical build is complete
      if (statuses[nextIdx] === 'Complete') {
        console.log('AutoDev: Build Complete. Triggering automatic test scheduling...');
        const build = prototypeBuilds.find(b => b.id === id);
        const programId = build?.program_id || null;
        await supabase.from('validation_tests').insert([
          { prototype_id: id, program_id: programId, assigned_engineer: null, test_name: 'Crash Worthiness (Frontal)', test_category: 'Safety', status: 'Scheduled' },
          { prototype_id: id, program_id: programId, assigned_engineer: null, test_name: 'Battery Thermal Runaway', test_category: 'Powertrain', status: 'Scheduled' },
          { prototype_id: id, program_id: programId, assigned_engineer: null, test_name: 'NVH Acoustics Evaluation', test_category: 'Comfort', status: 'Scheduled' }
        ]);
      }

      fetchMfgData();
    } catch (err) {
      console.error('Error updating build:', err);
    }
  };

  return (
    <div className="procurement-dashboard">
      <header className="proc-header">
        <div className="header-info">
          <div className="status-badge" style={{background: 'rgba(255,170,0,0.1)', color: 'var(--warning)'}}>PLANT OPERATIONS</div>
          <h1>Manufacturing Engineering</h1>
          <p>DFM Analysis // MBOM Approvals // Prototype Assembly Execution</p>
        </div>
      </header>

      <div className="proc-main-grid" style={{gridTemplateColumns: '1fr'}}>
        <section className="glass p-xl">
          <div className="section-header" style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
            <Settings size={20} />
            <h3 style={{margin: 0}}>Design for Manufacturability (DFM) / MBOM Review</h3>
          </div>
          <p className="text-muted" style={{marginBottom: '16px'}}>Review engineering designs for assembly feasibility, tooling requirements, and plant capability.</p>
          
          <table className="data-table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Submitted</th>
                <th>DFM Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={`skeleton-mfg-mbom-${i}`}>
                    <td><div className="skeleton-text" style={{ width: '120px' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '80px' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '80px' }}></div></td>
                    <td><div className="skeleton-text button" style={{ height: '28px', width: '80px' }}></div></td>
                  </tr>
                ))
              ) : mbomReviews.length === 0 ? (
                <tr><td colSpan="4" className="text-center text-muted">No pending BOM reviews.</td></tr>
              ) : mbomReviews.map(review => (
                <tr key={review.id}>
                  <td style={{color: 'var(--accent)'}}><strong>{review.programs?.program_name || 'Unknown'}</strong></td>
                  <td>{new Date(review.created_at).toLocaleDateString()}</td>
                  <td><span className={`status-pill ${review.status.toLowerCase()}`}>{review.status}</span></td>
                  <td>
                    <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                      <button className="primary-btn small" style={{background: 'rgba(0,180,216,0.15)', color: '#00b4d8', borderColor: 'rgba(0,180,216,0.3)', padding: '6px 12px'}} onClick={() => openBomInspector(review.program_id, review.programs?.program_name)}>
                        Inspect BOM
                      </button>
                      {review.status === 'Pending' ? (
                        <>
                          <button className="success-btn small" onClick={() => handleMbomDecision(review.id, 'Approved')}>Feasible</button>
                          <button className="danger-btn small" onClick={() => handleMbomDecision(review.id, 'Rejected')}>Assembly Risk</button>
                        </>
                      ) : (
                        <span style={{color: 'var(--text-muted)'}}>DFM Verified</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="glass p-xl">
          <div className="section-header" style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
            <Factory size={20} />
            <h3 style={{margin: 0}}>Active Prototype Builds</h3>
          </div>
          <p className="text-muted" style={{marginBottom: '16px'}}>Execute physical prototype builds requested by Program Management.</p>
          
          <table className="data-table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Build Type</th>
                <th>Plant</th>
                <th>Current Phase</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={`skeleton-mfg-build-${i}`}>
                    <td><div className="skeleton-text" style={{ width: '120px' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '100px' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '80px' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '80px' }}></div></td>
                    <td><div className="skeleton-text button" style={{ height: '28px', width: '120px' }}></div></td>
                  </tr>
                ))
              ) : prototypeBuilds.length === 0 ? (
                <tr><td colSpan="5" className="text-center text-muted">No active prototype builds.</td></tr>
              ) : prototypeBuilds.map(build => (
                <tr key={build.id}>
                  <td style={{color: 'var(--accent)'}}><strong>{build.programs?.program_name || 'Unknown'}</strong></td>
                  <td>{build.build_type} (Qty: {build.quantity})</td>
                  <td>{build.plant_location || 'TBD'}</td>
                  <td><span className="status-pill scheduled">{build.status}</span></td>
                  <td>
                    {build.status !== 'Complete' ? (
                      <button className="primary-btn small" onClick={() => advanceBuildStatus(build.id, build.status)}>
                        Advance to Next Stage
                      </button>
                    ) : (
                      <span style={{color: 'var(--success)'}}>Ready for Validation</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* BOM Inspector Modal */}
      {inspectingBom && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 5, 10, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div className="glass" style={{
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '16px',
            border: '1px solid rgba(0, 180, 216, 0.3)',
            background: 'rgba(15, 23, 42, 0.95)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(0, 180, 216, 0.05)'
            }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>
                BOM Parts Inspection — <span style={{ color: '#00b4d8' }}>{inspectingBom.programName}</span>
              </h3>
              <button 
                onClick={() => setInspectingBom(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a0a0b0',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {loadingBom ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#00b4d8' }}>Loading BOM Parts...</div>
              ) : bomParts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No parts found in the BOM for this program.
                </div>
              ) : (
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ color: '#00b4d8' }}>Part No.</th>
                      <th>Drawing No.</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>UoM</th>
                      <th>Material</th>
                      <th>Type</th>
                      <th>Rev</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomParts.map(part => (
                      <tr key={part.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#00b4d8' }}>{part.part_number}</td>
                        <td>{part.drawing_number || 'N/A'}</td>
                        <td style={{ color: '#fff' }}>{part.part_name}</td>
                        <td>{part.quantity}</td>
                        <td>{part.uom || 'pcs'}</td>
                        <td>{part.material || 'N/A'}</td>
                        <td>
                          <span className={`status-pill ${part.bom_type?.toLowerCase() || 'ebom'}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                            {part.bom_type || 'EBOM'}
                          </span>
                        </td>
                        <td>{part.revision}</td>
                        <td>
                          <span className={`status-pill ${(part.status || 'Draft').toLowerCase().replace(/ /g, '-')}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                            {part.status || 'Draft'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(0, 0, 0, 0.2)',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button 
                className="secondary-btn" 
                onClick={() => setInspectingBom(null)}
                style={{ padding: '8px 20px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManufacturingDashboard;
