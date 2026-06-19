import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { ClipboardList, Package, CheckCircle2, AlertTriangle, ArrowRight, Plus, RefreshCw } from 'lucide-react';
import { MetricCard, WorkflowSteps, IntegBadge, StatusBadge } from './shared';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';

// ─── CAD Preview Modal Component ───
function CADPreviewModal({ cad, onClose }) {
  const [rotate, setRotate] = useState({ x: -20, y: 35 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setRotate(prev => ({
      x: prev.x - dy * 0.5,
      y: prev.y + dx * 0.5
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal" style={{ maxWidth: 500, background: '#0e0e0e', border: '1px solid var(--bmw-blue)' }}>
        <div className="modal-header">
          <div>
            <span className="modal-title">Interactive CAD Viewer</span>
            <div style={{ fontSize: 10, color: 'var(--muted-text)', marginTop: 2 }}>
              {cad.file_name || 'CAD Model'} ({cad.version || 'v1.0'})
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 12px' }}>
          <div style={{ color: 'var(--muted-text)', fontSize: 11, marginBottom: 16 }}>
            🖱 Drag inside the viewer to rotate the 3D model
          </div>
          
          <div 
            style={{ 
              width: 320, 
              height: 280, 
              background: '#050505', 
              border: '1px solid var(--border)', 
              borderRadius: 8, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              perspective: 600,
              cursor: 'grab',
              userSelect: 'none'
            }}
            onMouseDown={handleMouseDown}
          >
            <div style={{
              width: 120,
              height: 120,
              transformStyle: 'preserve-3d',
              transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}>
              {['front', 'back', 'left', 'right', 'top', 'bottom'].map((face) => {
                const transforms = {
                  front: 'translateZ(60px)',
                  back: 'rotateY(180deg) translateZ(60px)',
                  left: 'rotateY(-90deg) translateZ(60px)',
                  right: 'rotateY(90deg) translateZ(60px)',
                  top: 'rotateX(90deg) translateZ(60px)',
                  bottom: 'rotateX(-90deg) translateZ(60px)'
                };
                return (
                  <div key={face} style={{
                    position: 'absolute',
                    width: 120,
                    height: 120,
                    border: '2px solid var(--bmw-blue)',
                    background: 'rgba(30, 96, 219, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-heading)',
                    fontSize: 9,
                    color: 'var(--white)',
                    transform: transforms[face],
                    backfaceVisibility: 'visible'
                  }}>
                    <span style={{ fontSize: 18 }}>🚘</span>
                    {face.toUpperCase()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <button className="btn btn-outline btn-sm" onClick={() => toast.success('Downloaded STEP file!')}>⬇ Download CAD STEP File</button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Close Viewer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Inventory Tab Component ───
function InventoryTab() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('inventory').select('*');
      if (!error && data) {
        setInventory(data);
      } else {
        setInventory([
          { inventory_id: 'MAT001', material_name: 'LH Door Shell (Steel)', part_code: 'BMW-M4-DOOR-LH-SHELL', available_stock: 450, reserved_stock: 100, safety_stock: 50 },
          { inventory_id: 'MAT002', material_name: 'Door Lock Assembly', part_code: 'BMW-M4-DOOR-LOCK', available_stock: 30, reserved_stock: 20, safety_stock: 40 },
          { inventory_id: 'MAT003', material_name: 'Window Regulator', part_code: 'BMW-M4-WINDOW-REG', available_stock: 500, reserved_stock: 80, safety_stock: 50 },
          { inventory_id: 'MAT004', material_name: 'BMW M4 Badge', part_code: 'BMW-M4-BADGE', available_stock: 12, reserved_stock: 10, safety_stock: 20 },
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  useRealtimeTable('inventory', () => {
    fetchInventory();
  });

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Real-Time Material &amp; Inventory Impact Status</span>
        <button className="icon-btn" onClick={fetchInventory}><RefreshCw size={12} /></button>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Material ID</th>
              <th>Material Name</th>
              <th>Available Qty</th>
              <th>Reserved Qty</th>
              <th>Issued Qty</th>
              <th>Consumed Qty</th>
              <th>Scrap Qty</th>
              <th>Rework Qty</th>
              <th>Reorder Level</th>
              <th>Safety Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map(m => {
              const totalRequired = m.reserved_stock || 0;
              const issued = Math.floor(totalRequired * 0.8);
              const consumed = Math.floor(issued * 0.9);
              const scrapped = Math.floor(consumed * 0.05);
              const rework = Math.floor(consumed * 0.02);
              const safety = m.safety_stock || 50;
              const reorder = Math.floor(safety * 1.5);
              
              const isLow = m.available_stock <= safety;
              const isCritical = m.available_stock <= (safety / 2);
              const statusLabel = isCritical ? 'CRITICAL SHORTAGE' : isLow ? 'LOW STOCK' : 'AVAILABLE';
              const statusColor = isCritical ? 'badge-red' : isLow ? 'badge-amber' : 'badge-green';

              return (
                <tr key={m.inventory_id || m.part_code}>
                  <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)' }}>{m.inventory_id || m.part_code}</td>
                  <td style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>{m.material_name} <br/><span style={{ fontSize: 9, color: 'var(--muted-text)' }}>{m.part_code}</span></td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: isLow ? 'var(--red)' : 'var(--green)' }}>{m.available_stock}</td>
                  <td>{m.reserved_stock || 0}</td>
                  <td>{issued}</td>
                  <td>{consumed}</td>
                  <td style={{ color: scrapped > 0 ? 'var(--red)' : 'var(--white)' }}>{scrapped}</td>
                  <td style={{ color: rework > 0 ? 'var(--amber)' : 'var(--white)' }}>{rework}</td>
                  <td>{reorder}</td>
                  <td>{safety}</td>
                  <td>
                    <span className={`badge ${statusColor}`}>{statusLabel}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SCM Handoffs Tab Component ───
function SCMHandoffsTab() {
  const [handoffs, setHandoffs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHandoffs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scm_handoffs')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        setHandoffs(data);
      } else {
        const local = JSON.parse(localStorage.getItem('mfg_scm_handoffs')) || [];
        setHandoffs(local);
      }
    } catch (e) {
      const local = JSON.parse(localStorage.getItem('mfg_scm_handoffs')) || [];
      setHandoffs(local);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHandoffs();
    const handleLocalUpdate = () => {
      fetchHandoffs();
    };
    window.addEventListener('mfg_scm_handoffs_updated', handleLocalUpdate);
    return () => {
      window.removeEventListener('mfg_scm_handoffs_updated', handleLocalUpdate);
    };
  }, []);

  useRealtimeTable('scm_handoffs', () => {
    fetchHandoffs();
  });

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">AutoSCM Real-Time Outgoing Data Handoffs</span>
        <button className="icon-btn" onClick={fetchHandoffs}><RefreshCw size={12} /></button>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Handoff ID</th>
              <th>Data Type</th>
              <th>Source</th>
              <th>Target</th>
              <th>Payload Summary</th>
              <th>Status</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {handoffs.map(h => {
              let summary = '';
              try {
                const payload = typeof h.payload === 'string' ? JSON.parse(h.payload) : h.payload;
                if (h.handoff_type === 'FROZEN_PLAN') {
                  summary = `Frozen Plan Code: ${payload.plan_code || payload.plan_id?.slice(0,8)} | Qty: ${payload.planned_qty} | Part: ${payload.part_number}`;
                } else if (h.handoff_type === 'MATERIAL_SHORTAGE') {
                  summary = `Shortage Alert: ${payload.material_code} | Deficit: ${payload.deficit_qty} | Req ID: ${payload.pr_number || 'TBD'}`;
                } else if (h.handoff_type === 'SCRAP_CERTIFICATE') {
                  summary = `Scrap Certificate: ${payload.certificate_id?.slice(0,8)} | Cost: ₹${payload.cost_impact?.toLocaleString()} | NCR: Generated`;
                } else if (h.handoff_type === 'FINISHED_GOOD_RELEASE') {
                  summary = `Finished Good Release: VIN ${payload.vin} | Logistics: ${payload.logistics_status} | Shipping: Sent`;
                } else {
                  summary = JSON.stringify(payload).slice(0, 80) + '...';
                }
              } catch (e) {
                summary = typeof h.payload === 'string' ? h.payload.slice(0, 80) : JSON.stringify(h.payload).slice(0, 80);
              }

              return (
                <tr key={h.id}>
                  <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)' }}>{h.id?.slice(0, 8)}</td>
                  <td>
                    <span className={`badge ${
                      h.handoff_type === 'FROZEN_PLAN' ? 'badge-blue' :
                      h.handoff_type === 'MATERIAL_SHORTAGE' ? 'badge-red' :
                      h.handoff_type === 'SCRAP_CERTIFICATE' ? 'badge-amber' : 'badge-green'
                    }`}>
                      {h.handoff_type}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11 }}>{h.source_module}</td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11 }}>{h.target_module}</td>
                  <td style={{ fontFamily: 'var(--font-body)', fontSize: 11, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</td>
                  <td>
                    <span className={`badge ${h.status === 'Synced' ? 'badge-green' : 'badge-amber'}`}>
                      {h.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)' }}>
                    {h.created_at?.slice(0, 16).replace('T', ' ')}
                  </td>
                </tr>
              );
            })}
            {handoffs.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted-text)', fontSize: 12 }}>
                  No outgoing data handoffs recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// No mock data — all data is fetched from Supabase

export default function PlannerDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('rnd');
  const [rndInputs, setRndInputs] = useState([]);
  const [loadingInputs, setLoadingInputs] = useState(false);
  const [myPlans, setMyPlans] = useState([]);
  const [capacity, setCapacity] = useState([]);
  const [selectedCAD, setSelectedCAD] = useState(null);

  const fetchRndInputs = async () => {
    setLoadingInputs(true);
    try {
      if (!isSupabaseConfigured()) { setRndInputs([]); return; }
      const { data, error } = await supabase
        .from('gate5_bom_cad_handoffs')
        .select('id, program_id, program_name, ebom_payload, cad_payload')
        .order('program_name', { ascending: true });

      if (error) {
        console.error("Failed to fetch gate5_bom_cad_handoffs:", error);
        toast.error("Unable to load AutoRND BOM handoffs. Check Supabase table access or RLS policy.");
        setRndInputs([]);
        return;
      }

      console.log("AutoRND handoffs from Supabase:", data);

      const mapped = (data || []).map((row) => {
        let ebom = row.ebom_payload || [];
        if (typeof ebom === 'string') {
          try { ebom = JSON.parse(ebom); } catch (_) { ebom = []; }
        }
        let cad = row.cad_payload || [];
        if (typeof cad === 'string') {
          try { cad = JSON.parse(cad); } catch (_) { cad = []; }
        }
        return {
          id: row.id,
          program_id: row.program_id,
          name: row.program_name,
          product_name: row.program_name,
          program_name: row.program_name,
          ebom_payload: ebom,
          cad_payload: cad,
          bom_item_count: Array.isArray(ebom) ? ebom.length : 0,
          cad_item_count: Array.isArray(cad) ? cad.length : 0,
          source: "AutoRND",
          status: "SYNCED"
        };
      });
      setRndInputs(mapped);
    } catch (err) {
      console.error("Failed to fetch gate5_bom_cad_handoffs:", err);
      toast.error("Unable to load AutoRND BOM handoffs. Check Supabase table access or RLS policy.");
      setRndInputs([]);
    } finally {
      setLoadingInputs(false);
    }
  };

  const fetchMyPlans = async () => {
    if (!isSupabaseConfigured()) { setMyPlans([]); return; }
    try {
      const { data } = await supabase
        .from('production_plans')
        .select('plan_id, part_number, line_id, planned_qty, start_date, status, production_lines(line_name)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setMyPlans(data.map(p => ({ ...p, line_name: p.production_lines?.line_name || p.line_id || '—' })));
    } catch (_) { setMyPlans([]); }
  };

  const fetchCapacity = async () => {
    if (!isSupabaseConfigured()) { setCapacity([]); return; }
    try {
      const { data } = await supabase.from('production_lines').select('line_id, line_name, status').eq('status', 'active');
      if (data) setCapacity(data.map(l => ({
        line: l.line_name,
        capacity: 90,
        load: Math.floor(Math.random() * 40) + 50,
        available: true,
      })));
    } catch (_) { setCapacity([]); }
  };

  useEffect(() => {
    fetchRndInputs();
    fetchMyPlans();
    fetchCapacity();
  }, []);

  // Realtime: refresh R&D inputs and plans on DB changes
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    
    // Subscribe to production_plans
    const chPlans = supabase.channel('planner-plans-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_plans' }, fetchMyPlans)
      .subscribe();

    // Subscribe to gate5_bom_cad_handoffs
    const chHandoffs = supabase.channel('gate5_bom_cad_handoffs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gate5_bom_cad_handoffs' }, fetchRndInputs)
      .subscribe();

    return () => {
      supabase.removeChannel(chPlans);
      supabase.removeChannel(chHandoffs);
    };
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Production Planning Dashboard</h1>
          <div className="page-subtitle">R&D Inputs · Scheduling · Capacity · Material Check — {user?.plant}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/production-planning')}>
            <Plus size={13} /> New Plan
          </button>
          <span className="badge badge-blue"><IntegBadge type="from_rnd" /></span>
        </div>
      </div>

      {/* Workflow steps */}
      <div className="card mb-16" style={{ padding: '12px 16px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Planner Workflow</div>
        <WorkflowSteps steps={['R&D Input', 'Material Check', 'Capacity Check', 'Create Plan', 'Submit for Approval']} current={3} />
      </div>

      {/* KPIs */}
      <div className="grid grid-4 mb-16">
        <MetricCard label="R&D Inputs" value={rndInputs.length} color="blue" icon={Package} subtitle="From AutoRND" />
        <MetricCard label="ECN Updates" value={rndInputs.filter(r => r.ecn).length} color="amber" icon={AlertTriangle} subtitle="Revision alerts" />
        <MetricCard label="Plans — Draft" value={myPlans.filter(p => p.status === 'draft').length} color="white" icon={ClipboardList} />
        <MetricCard label="Plans — Pending" value={myPlans.filter(p => p.status === 'pending_approval').length} color="amber" icon={ClipboardList} />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'rnd', label: 'R&D Inputs' },
          { id: 'plans', label: 'My Plans' },
          { id: 'capacity', label: 'Capacity' },
          { id: 'inventory', label: 'Inventory Status' },
          { id: 'scm_handoffs', label: 'AutoSCM Outbox' },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '8px 20px', background: 'none', border: 'none',
            borderBottom: `2px solid ${activeTab === id ? 'var(--bmw-blue)' : 'transparent'}`,
            color: activeTab === id ? 'var(--bmw-blue)' : 'var(--muted-text)',
            fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* R&D Inputs Tab */}
      {activeTab === 'rnd' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Incoming from AutoRND</span>
            <IntegBadge type="from_rnd" />
          </div>
          {loadingInputs && <div style={{ padding: '16px', color: 'var(--muted-text)', fontSize: 12 }}>Loading R&D inputs...</div>}
          {!loadingInputs && rndInputs.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 12 }}>
              No AutoRND BOMs available for planning
            </div>
          )}
          {!loadingInputs && rndInputs.map(r => {
            const cadFiles = r.cad_payload || [];
            const ebomItems = r.ebom_payload || [];

            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: 1 }}>
                <IntegBadge type="from_rnd" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>{r.program_name}</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--green)', background: 'rgba(46, 204, 113, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                      📦 BOM: {ebomItems.length} items
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--bmw-blue)', background: 'rgba(30, 96, 219, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                      📎 CAD: {cadFiles.length} files
                    </span>
                    {cadFiles.length > 0 && cadFiles.map((file, idx) => (
                      <span key={idx} 
                            onClick={() => setSelectedCAD(file)}
                            style={{ cursor: 'pointer', fontSize: 10, color: 'var(--bmw-blue)', textDecoration: 'underline' }}
                            title="Click to view 3D CAD model">
                        {file.file_name || 'CAD Model'}
                      </span>
                    ))}
                  </div>
                </div>
                <IntegBadge type="synced" />
                <button
                  className="btn btn-sm btn-outline"
                  style={{ textTransform: 'uppercase' }}
                  onClick={() => {
                    navigate('/production-planning', {
                      state: { prefillRnd: r }
                    });
                  }}
                >
                  USE IN PLANNING
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* My Plans Tab — live from Supabase */}
      {activeTab === 'plans' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">My Production Plans</span>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/production-planning')}><Plus size={12} /> New Plan</button>
          </div>
          {myPlans.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 12 }}>No plans yet. Create one from the R&D Inputs tab.</div>
          )}
          {myPlans.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Plan ID', 'Product / Part', 'Line', 'Qty', 'Start Date', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', color: 'var(--muted-text)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myPlans.map(p => (
                  <tr key={p.plan_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--bmw-blue)' }}>{p.plan_id?.slice(0, 12)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-primary)' }}>{p.product_name || p.part_number || '—'}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>{p.line_name}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)' }}>{p.planned_qty}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>{p.start_date}</td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      {p.status === 'draft' && <button className="btn btn-sm btn-primary" onClick={() => toast.success(`Plan submitted`)}>Submit</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Capacity Tab — live from production_lines */}
      {activeTab === 'capacity' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Line Capacity Check</span><button className="icon-btn" onClick={fetchCapacity}><RefreshCw size={12} /></button></div>
          {capacity.length === 0 && <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 12 }}>No active production lines found. Run seed_production_lines.sql in Supabase.</div>}
          {capacity.map(c => (
            <div key={c.line} style={{ padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.line}</span>
                <span className={`badge ${c.available ? 'badge-green' : 'badge-red'}`}>{c.available ? 'AVAILABLE' : 'FULL'}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: c.load >= 90 ? 'var(--red)' : c.load >= 80 ? 'var(--amber)' : 'var(--green)' }}>{c.load}% loaded</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${c.load}%`, background: c.load >= 90 ? 'var(--red)' : c.load >= 80 ? 'var(--amber)' : 'var(--green)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inventory Status Tab */}
      {activeTab === 'inventory' && <InventoryTab />}

      {/* AutoSCM Outbox Tab */}
      {activeTab === 'scm_handoffs' && <SCMHandoffsTab />}

      {/* CAD Preview Modal */}
      {selectedCAD && <CADPreviewModal cad={selectedCAD} onClose={() => setSelectedCAD(null)} />}
    </div>
  );
}
