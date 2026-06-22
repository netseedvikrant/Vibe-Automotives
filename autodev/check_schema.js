import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://smkgmfgbuioclfbuuynl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNta2dtZmdidWlvY2xmYnV1eW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjM4OTUsImV4cCI6MjA5NDM5OTg5NX0.FSjVcb6aR5nFaspS4M29YHDSB7QKxVyvYOkB_IN_lh4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Fetching one design_task row...');
  const { data, error } = await supabase.from('design_tasks').select('*').limit(1);
  if (error) {
    console.error('Error fetching:', error);
  } else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('Row data:', data[0]);
  } else {
    console.log('No design tasks found.');
  }
}

checkSchema();
