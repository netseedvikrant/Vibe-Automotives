import { useState, useEffect, useRef } from 'react';
import { useActiveShift } from '../hooks/useActiveShift';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Layers, Activity, Wrench,
  ArrowLeftRight, AlertTriangle, Shield, Cpu, TestTube,
  BarChart3, Settings, ChevronLeft, ChevronRight, LogOut, Menu, X,
  Bell, WifiOff, CheckCheck, Clock, Zap, Award, Users, FileText,
  TrendingUp, Package, Truck, Radio, Eye, GitMerge,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { useNotifications } from '../providers/NotificationProvider';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { syncOfflineQueue } from '../lib/offlineSync';
import toast from 'react-hot-toast';

// ── Role-specific navigation definitions ────────────────────────
// Each role gets a curated list of nav items relevant to their workflow
const ROLE_NAV = {
  sys_admin: [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { id: 'admin', label: 'Users & Roles', path: '/admin', icon: Users },
    { id: 'production_planning', label: 'Master Config', path: '/admin', icon: Settings },
    { id: 'oee', label: 'Audit Logs', path: '/admin', icon: FileText },
    { id: 'admin', label: 'Integration Monitor', path: '/admin', icon: GitMerge },
  ],
  plant_manager: [
    { id: 'dashboard', label: 'Executive Dashboard', path: '/dashboard', icon: Award },
    { id: 'oee', label: 'OEE', path: '/oee', icon: BarChart3 },
    { id: 'production_planning', label: 'Production Summary', path: '/production-planning', icon: TrendingUp },
    { id: 'quality_gate', label: 'Quality Escalations', path: '/quality-gate', icon: Shield },
    { id: 'shift_handover', label: 'Shift Reports', path: '/shift-handover', icon: FileText },
    { id: 'scrap_rework', label: 'Supply Chain Impact', path: '/scrap-rework', icon: Truck },
  ],
  production_manager: [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { id: 'production_planning', label: 'Plan Approvals', path: '/production-planning', icon: ClipboardList },
    { id: 'work_orders', label: 'Work Orders', path: '/work-orders', icon: Layers },
    { id: 'quality_gate', label: 'Quality Holds', path: '/quality-gate', icon: Shield },
    { id: 'shift_handover', label: 'Shift Handover', path: '/shift-handover', icon: ArrowLeftRight },
    { id: 'oee', label: 'OEE', path: '/oee', icon: BarChart3 },
  ],
  production_planner: [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { id: 'production_planning', label: 'R&D Inputs', path: '/production-planning', icon: Package },
    { id: 'production_planning', label: 'Planning', path: '/production-planning', icon: ClipboardList },
    { id: 'production_planning', label: 'Capacity Check', path: '/production-planning', icon: Activity },
    { id: 'production_planning', label: 'Material Check', path: '/production-planning', icon: Layers },
    { id: 'work_orders', label: 'Work Orders', path: '/work-orders', icon: Layers },
  ],
  shift_supervisor: [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { id: 'assembly_line', label: 'Live Floor', path: '/assembly-line', icon: Radio },
    { id: 'assembly_line', label: 'Andon', path: '/assembly-line', icon: AlertTriangle },
    { id: 'maintenance', label: 'Maintenance', path: '/maintenance', icon: Cpu },
    { id: 'scrap_rework', label: 'Scrap / Rework', path: '/scrap-rework', icon: AlertTriangle },
    { id: 'shift_handover', label: 'Shift Handover', path: '/shift-handover', icon: ArrowLeftRight },
  ],
  line_leader: [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { id: 'assembly_line', label: 'My Line', path: '/assembly-line', icon: Activity },
    { id: 'work_orders', label: 'Work Orders', path: '/work-orders', icon: Layers },
    { id: 'tooling', label: 'Tooling', path: '/tooling', icon: Wrench },
    { id: 'scrap_rework', label: 'Defects', path: '/scrap-rework', icon: AlertTriangle },
  ],
  machine_operator: [
    { id: 'dashboard', label: 'My Station', path: '/dashboard', icon: Cpu },
    { id: 'work_orders', label: 'My Work Order', path: '/work-orders', icon: Layers },
    { id: 'assembly_line', label: 'Assembly & Takt', path: '/assembly-line', icon: Activity },
  ],
  quality_inspector: [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { id: 'quality_gate', label: 'Quality Gate', path: '/quality-gate', icon: Shield },
    { id: 'scrap_rework', label: 'Defect Register', path: '/scrap-rework', icon: AlertTriangle },
    { id: 'scrap_rework', label: 'Scrap / Rework', path: '/scrap-rework', icon: Wrench },
    { id: 'eol', label: 'EOL Testing', path: '/eol-testing', icon: TestTube },
    { id: 'eol', label: 'Certificates', path: '/eol-testing', icon: Award },
  ],
  maintenance_tech: [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { id: 'maintenance', label: 'Breakdown Tickets', path: '/maintenance', icon: AlertTriangle },
    { id: 'maintenance', label: 'Machine Status', path: '/maintenance', icon: Cpu },
    { id: 'maintenance', label: 'Spare Requests', path: '/maintenance', icon: Package },
    { id: 'tooling', label: 'Tool Calibration', path: '/tooling', icon: Wrench },
    { id: 'maintenance', label: 'Repair Logs', path: '/maintenance', icon: FileText },
  ],
  ceo: [
    { id: 'ceo_dashboard', label: 'CEO Executive Dashboard', path: '/ceo-dashboard', icon: Award },
    { id: 'dashboard', label: 'Command Center', path: '/dashboard', icon: LayoutDashboard },
    { id: 'oee', label: 'OEE Dashboard', path: '/oee', icon: BarChart3 },
    { id: 'production_planning', label: 'Production Planning', path: '/production-planning', icon: ClipboardList },
    { id: 'work_orders', label: 'Work Orders', path: '/work-orders', icon: Layers },
    { id: 'admin', label: 'Admin Panel', path: '/admin', icon: Settings },
  ],
};

// Deduplicate nav items by path (some roles have same path for multiple labels)
const getNavForRole = (role) => {
  const items = ROLE_NAV[role] || [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  ];
  // Keep all items — allow duplicates for same-path different labels (tabs within a page)
  return items;
};

const SOURCE_ICONS = {
  andon: AlertTriangle,
  breakdown: Cpu,
  quality: Shield,
  plan: ClipboardList,
  work_order: Layers,
  default: Bell,
};

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className="topbar-clock">
      {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

function NotificationDropdown({ onClose }) {
  const ctx = useNotifications();
  const navigate = useNavigate();
  const notifications = ctx?.notifications || [];
  const markRead = ctx?.markRead;
  const markAllRead = ctx?.markAllRead;

  const SOURCE_PATH_MAP = {
    andon: '/assembly-line',
    breakdown: '/maintenance',
    quality: '/quality-gate',
    plan: '/production-planning',
    work_order: '/work-orders',
  };

  const handleClick = (n) => {
    markRead?.(n.notification_id);
    const path = SOURCE_PATH_MAP[n.source_type] || '/dashboard';
    navigate(path);
    onClose();
  };

  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0, width: 360,
      background: 'var(--bg-surface)', border: '1px solid var(--border-active)',
      zIndex: 2001, maxHeight: 480, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
          Notifications
        </span>
        {notifications.some((n) => n.status === 'unread') && (
          <button
            onClick={markAllRead}
            style={{ background: 'none', border: 'none', color: 'var(--bmw-blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: '0.1em' }}
          >
            <CheckCheck size={12} /> Mark all read
          </button>
        )}
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted-text)', fontFamily: 'var(--font-heading)', fontSize: 12, letterSpacing: '0.1em' }}>
            No notifications
          </div>
        ) : (
          notifications.map((n) => {
            const SrcIcon = SOURCE_ICONS[n.source_type] || SOURCE_ICONS.default;
            return (
              <div
                key={n.notification_id}
                onClick={() => handleClick(n)}
                style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start',
                  background: n.status === 'unread' ? 'var(--bmw-blue-subtle)' : 'transparent',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={(e) => e.currentTarget.style.background = n.status === 'unread' ? 'var(--bmw-blue-subtle)' : 'transparent'}
              >
                <div style={{ width: 28, height: 28, background: 'var(--bg-elevated)', border: '1px solid var(--border-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <SrcIcon size={12} color="var(--bmw-blue)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.08em', marginTop: 4 }}>
                    {new Date(n.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {n.status === 'unread' && (
                  <div style={{ width: 6, height: 6, background: 'var(--bmw-blue)', borderRadius: '50%', flexShrink: 0, marginTop: 4 }} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar, selectedPlant, setPlant, andonAlerts, isOnline, setOnline, toasts, raiseAndon, resolveAndon, setAndonAlerts, fetchAndons } = useAppStore();
  const activeShift = useActiveShift();
  const notifCtx = useNotifications();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const hasRedirectedAfterLogout = useRef(false);

  // Role-aware navigation — each role gets curated sidebar items
  const allowedNav = getNavForRole(user?.role);
  const activeAlerts = andonAlerts.filter((a) => a.status === 'Open' || a.status === 'open' || a.status === 'active' || a.status === 'Active');
  const unreadCount = notifCtx?.unreadCount || 0;

  // Load and sync Andon events from Supabase on mount with realtime subscriptions
  useEffect(() => {
    let channel;
    
    const initAndonSync = async () => {
      const { getAndonTableName, mapAndonFromDb } = await import('../lib/supabase');
      const tableName = await getAndonTableName();
      
      // Perform initial fetch using the unified fetch function
      await fetchAndons();
      
      if (!isSupabaseConfigured()) return;
      
      // Subscribe to real-time changes
      channel = supabase.channel('andon-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const mapped = mapAndonFromDb(payload.new, tableName);
            if (['active', 'open', 'raised', 'ACTIVE', 'OPEN'].includes(mapped.status)) {
              mapped.status = 'Open';
              setAndonAlerts([mapped, ...useAppStore.getState().andonAlerts.filter(a => a.id !== mapped.id)]);
              toast.error(`⚡ NEW ANDON: ${mapped.line} / ${mapped.station} - ${mapped.description}`, { duration: 6000 });
            }
          } else if (payload.eventType === 'UPDATE') {
            const mapped = mapAndonFromDb(payload.new, tableName);
            const isResolved = mapped.status === 'resolved' || mapped.status === 'Resolved';
            setAndonAlerts(useAppStore.getState().andonAlerts.map(a => 
              a.id === mapped.id 
                ? { 
                    ...a, 
                    status: isResolved ? 'Resolved' : mapped.status === 'acknowledged' ? 'Acknowledged' : 'Open',
                    resolved_at: mapped.resolved_at,
                    resolved_by: mapped.resolved_by,
                  } 
                : a
            ));
          } else if (payload.eventType === 'DELETE') {
            const id = tableName === 'andon_alerts' ? payload.old.id : payload.old.andon_id;
            setAndonAlerts(useAppStore.getState().andonAlerts.filter(a => a.id !== id));
          }
        })
        .subscribe();
    };

    initAndonSync();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Online / offline detection
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      toast.success('Connection restored');
      syncOfflineQueue();
    };
    const onOffline = () => {
      setOnline(false);
      toast.error('Connection lost — Offline mode');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Initial check
    if (navigator.onLine) {
      setOnline(true);
      syncOfflineQueue();
    } else {
      setOnline(false);
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await logout();
      if (!hasRedirectedAfterLogout.current) {
        hasRedirectedAfterLogout.current = true;
        navigate('/login', { replace: true });
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const initials = user?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'AU';

  return (
    <div className="app-shell">
      {/* TOPBAR */}
      <header className="topbar">
        <div className={`topbar-brand ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {!sidebarCollapsed ? (
            <div className="brand-logo">
              <div className="brand-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5l7.5 3.75L12 12 4.5 8.25 12 4.5z" />
                </svg>
              </div>
              <div>
                <div className="brand-text">AutoMFG</div>
                <div className="brand-sub">Manufacturing Suite</div>
              </div>
            </div>
          ) : (
            <div className="brand-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5l7.5 3.75L12 12 4.5 8.25 12 4.5z" />
              </svg>
            </div>
          )}
        </div>

        <div className="topbar-center">
          <button className="icon-btn" onClick={() => { toggleSidebar(); setMobileOpen(false); }} title="Toggle sidebar">
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <span className="shift-badge">{activeShift.name}</span>
          <span className="plant-select" style={{ pointerEvents: 'none', userSelect: 'none' }}>PLANT A</span>
          {!isOnline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--amber-dim)', border: '1px solid var(--amber)' }}>
              <WifiOff size={12} color="var(--amber)" />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--amber)', letterSpacing: '0.12em' }}>OFFLINE</span>
            </div>
          )}
          {activeAlerts.length > 0 && (() => {
            // Role-contextual Andon banner behavior
            const role = user?.role;
            const bannerPath = role === 'maintenance_tech' ? '/maintenance'
              : role === 'machine_operator' ? '/assembly-line'
              : role === 'shift_supervisor' ? '/assembly-line'
              : role === 'sys_admin' ? '/admin'
              : '/assembly-line';
            return (
              <div className="andon-banner" style={{ marginBottom: 0, padding: '4px 12px', flex: 1, cursor: 'pointer' }} onClick={() => navigate(bannerPath)}>
                <AlertTriangle size={14} />
                <span className="andon-banner-text">
                  {activeAlerts.length} ACTIVE ANDON ALERT{activeAlerts.length > 1 ? 'S' : ''} — {activeAlerts[0].line} / {activeAlerts[0].station}: {activeAlerts[0].description}
                </span>
              </div>
            );
          })()}
        </div>

        <div className="topbar-right">
          <LiveClock />
          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 8px' }} />

          {/* Notification Bell */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              className="icon-btn"
              title="Notifications"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: 5,
                  minWidth: 16, height: 16, background: 'var(--red)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontFamily: 'var(--font-heading)',
                  fontSize: 9, fontWeight: 700, color: 'white',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <NotificationDropdown onClose={() => setShowNotifications(false)} />
            )}
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
          <div 
            className="user-chip" 
            onClick={isLoggingOut ? null : handleLogout} 
            title="Click to logout"
            style={{ 
              pointerEvents: isLoggingOut ? 'none' : 'auto', 
              opacity: isLoggingOut ? 0.6 : 1 
            }}
          >
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{user?.roleLabel} · {user?.department || user?.plant}</span>
            </div>
            <LogOut size={12} style={{ color: 'var(--muted-text)', marginLeft: 4 }} />
          </div>
          {/* Mobile hamburger */}
          <button className="icon-btn mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>

      {/* SIDEBAR */}
      <nav className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-nav">
          {!sidebarCollapsed && (
            <div className="nav-section-label">Modules</div>
          )}
          {allowedNav.map((item, index) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={`${item.id}-${index}`}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={sidebarCollapsed ? item.label : ''}
                onClick={() => setMobileOpen(false)}
              >
                <span className="nav-item-icon"><Icon size={16} /></span>
                {!sidebarCollapsed && <span className="nav-item-label">{item.label}</span>}
              </NavLink>
            );
          })}
        </div>
        <div className="sidebar-footer">
          <button 
            className="sidebar-toggle" 
            onClick={handleLogout} 
            disabled={isLoggingOut}
            style={{ 
              pointerEvents: isLoggingOut ? 'none' : 'auto', 
              opacity: isLoggingOut ? 0.6 : 1 
            }}
          >
            <LogOut size={14} />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {children}
      </main>

      {/* OFFLINE BANNER */}
      {!isOnline && (
        <div className="offline-banner">
          <WifiOff size={14} />
          <span>OFFLINE MODE — Data will sync when connection is restored</span>
        </div>
      )}

      {/* Legacy toasts from appStore */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type || ''}`}>
            <div>
              <div className="toast-title">{t.title}</div>
              {t.message && <div className="toast-msg">{t.message}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
