import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://smkgmfgbuioclfbuuynl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNta2dtZmdidWlvY2xmYnV1eW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjM4OTUsImV4cCI6MjA5NDM5OTg5NX0.FSjVcb6aR5nFaspS4M29YHDSB7QKxVyvYOkB_IN_lh4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDupes() {
  console.log('Fetching dvpr_records...');
  const { data, error } = await supabase.from('dvpr_records').select('*');
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  const programMap = {};
  for (const record of data) {
    if (!programMap[record.program_id]) {
      programMap[record.program_id] = [];
    }
    programMap[record.program_id].push(record);
  }
  
  for (const [programId, records] of Object.entries(programMap)) {
    if (records.length > 1) {
      console.log(`Program ${programId} has ${records.length} records. Keeping the first one and deleting the rest.`);
      // Sort to keep the most recently updated one or the approved one
      records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      const toDelete = records.slice(1);
      for (const record of toDelete) {
        console.log(`Deleting duplicate record ${record.id}`);
        await supabase.from('dvpr_records').delete().eq('id', record.id);
      }
    }
  }
  console.log('Done fixing duplicates.');
}

fixDupes();
