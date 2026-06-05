import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, FileUp, CheckCircle2, UserPlus, Info, ChevronRight, ChevronLeft, Bell, Activity } from 'lucide-react';
import './RightPanel.css';

import { useDashboardData } from '../hooks/useDashboardData';

const RightPanel = ({ isCollapsed, setCollapsed }) => {
  const { activityLogs, notifications } = useDashboardData();

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 60000); // minutes
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <aside className={`right-panel glass-dark ${isCollapsed ? 'collapsed' : ''}`}>
      <button 
        className="right-toggle-btn glass" 
        onClick={() => setCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className="right-panel-content">
        <div className="panel-header">
          <div className="header-title flex-center">
            <Activity size={18} className="text-accent" />
            <h3>Activity Feed</h3>
          </div>
          <span className="live-indicator">
            <span className="live-dot"></span> LIVE
          </span>
        </div>

        <div className="activity-list">
          {activityLogs && activityLogs.length > 0 ? activityLogs.map((activity, index) => (
            <motion.div 
              key={activity.id} 
              className="activity-item"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="activity-icon">
                <Info size={14} />
              </div>
              <div className="activity-content">
                <p>
                  <span className="activity-user">{activity.users?.full_name || 'System'}</span> {activity.action_description}
                </p>
                <span className="activity-time">{formatTime(activity.timestamp)}</span>
              </div>
            </motion.div>
          )) : (
            <p className="empty-msg">No recent activity</p>
          )}
        </div>

        <div className="panel-section approvals-section">
          <div className="section-header">
            <div className="header-title flex-center">
              <Bell size={18} className="text-accent" />
              <h3>Notifications</h3>
            </div>
            <span className="count-badge">{notifications.filter(n => !n.read_status).length}</span>
          </div>
          <div className="approvals-list">
            {notifications && notifications.length > 0 ? notifications.map(n => (
              <div key={n.id} className="approval-card glass">
                <div className="approval-info">
                  <span className="approval-title">{n.title}</span>
                  <span className="approval-meta">{n.message}</span>
                </div>
              </div>
            )) : (
              <p className="empty-msg">No recent notifications</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default RightPanel;
