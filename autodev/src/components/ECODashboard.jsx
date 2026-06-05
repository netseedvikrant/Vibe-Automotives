import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileWarning, Settings, PenTool, RotateCcw, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './ECODashboard.css';

const ECODashboard = () => {
  const { profile } = useAuth();
  const [ecos, setEcos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedEcoId, setExpandedEcoId] = useState(null);
  const [voteComments, setVoteComments] = useState('');
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [resubmitDescription, setResubmitDescription] = useState('');

  useEffect(() => {
    fetchECOs();
  }, []);

  const fetchECOs = async () => {
    try {
      const { data, error } = await supabase
        .from('eco_requests')
        .select('*, programs(program_name), eco_votes(*, users(full_name, role))')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setEcos(data || []);
    } catch (err) {
      console.error('Error fetching ECOs:', err);
    } finally {
      setLoading(false);
    }
  };

  const advanceECOPhase = async (ecoId, currentStatus) => {
    const workflow = ['Pending', 'Design Updated', 'BOM Updated', 'Rebuilt & Retesting', 'Implemented'];
    const nextIdx = workflow.indexOf(currentStatus) + 1;
    if (nextIdx >= workflow.length) return;

    try {
      await supabase.from('eco_requests').update({ status: workflow[nextIdx] }).eq('id', ecoId);
      fetchECOs();
    } catch (err) {
      console.error('Error updating ECO:', err);
    }
  };

  const castCfrbVote = async (ecoId, voteType) => {
    if (!profile) {
      alert('Error: You must be logged in to vote.');
      return;
    }
    const cfrbRoles = ['Chief Engineer', 'Lead Engineer', 'Quality Engineer', 'Manufacturing Engineer'];
    if (!cfrbRoles.includes(profile.role)) {
      alert(`Error: Your role (${profile.role}) is not part of the Cross-Functional Review Board (CFRB).`);
      return;
    }

    setIsSubmittingVote(true);
    try {
      const { error } = await supabase
        .from('eco_votes')
        .upsert({
          eco_id: ecoId,
          user_id: profile.id,
          vote: voteType,
          comments: voteComments,
          timestamp: new Date().toISOString()
        }, { onConflict: 'eco_id,user_id' });

      if (error) throw error;
      
      const event = new CustomEvent('autodev-toast', {
        detail: {
          title: '🛡️ CFRB Vote Cast',
          message: `Your vote of "${voteType}" has been registered for this ECO.`,
          type: 'success'
        }
      });
      window.dispatchEvent(event);

      setVoteComments('');
      
      // Auto-process CFRB outcome
      const { data: allVotes } = await supabase.from('eco_votes').select('vote').eq('eco_id', ecoId);
      if (allVotes && allVotes.length >= 3) {
        const rejects = allVotes.filter(v => v.vote === 'Reject').length;
        if (rejects > 0) {
          await supabase.from('eco_requests').update({ status: 'Rejected', rejection_reason: 'CFRB Vetoed ECO' }).eq('id', ecoId);
          await supabase.from('activity_logs').insert({
            action_type: 'ECO Rejected',
            action_description: `CFRB rejected ECO. Total Rejects: ${rejects}`
          });
          alert('CFRB Voting completed. ECO has been REJECTED based on CFRB votes.');
        } else if (allVotes.length >= 4) { // Assume 4 members
          await supabase.from('eco_requests').update({ status: 'Pending' }).eq('id', ecoId);
          await supabase.from('activity_logs').insert({
            action_type: 'ECO Approved',
            action_description: `CFRB unanimously approved ECO. Proceeding to Design Update.`
          });
          alert('CFRB Voting completed. ECO has been APPROVED and advanced to Design Engineering.');
        }
      }

      await fetchECOs();
    } catch (err) {
      console.error('Error casting vote:', err);
      alert('Error casting vote: ' + err.message);
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const handleECOResubmit = async (ecoId, newDescription) => {
    if (!newDescription?.trim()) return alert('Please provide an updated ECO description.');
    try {
      await supabase.from('eco_requests').update({
        status: 'Pending',
        description: newDescription,
        rejection_reason: null
      }).eq('id', ecoId);
      await supabase.from('eco_votes').delete().eq('eco_id', ecoId);
      await supabase.from('activity_logs').insert({
        program_id: ecos.find(e => e.id === ecoId)?.program_id || null,
        action_type: 'ECO Resubmitted',
        action_description: 'ECO resubmitted with revised proposal after CFRB veto.'
      });
      setResubmitDescription('');
      alert('ECO resubmitted for a fresh CFRB review round.');
      fetchECOs();
    } catch (err) {
      alert('Failed to resubmit ECO: ' + err.message);
    }
  };

  const toggleExpandedEco = (ecoId) => {
    if (expandedEcoId === ecoId) {
      setExpandedEcoId(null);
    } else {
      setExpandedEcoId(ecoId);
      setVoteComments('');
      setResubmitDescription('');
    }
  };

  const getActionForRole = (eco) => {
    const role = profile?.role;
    const status = eco.status;

    if (status === 'Draft') {
      return <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Awaiting CFRB Voting</span>;
    }
    if (role === 'Design Engineer' && status === 'Pending') {
      return <button className="primary-btn small" onClick={() => advanceECOPhase(eco.id, status)}><PenTool size={14}/> Update Design CAD</button>;
    }
    if ((role === 'Design Engineer' || role === 'Manufacturing Engineer') && status === 'Design Updated') {
      return <button className="primary-btn small" onClick={() => advanceECOPhase(eco.id, status)}><Settings size={14}/> Publish New eBOM/MBOM</button>;
    }
    if (role === 'Manufacturing Engineer' && status === 'BOM Updated') {
      return <button className="primary-btn small" onClick={() => advanceECOPhase(eco.id, status)}><RotateCcw size={14}/> Rebuild Prototype</button>;
    }
    if ((role === 'Quality Engineer' || role === 'Lead Engineer') && status === 'Rebuilt & Retesting') {
      return <button className="success-btn small" onClick={() => advanceECOPhase(eco.id, status)}><CheckCircle2 size={14}/> Verify & Close ECO</button>;
    }
    
    return <span className="text-muted text-sm">Awaiting other department</span>;
  };

  if (loading) return <div className="flex-center h-100">Loading ECO Management System...</div>;

  return (
    <motion.div className="dashboard-wrapper eco-dashboard" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}}>
      <header className="val-header" style={{marginBottom: '24px'}}>
        <div className="header-left">
          <div className="status-badge-val" style={{background: 'rgba(255, 59, 48, 0.1)', color: 'var(--error)'}}>
            CRITICAL WORKFLOW
          </div>
          <h1>ECO Management Dashboard</h1>
          <p className="technical-meta">ENGINEERING CHANGE ORDERS // REDESIGN // REBUILD</p>
        </div>
      </header>

      <section className="glass p-xl">
        <div className="section-header" style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px'}}>
          <FileWarning size={20} color="var(--error)" />
          <h3 style={{margin: 0}}>Active Change Orders (Click row to expand CFRB Panel)</h3>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>ECO Ref</th>
              <th>Program</th>
              <th>Issue Description</th>
              <th>Change Type</th>
              <th>Affected Parts</th>
              <th>Cost Impact</th>
              <th>Impl. Date</th>
              <th>Phase</th>
              <th>Required Action ({profile?.role})</th>
            </tr>
          </thead>
          <tbody>
            {ecos.length === 0 ? (
              <tr><td colSpan="5" className="text-center text-muted">No active Engineering Change Orders.</td></tr>
            ) : ecos.map(eco => (
              <React.Fragment key={eco.id}>
                <tr 
                  onClick={() => toggleExpandedEco(eco.id)} 
                  style={{ cursor: 'pointer', background: expandedEcoId === eco.id ? 'rgba(255, 255, 255, 0.02)' : 'transparent' }}
                >
                  <td>
                    <span style={{ marginRight: '8px', color: 'var(--accent)', fontSize: '0.8rem' }}>
                      {expandedEcoId === eco.id ? '▼' : '▶'}
                    </span>
                    <strong>ECO-{eco.id.substring(0, 6).toUpperCase()}</strong>
                  </td>
                  <td>{eco.programs?.program_name || 'Global'}</td>
                  <td style={{maxWidth: '250px'}}>{eco.title}</td>
                  <td>{eco.change_type || 'Design'}</td>
                  <td>{eco.affected_parts || 'N/A'}</td>
                  <td>{eco.cost_of_change ? `$${eco.cost_of_change}` : 'TBD'}</td>
                  <td>{eco.implementation_date || 'TBD'}</td>
                  <td>
                    <span className={`status-pill ${eco.status === 'Implemented' ? 'passed' : eco.status === 'Draft' ? 'scheduled' : 'running'}`}>
                      {eco.status}
                    </span>
                  </td>
                  <td>
                    {eco.status === 'Implemented' ? (
                      <span className="text-success"><CheckCircle2 size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: '4px'}}/> Closed</span>
                    ) : (
                      getActionForRole(eco)
                    )}
                  </td>
                </tr>
                {expandedEcoId === eco.id && (
                  <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                    <td colSpan={9} style={{ padding: '20px 24px', borderTop: 'none' }}>
                      <div className="cfrb-panel glass-dark" style={{ padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h4 style={{ margin: 0, color: 'var(--accent)', fontSize: '0.95rem' }}>Cross-Functional Review Board (CFRB) Status</h4>
                          <span style={{ fontSize: '0.75rem', color: '#808090' }}>Auto-Approve requires ≥2 CFRB member votes</span>
                        </div>

                        {/* CFRB Roles grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                          {['Chief Engineer', 'Lead Engineer', 'Quality Engineer', 'Manufacturing Engineer'].map(role => {
                            const voter = eco.eco_votes?.find(v => v.users?.role === role);
                            return (
                              <div key={role} style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 'bold' }}>{role}</div>
                                {voter ? (
                                  <div style={{ marginTop: '8px' }}>
                                    <span className={`status-pill ${voter.vote === 'Approve' ? 'passed' : voter.vote === 'Reject' ? 'failed' : 'scheduled'}`} style={{ fontSize: '0.7rem' }}>
                                      {voter.vote.toUpperCase()}
                                    </span>
                                    <div style={{ fontSize: '0.75rem', color: '#ccc', marginTop: '6px', fontStyle: 'italic' }}>
                                      "{voter.comments || 'No comment'}"
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ marginTop: '8px' }}>
                                    <span className="status-pill scheduled" style={{ background: 'rgba(255,255,255,0.05)', color: '#888', fontSize: '0.7rem' }}>PENDING</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* If current user has a CFRB role, display voting form */}
                        {['Chief Engineer', 'Lead Engineer', 'Quality Engineer', 'Manufacturing Engineer'].includes(profile?.role) && (
                          <div style={{ background: 'rgba(0,180,216,0.03)', border: '1px solid rgba(0,180,216,0.1)', padding: '16px', borderRadius: '6px' }}>
                            <h5 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#fff' }}>Cast Your CFRB Review Vote</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <textarea
                                placeholder="Enter review comments (justification, constraints, design reviews...)"
                                value={voteComments}
                                onChange={e => setVoteComments(e.target.value)}
                                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff', fontSize: '0.85rem', minHeight: '60px', resize: 'vertical' }}
                              />
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                  className="success-btn small"
                                  onClick={(e) => { e.stopPropagation(); castCfrbVote(eco.id, 'Approve'); }}
                                  disabled={isSubmittingVote}
                                >
                                  Approve
                                </button>
                                <button
                                  className="danger-btn small"
                                  onClick={(e) => { e.stopPropagation(); castCfrbVote(eco.id, 'Reject'); }}
                                  disabled={isSubmittingVote}
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); castCfrbVote(eco.id, 'More Info'); }}
                                  disabled={isSubmittingVote}
                                  style={{ background: '#ffaa00', border: 'none', color: '#000', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                                >
                                  Request More Info
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {eco.status === 'Rejected' && ['Lead Engineer', 'Design Engineer'].includes(profile?.role) && (
                          <div style={{ marginTop: '16px', background: 'rgba(255,77,77,0.05)', border: '1px solid rgba(255,77,77,0.2)', padding: '16px', borderRadius: '6px' }}>
                            <h5 style={{ margin: '0 0 10px 0', color: '#ff6b6b' }}>Resubmit with Revised Proposal</h5>
                            <p style={{ fontSize: '0.8rem', color: '#a0a0b0', margin: '0 0 8px' }}>
                              CFRB veto reason: {eco.rejection_reason || 'Not specified'}
                            </p>
                            <textarea
                              placeholder="Updated ECO description addressing CFRB feedback..."
                              value={resubmitDescription}
                              onChange={e => setResubmitDescription(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff', fontSize: '0.85rem', minHeight: '60px', marginBottom: '10px' }}
                            />
                            <button
                              className="primary-btn small"
                              onClick={(e) => { e.stopPropagation(); handleECOResubmit(eco.id, resubmitDescription); }}
                            >
                              Resubmit ECO
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </section>

      <section className="glass p-xl mt-4">
        <h3>ECO APQP Workflow Guide</h3>
        <div className="eco-flow-guide">
          <div className="flow-step">
            <div className="step-num">1</div>
            <div><strong>CFRB Review</strong><br/>Requires multi-role approval</div>
          </div>
          <div className="flow-step">
            <div className="step-num">2</div>
            <div><strong>Design Engineer</strong><br/>Updates CAD & Releases</div>
          </div>
          <div className="flow-step">
            <div className="step-num">3</div>
            <div><strong>Mfg Engineer</strong><br/>Updates BOM & Routing</div>
          </div>
          <div className="flow-step">
            <div className="step-num">4</div>
            <div><strong>Plant Operations</strong><br/>Rebuilds Prototype</div>
          </div>
          <div className="flow-step">
            <div className="step-num">5</div>
            <div><strong>Quality/Lead</strong><br/>Retests & Closes ECO</div>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

export default ECODashboard;
