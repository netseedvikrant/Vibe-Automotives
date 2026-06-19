import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Custom hook to subscribe to realtime changes in a Supabase table.
 * @param {string} tableName - The table to subscribe to.
 * @param {function} onEvent - Callback function triggered on any change.
 */
export const useRealtimeTable = (tableName, onEvent) => {
  useEffect(() => {
    if (!isSupabaseConfigured() || !tableName) return;

    const channel = supabase
      .channel(`public:${tableName}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          onEvent?.(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to ${tableName}`);
        }
      });

    return () => {
      console.log(`[Realtime] Unsubscribing from ${tableName}`);
      supabase.removeChannel(channel);
    };
  }, [tableName, onEvent]);
};
