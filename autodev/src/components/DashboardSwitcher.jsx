import React from 'react';
import { useAuth } from '../context/AuthContext';
import ProgramManagerDashboard from './ProgramManagerDashboard';
import LeadDashboard from './LeadDashboard';
import ChiefDashboard from './ChiefDashboard';
import DesignDashboard from './DesignDashboard';
import ValidationDashboard from './ValidationDashboard';
import QualityDashboard from './QualityDashboard';
import SupplierDashboard from './SupplierDashboard';
import AdminDashboard from './AdminDashboard';
import ManufacturingDashboard from './ManufacturingDashboard';
import ProcurementDashboard from './ProcurementDashboard';
import CEODashboard from './CEODashboard';

const DashboardSwitcher = ({ activeTab }) => {
  const { profile, profileLoading, logout } = useAuth();
  const role = profile?.role;

  if (profileLoading) {
    return <div className="loader">Synchronizing Industrial Data...</div>;
  }

  switch (role) {
    case 'Program Manager':
      return <ProgramManagerDashboard activeTab={activeTab} />;
    case 'Lead Engineer':
      return <LeadDashboard />;
    case 'Chief Engineer':
      return <ChiefDashboard />;
    case 'Design Engineer':
      return <DesignDashboard />;
    case 'Validation Engineer':
      return <ValidationDashboard />;
    case 'Quality Engineer':
      return <QualityDashboard />;
    case 'Supplier Engineer':
      return <SupplierDashboard />;
    case 'Manufacturing Engineer':
      return <ManufacturingDashboard />;
    case 'Procurement Engineer':
      return <ProcurementDashboard />;
    case 'Admin':
      return <AdminDashboard />;
    case 'CEO':
      return <CEODashboard />;
    default:
      return <div className="flex-center" style={{height: '100%'}}>
        <div className="glass padding-xl text-center" style={{maxWidth: '400px'}}>
          <h2 style={{color: 'var(--error)', marginBottom: '15px'}}>Access Restricted</h2>
          <p style={{marginBottom: '20px'}}>Your account role "{role || 'Unknown'}" does not have an assigned dashboard in the system.</p>
          <button 
            onClick={() => logout()} 
            className="create-program-btn flex-center"
            style={{width: '100%', padding: '12px', background: 'var(--error)', color: 'white'}}
          >
            Logout & Switch Account
          </button>
        </div>
      </div>;
  }
};

export default DashboardSwitcher;
