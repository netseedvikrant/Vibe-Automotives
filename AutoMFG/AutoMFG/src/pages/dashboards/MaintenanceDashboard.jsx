// MaintenanceDashboard — Maintenance Technician
// Focus: breakdown tickets, diagnosis, spare requests, repair, trial run, calibration
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { Cpu, Wrench, CheckCircle2, Clock, AlertTriangle, Package, FileText } from 'lucide-react';
import { MetricCard, WorkflowSteps, StatusBadge } from './shared';
import toast from 'react-hot-toast';

const MY_TICKETS = [
  { id: 'BRK-001', machine: 'Press Machine P1',   desc: 'Hydraulic pressure loss — ram not returning', severity: 'P1', status: 'Open',      sla: 60,  elapsed: 42 },
  { id: 'BRK-002', machine: 'CNC Lathe L3',        desc: 'Tool change cycle failure — spindle jam',      severity: 'P2', status: 'In Repair', sla: 120, elapsed: 85 },
];

const CALIBRATION_DUE = [
  { id: 'TL-003', name: 'Pneumatic Drill 18V',  due: '2026-06-10', station: 'Station 3B' },
  { id: 'TL-006', name: 'Hydraulic Press 50T',  due: '2026-06-11', station: 'Press Shop'  },
];

const SPARE_PARTS = [
  { id: 'SP-001', ticket: 'BRK-001', part: 'Hydraulic Seal Kit HS-22', qty: 1, status: 'Ordered' },
  { id: 'SP-002', ticket: 'BRK-002', part: 'Spindle Bearing 6205-2RS',  qty: 2, status: 'In Stock' },
];

export default function MaintenanceDashboard() {
  const { user } = useAuthStore();
  const { breakdowns, updateBreakdown } = useAppStore();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState(MY_TICKETS);
  const [activeTab, setActiveTab] = useState('tickets');

  const acknowledge = (id) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'Acknowledged' } : t));
    updateBreakdown(id, { status: 'In Repair', acknowledged: true });
    toast.success(`Ticket ${id} acknowledged`);
  };

  const closeTicket = (id) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'Closed' } : t));
    updateBreakdown(id, { status: 'Resolved' });
    toast.success(`Ticket ${id} closed — machine back online`);
  };

  const openTickets = tickets.filter(t => t.status !== 'Closed');
  const p1Count = tickets.filter(t => t.severity === 'P1' && t.status !== 'Closed').length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Maintenance Technician Dashboard</h1>
          <div className="page-subtitle">Breakdown Tickets · Diagnosis · Repair · Calibration — {user?.plant}</div>
        </div>
        <div className="page-actions">
          {p1Count > 0 && <span className="badge badge-red">⚠ {p1Count} P1 ACTIVE</span>}
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/maintenance')}>All Tickets</button>
        </div>
      </div>

      {/* P1 Alert Banner */}
      {p1Count > 0 && (
        <div className="andon-banner" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} color="var(--red)" />
          <span className="andon-banner-text">P1 BREAKDOWN — Press Machine P1 — Hydraulic pressure loss — IMMEDIATE ACTION REQUIRED</span>
        </div>
      )}

      {/* Workflow */}
      <div className="card mb-16" style={{ padding: '12px 16px' }}>
        <WorkflowSteps steps={['Ticket Raised', 'Acknowledge', 'Diagnose', 'Spare Request', 'Repair', 'Trial Run', 'Close']} current={2} />
      </div>

      {/* KPIs */}
      <div className="grid grid-4 mb-16">
        <MetricCard label="Open Tickets"       value={openTickets.length} color={p1Count > 0 ? 'red' : 'amber'} icon={AlertTriangle} />
        <MetricCard label="P1 Breakdowns"      value={p1Count}            color={p1Count > 0 ? 'red' : 'green'} icon={Cpu} />
        <MetricCard label="Calibration Due"    value={CALIBRATION_DUE.length} color="amber" icon={Wrench} subtitle="Within 2 days" />
        <MetricCard label="Avg MTTR"           value="42" unit=" min"     color="blue" icon={Clock} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'tickets', label: 'My Tickets' },
          { id: 'calibration', label: 'Calibration Due' },
          { id: 'spares', label: 'Spare Requests' },
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

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tickets.map(t => (
            <div key={t.id} className="card" style={{ borderLeft: `4px solid ${t.severity === 'P1' ? 'var(--red)' : t.severity === 'P2' ? 'var(--amber)' : 'var(--bmw-blue)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${t.severity === 'P1' ? 'badge-red' : t.severity === 'P2' ? 'badge-amber' : 'badge-blue'}`}>{t.severity}</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{t.machine}</span>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>{t.desc}</div>

              {/* SLA Timer */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.1em' }}>SLA TIMER</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: t.elapsed / t.sla > 0.8 ? 'var(--red)' : 'var(--amber)' }}>
                    {t.elapsed}m / {t.sla}m
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min((t.elapsed / t.sla) * 100, 100)}%`, background: t.elapsed / t.sla > 0.8 ? 'var(--red)' : t.elapsed / t.sla > 0.6 ? 'var(--amber)' : 'var(--green)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {t.status === 'Open' && (
                  <button className="btn btn-primary btn-sm" onClick={() => acknowledge(t.id)}><CheckCircle2 size={12} /> Acknowledge</button>
                )}
                {t.status !== 'Open' && t.status !== 'Closed' && (
                  <>
                    <button className="btn btn-sm btn-outline" onClick={() => toast.success('Diagnosis form opened')}><FileText size={12} /> Diagnose</button>
                    <button className="btn btn-sm btn-outline" onClick={() => setActiveTab('spares')}><Package size={12} /> Request Parts</button>
                    <button className="btn btn-sm" style={{ background: 'var(--green)', borderColor: 'var(--green)', color: 'white' }} onClick={() => closeTicket(t.id)}>
                      <CheckCircle2 size={12} /> Trial Run & Close
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calibration Due Tab */}
      {activeTab === 'calibration' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tools Due for Calibration</span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/tooling')}>Tooling Module</button>
          </div>
          {CALIBRATION_DUE.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: '3px solid var(--amber)', marginBottom: 1 }}>
              <Wrench size={16} color="var(--amber)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)' }}>{c.name}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>{c.station} · Due: {c.due}</div>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => toast.success(`Calibration scheduled for ${c.name}`)}>Schedule</button>
            </div>
          ))}
        </div>
      )}

      {/* Spare Requests Tab */}
      {activeTab === 'spares' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Spare Parts Requests</span>
            <button className="btn btn-primary btn-sm" onClick={() => toast.success('New spare request created')}><Package size={12} /> New Request</button>
          </div>
          {SPARE_PARTS.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>{s.part}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>Ticket: {s.ticket} · Qty: {s.qty}</div>
              </div>
              <span className={`badge ${s.status === 'In Stock' ? 'badge-green' : 'badge-amber'}`}>{s.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
