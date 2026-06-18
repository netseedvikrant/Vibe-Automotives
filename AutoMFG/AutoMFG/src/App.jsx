import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, LEGACY_ROLE_MODULES } from './store/authStore';
import { useEffect } from 'react';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ProductionPlanning from './pages/ProductionPlanning';
import WorkOrders from './pages/WorkOrders';
import AssemblyLine from './pages/AssemblyLine';
import Tooling from './pages/Tooling';
import ShiftHandover from './pages/ShiftHandover';
import ScrapRework from './pages/ScrapRework';
import QualityGate from './pages/QualityGate';
import Maintenance from './pages/Maintenance';
import EOLTesting from './pages/EOLTesting';
import OEEDashboard from './pages/OEEDashboard';
import AdminPanel from './pages/AdminPanel';
import CEODashboard from './pages/CEODashboard';

// Access-denied card shown when role lacks permission
function AccessDenied() {
  const { user } = useAuthStore();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ maxWidth: 440, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--red)', textTransform: 'uppercase', marginBottom: 8 }}>
          Access Restricted
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Your role <strong style={{ color: 'var(--text-primary)' }}>{user?.roleLabel}</strong> does not have permission to access this module.
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Contact your System Admin to request access.
        </div>
      </div>
    </div>
  );
}

// Protected route — checks auth + optional module permission
function ProtectedRoute({ children, module }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (module && user?.role) {
    const legacyPerms = LEGACY_ROLE_MODULES[user.role] ?? [];
    if (!legacyPerms.includes(module)) {
      // Wrap access denied in AppShell so layout stays consistent
      return <AppShell><AccessDenied /></AppShell>;
    }
  }
  return <AppShell>{children}</AppShell>;
}

// Auth route — redirect to dashboard if already logged in
function AuthRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

// Global auth guard: watches isAuthenticated and redirects to /login on logout.
// Sits inside the HashRouter so it has access to useNavigate.
function AuthGuard() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const isLoginPage = location.pathname === '/login';
    if (!isAuthenticated && !isLoginPage) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  return null;
}

export default function App() {
  return (
    <HashRouter>
      <AuthGuard />
      <Routes>
        {/* Public: /login renders the AutoMFG System Access page */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />

        {/* Dashboard — role-specific content rendered inside Dashboard.jsx */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

        {/* Module pages — with legacy permission guards */}
        <Route path="/production-planning" element={<ProtectedRoute module="production_planning"><ProductionPlanning /></ProtectedRoute>} />
        <Route path="/work-orders"         element={<ProtectedRoute module="work_orders"><WorkOrders /></ProtectedRoute>} />
        <Route path="/assembly-line"       element={<ProtectedRoute module="assembly_line"><AssemblyLine /></ProtectedRoute>} />
        <Route path="/tooling"             element={<ProtectedRoute module="tooling"><Tooling /></ProtectedRoute>} />
        <Route path="/shift-handover"      element={<ProtectedRoute module="shift_handover"><ShiftHandover /></ProtectedRoute>} />
        <Route path="/scrap-rework"        element={<ProtectedRoute module="scrap_rework"><ScrapRework /></ProtectedRoute>} />
        <Route path="/quality-gate"        element={<ProtectedRoute module="quality_gate"><QualityGate /></ProtectedRoute>} />
        <Route path="/maintenance"         element={<ProtectedRoute module="maintenance"><Maintenance /></ProtectedRoute>} />
        <Route path="/eol-testing"         element={<ProtectedRoute module="eol"><EOLTesting /></ProtectedRoute>} />
        <Route path="/oee"                 element={<ProtectedRoute module="oee"><OEEDashboard /></ProtectedRoute>} />
        <Route path="/admin"               element={<ProtectedRoute module="admin"><AdminPanel /></ProtectedRoute>} />
        <Route path="/ceo-dashboard"       element={<ProtectedRoute module="ceo_dashboard"><CEODashboard /></ProtectedRoute>} />

        {/* Catch-all: unauthenticated = login, authenticated = dashboard */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
