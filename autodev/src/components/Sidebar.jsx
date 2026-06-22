import React from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, Car, Workflow, Clock, Users, FileCheck, 
  Settings, Bell, FileText, BarChart3, ShieldAlert, Zap,
  ChevronLeft, ChevronRight, HardDrive, TestTube
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const roleBasedMenus = {
  'Program Manager': ['Dashboard', 'Timeline', 'Reports', 'DDR Reviews'],
  'Lead Engineer': ['Dashboard', 'DDR Reviews'],
  'Chief Engineer': ['Dashboard', 'ECOs'],
  'Design Engineer': ['Dashboard', 'eBOM', 'ECOs', 'DDR Reviews'],
  'Validation Engineer': ['Dashboard', 'Test Schedule', 'DVP&R', 'Failures'],
  'Quality Engineer': ['Dashboard', 'APQP Tracker', 'PPAP Queue', 'Audits', 'DDR Reviews', 'ECOs'],
  'Manufacturing Engineer': ['Dashboard', 'DDR Reviews', 'ECOs', 'Process Plans'],
  'Procurement Engineer': ['Dashboard', 'MBOM Review', 'Supplier Sourcing'],
  'Supplier Engineer': ['Dashboard', 'My PPAP', 'Notifications'],
  'Admin': ['Dashboard', 'Users', 'System Logs', 'Workflow Config', 'Settings'],
  'CEO': ['Dashboard', 'Notifications']
};

const menuItems = [
  { id: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'Programs', icon: Car, label: 'Programs' },
  { id: 'APQP Gates', icon: Workflow, label: 'APQP Gates' },
  { id: 'Timeline', icon: Clock, label: 'Timeline' },
  { id: 'Teams', icon: Users, label: 'Teams' },
  { id: 'DDR Reviews', icon: Zap, label: 'DDR Reviews' },
  { id: 'Prototype Builds', icon: HardDrive, label: 'Prototype Builds' },
  { id: 'Validation', icon: TestTube, label: 'Validation' },
  { id: 'PPAP', icon: FileCheck, label: 'PPAP' },
  { id: 'Reports', icon: BarChart3, label: 'Reports' },
  { id: 'Documents', icon: FileText, label: 'Documents' },
  { id: 'Notifications', icon: Bell, label: 'Notifications' },
  { id: 'Settings', icon: Settings, label: 'Settings' },
  // Additional role specific items
  { id: 'Approvals', icon: FileCheck, label: 'Approvals' },
  { id: 'Portfolio', icon: LayoutDashboard, label: 'Portfolio' },
  { id: 'CAD Models', icon: HardDrive, label: 'CAD Models' },
  { id: 'eBOM', icon: FileText, label: 'eBOM' },
  { id: 'ECOs', icon: Workflow, label: 'ECOs' },
  { id: 'Test Schedule', icon: Clock, label: 'Test Schedule' },
  { id: 'DVP&R', icon: FileCheck, label: 'DVP&R' },
  { id: 'Failures', icon: ShieldAlert, label: 'Failures' },
  { id: 'APQP Tracker', icon: Workflow, label: 'APQP Tracker' },
  { id: 'PPAP Queue', icon: FileCheck, label: 'PPAP Queue' },
  { id: 'Audits', icon: FileText, label: 'Audits' },
  { id: 'My PPAP', icon: FileCheck, label: 'My PPAP' },
  { id: 'Specs', icon: FileText, label: 'Specs' },
  { id: 'MBOM Review', icon: Workflow, label: 'MBOM Review' },
  { id: 'Supplier Sourcing', icon: FileText, label: 'Supplier Sourcing' },
  { id: 'Users', icon: Users, label: 'Users' },
  { id: 'System Logs', icon: FileText, label: 'System Logs' },
  { id: 'Workflow Config', icon: Settings, label: 'Workflow Config' },
];

const Sidebar = ({ activeTab, setActiveTab, isCollapsed, setCollapsed }) => {
  const { profile, logout } = useAuth();
  const role = profile?.role || 'Design Engineer';
  
  const allowedItems = roleBasedMenus[role] || ['Dashboard', 'Notifications'];
  const filteredMenuItems = menuItems.filter(item => allowedItems.includes(item.id) || item.id === 'Dashboard');

  return (
    <motion.aside 
      className={`sidebar glass-dark ${isCollapsed ? 'collapsed' : ''}`}
      animate={{ width: isCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon">A</div>
          {!isCollapsed && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="logo-text"
            >
              AutoDev
            </motion.span>
          )}
        </div>
        <button 
          className="collapse-btn flex-center"
          onClick={() => setCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>


      <nav className="sidebar-nav">
        {filteredMenuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <div className="nav-icon-wrapper">
              <item.icon size={20} />
            </div>
            {!isCollapsed && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="nav-label"
              >
                {item.label}
              </motion.span>
            )}
            {activeTab === item.id && (
              <motion.div 
                layoutId="active-pill"
                className="active-indicator"
              />
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button 
          className="user-badge glass" 
          onClick={() => {
            console.log('AutoDev: Manual Logout Triggered');
            logout();
          }} 
          style={{
            cursor: 'pointer', 
            position: 'relative', 
            width: '100%', 
            border: 'none',
            textAlign: isCollapsed ? 'center' : 'left',
            display: 'flex',
            flexDirection: isCollapsed ? 'column' : 'row',
            alignItems: 'center',
            padding: isCollapsed ? '10px 4px' : '10px',
            gap: isCollapsed ? '6px' : '12px'
          }}
          title={`${profile?.full_name || 'System User'} - ${profile?.role || 'Staff'}`}
        >
          <div className="user-avatar" style={{ flexShrink: 0 }}>
            {profile?.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
          </div>
          <div className="user-info" style={{ 
            display: 'flex', 
            flexDirection: 'column',
            width: '100%',
            overflow: 'hidden'
          }}>
            <span className="user-name" style={{ 
              fontSize: isCollapsed ? '0.7rem' : '0.85rem',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              display: 'block',
              textAlign: isCollapsed ? 'center' : 'left',
              color: '#000000',
              fontWeight: '600'
            }}>
              {profile?.full_name || 'System User'}
            </span>
            <span className="user-role" style={{ 
              fontSize: isCollapsed ? '0.6rem' : '0.75rem',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              display: 'block',
              textAlign: isCollapsed ? 'center' : 'left',
              color: '#000000',
              fontWeight: '500'
            }}>
              {profile?.role || 'Awaiting Role'}
            </span>
          </div>
          <div className="logout-hint">Sign Out</div>
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
