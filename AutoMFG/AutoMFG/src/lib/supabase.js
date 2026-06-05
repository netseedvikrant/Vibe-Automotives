// ============================================
// AutoMFG — Supabase Client
// ============================================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate config
if (!supabaseUrl || supabaseUrl === 'https://your-project-id.supabase.co') {
  console.warn('[AutoMFG] Supabase URL not configured — running in mock mode');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// Helper: check if Supabase is properly configured
export const isSupabaseConfigured = () =>
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project-id.supabase.co';

// Helper: write audit log entry
export const writeAuditLog = async (userId, entity, action, payload) => {
  if (!isSupabaseConfigured()) return;
  try {
    await supabase.from('audit_log').insert({
      user_id: userId,
      entity,
      action,
      payload,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[AuditLog] Failed to write:', err.message);
  }
};

// Helper: write to notifications table
export const createNotification = async (recipientUserId, recipientRoleId, sourceType, sourceId, message) => {
  if (!isSupabaseConfigured()) return;
  try {
    await supabase.from('notifications').insert({
      recipient_user_id: recipientUserId,
      recipient_role_id: recipientRoleId,
      source_type: sourceType,
      source_id: sourceId,
      message,
      status: 'unread',
    });
  } catch (err) {
    console.warn('[Notification] Failed to create:', err.message);
  }
};
