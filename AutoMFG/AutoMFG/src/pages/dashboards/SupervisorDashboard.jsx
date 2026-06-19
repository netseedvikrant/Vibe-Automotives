// SupervisorDashboard — Shift Supervisor
// Focus: live floor, open Andons, blocked stations, scrap queue, shift handover
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { AlertTriangle, CheckCircle2, Cpu, ArrowLeftRight, Activity, Clock } from 'lucide-react';
import { MetricCard, WorkflowSteps, StatusBadge } from './shared';
import toast from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

const CARRY_FORWARD = [
  { id: 'CF-001', issue: 'MCH-002 under repair — partial output', from: 'Shift B', priority: 'P1' },
  { id: 'CF-002', issue: 'Material shortage Line 3 — gasket seal', from: 'Shift B', priority: 'P2' },
];

export default function SupervisorDashboard() {
  const { user } = useAuthStore();
  const { andonAlerts, resolveAndon, fetchAndons } = useAppStore();
  const navigate = useNavigate();

  const [floorStatus, setFloorStatus] = useState([]);
  const [loadingFloor, setLoadingFloor] = useState(true);

  const openAndons = andonAlerts.filter(a => 
    (a.status === 'Open' || a.status === 'open' || a.status === 'active' || a.status === 'Active') &&
    (!user?.plant || !a.plant || a.plant.toLowerCase() === user.plant.toLowerCase()) &&
    (!user?.shift || !a.shift || a.shift.toLowerCase() === user.shift.toLowerCase())
  );

  const fetchFloorStatus = async () => {
    if (!isSupabaseConfigured()) {
      setLoadingFloor(false);
      return;
    }
    try {
      const { data: andonData } = await supabase
        .from('andon_events')
        .select('*')
        .in('status', ['Open', 'open', 'active', 'Active']);

      const currentOpenAndons = andonData || [];

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

      const mapped = inProgressOrders.map((wo, index) => {
        const lineName = wo.production_lines?.line_name || 'Line 1';
        
        const lineAndon = currentOpenAndons.find(a => a.line === lineName);
        let status = 'Running';
        if (lineAndon) {
          status = lineAndon.severity === 'high' || lineAndon.severity === 'critical' ? 'BLOCKED' : 'Shortage';
        }

        return {
          line: lineName,
          station: `St.${(index % 3) + 1}`,
          status,
          wo: wo.wo_number || wo.id,
          op: wo.operation || 'Door Welding',
          takt: `${wo.stdTime || 24}s`,
          actual: wo.actual_qty > 0 ? `${Math.round((wo.stdTime || 24) * 0.9)}s` : '—'
        };
      });

      setFloorStatus(mapped);
    } catch (err) {
      console.error("Failed to fetch floor status:", err);
    } finally {
      setLoadingFloor(false);
    }
  };

  useEffect(() => {
    fetchAndons();
    fetchFloorStatus();

    let channel;
    if (isSupabaseConfigured()) {
      channel = supabase
        .channel("work_orders_realtime_supervisor")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "work_orders"
          },
          () => {
            fetchFloorStatus();
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const blockedStations = floorStatus.filter(s => s.status !== 'Running');

  const handleResolve = (id) => {
    resolveAndon(id);
    toast.success('Andon resolved — station resumed');
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Shift Supervisor Dashboard</h1>
          <div className="page-subtitle">Live Floor Control · Andon · Maintenance · Shift Handover — {user?.plant} · {user?.shift}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/shift-handover')}><ArrowLeftRight size={13} /> Start Handover</button>
          <span className="badge badge-green"><span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: '50%', display: 'inline-block' }} /> SHIFT ACTIVE</span>
        </div>
      </div>

      {/* Andon Banner */}
      {openAndons.length > 0 && (
        <div className="andon-banner" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} color="var(--red)" />
          <span className="andon-banner-text">⚡ {openAndons.length} ANDON ALERT{openAndons.length > 1 ? 'S' : ''} REQUIRE SUPERVISOR RESOLUTION</span>
          <button className="btn btn-sm btn-danger" onClick={() => navigate('/assembly-line')}>RESOLVE</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-4 mb-16">
        <MetricCard label="Open Andons"       value={openAndons.length}       color={openAndons.length > 0 ? 'red' : 'green'} icon={AlertTriangle} />
        <MetricCard label="Blocked Stations"  value={blockedStations.length}  color={blockedStations.length > 0 ? 'amber' : 'green'} icon={Activity} />
        <MetricCard label="Carry-Forward"     value={CARRY_FORWARD.length}    color="amber" icon={Clock} subtitle="From previous shift" />
        <MetricCard label="Shift Output"      value="310" unit=" units"       color="blue" icon={CheckCircle2} subtitle="Target: 350" />
      </div>

      <div className="grid grid-2 mb-16">
        {/* Open Andons */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Open Andon Alerts</span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/assembly-line')}>Full View</button>
          </div>
          {openAndons.length === 0 ? (
            <div className="empty-state" style={{ padding: 28 }}>
              <CheckCircle2 size={24} color="var(--green)" />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)' }}>NO OPEN ANDONS</span>
            </div>
          ) : openAndons.map(a => (
            <div key={a.id} style={{ padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: `3px solid ${a.severity === 'high' ? 'var(--red)' : 'var(--amber)'}`, marginBottom: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{a.line} / {a.station}</span>
                <span className={`badge ${a.severity === 'high' ? 'badge-red' : 'badge-amber'}`}>{a.type?.replace('_', ' ').toUpperCase()}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)', marginBottom: 8 }}>{a.description}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-primary" style={{ flex: 1, background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => handleResolve(a.id)}>
                  <CheckCircle2 size={12} /> Resolve
                </button>
                <button className="btn btn-sm btn-outline" onClick={() => navigate('/maintenance')}>
                  <Cpu size={12} /> Escalate
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Live Floor Status */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Live Floor Status</span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/assembly-line')}>Full View</button>
          </div>
          {loadingFloor ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 12 }}>
              Loading floor status...
            </div>
          ) : floorStatus.length === 0 ? (
            <div className="empty-state" style={{ padding: 28 }}>
              <CheckCircle2 size={24} color="var(--green)" />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)' }}>NO ACTIVE WORK CENTERS</span>
            </div>
          ) : floorStatus.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: `3px solid ${s.status === 'Running' ? 'var(--green)' : s.status === 'BLOCKED' ? 'var(--red)' : 'var(--amber)'}`, marginBottom: 1 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', minWidth: 50 }}>{s.station}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-primary)' }}>{s.op}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--muted-text)' }}>{s.wo} · Takt: {s.takt} / Actual: {s.actual}</div>
              </div>
              <span className={`badge ${s.status === 'Running' ? 'badge-green' : s.status === 'BLOCKED' ? 'badge-red' : 'badge-amber'}`}>{s.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Carry-forward issues */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Carry-Forward Issues from Previous Shift</span>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/shift-handover')}>Handover Report</button>
        </div>
        {CARRY_FORWARD.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: `3px solid ${c.priority === 'P1' ? 'var(--red)' : 'var(--amber)'}`, marginBottom: 1 }}>
            <span className={`badge ${c.priority === 'P1' ? 'badge-red' : 'badge-amber'}`}>{c.priority}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-primary)' }}>{c.issue}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>From: {c.from}</div>
            </div>
            <button className="btn btn-sm btn-outline"><CheckCircle2 size={11} /> Mark Resolved</button>
          </div>
        ))}
      </div>
    </div>
  );
}
