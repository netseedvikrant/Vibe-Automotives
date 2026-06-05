import React, { useState, useEffect } from 'react';
import { Truck, FileText, CheckCircle2, AlertCircle, ShoppingCart, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './ProcurementDashboard.css';

const ProcurementDashboard = () => {
  const [mbomReviews, setMbomReviews] = useState([]);
  const [prototypeBuilds, setPrototypeBuilds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProcurementData();
  }, []);

  const fetchProcurementData = async () => {
    try {
      const { data: mbom } = await supabase.from('mbom_reviews').select('*, programs(program_name)').order('created_at', { ascending: false });
      const { data: protos } = await supabase.from('prototype_builds').select('*, programs(program_name)').order('created_at', { ascending: false });
      
      setMbomReviews(mbom || []);
      setPrototypeBuilds(protos || []);
    } catch (error) {
      console.error("Error fetching procurement data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMbomDecision = async (id, decision) => {
    try {
      await supabase.from('mbom_reviews').update({ status: decision }).eq('id', id);
      fetchProcurementData();
    } catch (err) {
      console.error('Error updating review:', err);
    }
  };

  const handlePartSourcing = async (id, currentStatus) => {
    if (currentStatus !== 'Planning') return; // Procurement only acts when it's in planning
    try {
      await supabase.from('prototype_builds').update({ status: 'Parts Sourcing' }).eq('id', id);
      fetchProcurementData();
    } catch (err) {
      console.error('Error updating build:', err);
    }
  };

  if (loading) return <div className="flex-center h-100">Loading Procurement Data...</div>;

  return (
    <div className="procurement-dashboard">
      <header className="proc-header">
        <div className="header-info">
          <div className="status-badge" style={{background: 'rgba(0,255,157,0.1)', color: 'var(--success)'}}>SOURCING & SUPPLY CHAIN</div>
          <h1>Procurement Dashboard</h1>
          <p>MBOM Review // Supplier Readiness // Prototype Sourcing</p>
        </div>
      </header>

      <div className="proc-main-grid">
        <section className="glass p-xl">
          <div className="section-header" style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
            <Truck size={20} />
            <h3 style={{margin: 0}}>eBOM / MBOM Sourcing Review</h3>
          </div>
          <p className="text-muted" style={{marginBottom: '16px'}}>Review Engineering BOMs for supplier availability, tooling lead times, and cost targets before prototype build authorization.</p>
          
          <table className="data-table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Submitted</th>
                <th>Sourcing Status</th>
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
                        <button className="danger-btn small" onClick={() => handleMbomDecision(review.id, 'Rejected')}>Delay Risk</button>
                      </div>
                    ) : (
                      <span style={{color: 'var(--text-muted)'}}>Sourcing Verified</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="glass p-xl">
          <div className="section-header" style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
            <ShoppingCart size={20} />
            <h3 style={{margin: 0}}>Prototype Part Orders</h3>
          </div>
          <p className="text-muted" style={{marginBottom: '16px'}}>Authorize supplier purchase orders for upcoming physical prototype builds.</p>
          
          <table className="data-table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Build Type</th>
                <th>Qty</th>
                <th>Assembly Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {prototypeBuilds.length === 0 ? (
                <tr><td colSpan="5" className="text-center text-muted">Awaiting Program Manager authorization for prototype builds.</td></tr>
              ) : prototypeBuilds.map(build => (
                <tr key={build.id}>
                  <td style={{color: 'var(--accent)'}}><strong>{build.programs?.program_name || 'Unknown'}</strong></td>
                  <td>{build.build_type}</td>
                  <td>{build.quantity} units</td>
                  <td><span className="status-pill scheduled">{build.status}</span></td>
                  <td>
                    {build.status === 'Planning' ? (
                      <button className="primary-btn small" onClick={() => handlePartSourcing(build.id, build.status)}>
                        Generate POs & Order Parts
                      </button>
                    ) : (
                      <span style={{color: 'var(--success)'}}>Parts Ordered</span>
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

export default ProcurementDashboard;
