import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, FileText, CheckCircle2, AlertCircle, ShoppingCart, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './ProcurementDashboard.css';

const ProcurementDashboard = ({ activeTab = 'Dashboard' }) => {
  const [mbomReviews, setMbomReviews] = useState([]);
  const [prototypeBuilds, setPrototypeBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inspectingBom, setInspectingBom] = useState(null); // { programId, programName }
  const [bomParts, setBomParts] = useState([]);
  const [loadingBom, setLoadingBom] = useState(false);

  useEffect(() => {
    fetchProcurementData();
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

  return (
    <div className="procurement-dashboard">
      <header className="proc-header">
        <div className="header-info">
          <div className="status-badge" style={{background: 'rgba(0,255,157,0.1)', color: 'var(--success)'}}>SOURCING & SUPPLY CHAIN</div>
          <h1>
            {activeTab === 'MBOM Review' ? 'eBOM / MBOM Sourcing Review'
              : activeTab === 'Supplier Sourcing' ? 'Prototype Part Sourcing'
              : 'Procurement Dashboard'}
          </h1>
          <p>MBOM Review // Supplier Readiness // Prototype Sourcing</p>
        </div>
      </header>

      {activeTab === 'Dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            <div className="glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>BOMs Reviewed</span>
                <FileText size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{mbomReviews.length}</div>
            </div>
            <div className="glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Pending Reviews</span>
                <AlertCircle size={20} style={{ color: 'var(--warning)' }} />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: mbomReviews.filter(r => r.status === 'Pending').length > 0 ? 'var(--warning)' : 'inherit' }}>
                {mbomReviews.filter(r => r.status === 'Pending').length}
              </div>
            </div>
            <div className="glass" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Total Prototype Builds</span>
                <Truck size={20} style={{ color: 'var(--success)' }} />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{prototypeBuilds.length}</div>
            </div>
          </div>
          <div className="glass" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Procurement Activity Overview</h3>
            <p className="text-muted" style={{ margin: 0 }}>
              Use the sidebar navigation to access the full **MBOM Review** queue or manage **Supplier Sourcing** / prototype orders.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'MBOM Review' && (
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
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={`skeleton-proc-mbom-${i}`}>
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
                          <button className="danger-btn small" onClick={() => handleMbomDecision(review.id, 'Rejected')}>Delay Risk</button>
                        </>
                      ) : (
                        <span style={{color: 'var(--text-muted)'}}>Sourcing Verified</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === 'Supplier Sourcing' && (
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
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={`skeleton-proc-build-${i}`}>
                    <td><div className="skeleton-text" style={{ width: '120px' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '100px' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '60px' }}></div></td>
                    <td><div className="skeleton-text" style={{ width: '80px' }}></div></td>
                    <td><div className="skeleton-text button" style={{ height: '28px', width: '150px' }}></div></td>
                  </tr>
                ))
              ) : prototypeBuilds.length === 0 ? (
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
      )}

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

export default ProcurementDashboard;
