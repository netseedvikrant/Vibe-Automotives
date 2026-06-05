import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useDashboardData = () => {
  const [programs, setPrograms] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [workflowInstances, setWorkflowInstances] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [
        { data: programsData },
        { data: logsData },
        { data: notificationsData },
        { data: workflowData }
      ] = await Promise.all([
        supabase.from('programs').select('*, apqp_gates(*)').order('created_at', { ascending: false }),
        supabase.from('activity_logs').select('*, users(full_name)').order('timestamp', { ascending: false }).limit(20),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('workflow_instances').select('program_id, current_stage, assigned_role, workflow_status')
      ]);

      if (programsData) setPrograms(programsData);
      if (logsData) setActivityLogs(logsData);
      if (notificationsData) setNotifications(notificationsData);
      if (workflowData) setWorkflowInstances(workflowData);
    } catch (err) {
      console.error('AutoDev: Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Generate a unique channel name for this specific mount to avoid conflicts in Strict Mode
    const channelId = `dashboard-realtime-${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId);
    
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'programs' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => fetchData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const notif = payload.new;
        const event = new CustomEvent('autodev-toast', { detail: notif });
        window.dispatchEvent(event);
        fetchData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, () => fetchData())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_instances' }, () => fetchData())
      .subscribe((status) => {
        console.log(`AutoDev: Realtime subscription status [${channelId}]:`, status);
      });

    return () => {
      console.log(`AutoDev: Cleaning up realtime channel [${channelId}]`);
      supabase.removeChannel(channel);
    };
  }, []);

  return { programs, activityLogs, notifications, workflowInstances, loading, refresh: fetchData };
};
