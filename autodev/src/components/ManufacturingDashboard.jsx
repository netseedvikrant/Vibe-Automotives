import React, { useState, useEffect } from 'react';
import { Settings, CheckCircle2, AlertCircle, Wrench, Factory } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './ProcurementDashboard.css'; // Reuse basic styles

const ManufacturingDashboard = () => {
  const [mbomReviews, setMbomReviews] = useState([]);
  const [prototypeBuilds, setPrototypeBuilds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMfgData();
  }, []);

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

  if (loading) return <div className="flex-center h-100">Loading Manufacturing Data...</div>;

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
              {mbomReviews.length === 0 ? (
                <tr><td colSpan="4" className="text-center text-muted">No pending BOM reviews.</td></tr>
              ) : mbomReviews.map(review => (
                <tr key={review.id}>
                  <td style={{color: 'var(--accent)'}}><strong>{review.programs?.program_name || 'Unknown'}</strong></td>
                  <td>{new Date(review.created_at).toLocaleDateString()}</td>
                  <td><span className={`status-pill ${review.status.toLowerCase()}`}>{review.status}</span></td>
                  <td>
                    {review.status === 'Pending' ? (
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button className="success-btn small" onClick={() => handleMbomDecision(review.id, 'Approved')}>Feasible</button>
                        <button className="danger-btn small" onClick={() => handleMbomDecision(review.id, 'Rejected')}>Assembly Risk</button>
                      </div>
                    ) : (
                      <span style={{color: 'var(--text-muted)'}}>DFM Verified</span>
                    )}
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
              {prototypeBuilds.length === 0 ? (
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
    </div>
  );
};

export default ManufacturingDashboard;
