import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, ROLE_PERMISSIONS } from './store/authStore';
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

// Protected Route wrapper
function ProtectedRoute({ children, module }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (module && !ROLE_PERMISSIONS[user?.role]?.includes(module)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <AppShell>{children}</AppShell>;
}

function AuthRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />

        {/* Protected — per module */}
        <Route path="/dashboard" element={<ProtectedRoute module="dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/production-planning" element={<ProtectedRoute module="production_planning"><ProductionPlanning /></ProtectedRoute>} />
        <Route path="/work-orders" element={<ProtectedRoute module="work_orders"><WorkOrders /></ProtectedRoute>} />
        <Route path="/assembly-line" element={<ProtectedRoute module="assembly_line"><AssemblyLine /></ProtectedRoute>} />
        <Route path="/tooling" element={<ProtectedRoute module="tooling"><Tooling /></ProtectedRoute>} />
        <Route path="/shift-handover" element={<ProtectedRoute module="shift_handover"><ShiftHandover /></ProtectedRoute>} />
        <Route path="/scrap-rework" element={<ProtectedRoute module="scrap_rework"><ScrapRework /></ProtectedRoute>} />
        <Route path="/quality-gate" element={<ProtectedRoute module="quality_gate"><QualityGate /></ProtectedRoute>} />
        <Route path="/maintenance" element={<ProtectedRoute module="maintenance"><Maintenance /></ProtectedRoute>} />
        <Route path="/eol-testing" element={<ProtectedRoute module="eol"><EOLTesting /></ProtectedRoute>} />
        <Route path="/oee" element={<ProtectedRoute module="oee"><OEEDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute module="admin"><AdminPanel /></ProtectedRoute>} />
        <Route path="/ceo-dashboard" element={<ProtectedRoute module="ceo_dashboard"><CEODashboard /></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
