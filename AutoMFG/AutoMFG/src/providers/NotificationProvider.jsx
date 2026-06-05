// ============================================
// AutoMFG — Notification Provider — FIXED
// Wraps app with Supabase Realtime notification listener
// ============================================
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const safeUUID = (id) =>
  id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications from DB
  const loadNotifications = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return;
    const uuid = safeUUID(user.id);
    if (!uuid) return; // Silent return if not a valid UUID to prevent Postgres errors
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', uuid)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => n.status === 'unread').length);
      }
    } catch (e) {
      console.warn('[NotificationProvider] Failed to load notifications:', e.message);
    }
  }, [user]);

  // Mark notification as read
  const markRead = useCallback(async (notificationId) => {
    if (!isSupabaseConfigured()) return;
    try {
      await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('notification_id', notificationId);
      setNotifications((prev) =>
        prev.map((n) => n.notification_id === notificationId ? { ...n, status: 'read' } : n)
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.warn('[NotificationProvider] Failed to mark notification read:', e.message);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return;
    const uuid = safeUUID(user.id);
    if (!uuid) return;
    try {
      await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('recipient_user_id', uuid)
        .eq('status', 'unread');
      setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' })));
      setUnreadCount(0);
    } catch (e) {
      console.warn('[NotificationProvider] Failed to mark all read:', e.message);
    }
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return;
    const uuid = safeUUID(user.id);
    if (!uuid) return;
    loadNotifications();

    const channel = supabase
      .channel(`notifications:${uuid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${uuid}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev].slice(0, 20));
          setUnreadCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, loadNotifications]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, reload: loadNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
