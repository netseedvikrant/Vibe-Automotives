import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Send, Activity, Settings, Database, Server } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './EBOMDashboard.css';

const EBOMDashboard = () => {
  const { profile } = useAuth();
  const canEditBom = ['Lead Engineer', 'Chief Engineer', 'Design Engineer'].includes(profile?.role); // Cache invalidation
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [bomItems, setBomItems] = useState([]);
  const [mbomRejection, setMbomRejection] = useState(null);
  const [editingPartId, setEditingPartId] = useState(null);
  const [editMaterial, setEditMaterial] = useState('');
  const [loading, setLoading] = useState(true);

  // Form State
  const [partNumber, setPartNumber] = useState('');
  const [drawingNumber, setDrawingNumber] = useState('');
  const [partName, setPartName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [uom, setUom] = useState('pcs');
  const [material, setMaterial] = useState('');
  const [bomType, setBomType] = useState('EBOM');
  const [status, setStatus] = useState('Draft');

  useEffect(() => {
    fetchPrograms();
  }, []);

  useEffect(() => {
    if (selectedProgram) {
      fetchBOM();
      fetchMbomRejection();
    }
  }, [selectedProgram]);

  const fetchMbomRejection = async () => {
    if (!selectedProgram) return;
    try {
      const { data } = await supabase
        .from('mbom_reviews')
        .select('*')
        .eq('program_id', selectedProgram.id)
        .eq('status', 'Rejected')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setMbomRejection(data);
    } catch (err) {
      console.error('Error fetching MBOM rejection:', err);
    }
  };

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase.from('programs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setPrograms(data || []);
      if (data && data.length > 0) setSelectedProgram(data[0]);
    } catch (err) {
      console.error('Error fetching programs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBOM = async () => {
    try {
      const { data, error } = await supabase
        .from('ebom')
        .select('*')
        .eq('program_id', selectedProgram.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setBomItems(data || []);
    } catch (err) {
      console.error('Error fetching BOM:', err);
    }
  };

  const handleAddPart = async () => {
    if (!partNumber || !partName) return alert('Part Number and Name are required.');
    
    try {
      const { data: existingRevs } = await supabase
        .from('ebom')
        .select('revision')
        .eq('program_id', selectedProgram.id)
        .eq('part_number', partNumber);

      const nextRev = existingRevs && existingRevs.length > 0
        ? String.fromCharCode(65 + existingRevs.length)  // A → B → C
        : 'A';

      const { error } = await supabase.from('ebom').insert({
        program_id: selectedProgram.id,
        part_number: partNumber,
        part_name: partName,
        quantity: parseInt(quantity),
        material: material,
        revision: nextRev,
        drawing_number: drawingNumber || null,
        uom: uom,
        bom_type: bomType,
        status: status
      });

      if (error) throw error;
      
      setPartNumber('');
      setDrawingNumber('');
      setPartName('');
      setQuantity(1);
      setUom('pcs');
      setMaterial('');
      setBomType('EBOM');
      setStatus('Draft');
      fetchBOM();
    } catch (err) {
      console.error('Error adding part:', err);
      alert(`Failed to add part: ${err.message || JSON.stringify(err)}`);
    }
  };

  const handleEditPart = async (item) => {
    const action = prompt("Enter 'ECO' to trigger an Engineering Change Order, or 'UPDATE' to modify BOM silently:");
    if (!action) return;

    if (action.toUpperCase() === 'ECO') {
      const reason = prompt("Enter reason for ECO trigger (Design flaw, Cost reduction, Supplier issue, etc.):");
      if (!reason) return;
      try {
        await supabase.from('ebom').update({ status: 'Under Review (ECO)' }).eq('id', item.id);
        
        await supabase.from('eco_requests').insert({
          program_id: selectedProgram.id,
          title: `ECO for ${item.part_number}: ${item.part_name}`,
          description: `ECO triggered from BOM. Reason: ${reason}`,
          priority: 'High',
          status: 'Pending',
          change_type: 'Design',
          affected_parts: item.part_number
        });

        await supabase.from('activity_logs').insert({
          program_id: selectedProgram.id,
          action_type: 'ECO Triggered from BOM',
          action_description: `User triggered ECO for part ${item.part_number} (${item.part_name}).`
        });

        alert("ECO Triggered successfully. Part status locked to 'Under Review (ECO)'.");
        fetchBOM();
      } catch (err) {
        alert("Error triggering ECO: " + err.message);
      }
    } else if (action.toUpperCase() === 'UPDATE') {
      const newMaterial = prompt('Enter new material value:', item.material || '');
      if (!newMaterial) return;
      await handleMaterialUpdate(item.id, newMaterial);
    } else {
      alert("Invalid action.");
    }
  };

  const handleMaterialUpdate = async (partId, newMaterial) => {
    try {
      const part = bomItems.find(p => p.id === partId);
      const { error } = await supabase.from('ebom')
        .update({ material: newMaterial, status: 'Under Review' })
        .eq('id', partId);
      if (error) throw error;

      await supabase.from('activity_logs').insert({
        program_id: selectedProgram.id,
        action_type: 'BOM Part Revised',
        action_description: `BOM part ${part?.part_number || partId} material revised to ${newMaterial}`
      });

      setEditingPartId(null);
      setEditMaterial('');
      fetchBOM();
      alert('Material updated. Part status reset to Under Review.');
    } catch (err) {
      alert('Failed to update material: ' + err.message);
    }
  };

  const handleSubmitReview = async () => {
    try {
      // Create a dummy MBOM review request linking to the first item for demonstration
      if (bomItems.length === 0) return alert('BOM is empty.');

      const { error } = await supabase.from('mbom_reviews').insert({
        program_id: selectedProgram.id,
        ebom_id: bomItems[0].id, // Technically should link entire BOM or program
        reviewer_id: profile?.id, // Mocking reviewer for now
        role: 'Manufacturing Engineer',
        status: 'Pending',
        comments: 'Initial MBOM Review requested.'
      });

      if (error) throw error;
      alert('BOM Submitted for Cross-Functional Review!');
    } catch (err) {
      console.error('Error submitting review:', err);
      alert('Failed to submit BOM review.');
    }
  };

  const handleExportToSCM = async () => {
    if (bomItems.length === 0) return alert('BOM is empty.');
    
    let count = 0;
    try {
      for (const item of bomItems) {
        const { error } = await supabase.from('purchase_requisitions').insert({
          program_id: selectedProgram.id,
          material_name: item.part_name,
          part_code: item.part_number,
          quantity: item.quantity,
          estimated_cost: 0,
          procurement_type: 'Direct Materials',
          supplier_category: 'Tier-1',
          priority: 'Medium',
          status: 'Pending Finance Approval',
          finance_approval_status: 'Pending',
          procurement_head_status: 'Pending'
        });
        if (!error) count++;
      }
      
      await supabase.from('activity_logs').insert({
        program_id: selectedProgram.id,
        action_type: 'BOM Exported to SCM',
        action_description: `Successfully exported ${count} parts to SCM Purchase Requisitions.`
      });

      alert(`Successfully exported ${count} parts as SCM Purchase Requisitions!`);
    } catch (err) {
      console.error(err);
      alert('Failed to export BOM to SCM: ' + err.message);
    }
  };

  return (
    <div className="ebom-dashboard">
      <header className="ebom-header">
        <div className="header-left">
          <div className="status-badge-ebom">BOM CREATION PHASE</div>
          <h1>Engineering BOM (eBOM)</h1>
          <p className="technical-meta">PARTS DEFINITION // MATERIAL SOURCING // MBOM SUBMISSION</p>
        </div>
      </header>

      <div className="ebom-content">
        <aside className="ebom-sidebar">
          <div className="sidebar-header">
            <h3>Active Programs</h3>
          </div>
          <div className="program-list">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={`skeleton-prog-${i}`} className="program-card" style={{ opacity: 0.5 }}>
                  <div className="skeleton-text" style={{ width: '70%', height: '14px', marginBottom: '6px' }}></div>
                  <div className="skeleton-text short" style={{ width: '40%' }}></div>
                </div>
              ))
            ) : (
              programs.map(prog => (
                <div 
                  key={prog.id} 
                  className={`program-card ${selectedProgram?.id === prog.id ? 'active' : ''}`}
                  onClick={() => setSelectedProgram(prog)}
                >
                  <div style={{fontWeight: 600, marginBottom: '4px'}}>{prog.program_name}</div>
                  <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{prog.id.substring(0, 8).toUpperCase()}</div>
                </div>
              ))
            )}
          </div>
        </aside>

        <div className="ebom-workspace">
          <div className="workspace-header">
            <h3>{selectedProgram?.program_name} - Master Parts List</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="secondary-btn" onClick={handleExportToSCM} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border)', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                <Database size={16} /> Export BOM to SCM
              </button>
              <button className="primary-btn" onClick={handleSubmitReview} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Send size={16} /> Submit BOM Review
              </button>
            </div>
          </div>

          {mbomRejection && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(255, 77, 77, 0.08)', border: '1px solid rgba(255, 77, 77, 0.3)', borderRadius: '8px' }}>
              <strong style={{ color: '#ff6b6b' }}>⚠️ MBOM Rejected — Manufacturing Comments:</strong>
              <p style={{ margin: '8px 0 0', color: '#ffaaaa' }}>"{mbomRejection.comments || 'No comments provided.'}"</p>
            </div>
          )}

          <div className="bom-table-container">
            <table className="bom-table">
              <thead>
                <tr>
                  <th>Part No.</th>
                  <th>Drawing No.</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>UoM</th>
                  <th>Material</th>
                  <th>Type</th>
                  <th>Rev</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={`skeleton-bom-${i}`}>
                      <td><div className="skeleton-text" style={{ width: '90px' }}></div></td>
                      <td><div className="skeleton-text" style={{ width: '90px' }}></div></td>
                      <td><div className="skeleton-text" style={{ width: '120px' }}></div></td>
                      <td><div className="skeleton-text" style={{ width: '40px' }}></div></td>
                      <td><div className="skeleton-text" style={{ width: '40px' }}></div></td>
                      <td><div className="skeleton-text" style={{ width: '70px' }}></div></td>
                      <td><div className="skeleton-text" style={{ width: '60px' }}></div></td>
                      <td><div className="skeleton-text" style={{ width: '40px' }}></div></td>
                      <td><div className="skeleton-text" style={{ width: '60px' }}></div></td>
                      <td><div className="skeleton-text button" style={{ height: '24px', width: '80px' }}></div></td>
                    </tr>
                  ))
                ) : bomItems.length === 0 ? (
                  <tr><td colSpan="10" className="text-center text-muted" style={{ textAlign: 'center', padding: '24px' }}>No parts added to the EBOM yet.</td></tr>
                ) : (
                  bomItems.map(item => (
                    <tr key={item.id}>
                      <td style={{fontFamily: 'monospace', color: 'var(--accent)'}}>{item.part_number}</td>
                      <td>{item.drawing_number || 'N/A'}</td>
                      <td>{item.part_name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.uom || 'pcs'}</td>
                      <td>{item.material || 'N/A'}</td>
                      <td>
                        <span className={`bom-type-badge ${(item.bom_type || 'EBOM').toLowerCase()}`}>
                          {item.bom_type || 'EBOM'}
                        </span>
                      </td>
                      <td>{item.revision}</td>
                      <td>
                        <span className={`bom-status-pill ${item.status === 'Under Review (ECO)' ? 'under-review-eco' : (item.status || 'Draft').toLowerCase().replace(/ /g, '-')}`}>
                          {item.status || 'Draft'}
                        </span>
                      </td>
                      <td>
                        {canEditBom && item.status !== 'Under Review (ECO)' && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {editingPartId === item.id ? (
                              <>
                                <input
                                  type="text"
                                  value={editMaterial}
                                  onChange={e => setEditMaterial(e.target.value)}
                                  placeholder="New material"
                                  style={{ width: '100px', padding: '4px 8px', fontSize: '0.75rem' }}
                                />
                                <button className="primary-btn small" onClick={() => handleMaterialUpdate(item.id, editMaterial)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Save</button>
                                <button className="secondary-btn small" onClick={() => setEditingPartId(null)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="secondary-btn small"
                                  onClick={() => { setEditingPartId(item.id); setEditMaterial(item.material || ''); }}
                                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                >
                                  Edit Material
                                </button>
                                <button className="secondary-btn small" onClick={() => handleEditPart(item)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                  Trigger ECO
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {canEditBom ? (
          <div className="add-part-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', alignItems: 'end' }}>
            <div className="form-group">
              <label>Part Number</label>
              <input type="text" placeholder="e.g. ASM-9901" value={partNumber} onChange={e => setPartNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Drawing Number</label>
              <input type="text" placeholder="e.g. DWG-229-01" value={drawingNumber} onChange={e => setDrawingNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input type="text" placeholder="e.g. Battery Tray" value={partName} onChange={e => setPartName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>
            <div className="form-group">
              <label>UoM</label>
              <select value={uom} onChange={e => setUom(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'rgba(20,20,25,0.95)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }}>
                <option value="pcs">pcs</option>
                <option value="kg">kg</option>
                <option value="m">m</option>
                <option value="l">l</option>
                <option value="sqm">sqm</option>
              </select>
            </div>
            <div className="form-group">
              <label>Material (Optional)</label>
              <input type="text" placeholder="e.g. AL-6061" value={material} onChange={e => setMaterial(e.target.value)} />
            </div>
            <div className="form-group">
              <label>BOM Type</label>
              <select value={bomType} onChange={e => setBomType(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'rgba(20,20,25,0.95)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }}>
                <option value="EBOM">EBOM</option>
                <option value="MBOM">MBOM</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'rgba(20,20,25,0.95)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }}>
                <option value="Draft">Draft</option>
                <option value="Under Review">Under Review</option>
                <option value="Approved">Approved</option>
                <option value="Released">Released</option>
              </select>
            </div>
            <button className="primary-btn" style={{height: '38px', width: '100%'}} onClick={handleAddPart}>
              <Plus size={16} /> Add
            </button>
          </div>
          ) : (
            <p className="text-muted" style={{ marginTop: '16px', fontSize: '0.85rem' }}>
              View-only access. Only Lead and Chief Engineers can add or edit BOM parts.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EBOMDashboard;
