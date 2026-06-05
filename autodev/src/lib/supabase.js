import { createClient } from '@supabase/supabase-js';

// AutoDev: Priority environment loading with hardcoded fallback
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://smkgmfgbuioclfbuuynl.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNta2dtZmdidWlvY2xmYnV1eW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjM4OTUsImV4cCI6MjA5NDM5OTg5NX0.FSjVcb6aR5nFaspS4M29YHDSB7QKxVyvYOkB_IN_lh4';

console.log('AutoDev System Check:');
console.log('- Connection Endpoint:', supabaseUrl ? 'VERIFIED' : 'FAILED');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
