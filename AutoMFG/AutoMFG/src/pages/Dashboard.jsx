// AutoMFG — Dashboard — Role-Based Dispatcher
// Detects the logged-in user's role and renders the correct dashboard.
// Each role sees a completely different layout, KPIs, quick actions, and workflow.

import { useAuthStore } from '../store/authStore';

// Role-specific dashboard components
import SysAdminDashboard     from './dashboards/SysAdminDashboard';
import PlantManagerDashboard from './dashboards/PlantManagerDashboard';
import ProdManagerDashboard  from './dashboards/ProdManagerDashboard';
import PlannerDashboard      from './dashboards/PlannerDashboard';
import SupervisorDashboard   from './dashboards/SupervisorDashboard';
import LineLeaderDashboard   from './dashboards/LineLeaderDashboard';
import OperatorDashboard     from './dashboards/OperatorDashboard';
import QualityDashboard      from './dashboards/QualityDashboard';
import MaintenanceDashboard  from './dashboards/MaintenanceDashboard';
import CommandCenterDashboard from './dashboards/CommandCenterDashboard'; // CEO + fallback

export default function Dashboard() {
  const { user } = useAuthStore();
  const role = user?.role;

  // Route to role-specific dashboard component
  switch (role) {
    case 'sys_admin':          return <SysAdminDashboard />;
    case 'plant_manager':      return <PlantManagerDashboard />;
    case 'production_manager': return <ProdManagerDashboard />;
    case 'production_planner': return <PlannerDashboard />;
    case 'shift_supervisor':   return <SupervisorDashboard />;
    case 'line_leader':        return <LineLeaderDashboard />;
    case 'machine_operator':   return <OperatorDashboard />;
    case 'quality_inspector':  return <QualityDashboard />;
    case 'maintenance_tech':   return <MaintenanceDashboard />;
    case 'ceo':
    default:                   return <CommandCenterDashboard />;
  }
}
