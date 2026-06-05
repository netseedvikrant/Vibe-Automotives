import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, AlertCircle, Rocket, Shield, MapPin, DollarSign, Calendar, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './CreateProgramForm.css';

const CreateProgramForm = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [features, setFeatures] = useState([]);
  const [featureInput, setFeatureInput] = useState('');
  const [leadEngineers, setLeadEngineers] = useState([]);

  React.useEffect(() => {
    fetchLeadEngineers();
  }, []);

  const fetchLeadEngineers = async () => {
    const { data } = await supabase.from('users').select('id, full_name').eq('role', 'Lead Engineer');
    setLeadEngineers(data || []);
  };

  const handleAddFeature = (e) => {
    if (e.key === 'Enter' && featureInput.trim()) {
      setFeatures([...features, featureInput.trim()]);
      setFeatureInput('');
      e.preventDefault();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.target);
    const progName = formData.get('prog_name');
    const programCode = `AD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    try {
      // 1. Create Program
      const { data: program, error: pError } = await supabase
        .from('programs')
        .insert({
          program_code: programCode,
          program_name: progName,
          target_market: formData.get('market'),
          vehicle_category: formData.get('category'),
          estimated_budget: parseFloat(formData.get('budget')) || 0,
          target_launch_date: formData.get('launch_date'),
          priority_level: formData.get('priority') || 'Standard',
          program_description: formData.get('description'),
          status: 'Concept',
          assigned_lead_engineer: formData.get('lead_engineer')
        })
        .select()
        .single();

      if (pError) throw pError;

      // 2. Create Features
      if (features.length > 0) {
        await supabase.from('program_features').insert(
          features.map(f => ({ program_id: program.id, feature_name: f }))
        );
      }

      // 3. Create Default APQP Gates (0-5)
      const defaultGates = [
        { name: 'Gate 0: Concept Approval', num: 0 },
        { name: 'Gate 1: Design Freeze', num: 1 },
        { name: 'Gate 2: Prototype Validation', num: 2 },
        { name: 'Gate 3: DVP&R Approved', num: 3 },
        { name: 'Gate 4: PPAP Approved', num: 4 },
        { name: 'Gate 5: Serial Production Release', num: 5 }
      ];

      await supabase.from('apqp_gates').insert(
        defaultGates.map(g => ({
          program_id: program.id,
          gate_name: g.name,
          gate_number: g.num,
          gate_status: g.num === 0 ? 'In Progress' : 'Pending',
          completion_percentage: 0
        }))
      );

      // 4. Create Workflow Instance (NEW: Automated Handoff)
      const leadId = formData.get('lead_engineer');
      await supabase.from('workflow_instances').insert({
        program_id: program.id,
        current_stage: 'FEASIBILITY_REVIEW',
        assigned_role: 'Lead Engineer',
        assigned_user_id: leadId,
        workflow_status: 'Active'
      });

      // 5. Update Program Status for Handoff
      await supabase.from('programs').update({ 
        status: 'Feasibility' 
      }).eq('id', program.id);

      // 6. Create Activity Log & Audit Trail
      await supabase.from('activity_logs').insert({
        program_id: program.id,
        action_type: 'Workflow Handover',
        action_description: `Program ${programCode} submitted for Feasibility Review. Assigned to Lead Engineer.`,
        new_values: { stage: 'FEASIBILITY_REVIEW', assigned_to: leadId }
      });

      // 7. Targeted Notification for Lead Engineer
      await supabase.from('notifications').insert([
        {
          user_id: leadId,
          title: 'New Feasibility Review Task',
          message: `Technical assessment requested for ${progName}. High priority.`,
          type: 'Workflow'
        },
        {
          title: 'Program Initiated',
          message: `Program ${progName} (${programCode}) has been successfully created.`,
          type: 'success'
        }
      ]);

      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 3000);

    } catch (error) {
      console.error('Error creating program:', error);
      alert('Failed to create program. Check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div 
        className="modal-content glass-dark glow-border"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <button className="close-btn" onClick={onClose}><X /></button>

        {isSuccess ? (
          <div className="success-view flex-center">
            <motion.div 
              className="success-icon-wrapper"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10 }}
            >
              <Check size={48} />
            </motion.div>
            <h2>Program Initiated Successfully</h2>
            <div className="automation-steps">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>✓ APQP Gate 0 Triggered</motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>✓ Default Engineering Teams Assigned</motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>✓ Workflow Repository Created</motion.div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="program-form">
            <header className="form-header">
              <Rocket className="text-accent" size={24} />
              <div>
                <h1>Initiate New Vehicle Program</h1>
                <p>Define core parameters for the development lifecycle.</p>
              </div>
            </header>

            <div className="form-grid">
              {/* Program Name */}
              <div className="input-group full-width">
                <input type="text" required placeholder=" " id="prog_name" name="prog_name" />
                <label htmlFor="prog_name">Program Name (e.g. Model X-2027 Evolution)</label>
              </div>

              {/* Target Market & Category */}
              <div className="input-group">
                <select required id="market" name="market">
                  <option value="">Target Market</option>
                  <option>North America (NAFTA)</option>
                  <option>European Union (EU)</option>
                  <option>APAC / China</option>
                </select>
              </div>
              <div className="input-group">
                <select required id="category" name="category">
                  <option value="">Vehicle Category</option>
                  <option>Battery Electric (BEV)</option>
                  <option>Plug-in Hybrid (PHEV)</option>
                  <option>Internal Combustion (ICE)</option>
                  <option>Commercial / Fleet</option>
                </select>
              </div>

              {/* Lead Engineer Assignment */}
              <div className="input-group full-width">
                <select required id="lead_engineer" name="lead_engineer">
                  <option value="">Assign Lead Engineer</option>
                  {leadEngineers.map(le => (
                    <option key={le.id} value={le.id}>{le.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Budget & Timeline */}
              <div className="input-group">
                <DollarSign size={16} className="input-icon" />
                <input type="text" placeholder="Estimated Budget (USD)" name="budget" />
              </div>
              <div className="input-group">
                <Calendar size={16} className="input-icon" />
                <input type="date" placeholder="Target Launch Date" name="launch_date" />
              </div>

              {/* Plant & Priority */}
              <div className="input-group">
                <MapPin size={16} className="input-icon" />
                <select id="plant" name="plant">
                  <option>Detroit Assembly</option>
                  <option>Berlin Gigafactory</option>
                  <option>Shanghai Plant 2</option>
                </select>
              </div>
              <div className="input-group">
                <Zap size={16} className="input-icon" />
                <select id="priority" name="priority">
                  <option value="Standard">Priority: Standard</option>
                  <option value="High">Priority: High (Executive)</option>
                  <option value="Critical">Priority: Critical (Launch)</option>
                </select>
              </div>

              {/* Features Tag Input */}
              <div className="input-group full-width feature-input-group">
                <div className="tags-container">
                  {features.map((f, i) => (
                    <span key={i} className="tag">{f}</span>
                  ))}
                  <input 
                    type="text" 
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    onKeyDown={handleAddFeature}
                    placeholder="Key Features (Press Enter to add)..." 
                  />
                </div>
              </div>

              {/* Risks Selector */}
              <div className="input-group full-width">
                <div className="risk-selector glass">
                  <Shield size={16} />
                  <span>Primary Risk Factors:</span>
                  <label className="checkbox-label">
                    <input type="checkbox" /> Supply Chain
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" /> Regulatory
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" /> Thermal Management
                  </label>
                </div>
              </div>

              {/* Description */}
              <div className="input-group full-width">
                <textarea placeholder="Program Description & Executive Summary..." rows="4" name="description"></textarea>
              </div>
            </div>

            <footer className="form-footer">
              <button type="button" className="cancel-btn" onClick={onClose}>Discard</button>
              <button type="submit" className="submit-btn" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="animate-spin" size={18} /> Processing...</>
                ) : (
                  'Initiate Program'
                )}
              </button>
            </footer>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default CreateProgramForm;
