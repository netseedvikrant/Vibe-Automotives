import { useState, useEffect, useRef } from 'react';
import { useActiveShift } from '../hooks/useActiveShift';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Layers, Activity, Wrench,
  ArrowLeftRight, AlertTriangle, Shield, Cpu, TestTube,
  BarChart3, Settings, ChevronLeft, ChevronRight, LogOut, Menu, X,
  Bell, WifiOff, CheckCheck, Clock, Zap, Award,
} from 'lucide-react';
import { useAuthStore, ROLE_PERMISSIONS } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { useNotifications } from '../providers/NotificationProvider';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { syncOfflineQueue } from '../lib/offlineSync';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { id: 'ceo_dashboard', label: 'CEO Executive Dashboard', path: '/ceo-dashboard', icon: Award },
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { id: 'production_planning', label: 'Production Planning', path: '/production-planning', icon: ClipboardList },
  { id: 'work_orders', label: 'Work Orders', path: '/work-orders', icon: Layers },
  { id: 'assembly_line', label: 'Assembly & Takt', path: '/assembly-line', icon: Activity },
  { id: 'tooling', label: 'Tooling & Equipment', path: '/tooling', icon: Wrench },
  { id: 'shift_handover', label: 'Shift Handover', path: '/shift-handover', icon: ArrowLeftRight },
  { id: 'scrap_rework', label: 'Scrap & Rework', path: '/scrap-rework', icon: AlertTriangle },
  { id: 'quality_gate', label: 'Quality Gate', path: '/quality-gate', icon: Shield },
  { id: 'maintenance', label: 'Maintenance', path: '/maintenance', icon: Cpu },
  { id: 'eol', label: 'EOL Testing', path: '/eol-testing', icon: TestTube },
  { id: 'oee', label: 'OEE Dashboard', path: '/oee', icon: BarChart3 },
  { id: 'admin', label: 'Admin Panel', path: '/admin', icon: Settings },
];

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
  const { sidebarCollapsed, toggleSidebar, selectedPlant, setPlant, andonAlerts, isOnline, setOnline, toasts, raiseAndon, resolveAndon, setAndonAlerts } = useAppStore();
  const activeShift = useActiveShift();
  const notifCtx = useNotifications();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  const permissions = ROLE_PERMISSIONS[user?.role] ?? [];
  const allowedNav = NAV_ITEMS.filter((item) => permissions.includes(item.id));
  const activeAlerts = andonAlerts.filter((a) => a.status === 'Open' || a.status === 'open');
  const unreadCount = notifCtx?.unreadCount || 0;

  // Load and sync Andon events from Supabase on mount
  useEffect(() => {
    const getResolvedAndonIds = () => {
      try {
        return JSON.parse(localStorage.getItem('automfg_resolved_andon_ids')) || [];
      } catch {
        return [];
      }
    };

    const loadAndonEvents = async () => {
      const resolvedIds = getResolvedAndonIds();
      
      // Update local mock store first so resolved state is visible instantly
      const initialAlerts = andonAlerts.map(a => resolvedIds.includes(a.id) ? { ...a, status: 'Resolved' } : a);
      setAndonAlerts(initialAlerts);

      if (!isSupabaseConfigured()) return;

      try {
        const { data, error } = await supabase.from('andon_events').select('*');
        if (error) throw error;

        if (data && data.length > 0) {
          const formatted = data.map((item) => {
            const isResolved = item.status === 'resolved' || resolvedIds.includes(item.andon_id);
            return {
              id: item.andon_id,
              line: 'Line 1',
              station: item.station_id || (item.issue_type === 'machine_issue' ? 'Station 3' : 'Station 1'),
              type: item.issue_type,
              issue_type: item.issue_type,
              description: item.issue_type === 'machine_issue' ? 'Welding robot E-fault' : 'Door seal gaskets depleted',
              severity: item.severity || 'medium',
              time: new Date(item.raised_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
              status: isResolved ? 'Resolved' : item.status === 'acknowledged' ? 'Acknowledged' : 'Open',
            };
          });
          setAndonAlerts(formatted);
        } else {
          // Seed the database with the initial two mock alerts so they have real UUIDs
          const seedData = [
            {
              issue_type: 'machine_issue',
              severity: 'high',
              status: resolvedIds.includes('AND-001') ? 'resolved' : 'open',
              raised_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            },
            {
              issue_type: 'part_shortage',
              severity: 'medium',
              status: resolvedIds.includes('AND-002') ? 'resolved' : 'acknowledged',
              raised_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
            }
          ];
          const { data: seeded, error: seedErr } = await supabase.from('andon_events').insert(seedData).select();
          if (!seedErr && seeded) {
            const formatted = seeded.map((item) => {
              const isResolved = item.status === 'resolved' || resolvedIds.includes(item.andon_id);
              return {
                id: item.andon_id,
                line: 'Line 1',
                station: item.station_id || (item.issue_type === 'machine_issue' ? 'Station 3' : 'Station 1'),
                type: item.issue_type,
                issue_type: item.issue_type,
                description: item.issue_type === 'machine_issue' ? 'Welding robot E-fault' : 'Door seal gaskets depleted',
                severity: item.severity || 'medium',
                time: new Date(item.raised_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                status: isResolved ? 'Resolved' : item.status === 'acknowledged' ? 'Acknowledged' : 'Open',
              };
            });
            setAndonAlerts(formatted);
          }
        }
      } catch (err) {
        console.warn('[AppShell] Failed to load/seed andon events:', err.message);
      }
    };

    loadAndonEvents();
  }, []);

  // Realtime andon subscription — keeps topbar banner live across all sessions
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const channel = supabase.channel('andon-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'andon_events' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new?.status === 'open') {
          raiseAndon({
            id: payload.new.andon_id,
            line: 'Line 1',
            station: payload.new.station_id || 'Unknown',
            type: payload.new.issue_type,
            issue_type: payload.new.issue_type,
            description: payload.new.issue_type,
            severity: payload.new.severity,
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            status: 'Open',
          });
        } else if (payload.eventType === 'UPDATE' && payload.new?.status === 'resolved') {
          resolveAndon(payload.new.andon_id);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
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
    await logout();
    window.location.href = '/index.html';
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
          {activeAlerts.length > 0 && (
            <div className="andon-banner" style={{ marginBottom: 0, padding: '4px 12px', flex: 1, cursor: 'pointer' }} onClick={() => navigate('/assembly-line')}>
              <AlertTriangle size={14} />
              <span className="andon-banner-text">
                {activeAlerts.length} ACTIVE ANDON ALERT{activeAlerts.length > 1 ? 'S' : ''} — {activeAlerts[0].line} / {activeAlerts[0].station}: {activeAlerts[0].description}
              </span>
            </div>
          )}
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
          <div className="user-chip" onClick={handleLogout} title="Click to logout">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{user?.roleLabel}</span>
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
          {allowedNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
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
          <button className="sidebar-toggle" onClick={handleLogout}>
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
