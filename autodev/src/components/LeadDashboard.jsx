import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, ShieldAlert, Cpu, Settings, Factory, 
  BarChart, FileText, Zap, ChevronRight, Layers,
  Compass, Terminal, Microscope, PenTool, CheckCircle2
} from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './LeadDashboard.css';

const LeadDashboard = () => {
  const { profile } = useAuth();
  const { programs, workflowInstances, notifications, loading, refresh } = useDashboardData();
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [activeSection, setActiveSection] = useState('feasibility');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [architectureNotes, setArchitectureNotes] = useState('');
  const [trlScore, setTrlScore] = useState(7);
  const [plantReadinessScore, setPlantReadinessScore] = useState(85);
  const [plantReadinessNotes, setPlantReadinessNotes] = useState('');

  // Programs waiting for this Lead to review.
  // Uses a multi-tier filter that works even when workflowInstances is empty:
  //  1. Exclude if positively confirmed as submitted/awaiting Chief (workflow stage)
  //  2. Include if status = 'Feasibility' (normal case)
  //  3. Include if status = 'Design' AND Gate 0 not yet Completed
  //     (catches programs stuck in 'Design' due to old buggy code that advanced
  //      status prematurely on Conditional approval before the fix was applied)
  const pendingTasks = programs.filter(p => {
    if (p.assigned_lead_engineer !== profile?.id) return false;

    const wf = workflowInstances.find(w => w.program_id === p.id);
    const submittedStages = ['GATE_0_CONDITIONAL_REVIEW', 'GATE_0_APPROVAL_PENDING'];
    // Tier 1: Actively submitted to Chief — hide from Lead
    if (wf && submittedStages.includes(wf.current_stage)) return false;

    // Tier 1b: Chief sent back for rework — Lead must address
    if (wf?.current_stage === 'FEASIBILITY_REWORK_REQUIRED') return true;

    // Tier 2: Normal feasibility status
    if (p.status === 'Feasibility') return true;

    // Tier 3: Stuck in 'Design' but Gate 0 not yet approved — Lead still needs to work on it
    if (p.status === 'Design') {
      const gates = p.apqp_gates || [];
      const gate0 = gates.find(g => g.gate_number === 0);
      const gate0Completed = gate0?.gate_status === 'Completed';
      return !gate0Completed; // Gate 0 not done = Lead's assessment still needed
    }

    return false;
  });

  // Programs this Lead submitted with Conditional Approval — now awaiting Chief review
  const awaitingChiefReview = programs.filter(p => {
    if (p.assigned_lead_engineer !== profile?.id) return false;
    const wf = workflowInstances.find(w => w.program_id === p.id);
    return wf?.current_stage === 'GATE_0_CONDITIONAL_REVIEW';
  });

  const reworkRequired = programs.filter(p => {
    if (p.assigned_lead_engineer !== profile?.id) return false;
    const wf = workflowInstances.find(w => w.program_id === p.id);
    return wf?.current_stage === 'FEASIBILITY_REWORK_REQUIRED';
  });

  const getReworkDirective = (programId) => {
    const reworkNotif = notifications.find(
      n => n.type === 'error' && (n.title?.includes('Rework') || n.title?.includes('Gate 0'))
    );
    return reworkNotif?.message || 'Please revise your assessment per Chief Engineer feedback.';
  };

  const selectedWorkflow = selectedProgram
    ? workflowInstances.find(w => w.program_id === selectedProgram.id)
    : null;
  const isReworkRequired = selectedWorkflow?.current_stage === 'FEASIBILITY_REWORK_REQUIRED';

  const awaitingDesignTasks = programs.filter(p => {
    if (p.assigned_lead_engineer !== profile?.id) return false;
    if (p.status !== 'Design') return false;
    const gate0 = (p.apqp_gates || []).find(g => g.gate_number === 0);
    return gate0?.gate_status === 'Completed';
  });

  const handleAssessmentSubmit = async (recommendation) => {
    if (!selectedProgram) return;
    setIsSubmitting(true);

    try {
      // 1. Save Technical Assessment
      const { data: assessment, error: aError } = await supabase
        .from('technical_assessments')
        .insert({
          program_id: selectedProgram.id,
          lead_engineer_id: profile.id,
          recommendation: recommendation,
          architecture_complexity: architectureNotes || 'Not specified',
          ev_compatibility_score: trlScore * 10,
          est_engineering_hours: 12500,
          plant_readiness_assessment: plantReadinessNotes || `Plant readiness score: ${plantReadinessScore}%`
        })
        .select()
        .single();

      if (aError) throw aError;

      // 2. Determine next program status and workflow stage based on recommendation
      let nextProgramStatus;
      let nextWorkflowStage;
      let notifTitle;
      let notifMessage;

      if (recommendation === 'Approve') {
        nextProgramStatus = 'Design'; // Full approval — advance to Design phase
        nextWorkflowStage = 'GATE_0_APPROVAL_PENDING';
        notifTitle = 'Technical Case Ready for Approval';
        notifMessage = `Lead Engineer fully approved ${selectedProgram.program_name}. Awaiting Chief Engineer Gate 0 sign-off.`;
      } else if (recommendation === 'Conditional') {
        // Keep status as 'Feasibility' — Chief Dashboard detects conditional review via
        // technical_assessments.recommendation field + workflow_instances.current_stage
        // to avoid relying on a custom status enum value in the DB
        nextProgramStatus = 'Feasibility';
        nextWorkflowStage = 'GATE_0_CONDITIONAL_REVIEW';
        notifTitle = '⚠️ Conditional Approval — Chief Review Required';
        notifMessage = `Lead Engineer issued a Conditional Approval for ${selectedProgram.program_name}. Please review conditions before authorizing Gate 0.`;
      } else {
        // Reject — return program to Feasibility for rework
        nextProgramStatus = 'Feasibility';
        nextWorkflowStage = 'FEASIBILITY_REJECTED';
        notifTitle = '❌ Technical Case Rejected';
        notifMessage = `Lead Engineer rejected the technical case for ${selectedProgram.program_name}. Rework required before resubmission.`;
      }

      // 3. Update Workflow Instance
      await supabase.from('workflow_instances')
        .update({ 
          current_stage: nextWorkflowStage,
          assigned_role: recommendation === 'Reject' ? 'Lead Engineer' : 'Chief Engineer',
          workflow_status: 'Active'
        })
        .eq('program_id', selectedProgram.id);

      // 4. Update Program Status
      await supabase.from('programs')
        .update({ status: nextProgramStatus })
        .eq('id', selectedProgram.id);

      // 5. Notification for Chief Engineer (or team)
      await supabase.from('notifications').insert({
        title: notifTitle,
        message: notifMessage,
        type: recommendation === 'Approve' ? 'success' : recommendation === 'Conditional' ? 'warning' : 'error'
      });

      // 6. Audit Log
      await supabase.from('activity_logs').insert({
        program_id: selectedProgram.id,
        action_type: 'Assessment Submitted',
        action_description: `Lead Engineer submitted ${recommendation.toLowerCase()} recommendation. Program status set to: ${nextProgramStatus}.`,
      });

      const successMsg = recommendation === 'Conditional'
        ? '⚠️ Conditional Approval submitted. Program is now visible on the Chief Engineer dashboard under "Conditional Review" queue for further action.'
        : recommendation === 'Reject'
        ? '❌ Technical case rejected. Program returned to Feasibility for rework.'
        : '✅ Assessment approved and submitted.\n\nNext: Chief Engineer will review Gate 0. You will see updates in the activity stream once design tasks are assigned.';

      alert(successMsg);
      setSelectedProgram(null);
      refresh();
    } catch (err) {
      console.error('Submission error details:', err);
      alert(`Failed to submit assessment: ${err.message || 'Unknown Error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="loader">Initializing R&D Environment...</div>;

  return (
    <motion.div 
      className="lead-dashboard-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="blueprint-overlay"></div>
      
      <header className="lead-header">
        <div className="header-left">
          <div className="status-badge">R&D CLASSIFIED</div>
          <h1>Lead Engineering Assessment Portal</h1>
          <p className="technical-meta">FEASIBILITY ANALYSIS // SYSTEM ARCHITECTURE // TRL EVALUATION</p>
        </div>
        <div className="project-switcher glass">
          <Layers size={18} />
          <select 
            value={selectedProgram?.id} 
            onChange={(e) => setSelectedProgram(pendingTasks.find(p => p.id === e.target.value))}
          >
            <option value="">Select Pending Feasibility Review...</option>
            {pendingTasks.map(p => (
              <option key={p.id} value={p.id}>{p.program_code}: {p.program_name}</option>
            ))}
          </select>
        </div>
      </header>

      {selectedProgram ? (
        <div className="eng-grid-layout">
          {/* NAVIGATION FOR SECTIONS */}
          <nav className="eng-nav glass">
            {['feasibility', 'trl', 'risks', 'manufacturing', 'resources', 'recommendation'].map(s => (
              <button 
                key={s} 
                className={`nav-item ${activeSection === s ? 'active' : ''}`}
                onClick={() => setActiveSection(s)}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </nav>

          <main className="eng-panel main-workspace glass">
            {activeSection === 'feasibility' && (
              <section className="workspace-section">
                <h3><Terminal size={18} /> Section 1 — Technical Feasibility</h3>
                <div className="feasibility-grid">
                  <div className="check-item"><span>EV Platform Compatibility</span> <input type="checkbox" defaultChecked /></div>
                  <div className="check-item"><span>ECU Architecture Review</span> <input type="checkbox" defaultChecked /></div>
                  <div className="check-item"><span>ADAS Integration Path</span> <input type="checkbox" /></div>
                  <div className="check-item"><span>Thermal Management Loop</span> <input type="checkbox" defaultChecked /></div>
                </div>
                <textarea placeholder="Architecture observations..." className="tech-textarea" value={architectureNotes} onChange={e => setArchitectureNotes(e.target.value)}></textarea>
              </section>
            )}

            {activeSection === 'trl' && (
              <section className="workspace-section">
                <h3><Compass size={18} /> Section 2 — TRL Assessment</h3>
                <div className="trl-range">
                  <label>Overall Readiness Level: <strong>TRL {trlScore}</strong></label>
                  <input type="range" min="1" max="9" value={trlScore} onChange={e => setTrlScore(parseInt(e.target.value, 10))} />
                </div>
                <div className="subsystem-trl">
                  <div className="sub-row"><span>Powertrain Maturity</span> <strong>Level 8</strong></div>
                  <div className="sub-row"><span>Software Stack Maturity</span> <strong>Level 6</strong></div>
                </div>
              </section>
            )}

            {activeSection === 'risks' && (
              <section className="workspace-section">
                <h3><ShieldAlert size={18} /> Section 3 — Engineering Risk Register</h3>
                <div className="risk-add-row">
                  <input type="text" placeholder="Risk Title" className="tech-input" />
                  <select className="tech-select">
                    <option>High Severity</option>
                    <option>Medium Severity</option>
                  </select>
                  <button className="add-risk-btn">Add Risk</button>
                </div>
                <div className="risk-list">
                  <div className="risk-item glass"><span>Battery Sourcing Constraints</span> <span className="risk-tag high">HIGH</span></div>
                  <div className="risk-item glass"><span>Thermal Validation Delay</span> <span className="risk-tag med">MED</span></div>
                </div>
              </section>
            )}

            {activeSection === 'manufacturing' && (
              <section className="workspace-section">
                <h3><Factory size={18} /> Section 4 — Manufacturing Constraints</h3>
                <div className="form-column">
                  <label>Tooling Limitations</label>
                  <textarea placeholder="Identify stamping/tooling bottlenecks..." className="tech-textarea"></textarea>
                  <label>Plant Readiness Score</label>
                  <input type="number" value={plantReadinessScore} onChange={e => setPlantReadinessScore(parseInt(e.target.value, 10) || 0)} className="tech-input" />
                  <label>Plant Readiness Notes</label>
                  <textarea placeholder="Tooling, stamping, assembly constraints..." className="tech-textarea" value={plantReadinessNotes} onChange={e => setPlantReadinessNotes(e.target.value)}></textarea>
                </div>
              </section>
            )}

            {activeSection === 'resources' && (
              <section className="workspace-section">
                <h3><Zap size={18} /> Section 5 — Resource Estimation</h3>
                <div className="resource-grid">
                  <div className="res-card"><span>Engineers</span> <strong>42 FTE</strong></div>
                  <div className="res-card"><span>Lab Hours</span> <strong>1,800h</strong></div>
                  <div className="res-card"><span>Prototypes</span> <strong>12 Units</strong></div>
                </div>
              </section>
            )}

            {activeSection === 'recommendation' && (
              <section className="workspace-section">
                <h3><FileText size={18} /> Section 6 — Engineering Recommendation</h3>
                {isReworkRequired && (
                  <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(255, 77, 77, 0.08)', border: '1px solid rgba(255, 77, 77, 0.3)', borderRadius: '8px' }}>
                    <strong style={{ color: '#ff6b6b' }}>⚠️ REWORK REQUIRED — Chief Engineer Directive:</strong>
                    <p style={{ margin: '8px 0 0', color: '#ffaaaa' }}>"{getReworkDirective(selectedProgram.id)}"</p>
                    <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#a0a0b0' }}>→ Please revise your assessment and resubmit.</p>
                  </div>
                )}
                <textarea placeholder="Provide technical justification for your decision..." className="tech-textarea" rows="6"></textarea>
                <div className="recommendation-actions">
                  {!isReworkRequired && (
                    <>
                      <button className="rec-btn reject" onClick={() => handleAssessmentSubmit('Reject')} disabled={isSubmitting}>Reject Technical Case</button>
                      <button className="rec-btn conditional" onClick={() => handleAssessmentSubmit('Conditional')} disabled={isSubmitting}>Conditional Approval</button>
                    </>
                  )}
                  <button className="rec-btn approve" onClick={() => handleAssessmentSubmit('Approve')} disabled={isSubmitting}>
                    {isReworkRequired ? 'Resubmit Assessment' : 'Submit Technical Assessment'}
                  </button>
                </div>
              </section>
            )}
          </main>
        </div>
      ) : (
        <div className="empty-workspace glass flex-center">
          <Terminal size={48} className="muted-icon" />
          <h2>Select a Pending Program to Begin Technical Review</h2>
          <p>Assigned feasibility tasks will appear in the selector above.</p>
        </div>
      )}

      {/* Activity stream footer */}
      <section className="eng-panel activity-panel glass">
        <div className="panel-header">
          <h3><Activity size={18} /> Engineering Activity Stream</h3>
        </div>
        <div className="tech-activity-list">
          {reworkRequired.length > 0 && (
            <div style={{ marginBottom: '12px', padding: '12px 16px', background: 'rgba(255, 77, 77, 0.07)', border: '1px solid rgba(255, 77, 77, 0.25)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#ff6b6b', fontWeight: 'bold', fontSize: '0.85rem' }}>
                <ShieldAlert size={14} /> ⚠️ REWORK REQUIRED
              </div>
              {reworkRequired.map(p => (
                <div key={p.id} className="tech-activity-item" style={{ background: 'rgba(255,77,77,0.04)', borderLeft: '2px solid #ff4d4d', paddingLeft: '10px' }}>
                  <span className="time font-mono" style={{ color: '#ff6b6b' }}>[REWORK]</span>
                  <span className="msg"><strong>{p.program_name}</strong> — {getReworkDirective(p.id)}</span>
                  <span className="user">@Chief</span>
                </div>
              ))}
            </div>
          )}
          {awaitingDesignTasks.length > 0 && (
            <div style={{ marginBottom: '12px', padding: '12px 16px', background: 'rgba(0, 255, 157, 0.06)', border: '1px solid rgba(0, 255, 157, 0.25)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#00ff9d', fontWeight: 'bold', fontSize: '0.85rem' }}>
                <CheckCircle2 size={14} /> ✅ GATE 0 APPROVED — AWAITING DESIGN TASKS
              </div>
              {awaitingDesignTasks.map(p => (
                <div key={p.id} className="tech-activity-item" style={{ background: 'rgba(0,255,157,0.04)', borderLeft: '2px solid #00ff9d', paddingLeft: '10px' }}>
                  <span className="time font-mono" style={{ color: '#00ff9d' }}>[DESIGN]</span>
                  <span className="msg"><strong>{p.program_name}</strong> — Gate 0 signed off. Design tasks are being assigned to the Design Engineer.</span>
                  <span className="user">@Chief</span>
                </div>
              ))}
            </div>
          )}
          {awaitingChiefReview.length > 0 && (
            <div style={{ marginBottom: '12px', padding: '12px 16px', background: 'rgba(255, 160, 50, 0.07)', border: '1px solid rgba(255, 160, 50, 0.25)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#ffaa33', fontWeight: 'bold', fontSize: '0.85rem' }}>
                <Zap size={14} /> ⚠️ AWAITING CHIEF ENGINEER REVIEW
              </div>
              {awaitingChiefReview.map(p => (
                <div key={p.id} className="tech-activity-item" style={{ background: 'rgba(255,160,50,0.04)', borderLeft: '2px solid #ffaa33', paddingLeft: '10px' }}>
                  <span className="time font-mono" style={{ color: '#ffaa33' }}>[CONDITIONAL]</span>
                  <span className="msg">Conditional Approval submitted for <strong>{p.program_name}</strong> — Chief Engineer is reviewing.</span>
                  <span className="user">@Chief</span>
                </div>
              ))}
            </div>
          )}
          {pendingTasks.length > 0 ? (
            <div className="tech-activity-item">
              <span className="time font-mono">[URGENT]</span>
              <span className="msg">New Feasibility Review assigned for {pendingTasks[0].program_name}</span>
              <span className="user">@System</span>
            </div>
          ) : awaitingChiefReview.length === 0 && reworkRequired.length === 0 && awaitingDesignTasks.length === 0 ? (
            <p className="muted-text">No active workflow tasks assigned.</p>
          ) : null}
        </div>
      </section>
    </motion.div>
  );
};

export default LeadDashboard;
