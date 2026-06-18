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

// Helper: get the actual name of the table to use for Andon (andon_events or andon_alerts)
export async function getAndonTableName() {
  if (window.__andonTableName) return window.__andonTableName;
  if (!isSupabaseConfigured()) {
    window.__andonTableName = 'andon_events';
    return 'andon_events';
  }
  try {
    const { error } = await supabase.from('andon_alerts').select('id').limit(1);
    if (error && error.message && error.message.includes('schema cache')) {
      window.__andonTableName = 'andon_events';
    } else {
      window.__andonTableName = 'andon_alerts';
    }
  } catch (e) {
    window.__andonTableName = 'andon_events';
  }
  return window.__andonTableName;
}

// Helper: map a database Andon row to the frontend structure
export function mapAndonFromDb(item, tableName) {
  const isAlerts = tableName === 'andon_alerts';
  const id = isAlerts ? item.id : item.andon_id;
  const createdAt = isAlerts ? item.created_at : item.raised_at;
  const severityOrPriority = isAlerts ? item.priority : item.severity;
  
  return {
    id,
    line: item.line || 'Line 1',
    station: item.station || item.station_id || 'Unknown',
    type: item.issue_type,
    issue_type: item.issue_type,
    description: item.description || `${item.issue_type?.replace('_', ' ')} reported by operator`,
    severity: severityOrPriority || 'medium',
    priority: severityOrPriority || 'high',
    time: new Date(createdAt || Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    status: item.status,
    plant: item.plant || 'Plant A',
    shift: item.shift || 'Shift A',
    raised_by: item.raised_by,
    raised_by_role: item.raised_by_role || 'machine_operator',
    assigned_to_role: item.assigned_to_role || 'shift_supervisor',
    created_at: createdAt,
    resolved_at: item.resolved_at,
    resolved_by: item.resolved_by
  };
}

// Helper: map frontend Andon structure to database payload
export function mapAndonToDb(alert, tableName) {
  const isAlerts = tableName === 'andon_alerts';
  const payload = {
    line: alert.line || 'Line 1',
    station: alert.station || 'Unknown',
    issue_type: alert.type || alert.issue_type || 'machine_issue',
    description: alert.description || `${(alert.type || alert.issue_type || 'issue').replace('_', ' ')} reported by operator`,
    status: 'active',
    plant: alert.plant || 'Plant A',
    shift: alert.shift || 'Shift A',
    raised_by: alert.raised_by || 'Machine Operator',
    raised_by_role: alert.raised_by_role || 'machine_operator',
    assigned_to_role: alert.assigned_to_role || 'shift_supervisor',
  };
  
  if (isAlerts) {
    payload.priority = alert.severity || alert.priority || 'high';
    payload.created_at = new Date().toISOString();
  } else {
    payload.severity = alert.severity || alert.priority || 'high';
    payload.raised_at = new Date().toISOString();
  }
  return payload;
}

// Helper: insert to database dynamically stripping missing columns or status constraints
export async function insertDynamic(tableName, payload) {
  let currentPayload = { ...payload };
  while (true) {
    const { data, error } = await supabase.from(tableName).insert(currentPayload).select();
    if (error) {
      // Handle missing columns
      const match = error.message?.match(/Could not find the '([^']+)' column of/);
      if (match && match[1]) {
        const colToRemove = match[1];
        console.warn(`[Supabase] Column '${colToRemove}' not found in database. Stripping and retrying...`);
        delete currentPayload[colToRemove];
        if (Object.keys(currentPayload).length === 0) {
          return { data: null, error };
        }
        continue;
      }
      // Handle check constraint violation for 'active' status
      if (error.message?.includes('violates check constraint') && currentPayload.status === 'active') {
        console.warn(`[Supabase] status 'active' violates check constraint. Falling back to 'open'...`);
        currentPayload.status = 'open';
        continue;
      }
      return { data: null, error };
    }
    return { data: data ? data[0] : null, error: null };
  }
}

// Helper: update database dynamically stripping missing columns
export async function updateDynamic(tableName, payload, matchObj) {
  let currentPayload = { ...payload };
  while (true) {
    const { data, error } = await supabase.from(tableName).update(currentPayload).match(matchObj).select();
    if (error) {
      const match = error.message?.match(/Could not find the '([^']+)' column of/);
      if (match && match[1]) {
        const colToRemove = match[1];
        console.warn(`[Supabase] Column '${colToRemove}' not found in database for update. Stripping and retrying...`);
        delete currentPayload[colToRemove];
        if (Object.keys(currentPayload).length === 0) {
          return { data: null, error };
        }
        continue;
      }
      return { data: null, error };
    }
    return { data: data ? data[0] : null, error: null };
  }
}


