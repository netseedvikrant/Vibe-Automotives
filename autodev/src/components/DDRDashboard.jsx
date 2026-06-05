import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Box, AlertTriangle, CheckCircle, MessageSquare, 
  Send, Maximize2, RotateCcw, ZoomIn, Layers, Activity
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './DDRDashboard.css';

const DDRDashboard = () => {
  const { profile } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, []);

  useEffect(() => {
    if (selectedReview) {
      fetchComments();
    }
  }, [selectedReview]);

  const fetchReviews = async () => {
    try {
      console.log('AutoDev: [DIAGNOSTIC] Starting DDR Fetch...');
      const { data: ddrs, error } = await supabase
        .from('ddr_reviews')
        .select('*');
      
      if (error) {
        alert(`DDR Fetch Error: ${error.message}`);
        throw error;
      }
      
      console.log('AutoDev: [DIAGNOSTIC] Raw DDRs:', ddrs);

      if (!ddrs || ddrs.length === 0) {
        setReviews([]);
        setLoading(false);
        return;
      }

      // Manual Join for safety
      const enriched = await Promise.all(ddrs.map(async (review) => {
        let taskData = null;
        let cadData = null;

        if (review.task_id) {
          const { data: tData } = await supabase.from('design_tasks').select('*, programs(*)').eq('id', review.task_id).single();
          taskData = tData;
        }
        
        if (review.cad_file_id) {
          const { data: cData } = await supabase.from('cad_files').select('*').eq('id', review.cad_file_id).single();
          cadData = cData;
        }

        return {
          ...review,
          design_tasks: taskData,
          cad_files: cadData
        };
      }));

      console.log('AutoDev: [DIAGNOSTIC] Enriched DDRs:', enriched);
      setReviews(enriched);
      if (enriched.length > 0) setSelectedReview(enriched[0]);
    } catch (err) {
      console.error('Error fetching DDR reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('ddr_comments')
        .select('*, author:users!author_id(full_name, role)')
        .eq('ddr_id', selectedReview.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedReview) return;

    try {
      const { error } = await supabase.from('ddr_comments').insert({
        ddr_id: selectedReview.id,
        cad_file_id: selectedReview.cad_file_id || null,
        author_id: profile.id,
        assigned_to: selectedReview.design_tasks?.assigned_engineer_id || null,
        severity: severity,
        comment_text: newComment,
        status: 'Open'
      });

      if (error) throw error;
      setNewComment('');
      fetchComments();
    } catch (err) {
      console.error('Error adding comment:', err);
      alert(`Failed to add comment: ${err.message || JSON.stringify(err)}`);
    }
  };

  const handleResolve = async (commentId) => {
    try {
      const { error } = await supabase
        .from('ddr_comments')
        .update({ status: 'Resolved', resolution_notes: 'Resolved by ' + profile.full_name })
        .eq('id', commentId);

      if (error) throw error;
      fetchComments();
    } catch (err) {
      console.error('Error resolving comment:', err);
    }
  };

  const handleApproveDDR = async () => {
    if (profile?.role !== 'Chief Engineer') {
      alert('Only the Chief Engineer can approve DDR reviews and freeze designs.');
      return;
    }
    try {
      // 1. Mark DDR as Resolved/Approved
      const { error: ddrErr } = await supabase
        .from('ddr_reviews')
        .update({ status: 'Resolved', current_stage: 'Approved' })
        .eq('id', selectedReview.id);
      if (ddrErr) throw ddrErr;

      // 2. Freeze the linked CAD file (Design Freeze)
      if (selectedReview.cad_file_id) {
        await supabase
          .from('cad_files')
          .update({ status: 'Frozen' })
          .eq('id', selectedReview.cad_file_id);
      }

      // 3. Workflow notification
      await supabase.from('notifications').insert({
        title: '❄️ DDR Approved — Design Frozen',
        message: `Chief Engineer approved DDR: "${selectedReview.title}". The design is now officially frozen. No further CAD changes permitted without an ECO.`,
        type: 'success'
      });

      // 4. Activity log
      await supabase.from('activity_logs').insert({
        program_id: selectedReview.design_tasks?.program_id || null,
        action_type: 'DDR Approved',
        action_description: `Chief Engineer froze design: DDR "${selectedReview.title}" approved. CAD locked.`
      });

      fetchReviews();
      alert('❄️ DDR Review Approved. Design is now Frozen. CAD file has been locked — any changes require an Engineering Change Order (ECO).');
    } catch (err) {
      console.error('Error approving DDR:', err);
      alert(`Failed to approve DDR: ${err.message}`);
    }
  };

  if (loading) return <div className="flex-center h-100"><Activity className="animate-spin text-accent" size={32} /></div>;

  return (
    <div className="ddr-dashboard-container">
      <div className="ddr-header">
        <div className="header-left">
          <div className="status-badge-studio">CROSS FUNCTIONAL PANEL</div>
          <h1>Design Detail Review (DDR)</h1>
          <p className="ddr-meta">COLLABORATIVE ENGINEERING WORKSPACE // ISSUE TRACKING</p>
        </div>
      </div>

      <div className="ddr-main-layout">
        <aside className="ddr-sidebar glass-dark">
          <div className="sidebar-header">
            <h3>Active Reviews</h3>
          </div>
          <div className="review-list">
            {reviews.length === 0 ? (
              <p className="text-muted" style={{padding: '16px'}}>No active DDRs.</p>
            ) : (
              reviews.map(review => (
                <div 
                  key={review.id} 
                  className={`review-card ${selectedReview?.id === review.id ? 'active' : ''}`}
                  onClick={() => setSelectedReview(review)}
                >
                  <div className="review-meta">
                    <span style={{color: 'var(--accent)'}}>{review.design_tasks?.programs?.program_name}</span>
                    <span>{new Date(review.created_at).toLocaleDateString()}</span>
                  </div>
                  <h4>{review.title}</h4>
                  <div className="review-meta" style={{marginBottom: 0, marginTop: '8px'}}>
                    <span>Rev: {review.cad_files?.version || 'N/A'}</span>
                    <span className="severity-pill" style={{
                      background: review.status === 'Resolved' ? 'rgba(0,255,157,0.1)' : 'rgba(255,170,0,0.1)',
                      color: review.status === 'Resolved' ? 'var(--success)' : 'var(--warning)',
                      border: 'none'
                    }}>{review.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {selectedReview ? (
          <div className="ddr-workspace">
            <div className="cad-viewer-panel">
              <div className="cad-overlay">
                <button className="viewer-tool"><ZoomIn size={16} /></button>
                <button className="viewer-tool"><RotateCcw size={16} /></button>
                <button className="viewer-tool"><Layers size={16} /></button>
                <button className="viewer-tool"><Maximize2 size={16} /></button>
              </div>
              <Box size={64} style={{color: 'var(--accent)', opacity: 0.4, marginBottom: '16px'}} />
              <h3 style={{color: 'var(--text-secondary)'}}>3DEXPERIENCE Viewer Simulation</h3>
              <p style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{selectedReview.cad_files?.file_name}</p>
            </div>

            <div className="comments-panel">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3>Engineering Comments</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Only Chief Engineer can approve and freeze the design */}
                  {profile?.role === 'Chief Engineer' && selectedReview.status !== 'Resolved' && (
                    <button
                      className="primary-btn"
                      onClick={handleApproveDDR}
                      style={{ background: 'linear-gradient(135deg, #00b4d8, #0077b6)', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      ❄️ Approve DDR &amp; Freeze Design
                    </button>
                  )}
                  {/* Other roles see a read-only badge */}
                  {profile?.role !== 'Chief Engineer' && profile?.role !== 'Design Engineer' && selectedReview.status !== 'Resolved' && (
                    <span style={{ fontSize: '0.75rem', color: '#808090', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px' }}>
                      👁️ Review Only — Chief Engineer approves
                    </span>
                  )}
                  {selectedReview.status === 'Resolved' && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                      ❄️ Design Frozen
                    </span>
                  )}
                </div>
              </div>

              {comments.length === 0 ? (
                <p className="text-muted text-center" style={{marginTop: '20px'}}>No comments yet. Add a review note below.</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="comment-thread" style={{ opacity: c.status === 'Resolved' ? 0.6 : 1, borderLeftColor: c.status === 'Resolved' ? 'var(--success)' : (c.severity === 'Critical' ? 'var(--error)' : 'var(--accent)') }}>
                    <div className="comment-header">
                      <div className="comment-author">
                        {c.author?.full_name || 'Engineer'} 
                        <span className="author-role">({c.author?.role})</span>
                      </div>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <span className={`severity-pill ${c.severity.toLowerCase()}`}>{c.severity}</span>
                        <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>{new Date(c.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <p className="comment-body" style={{ textDecoration: c.status === 'Resolved' ? 'line-through' : 'none' }}>
                      {c.comment_text}
                    </p>
                    <div className="comment-actions">
                      {c.status === 'Resolved' ? (
                        <span style={{color: 'var(--success)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px'}}>
                          <CheckCircle size={14} /> {c.resolution_notes || 'Resolved'}
                        </span>
                      ) : (
                        <>
                          {(profile?.role === 'Design Engineer' || profile?.id === c.assigned_to) && (
                            <button className="action-btn resolve" onClick={() => handleResolve(c.id)}>Resolve</button>
                          )}
                          <button className="action-btn">Reply</button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}

              {selectedReview.status !== 'Resolved' && (
                <div className="add-comment-box">
                  <textarea 
                    rows="3" 
                    placeholder="Add an engineering review comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="comment-controls">
                    <select 
                      className="severity-select"
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                    >
                      <option value="Low">Low Severity</option>
                      <option value="Medium">Medium Severity</option>
                      <option value="High">High Severity</option>
                      <option value="Critical">Critical</option>
                    </select>
                    <button className="primary-btn" onClick={handleAddComment}>
                      <Send size={16} /> Submit
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="ddr-workspace flex-center">
            <MessageSquare size={48} className="text-muted" style={{opacity: 0.3, marginBottom: '16px'}} />
            <h3 className="text-muted">Select a DDR Review</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default DDRDashboard;
