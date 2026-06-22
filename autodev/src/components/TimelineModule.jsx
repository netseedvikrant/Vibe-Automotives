import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, CheckCircle2, AlertOctagon, Edit3, Save } from 'lucide-react';

const TimelineModule = ({ initialProgramId }) => {
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(initialProgramId || '');
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingGateId, setEditingGateId] = useState(null);

  // Sync initialProgramId if it becomes available and we don't have a selection yet
  useEffect(() => {
    if (initialProgramId && !selectedProgramId) {
      setSelectedProgramId(initialProgramId);
    }
  }, [initialProgramId, selectedProgramId]);

  // Temporary editing state
  const [editStatus, setEditStatus] = useState('');
  const [editPercent, setEditPercent] = useState(0);
  const [editDate, setEditDate] = useState('');

  // Realtime subscription for programs list
  useEffect(() => {
    fetchPrograms();

    const channelId = `timeline-programs-realtime-${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId);

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'programs' },
        (payload) => {
          console.log('Realtime program update received:', payload);
          fetchPrograms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Realtime subscription for gates under the selected program
  useEffect(() => {
    if (!selectedProgramId) return;

    fetchGates(selectedProgramId);

    const channelId = `timeline-gates-realtime-${selectedProgramId}-${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId);

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'apqp_gates' },
        (payload) => {
          const newProgramId = payload.new?.program_id;
          const oldProgramId = payload.old?.program_id;
          if (newProgramId === selectedProgramId || oldProgramId === selectedProgramId) {
            console.log('Realtime gate update received for current program:', payload);
            fetchGates(selectedProgramId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProgramId]);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('id, program_name, program_code, current_gate, status')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const programsList = data || [];
      setPrograms(programsList);
      
      // Keep selectedProgramId synced with current programs
      setSelectedProgramId(currentId => {
        const stillExists = programsList.some(p => p.id === currentId);
        if (stillExists) return currentId;
        return programsList.length > 0 ? programsList[0].id : '';
      });
    } catch (err) {
      console.error('Error fetching programs for timeline:', err);
    }
  };

  const fetchGates = async (programId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('apqp_gates')
        .select('*')
        .eq('program_id', programId)
        .order('gate_number', { ascending: true });
      if (error) throw error;
      setGates(data || []);
    } catch (err) {
      console.error('Error fetching gates:', err);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (gate) => {
    setEditingGateId(gate.id);
    setEditStatus(gate.displayStatus || gate.gate_status || 'Pending');
    setEditPercent(gate.displayCompletion || gate.completion_percentage || 0);
    setEditDate(gate.due_date || '');
  };

  const cancelEditing = () => {
    setEditingGateId(null);
  };

  const saveGateChanges = async (gateId) => {
    try {
      const { error } = await supabase
        .from('apqp_gates')
        .update({
          gate_status: editStatus,
          completion_percentage: parseInt(editPercent) || 0,
          due_date: editDate || null
        })
        .eq('id', gateId);

      if (error) throw error;
      setEditingGateId(null);
      
      // Fetch the updated gates first to compute current_gate
      const { data: updatedGates, error: gatesError } = await supabase
        .from('apqp_gates')
        .select('*')
        .eq('program_id', selectedProgramId)
        .order('gate_number', { ascending: true });
      
      if (gatesError) throw gatesError;
      setGates(updatedGates || []);

      // Calculate the new current_gate and status for the program
      if (updatedGates && updatedGates.length > 0) {
        const sortedGates = [...updatedGates].sort((a, b) => a.gate_number - b.gate_number);
        // Find the first gate that is not Completed
        const activeGate = sortedGates.find(g => g.gate_status !== 'Completed');
        
        let newCurrentGate = 0;
        let newStatus = 'Concept';
        
        if (!activeGate) {
          // All gates completed
          newCurrentGate = 5;
          newStatus = 'Production';
        } else {
          newCurrentGate = activeGate.gate_number;
          // Map gate number to program status
          const statusMap = {
            0: 'Concept',
            1: 'Feasibility',
            2: 'Design',
            3: 'Prototype',
            4: 'Validation',
            5: 'PPAP'
          };
          newStatus = statusMap[newCurrentGate] || 'Concept';
        }

        // Update the programs table in the database
        const { error: progError } = await supabase
          .from('programs')
          .update({
            current_gate: newCurrentGate,
            status: newStatus
          })
          .eq('id', selectedProgramId);
          
        if (progError) {
          console.error('Error updating program current_gate/status:', progError);
        }
      }
      
      // Dispatch alert/notification event for toast
      const event = new CustomEvent('autodev-toast', {
        detail: {
          title: 'APQP Gate Updated',
          message: `Gate settings modified successfully. Status: ${editStatus}, Progress: ${editPercent}%`,
          user_id: null
        }
      });
      window.dispatchEvent(event);
    } catch (err) {
      console.error('Error saving gate:', err);
      alert('Failed to save gate updates: ' + err.message);
    }
  };

  // Helper to calculate relative positions for Gantt bars
  const calculateGanttPositions = () => {
    if (gates.length === 0) return [];
    
    // Sort gates sequentially
    const sorted = [...gates].sort((a, b) => a.gate_number - b.gate_number);
    
    // Find min and max dates. If not set, mock a reasonable baseline.
    const programStart = new Date();
    programStart.setMonth(programStart.getMonth() - 1); // default start is 1 month ago
    
    let maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 6); // default end is 6 months out

    // Use actual dates if available
    const dates = sorted.map(g => g.due_date ? new Date(g.due_date) : null).filter(Boolean);
    const minTime = programStart.getTime();
    const maxTime = dates.length > 0 ? Math.max(...dates.map(d => d.getTime())) + 15 * 24 * 60 * 60 * 1000 : maxDate.getTime();
    
    const totalDuration = maxTime - minTime;

    const currentProgram = programs.find(p => p.id === selectedProgramId);
    const currentGateNum = currentProgram ? (currentProgram.current_gate ?? 0) : 0;

    return sorted.map((gate, index) => {
      // Calculate start and end percentages
      let prevTime = minTime;
      if (index > 0 && sorted[index - 1].due_date) {
        prevTime = new Date(sorted[index - 1].due_date).getTime();
      }
      
      const currentTime = gate.due_date ? new Date(gate.due_date).getTime() : minTime + (index + 1) * (totalDuration / (sorted.length + 1));
      
      // Bounds
      const startPercent = Math.max(0, Math.min(95, ((prevTime - minTime) / totalDuration) * 100));
      const endPercent = Math.max(0, Math.min(100, ((currentTime - minTime) / totalDuration) * 100));
      const widthPercent = Math.max(2, endPercent - startPercent);

      // Determine status and completion percentage dynamically based on program's current_gate
      let displayStatus = gate.gate_status || 'Pending';
      let displayCompletion = gate.completion_percentage || 0;

      if (gate.gate_number < currentGateNum) {
        displayStatus = 'Completed';
        displayCompletion = 100;
      } else if (gate.gate_number === currentGateNum) {
        displayStatus = 'In Progress';
        displayCompletion = gate.completion_percentage > 0 ? gate.completion_percentage : 25;
      } else {
        displayStatus = 'Pending';
        displayCompletion = 0;
      }

      return {
        ...gate,
        displayStatus,
        displayCompletion,
        left: startPercent,
        width: widthPercent,
        formattedDate: gate.due_date ? new Date(gate.due_date).toLocaleDateString() : 'TBD'
      };
    });
  };

  const ganttItems = calculateGanttPositions();

  return (
    <div className="timeline-module" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass padding-lg" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#000000', marginBottom: '4px' }}>Interactive APQP Gantt Timeline</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>View, track and schedule milestones across gates 0 to 5 in real-time.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.9rem', color: '#000000' }}>Select Program:</span>
          <select 
            value={selectedProgramId} 
            onChange={e => setSelectedProgramId(e.target.value)} 
            style={{ padding: '8px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}
          >
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.program_name} ({p.program_code})</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex-center glass" style={{ height: '300px' }}>Loading Timeline Milestones...</div>
      ) : (
        <div className="grid-timeline-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Gantt Visual Chart Card */}
          <div className="dashboard-card glass" style={{ padding: '24px', position: 'relative', overflowX: 'auto' }}>
            <h4 style={{ color: '#000000', fontSize: '1rem', fontWeight: 600, marginBottom: '24px' }}>Gantt Visualizer</h4>
            
            <div style={{ minWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
              {/* Background grid headers */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: '8px', fontSize: '0.75rem', color: '#000000', fontWeight: 600 }}>
                <div style={{ width: '180px', flexShrink: 0 }}>Gate Milestone</div>
                <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Phase Start</span>
                  <span>Quarter 1</span>
                  <span>Quarter 2</span>
                  <span>Quarter 3</span>
                  <span>Phase Target</span>
                </div>
              </div>

              {/* Gantt Rows */}
              {ganttItems.map((item, idx) => {
                let barColor = 'linear-gradient(90deg, #555, #777)';
                if (item.displayStatus === 'Completed') barColor = 'linear-gradient(90deg, #10b981, #059669)';
                else if (item.displayStatus === 'In Progress') barColor = 'linear-gradient(90deg, #3b82f6, #2563eb)';
                else if (item.displayStatus === 'Blocked') barColor = 'linear-gradient(90deg, #ef4444, #dc2626)';

                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center' }}>
                     <div style={{ width: '180px', flexShrink: 0, paddingRight: '12px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#000000', display: 'block' }}>Gate {item.gate_number}</span>
                      <span style={{ fontSize: '0.75rem', color: '#000000', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.gate_name}</span>
                    </div>
                    
                    <div style={{ flex: 1, height: '36px', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', position: 'relative', border: '1px solid var(--border)' }}>
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.8, delay: idx * 0.05 }}
                        style={{
                          position: 'absolute',
                          left: `${item.left}%`,
                          width: `${item.width}%`,
                          height: '20px',
                          top: '7px',
                          background: barColor,
                          borderRadius: '4px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          transformOrigin: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 8px',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          color: 'white',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden'
                        }}
                      >
                        {item.displayCompletion}%
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dashboard-card glass" style={{ padding: '24px' }}>
            <h4 style={{ color: '#000000', fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Milestone Scheduler & Progress Panel</h4>
            
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gate</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Due Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ganttItems.map(gate => (
                  <tr key={gate.id}>
                    <td><strong style={{ color: 'var(--accent)' }}>Gate {gate.gate_number}</strong></td>
                    <td style={{ fontSize: '0.9rem' }}>{gate.gate_name}</td>
                    <td>
                      {editingGateId === gate.id ? (
                        <select 
                          value={editStatus} 
                          onChange={e => setEditStatus(e.target.value)}
                          style={{ padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)' }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Blocked">Blocked</option>
                        </select>
                      ) : (
                        <span className={`status-pill ${gate.displayStatus.toLowerCase().replace(' ', '-')}`}>
                          {gate.displayStatus}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingGateId === gate.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={editPercent} 
                            onChange={e => setEditPercent(e.target.value)}
                            style={{ width: '80px' }}
                          />
                          <span style={{ fontSize: '0.8rem', width: '32px' }}>{editPercent}%</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.85rem' }}>{gate.displayCompletion}%</span>
                      )}
                    </td>
                    <td>
                      {editingGateId === gate.id ? (
                        <input 
                          type="date" 
                          value={editDate} 
                          onChange={e => setEditDate(e.target.value)}
                          style={{ padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                        />
                      ) : (
                        <span style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>
                          {gate.due_date ? new Date(gate.due_date).toLocaleDateString() : 'TBD'}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingGateId === gate.id ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="success-btn small flex-center" 
                            onClick={() => saveGateChanges(gate.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                          >
                            <Save size={12} /> Save
                          </button>
                          <button 
                            className="secondary-btn small" 
                            onClick={cancelEditing}
                            style={{ padding: '4px 8px' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="secondary-btn small flex-center" 
                          onClick={() => startEditing(gate)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                        >
                          <Edit3 size={12} /> Reschedule
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
};

export default TimelineModule;
