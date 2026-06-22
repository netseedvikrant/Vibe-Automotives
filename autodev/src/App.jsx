import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import CreateProgramForm from './components/CreateProgramForm';
import LoginPage from './pages/LoginPage';
import DashboardSwitcher from './components/DashboardSwitcher';
import DDRDashboard from './components/DDRDashboard';
import EBOMDashboard from './components/EBOMDashboard';
import ValidationDashboard from './components/ValidationDashboard';
import ECODashboard from './components/ECODashboard';
import LeadDashboard from './components/LeadDashboard';
import ChiefDashboard from './components/ChiefDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

import { motion, AnimatePresence } from 'framer-motion';

const AppContent = () => {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toasts, setToasts] = useState([]);

  React.useEffect(() => {
    // Intercept native browser alert() dialogs and route them to custom in-app toasts
    const originalAlert = window.alert;
    window.alert = (message) => {
      if (!message) return;
      const strMessage = String(message);
      const isError = /error|failed|invalid|required/i.test(strMessage);
      const isSuccess = /success|approved|completed|authorized|mapped|signed off/i.test(strMessage);
      
      const type = isError ? 'error' : isSuccess ? 'success' : 'info';
      const title = isError ? 'System Alert' : isSuccess ? 'Operation Successful' : 'Notification';

      const event = new CustomEvent('autodev-toast', {
        detail: {
          title,
          message: strMessage,
          type,
          user_id: null
        }
      });
      window.dispatchEvent(event);
    };

    const handleToast = (e) => {
      const notif = e.detail;
      // Suppress toast notifications intended for other users
      if (notif.user_id && profile?.id && notif.user_id !== profile.id) {
        return;
      }
      const id = Math.random().toString(36).substring(7);
      setToasts(prev => [...prev, { id, ...notif }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 6000);
    };

    const handleOpenModal = () => setShowCreateModal(true);
    window.addEventListener('open-new-program-modal', handleOpenModal);
    window.addEventListener('autodev-toast', handleToast);
    return () => {
      window.removeEventListener('open-new-program-modal', handleOpenModal);
      window.removeEventListener('autodev-toast', handleToast);
      window.alert = originalAlert;
    };
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="system-loading flex-center">
        <div className="loader"></div>
        <p>Initializing Secure Automotive Environment...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const hideSidebar = false;

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${hideSidebar ? 'no-sidebar' : ''}`}>
      {!hideSidebar && (
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isCollapsed={isSidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
      )}
      
      <main className="main-content">
        <div className={`content-area ${activeTab.toLowerCase().replace(/\s+/g, '-')}-layout`}>
          {/* Role-specific Dashboards (via DashboardSwitcher) */}
          {['Dashboard', 'Programs', 'APQP Gates', 'Timeline', 'Teams',
            'MBOM Review', 'Process Plans', 'Supplier Sourcing',
            'APQP Tracker', 'PPAP Queue', 'Audits',
            'PPAP', 'My PPAP', 'Specs',
            'Documents', 'Reports', 'Notifications',
            'Prototype Builds', 'Settings',
            'Users', 'System Logs', 'Workflow Config',
            'TRL Analysis', 'Risk Matrix'
          ].includes(activeTab) ? (
            /* TRL Analysis and Risk Matrix are Lead Eng sub-sections — show LeadDashboard */
            ['TRL Analysis', 'Risk Matrix'].includes(activeTab) ? (
              <LeadDashboard />
            ) : (
              <DashboardSwitcher activeTab={activeTab} />
            )
          ) : activeTab === 'Feasibility' ? (
            <LeadDashboard />
          ) : activeTab === 'Approvals' || activeTab === 'Portfolio' ? (
            <ChiefDashboard />
          ) : activeTab === 'DDR Reviews' ? (
            <DDRDashboard />
          ) : activeTab === 'eBOM' || activeTab === 'CAD Models' ? (
            <EBOMDashboard />
          ) : ['Test Schedule', 'DVP&R', 'Failures'].includes(activeTab) ? (
            <ValidationDashboard activeTab={activeTab} />
          ) : activeTab === 'ECOs' ? (
            <ECODashboard />
          ) : (
            <div className="placeholder-view flex-center glass" style={{ height: '100%', flexDirection: 'column', gap: '16px' }}>
              <h2>{activeTab} Module</h2>
              <p>This module is currently in development.</p>
              <button className="primary-btn" onClick={() => setActiveTab('Dashboard')}>Return to Dashboard</button>
            </div>
          )}
        </div>
      </main>

      {showCreateModal && (
        <CreateProgramForm onClose={() => setShowCreateModal(false)} />
      )}

      {/* Floating Real-time Toast Notifications */}
      <div 
        className="toasts-container" 
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          right: '24px', 
          zIndex: 99999, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px', 
          pointerEvents: 'none' 
        }}
      >
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              style={{ 
                background: 'rgba(18, 18, 23, 0.95)', 
                borderLeft: `4px solid ${
                  t.type === 'error' ? '#ef4444' :
                  t.type === 'success' ? '#10b981' :
                  'var(--accent)'
                }`,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                borderRight: '1px solid rgba(255,255,255,0.08)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)', 
                padding: '16px 20px', 
                borderRadius: '8px', 
                color: 'white', 
                minWidth: '280px', 
                maxWidth: '360px',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <strong style={{ 
                  color: t.type === 'error' ? '#ef4444' :
                         t.type === 'success' ? '#10b981' :
                         'var(--accent)', 
                  fontSize: '0.9rem', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px' 
                }}>{t.title}</strong>
                <button 
                  onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                  style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.1rem', padding: '0 0 0 8px', lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("AutoDev Critical UI Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="system-loading flex-center">
          <h1 style={{ color: 'var(--error)' }}>Dashboard Offline</h1>
          <p>A critical UI component failed to load. Please refresh the portal.</p>
          <button onClick={() => window.location.reload()} className="create-program-btn" style={{marginTop: '20px'}}>
            Restart Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
