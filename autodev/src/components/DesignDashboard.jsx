import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Box, Upload, Layers, FileCode, MessageSquare, RefreshCcw, 
  CheckCircle, Clock, History, FileText, Search, Filter, 
  Plus, Settings, Cpu, Database, Activity, ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { uploadToCloudinary } from '../lib/cloudinary';
import './DesignDashboard.css';

const DesignDashboard = () => {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks'); // tasks, cad, bom, ddr
  const [isUploading, setIsUploading] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [linkedParts, setLinkedParts] = useState([]);
  const [ebomParts, setEbomParts] = useState([]);
  const [ebomSearch, setEbomSearch] = useState('');

  useEffect(() => {
    fetchDesignTasks();
  }, []);

  useEffect(() => {
    if (selectedTask) {
      fetchRevisions();
      setLinkedParts(selectedTask.ebom_refs || []);
    }
  }, [selectedTask]);

  useEffect(() => {
    if (selectedTask && activeTab === 'ebom-linking') {
      fetchEbomParts();
    }
  }, [selectedTask, activeTab]);

  const fetchEbomParts = async () => {
    if (!selectedTask?.program_id) return;
    try {
      const { data, error } = await supabase
        .from('ebom')
        .select('id, part_number, part_name, material')
        .eq('program_id', selectedTask.program_id)
        .order('part_number', { ascending: true });
      if (error) throw error;
      setEbomParts(data || []);
    } catch (err) {
      console.error('Error fetching eBOM parts:', err);
      setEbomParts([]);
    }
  };

  const togglePartLink = async (partNumber) => {
    if (!selectedTask) return;
    const newRefs = linkedParts.includes(partNumber)
      ? linkedParts.filter(p => p !== partNumber)
      : [...linkedParts, partNumber];

    try {
      const { error } = await supabase
        .from('design_tasks')
        .update({ ebom_refs: newRefs })
        .eq('id', selectedTask.id);
      if (error) throw error;
      setLinkedParts(newRefs);
      setSelectedTask(prev => ({ ...prev, ebom_refs: newRefs }));
    } catch (err) {
      console.error('Error linking part:', err);
      alert('Failed to save eBOM link: ' + err.message);
    }
  };

  const fetchRevisions = async () => {
    if (!selectedTask) return;
    try {
      const { data, error } = await supabase
        .from('cad_files')
        .select('*')
        .eq('program_id', selectedTask.program_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRevisions(data || []);
    } catch (err) {
      console.error('Error fetching revisions:', err);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedTask) return;

    setIsUploading(true);
    
    try {
      // Upload file directly to Cloudinary
      const uploadResult = await uploadToCloudinary(file);
      const publicUrl = uploadResult.url;

      // Version calculation: proposal of v1.x based on highest current version
      let newVersion = 'v1.0';
      if (revisions && revisions.length > 0) {
        const latestRev = revisions[0]; // Ordered descending by created_at
        const match = latestRev.version.match(/^v(\d+)\.(\d+)$/);
        if (match) {
          const major = parseInt(match[1], 10);
          const minor = parseInt(match[2], 10);
          newVersion = `v${major}.${minor + 1}`;
        } else {
          newVersion = `v1.${revisions.length + 1}`;
        }
      }

      const { error } = await supabase.from('cad_files').insert({
        program_id: selectedTask.program_id,
        file_name: file.name,
        file_url: publicUrl,
        version: newVersion,
        description: `Storage: ${uploadResult.publicId} | Task: ${selectedTask.task_name} | Size: ${(file.size / 1024).toFixed(1)} KB`,
        uploaded_by: profile?.id,
        status: 'In Progress'
      });

      if (error) throw error;
      
      await fetchRevisions();
      if (selectedTask.status === 'Not Started') {
        await updateTaskStatus(selectedTask.id, 'In Progress');
      }
      event.target.value = '';
      alert(`CAD file uploaded to Cloudinary as ${newVersion}.\n\nFile: ${file.name}\nURL: ${publicUrl}`);
    } catch (err) {
      console.error('Error uploading file:', err);
      alert(`Failed to upload revision: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const [ddrComments, setDdrComments] = useState([]);
  const [currentDDR, setCurrentDDR] = useState(null);

  useEffect(() => {
    if (selectedTask && activeTab === 'ddr-review') {
      fetchDdrComments();
    }
  }, [selectedTask, activeTab]);

  const fetchDdrComments = async () => {
    if (!selectedTask) return;
    try {
      const { data: reviews } = await supabase
        .from('ddr_reviews')
        .select('*')
        .eq('task_id', selectedTask.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (reviews && reviews.length > 0) {
        setCurrentDDR(reviews[0]);
        const { data: comments, error } = await supabase
          .from('ddr_comments')
          .select('*, author:users!author_id(full_name, role)')
          .eq('ddr_id', reviews[0].id)
          .order('created_at', { ascending: true });
        
        if (!error) {
          setDdrComments(comments || []);
        }
      } else {
        setCurrentDDR(null);
        setDdrComments([]);
      }
    } catch (err) {
      console.error('Error fetching DDR comments:', err);
    }
  };

  const handleDDRResubmit = async (ddrId, latestCadId) => {
    if (!latestCadId) return alert('Upload a revised CAD revision before resubmitting.');
    try {
      const { error } = await supabase.from('ddr_reviews').update({
        status: 'Under Review',
        cad_file_id: latestCadId,
        rejection_reason: null,
        current_stage: 'Initial Review'
      }).eq('id', ddrId);
      if (error) throw error;

      await supabase.from('design_tasks')
        .update({ status: 'DDR Review' })
        .eq('id', selectedTask.id);

      await supabase.from('notifications').insert({
        title: 'DDR Resubmitted for Review',
        message: `DDR "${currentDDR?.title}" has been resubmitted with updated CAD.`,
        type: 'info'
      });

      alert('DDR resubmitted for Chief Engineer review.');
      fetchDdrComments();
      fetchDesignTasks();
    } catch (err) {
      alert('Failed to resubmit DDR: ' + err.message);
    }
  };

  const ddrStageSteps = ['Initial Review', 'Cross Functional', 'Manufacturing', 'Quality', 'Approved'];
  const getDdrStepState = (step) => {
    const stage = currentDDR?.current_stage || 'Initial Review';
    const idx = ddrStageSteps.indexOf(stage);
    const stepIdx = ddrStageSteps.indexOf(step);
    if (stepIdx < idx || stage === 'Approved') return 'completed';
    if (stepIdx === idx) return 'active';
    return '';
  };

  const resolveComment = async (id) => {
    try {
      await supabase.from('ddr_comments')
        .update({ status: 'Resolved', resolution_notes: 'Resolved with new CAD revision.' })
        .eq('id', id);
      fetchDdrComments();
    } catch (err) {
      console.error('Failed to resolve comment');
    }
  };

  const fetchDesignTasks = async () => {
    try {
      console.log('AutoDev: [DIAGNOSTIC] Fetching Design Tasks (Simplified)...');
      
      // 1. Fetch only design_tasks first to avoid join errors
      const { data, error } = await supabase
        .from('design_tasks')
        .select('*');

      if (error) {
        console.error('AutoDev: [DIAGNOSTIC] Design Task Fetch Error:', error);
        throw error;
      }

      console.log('AutoDev: [DIAGNOSTIC] Raw Tasks found:', data?.length || 0, data);

      // 2. If tasks exist, manually fetch their program info to be safe
      const enriched = await Promise.all((data || []).map(async (task) => {
        const { data: prog } = await supabase
          .from('programs')
          .select('program_name, program_code, created_at')
          .eq('id', task.program_id)
          .maybeSingle();
        
        return { ...task, programs: prog };
      }));

      // Sort tasks by program creation date descending
      enriched.sort((a, b) => {
        const dateA = a.programs?.created_at ? new Date(a.programs.created_at) : new Date(0);
        const dateB = b.programs?.created_at ? new Date(b.programs.created_at) : new Date(0);
        return dateB - dateA;
      });

      setTasks(enriched);
      if (enriched.length > 0) setSelectedTask(enriched[0]);
    } catch (err) {
      console.error('AutoDev: [DIAGNOSTIC] Design Workspace Initialization Failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      await supabase.from('design_tasks')
        .update({ status })
        .eq('id', taskId);
      
      if (status === 'DDR Review') {
        // Create DDR Review Entry
        const activeCad = revisions.length > 0 ? revisions[0] : null;
        await supabase.from('ddr_reviews').insert({
          task_id: taskId,
          program_id: selectedTask.program_id,
          cad_file_id: activeCad ? activeCad.id : null,
          title: `DDR: ${selectedTask.task_name}`,
          status: 'Under Review',
          created_by: profile?.id
        });
      }

      fetchDesignTasks();
      alert(`Task status updated to ${status}. ${status === 'DDR Review' ? 'DDR Workflow Initiated.' : ''}`);
    } catch (err) {
      console.error(err);
      alert('Failed to update task');
    }
  };

  return (
    <div className="design-dashboard-container">
      <header className="design-header">
        <div className="header-left">
          <div className="status-badge-studio">DESIGN PHASE ACTIVE</div>
          <h1>Engineering Design Studio</h1>
          <p className="technical-meta">SUBSYSTEM DEVELOPMENT // CAD VERSIONING // DDR WORKFLOW</p>
        </div>
      </header>

      <div className="design-main-layout">
        {/* LEFT: TASK LIST */}
        <aside className="design-sidebar-tasks glass">
          <div className="sidebar-header">
            <h3><Activity size={18} /> Assigned Tasks</h3>
          </div>
          <div className="task-list">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={`skeleton-task-${i}`} className="task-card glass" style={{ opacity: 0.5 }}>
                  <div className="task-top">
                    <div className="skeleton-text" style={{ width: '40px', height: '14px' }}></div>
                    <div className="skeleton-text" style={{ width: '60px', height: '14px' }}></div>
                  </div>
                  <div className="skeleton-text" style={{ width: '80%', height: '14px', margin: '8px 0' }}></div>
                  <div className="skeleton-text short" style={{ width: '50%' }}></div>
                </div>
              ))
            ) : (
              tasks.map(task => (
                <div 
                  key={task.id} 
                  className={`task-card glass ${selectedTask?.id === task.id ? 'active' : ''}`}
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="task-top">
                    <span className={`priority-tag ${task.priority.toLowerCase()}`}>{task.priority}</span>
                    <span className="due-tag"><Clock size={12} /> {new Date(task.due_date).toLocaleDateString()}</span>
                  </div>
                  <h4>{task.task_name}</h4>
                  <p>{task.programs?.program_name}</p>
                  <div className={`status-pill ${task.status.replace(' ', '-').toLowerCase()}`}>{task.status}</div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* RIGHT: WORKSPACE */}
        <main className="design-workspace-area">
          {selectedTask ? (
            <div className="workspace-container glass">
              <nav className="workspace-tabs">
                {['Overview', 'CAD Module', 'eBOM Linking', 'DDR Review'].map(tab => (
                  <button 
                    key={tab} 
                    className={activeTab === tab.toLowerCase().replace(' ', '-') ? 'active' : ''}
                    onClick={() => setActiveTab(tab.toLowerCase().replace(' ', '-'))}
                  >
                    {tab}
                  </button>
                ))}
              </nav>

              <div className="workspace-content">
                {activeTab === 'overview' && (
                  <div className="tab-section">
                    <div className="info-grid">
                      <div className="info-card glass">
                        <h3>Subsystem</h3>
                        <p>{selectedTask.subsystem}</p>
                      </div>
                      <div className="info-card glass">
                        <h3>Program</h3>
                        <p>{selectedTask.programs?.program_name}</p>
                      </div>
                      <div className="info-card glass">
                        <h3>Task ID</h3>
                        <p className="font-mono">{selectedTask.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <div className="action-row">
                      <button className="status-btn in-progress" onClick={() => updateTaskStatus(selectedTask.id, 'In Progress')}>Start Development</button>
                      <button className="status-btn ddr" onClick={() => updateTaskStatus(selectedTask.id, 'DDR Review')}>Request DDR Review</button>
                    </div>
                  </div>
                )}

                {activeTab === 'cad-module' && (
                  <div className="tab-section">
                    <div className="cad-upload-zone glass-dark flex-center" onClick={() => document.getElementById('cad-upload').click()} style={{cursor: 'pointer'}}>
                      <input 
                        type="file" 
                        id="cad-upload" 
                        style={{display: 'none'}} 
                        onChange={handleFileUpload}
                      />
                      {isUploading ? (
                        <div className="flex-center" style={{flexDirection: 'column', gap: '10px'}}>
                          <Activity className="animate-spin text-accent" size={48} />
                          <h3>Processing CAD Geometry...</h3>
                        </div>
                      ) : (
                        <>
                          <Upload size={48} className="muted-icon" />
                          <h3>Upload CAD/STEP Revision</h3>
                          <p>Drag and drop engineering drawings here, or click to browse</p>
                          <button className="upload-btn">Select File</button>
                        </>
                      )}
                    </div>
                    <div className="revision-list">
                      <h3>Revision Control</h3>
                      {revisions.length === 0 ? (
                        <p className="muted-text">No revisions uploaded yet.</p>
                      ) : (
                        revisions.map((rev) => (
                          <div key={rev.id} className="revision-item glass" style={{marginBottom: '10px'}}>
                            <span>{rev.version} - {rev.file_name}</span>
                            <span>{new Date(rev.created_at).toLocaleDateString()}</span>
                            {rev.file_url ? (
                              <a href={rev.file_url} target="_blank" rel="noopener noreferrer" title="Open CAD file from storage">
                                <ExternalLink size={16} style={{ cursor: 'pointer', color: 'var(--accent)' }} />
                              </a>
                            ) : (
                              <ExternalLink size={16} className="muted-icon" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'ebom-linking' && (
                  <div className="tab-section">
                    <div className="bom-search">
                      <Search size={18} />
                      <input
                        type="text"
                        placeholder="Search Master Part List..."
                        value={ebomSearch}
                        onChange={e => setEbomSearch(e.target.value)}
                      />
                    </div>
                    <table className="bom-table">
                      <thead>
                        <tr><th>Part No</th><th>Description</th><th>Material</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {ebomParts
                          .filter(part =>
                            !ebomSearch ||
                            part.part_number?.toLowerCase().includes(ebomSearch.toLowerCase()) ||
                            part.part_name?.toLowerCase().includes(ebomSearch.toLowerCase())
                          )
                          .length === 0 ? (
                          <tr>
                            <td colSpan="4" className="muted-text" style={{ textAlign: 'center', padding: '20px' }}>
                              {selectedTask?.program_id ? 'No eBOM parts found for this program. Add parts in the EBOM dashboard.' : 'Select a task to load parts.'}
                            </td>
                          </tr>
                        ) : (
                          ebomParts
                            .filter(part =>
                              !ebomSearch ||
                              part.part_number?.toLowerCase().includes(ebomSearch.toLowerCase()) ||
                              part.part_name?.toLowerCase().includes(ebomSearch.toLowerCase())
                            )
                            .map(part => (
                              <tr key={part.id}>
                                <td className="part-no">{part.part_number}</td>
                                <td>{part.part_name}</td>
                                <td>{part.material || 'N/A'}</td>
                                <td>
                                  <button
                                    className={`link-btn ${linkedParts.includes(part.part_number) ? 'linked' : ''}`}
                                    onClick={() => togglePartLink(part.part_number)}
                                  >
                                    {linkedParts.includes(part.part_number) ? <><CheckCircle size={14} /> Linked</> : <><Plus size={14} /> Link</>}
                                  </button>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'ddr-review' && (
                  <div className="tab-section">
                    {currentDDR?.status === 'Corrections Required' && (
                      <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(255, 77, 77, 0.08)', border: '1px solid rgba(255, 77, 77, 0.3)', borderRadius: '8px' }}>
                        <strong style={{ color: '#ff6b6b' }}>DDR Rejected — Chief Engineer Feedback:</strong>
                        <p style={{ margin: '8px 0', color: '#ffaaaa' }}>{currentDDR.rejection_reason || 'Corrections required.'}</p>
                        <button
                          className="status-btn ddr"
                          onClick={() => handleDDRResubmit(currentDDR.id, revisions[0]?.id)}
                          disabled={!revisions.length}
                        >
                          Resubmit for DDR Review
                        </button>
                      </div>
                    )}
                    <div className="ddr-comments glass">
                      <h3>DDR Feedback Loop</h3>
                      <p className="muted-text" style={{marginBottom: '20px'}}>
                        Review feedback from cross-functional teams below.
                      </p>
                      
                      {ddrComments.map(comment => (
                        <div key={comment.id} className="comment" style={{ opacity: comment.status === 'Resolved' ? 0.6 : 1, borderLeftColor: comment.status === 'Resolved' ? 'var(--success)' : (comment.severity === 'Critical' ? 'var(--error)' : 'var(--accent)') }}>
                          <div className="comment-meta">
                            <strong>{comment.author?.full_name || 'Reviewer'} <span style={{fontWeight: 400, color: 'var(--text-muted)'}}>({comment.author?.role || 'Engineer'})</span></strong>
                            <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                          </div>
                          <p style={{ textDecoration: comment.status === 'Resolved' ? 'line-through' : 'none' }}>
                            {comment.comment_text}
                          </p>
                          <div className="comment-actions">
                            {comment.status === 'Resolved' ? (
                              <span style={{color: 'var(--success)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px'}}>
                                <CheckCircle size={14} /> {comment.resolution_notes || 'Resolved'}
                              </span>
                            ) : (
                              <>
                                <button className="reply-btn">Reply</button>
                                <button className="resolve-btn" onClick={() => resolveComment(comment.id)}>Resolve Issue</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            loading ? (
              <div className="empty-workspace glass flex-center">
                <div className="skeleton-text" style={{ width: '48px', height: '48px', borderRadius: '50%', marginBottom: '16px' }}></div>
                <div className="skeleton-text" style={{ width: '250px', height: '20px' }}></div>
              </div>
            ) : (
              <div className="empty-workspace glass flex-center">
                <Cpu size={64} className="muted-icon" />
                <h2>Select a Design Task to Open Studio</h2>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
};

export default DesignDashboard;
