import { supabase, isSupabaseConfigured } from './supabase';
import toast from 'react-hot-toast';

const QUEUE_KEY = 'automfg_offline_sync_queue';

export function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// Queue an action to be synchronized when online
export function queueOfflineAction(entity, payload) {
  const queue = getOfflineQueue();
  const newItem = {
    sync_id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
    entity,
    payload,
    created_at: new Date().toISOString(),
  };
  queue.push(newItem);
  saveOfflineQueue(queue);
  toast.error(`Offline: Saved transaction to local queue (${entity.toUpperCase()})`);
  return newItem;
}

// Process and sync the queue
export async function syncOfflineQueue() {
  if (!isSupabaseConfigured()) return;
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  const toastId = toast.loading(`Syncing ${queue.length} pending offline transactions...`);

  let successCount = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      // First insert into Supabase's offline_sync_queue to audit the offline sync
      const { error: auditError } = await supabase.from('offline_sync_queue').insert({
        sync_id: item.sync_id,
        entity: item.entity,
        payload: item.payload,
        sync_status: 'pending',
        created_at: item.created_at,
      });

      if (auditError && auditError.code !== '23505') { // Ignore duplicate key errors if already present
        throw auditError;
      }

      // Execute actual entity operation
      let query;
      if (item.entity === 'andon_events') {
        query = supabase.from('andon_events').insert(item.payload);
      } else if (item.entity === 'defect_records') {
        query = supabase.from('defect_records').insert(item.payload);
      } else if (item.entity === 'breakdown_tickets') {
        query = supabase.from('breakdown_tickets').insert(item.payload);
      } else if (item.entity === 'operation_records') {
        query = supabase.from('operation_records').insert(item.payload);
      } else if (item.entity === 'digital_signoffs') {
        query = supabase.from('digital_signoffs').insert(item.payload);
      } else if (item.entity === 'rework_orders') {
        query = supabase.from('rework_orders').insert(item.payload);
      } else {
        query = supabase.from(item.entity).insert(item.payload);
      }

      const { error: entityError } = await query;
      if (entityError) throw entityError;

      // Update sync status in Supabase audit table
      await supabase.from('offline_sync_queue').update({ sync_status: 'synced' }).eq('sync_id', item.sync_id);
      successCount++;
    } catch (err) {
      console.error(`[OfflineSync] Failed to sync ${item.entity}:`, err.message);
      remaining.push(item);
      // Mark as failed in Supabase if audit row was inserted
      await supabase.from('offline_sync_queue').update({ sync_status: 'failed' }).eq('sync_id', item.sync_id).catch(() => {});
    }
  }

  saveOfflineQueue(remaining);

  toast.dismiss(toastId);
  if (successCount > 0) {
    toast.success(`Successfully synchronized ${successCount} transactions!`);
  }
  if (remaining.length > 0) {
    toast.error(`Failed to sync ${remaining.length} transactions. Will retry later.`);
  }
}
