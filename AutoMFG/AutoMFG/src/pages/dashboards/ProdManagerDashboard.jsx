// ProdManagerDashboard — Production Manager
// Focus: plan approvals, WO release, quality holds, shift review, OEE
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { CheckCircle2, XCircle, ClipboardList, Layers, AlertTriangle, BarChart3, ArrowRight, Lock } from 'lucide-react';
import { MetricCard, WorkflowSteps, StatusBadge, QuickActions } from './shared';
import toast from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

const PENDING_PLANS = [
  { id: 'PP-2026-002', part: 'BMW-3-CHASSIS',       line: 'Line 2', qty: 60,  date: '2026-06-09', materialStatus: 'Partial',   capacityUtil: 72, status: 'Pending Approval' },
  { id: 'PP-2026-003', part: 'BMW-5-ENGINE-MOUNT',   line: 'Line 3', qty: 45,  date: '2026-06-10', materialStatus: 'Available', capacityUtil: 90, status: 'Pending Approval' },
];

const FROZEN_PLANS = [
  { id: 'PP-2026-004', part: 'BMW-7-DASH-PANEL', line: 'Line 4', qty: 100, date: '2026-06-09', status: 'Frozen' },
];

const MATERIAL_WARNINGS = [
  { part: 'Gasket Seal GS-401',   line: 'Line 3', current: 12, required: 200, status: 'Critical' },
  { part: 'M8 Hex Bolt (Grade 8)', line: 'Line 1', current: 450, required: 600, status: 'Low' },
];

export default function ProdManagerDashboard() {
  const { user } = useAuthStore();
  const { oeeMetrics, productionPlans, updatePlanStatus, andonAlerts } = useAppStore();
  const navigate = useNavigate();
  const [plans, setPlans] = useState(PENDING_PLANS);

  const [activeWOs, setActiveWOs] = useState([]);
  const [loadingWOs, setLoadingWOs] = useState(true);

  const fetchActiveWOs = async () => {
    if (!isSupabaseConfigured()) {
      setLoadingWOs(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          production_plans ( plan_id, plan_code, part_number, line_id, start_date, end_date ),
          production_lines ( line_name ),
          plants ( name )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const allOrders = data || [];
      const normalizeStatus = (status) =>
        String(status || "")
          .toLowerCase()
          .replaceAll(" ", "_")
          .replaceAll("-", "_");

      const inProgressOrders = allOrders.filter(
        (wo) => normalizeStatus(wo.status) === "in_progress"
      );

      const formatted = inProgressOrders.map(wo => ({
        id: wo.wo_number || wo.id,
        part: wo.part_number || wo.part || '—',
        line: wo.production_lines?.line_name || (!wo.line_id || wo.line_id?.includes('-') ? '—' : wo.line_id) || '—',
        planned: wo.planned_qty ?? wo.producedQty ?? 0,
        actual: wo.actual_qty ?? wo.producedQty ?? 0,
        status: 'In Progress'
      }));

      setActiveWOs(formatted);
    } catch (err) {
      console.error("Failed to fetch active work orders:", err);
    } finally {
      setLoadingWOs(false);
    }
  };

  useEffect(() => {
    fetchActiveWOs();

    let channel;
    if (isSupabaseConfigured()) {
      channel = supabase
        .channel("work_orders_realtime_manager")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "work_orders"
          },
          () => {
            fetchActiveWOs();
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = (id) => {
    setPlans(prev => prev.filter(p => p.id !== id));
    updatePlanStatus(id, 'Approved');
    toast.success(`Plan ${id} approved and frozen`);
  };

  const handleReject = (id) => {
    setPlans(prev => prev.filter(p => p.id !== id));
    updatePlanStatus(id, 'Draft');
    toast.error(`Plan ${id} sent back to planner`);
  };

  const openAndons = andonAlerts.filter(a => a.status === 'Open');

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Production Manager Dashboard</h1>
          <div className="page-subtitle">Plan Approvals · WO Control · Quality · Shift Review — {user?.plant}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/production-planning')}><ClipboardList size={13} /> Production Planning</button>
          <span className="badge badge-green"><span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: '50%', display: 'inline-block' }} /> LIVE</span>
        </div>
      </div>

      {/* Workflow steps */}
      <div className="card mb-16" style={{ padding: '12px 16px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Workflow Position</div>
        <WorkflowSteps steps={['Planning', 'Approval', 'WO Release', 'Production', 'Quality', 'Shift Review', 'OEE']} current={1} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-4 mb-16">
        <MetricCard label="Pending Approvals" value={plans.length} color={plans.length > 0 ? 'amber' : 'green'} icon={ClipboardList} subtitle="Plans awaiting sign-off" />
        <MetricCard label="Active Work Orders" value={activeWOs.length} color="blue" icon={Layers} />
        <MetricCard label="Open Andon Alerts"  value={openAndons.length} color={openAndons.length > 0 ? 'red' : 'green'} icon={AlertTriangle} />
        <MetricCard label="OEE Today" value={oeeMetrics.oee.toFixed(1)} unit="%" trend={1.2} color={oeeMetrics.oee >= 80 ? 'green' : 'amber'} icon={BarChart3} />
      </div>

      {/* Material Warnings */}
      {MATERIAL_WARNINGS.length > 0 && (
        <div className="andon-banner" style={{ background: 'rgba(255,100,0,0.1)', border: '1px solid rgba(255,100,0,0.35)', marginBottom: 16 }}>
          <AlertTriangle size={14} color="var(--amber)" />
          <span className="andon-banner-text" style={{ color: 'var(--amber)' }}>
            MATERIAL SHORTAGE WARNING — {MATERIAL_WARNINGS.length} critical item{MATERIAL_WARNINGS.length > 1 ? 's' : ''} below required stock level
          </span>
        </div>
      )}

      <div className="grid grid-2 mb-16">
        {/* Pending Plan Approvals */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Plans Pending Approval</span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/production-planning')}>View All</button>
          </div>
          {plans.length === 0 ? (
            <div className="empty-state" style={{ padding: 28 }}>
              <CheckCircle2 size={24} color="var(--green)" />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)' }}>ALL PLANS REVIEWED</span>
            </div>
          ) : plans.map(p => (
            <div key={p.id} style={{ padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: '3px solid var(--amber)', marginBottom: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.part}</span>
                <span className="badge badge-amber">PENDING</span>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)', marginBottom: 8 }}>
                {p.line} · {p.qty} units · {p.date} · Material: {p.materialStatus} · Capacity: {p.capacityUtil}%
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-primary" style={{ flex: 1, background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => handleApprove(p.id)}>
                  <CheckCircle2 size={12} /> Approve & Freeze
                </button>
                <button className="btn btn-sm btn-danger" style={{ flex: 1 }} onClick={() => handleReject(p.id)}>
                  <XCircle size={12} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Active Work Orders */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Active Work Orders</span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/work-orders')}>View All</button>
          </div>
          {loadingWOs ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 12 }}>
              Loading active work orders...
            </div>
          ) : activeWOs.length === 0 ? (
            <div className="empty-state" style={{ padding: 28 }}>
              <CheckCircle2 size={24} color="var(--green)" />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)' }}>NO ACTIVE WORK ORDERS</span>
            </div>
          ) : activeWOs.map(wo => (
            <div key={wo.id} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)' }}>{wo.id}</span>
                <StatusBadge status={wo.status} />
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)', marginBottom: 6 }}>{wo.part} · {wo.line}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)' }}>{wo.actual}/{wo.planned} units</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--bmw-blue)' }}>{wo.planned > 0 ? Math.round((wo.actual / wo.planned) * 100) : 0}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${wo.planned > 0 ? (wo.actual / wo.planned) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Material Shortage table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Material Shortage Warnings</span>
          <span className="badge badge-red">{MATERIAL_WARNINGS.length} ITEMS</span>
        </div>
        {MATERIAL_WARNINGS.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: `3px solid ${m.status === 'Critical' ? 'var(--red)' : 'var(--amber)'}`, marginBottom: 1 }}>
            <span className={`badge ${m.status === 'Critical' ? 'badge-red' : 'badge-amber'}`}>{m.status}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)' }}>{m.part}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>{m.line} · Stock: {m.current} / Required: {m.required}</div>
            </div>
            <button className="btn btn-sm btn-outline">Request Replenishment</button>
          </div>
        ))}
      </div>
    </div>
  );
}
