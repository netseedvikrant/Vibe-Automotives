import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Box, AlertTriangle, CheckCircle, MessageSquare, 
  Send, Maximize2, RotateCcw, ZoomIn, ZoomOut, Download, ExternalLink, FileText, Layers, Activity
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './DDRDashboard.css';
import CadFilesViewer from './CadFilesViewer';

const DDRDashboard = () => {
  const { profile } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const [loading, setLoading] = useState(true);

  // CAD Viewer Interactive States
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeCadFile, setActiveCadFile] = useState(null);
  const [activeTabLeft, setActiveTabLeft] = useState('visualizer');
  const containerRef = useRef(null);

  useEffect(() => {
    setZoom(1);
    setRotate(0);
    setIsFullscreen(false);
    if (selectedReview) {
      setActiveCadFile(selectedReview.cad_files);
      setActiveTabLeft(selectedReview.cad_files ? 'visualizer' : 'revisions');
    } else {
      setActiveCadFile(null);
    }
  }, [selectedReview]);

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
      // Sort reviews so that reviews of the latest created program appear on top
      enriched.sort((a, b) => {
        const dateA = a.design_tasks?.programs?.created_at ? new Date(a.design_tasks.programs.created_at) : new Date(a.created_at || 0);
        const dateB = b.design_tasks?.programs?.created_at ? new Date(b.design_tasks.programs.created_at) : new Date(b.created_at || 0);
        return dateB - dateA;
      });
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

  const getFullCadUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('storage/cad_models/')) {
      const filePath = url.replace('storage/cad_models/', '');
      const supabaseUrl = 'https://smkgmfgbuioclfbuuynl.supabase.co';
      return `${supabaseUrl}/storage/v1/object/public/cad_models/${filePath}`;
    }
    if (!url.includes('://')) {
      const supabaseUrl = 'https://smkgmfgbuioclfbuuynl.supabase.co';
      return `${supabaseUrl}/storage/v1/object/public/cad_models/${url}`;
    }
    return url;
  };

  const getFileType = (fileName) => {
    if (!fileName) return 'unknown';
    return fileName.split('.').pop().toLowerCase();
  };

  const renderCadViewer = () => {
    const cadFile = activeCadFile;
    const programId = selectedReview?.design_tasks?.program_id || selectedReview?.program_id;
    const programName = selectedReview?.design_tasks?.programs?.program_name;

    if (!cadFile) {
      return (
        <div 
          className="cad-viewer-panel" 
          style={{ 
            padding: '32px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '10px', 
            height: '100%', 
            width: '100%',
            alignItems: 'center', 
            justifyContent: 'center', 
            background: 'var(--bg-surface)' 
          }}
        >
          <Box size={40} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
          <h4 style={{ color: 'var(--text-primary)', margin: 0 }}>No CAD File Selected</h4>
          <p style={{ fontSize: '0.8rem', color: '#000000', margin: 0, textAlign: 'center' }}>
            Choose a revision from the "Program Revisions &amp; BOM" tab above to review.
          </p>
        </div>
      );
    }

    const resolvedUrl = getFullCadUrl(cadFile.file_url);
    const fileExt = getFileType(cadFile.file_name);
    const isHtml = fileExt === 'html' || fileExt === 'htm' || 
                   resolvedUrl.toLowerCase().includes('.html') || 
                   resolvedUrl.toLowerCase().includes('.htm');
    const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(fileExt) && !isHtml;
    const isPdf = fileExt === 'pdf';

    if (isImage) {
      return (
        <div 
          ref={containerRef}
          className={`cad-viewer-panel ${isFullscreen ? 'fullscreen-cad-viewer' : ''}`} 
          style={isFullscreen ? {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            background: '#0a0a0f',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          } : { height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}
        >
          <div className="cad-overlay" style={{ zIndex: 10 }}>
            <button className="viewer-tool" title="Zoom In" onClick={() => setZoom(z => Math.min(4, z + 0.2))}><ZoomIn size={16} /></button>
            <button className="viewer-tool" title="Zoom Out" onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}><ZoomOut size={16} /></button>
            <button className="viewer-tool" title="Rotate 90°" onClick={() => setRotate(r => r + 90)}><RotateCcw size={16} /></button>
            <button className="viewer-tool" title="Reset View" onClick={() => { setZoom(1); setRotate(0); }}><Layers size={16} /></button>
            <button className="viewer-tool" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"} onClick={() => setIsFullscreen(!isFullscreen)}><Maximize2 size={16} /></button>
            {resolvedUrl && (
              <button className="viewer-tool" title="Download File" onClick={() => window.open(resolvedUrl, '_blank', 'noopener,noreferrer')} style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
                <Download size={16} />
              </button>
            )}
          </div>
          
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
            <motion.img
              key={resolvedUrl}
              src={resolvedUrl}
              alt={cadFile.file_name}
              drag
              dragElastic={0.1}
              dragMomentum={false}
              dragConstraints={containerRef}
              animate={{ scale: zoom, rotate: rotate }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              style={{
                maxWidth: '85%',
                maxHeight: '85%',
                objectFit: 'contain',
                cursor: 'grab',
                borderRadius: '8px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
              }}
              whileDrag={{ cursor: 'grabbing' }}
            />
          </div>

          {!isFullscreen && (
            <div style={{ position: 'absolute', bottom: '12px', right: '16px', background: 'rgba(0,0,0,0.75)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.15)', color: '#ffffff' }}>
              {cadFile.file_name} ({cadFile.version})
            </div>
          )}
        </div>
      );
    }

    if (isPdf || isHtml) {
      return (
        <div 
          className={`cad-viewer-panel ${isFullscreen ? 'fullscreen-cad-viewer' : ''}`} 
          style={isFullscreen ? {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            background: '#0a0a0f',
            display: 'flex',
            flexDirection: 'column'
          } : { height: '100%', width: '100%', position: 'relative' }}
        >
          <div className="cad-overlay" style={{ zIndex: 10, background: 'rgba(10,10,15,0.8)', padding: '4px 8px', borderRadius: '8px', top: '8px', left: '8px' }}>
            <button className="viewer-tool" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"} onClick={() => setIsFullscreen(!isFullscreen)}><Maximize2 size={16} /></button>
            <button className="viewer-tool" title="Download Blueprint PDF" onClick={() => window.open(resolvedUrl, '_blank', 'noopener,noreferrer')} style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
              <Download size={16} />
            </button>
          </div>
          <iframe 
            src={resolvedUrl} 
            title={cadFile.file_name} 
            style={{ width: '100%', height: '100%', border: 'none', background: 'var(--bg-card)' }}
          />
        </div>
      );
    }

    // Default CAD format viewer (STEP, STL, STP, PRT, etc.)
    return (
      <div className="cad-viewer-panel" style={{ height: '100%', width: '100%', padding: '24px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '36px', background: 'var(--bg-surface)' }}>
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
          style={{ flexShrink: 0, width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(29, 78, 216, 0.03)', border: '1px dashed var(--accent)', borderRadius: '50%', position: 'relative' }}
        >
          <Box size={48} style={{ color: 'var(--accent)', filter: 'drop-shadow(0 0 6px var(--accent-glow))' }} />
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
            style={{ position: 'absolute', width: '76px', height: '76px', border: '1px solid rgba(29, 78, 216, 0.15)', borderRadius: '50%', borderTopColor: 'var(--accent)' }}
          ></motion.div>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '60%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="status-badge-studio" style={{ background: 'rgba(29, 78, 216, 0.1)', color: 'var(--accent)', padding: '2px 8px', fontSize: '0.65rem', borderRadius: '4px', textTransform: 'uppercase' }}>
              {fileExt.toUpperCase()} Model
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Rev: {cadFile.version}
            </span>
          </div>
          <h3 style={{ color: '#000000', fontSize: '1rem', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {cadFile.file_name}
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            {cadFile.description || 'CAD revision details.'}
          </p>
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button 
              className="primary-btn small" 
              onClick={() => window.open(resolvedUrl, '_blank', 'noopener,noreferrer')}
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary))', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontWeight: 'bold' }}
            >
              <Download size={14} /> Download CAD Drawing
            </button>
            {resolvedUrl && (
              <a 
                href={resolvedUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="secondary-btn small"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', textDecoration: 'none' }}
              >
                <ExternalLink size={14} /> Open in PDM
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

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
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={`skeleton-ddr-${i}`} className="review-card" style={{ opacity: 0.5 }}>
                  <div className="review-meta">
                    <div className="skeleton-text" style={{ width: '45%' }}></div>
                    <div className="skeleton-text short" style={{ width: '20%' }}></div>
                  </div>
                  <div className="skeleton-text" style={{ width: '85%', height: '14px', margin: '8px 0' }}></div>
                  <div className="review-meta">
                    <div className="skeleton-text" style={{ width: '30%' }}></div>
                    <div className="skeleton-text" style={{ width: '25%' }}></div>
                  </div>
                </div>
              ))
            ) : reviews.length === 0 ? (
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
            <div className="workspace-left-pane">
              <div className="left-pane-tabs">
                <button 
                  className={`pane-tab-btn ${activeTabLeft === 'visualizer' ? 'active' : ''}`}
                  onClick={() => setActiveTabLeft('visualizer')}
                >
                  🔍 CAD Visualizer
                </button>
                <button 
                  className={`pane-tab-btn ${activeTabLeft === 'revisions' ? 'active' : ''}`}
                  onClick={() => setActiveTabLeft('revisions')}
                >
                  📂 Program Revisions &amp; BOM
                </button>
              </div>
              <div className="left-pane-content" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {activeTabLeft === 'visualizer' ? (
                  renderCadViewer()
                ) : (
                  <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
                    <CadFilesViewer 
                      programId={selectedReview?.design_tasks?.program_id || selectedReview?.program_id}
                      programName={selectedReview?.design_tasks?.programs?.program_name}
                      defaultOpen={true}
                      onSelectFile={(file) => {
                        setActiveCadFile(file);
                        setActiveTabLeft('visualizer');
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="workspace-right-pane">
              <div className="comments-panel">
                <div className="comments-header-container">
                  <h3 className="comments-section-title">Engineering Comments</h3>
                  <div className="comments-status-actions">
                    {/* Only Chief Engineer can approve and freeze the design */}
                    {profile?.role === 'Chief Engineer' && selectedReview.status !== 'Resolved' && (
                      <button
                        className="primary-btn approve-freeze-btn"
                        onClick={handleApproveDDR}
                      >
                        ❄️ Approve DDR &amp; Freeze Design
                      </button>
                    )}
                    {/* Other roles see a read-only badge */}
                    {profile?.role !== 'Chief Engineer' && profile?.role !== 'Design Engineer' && selectedReview.status !== 'Resolved' && (
                      <span className="review-only-badge">
                        👁️ Review Only — Chief Engineer approves
                      </span>
                    )}
                    {selectedReview.status === 'Resolved' && (
                      <span className="design-frozen-badge">
                        ❄️ Design Frozen
                      </span>
                    )}
                  </div>
                </div>

                <div className="comments-list-container">
                  {loading ? (
                    Array(2).fill(0).map((_, i) => (
                      <div key={`skeleton-cmt-${i}`} className="comment-thread skeleton" style={{ opacity: 0.5 }}>
                        <div className="comment-header">
                          <div className="skeleton-text" style={{ width: '120px' }}></div>
                          <div className="skeleton-text" style={{ width: '60px' }}></div>
                        </div>
                        <div className="skeleton-text" style={{ width: '80%', margin: '8px 0' }}></div>
                        <div className="skeleton-text short" style={{ width: '40%' }}></div>
                      </div>
                    ))
                  ) : comments.length === 0 ? (
                    <p className="no-comments-placeholder">No comments yet. Add a review note below.</p>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} className={`comment-thread ${c.status === 'Resolved' ? 'resolved' : ''} ${c.severity.toLowerCase()}`}>
                        <div className="comment-header">
                          <div className="comment-author">
                            <span className="author-avatar">{c.author?.full_name ? c.author.full_name.split(' ').map(n=>n[0]).join('').slice(0, 2).toUpperCase() : 'ENG'}</span>
                            <div className="author-meta-block">
                              <span className="author-name">{c.author?.full_name || 'Engineer'}</span>
                              <span className="author-role">({c.author?.role})</span>
                            </div>
                          </div>
                          <div className="comment-meta-right">
                            <span className={`severity-badge ${c.severity.toLowerCase()}`}>{c.severity}</span>
                            <span className="comment-time">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <p className="comment-body">
                          {c.comment_text}
                        </p>
                        <div className="comment-actions">
                          {c.status === 'Resolved' ? (
                            <span className="resolution-status">
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
                </div>

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
                      <button className="primary-btn submit-comment-btn" onClick={handleAddComment}>
                        <Send size={16} /> Submit Comment
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
