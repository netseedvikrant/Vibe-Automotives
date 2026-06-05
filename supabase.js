// Initialize Supabase from .env file loaded dynamically via fetch with a fallback
let supabaseClient = null;

const FALLBACK_URL = 'https://smkgmfgbuioclfbuuynl.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNta2dtZmdidWlvY2xmYnV1eW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjM4OTUsImV4cCI6MjA5NDM5OTg5NX0.FSjVcb6aR5nFaspS4M29YHDSB7QKxVyvYOkB_IN_lh4';

async function initSupabase() {
    let supabaseUrl = FALLBACK_URL;
    let supabaseKey = FALLBACK_KEY;
    
    try {
        const response = await fetch('.env');
        if (response.ok) {
            const text = await response.text();
            const env = {};
            
            // Parse .env file lines
            text.split(/\r?\n/).forEach(line => {
                // Ignore comments and empty lines
                if (line.trim() && !line.trim().startsWith('#')) {
                    const delimiterIndex = line.indexOf('=');
                    if (delimiterIndex !== -1) {
                        const key = line.substring(0, delimiterIndex).trim();
                        const value = line.substring(delimiterIndex + 1).trim().replace(/^['"]|['"]$/g, '');
                        if (key) {
                            env[key] = value;
                        }
                    }
                }
            });

            if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
                supabaseUrl = env.SUPABASE_URL;
                supabaseKey = env.SUPABASE_ANON_KEY;
                console.log("Loaded Supabase configuration from .env successfully.");
            }
        } else {
            console.warn(`Could not read .env file (${response.status} ${response.statusText}). Falling back to built-in credentials.`);
        }
    } catch (error) {
        console.warn("Could not fetch .env file (possibly running via file:// protocol). Falling back to built-in credentials.", error);
    }

    try {
        // Create Supabase client (requires the Supabase CDN script loaded first in HTML)
        if (typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
            console.log("Supabase connection successfully established!");
            window.supabaseClient = supabaseClient; // Make it globally accessible
            return supabaseClient;
        } else {
            throw new Error("Supabase library not loaded. Make sure the CDN script is included.");
        }
    } catch (error) {
        console.error("Supabase Initialization Error:", error);
    }
    return null;
}

// Export initialization to window so other scripts can wait for it
window.supabaseInit = initSupabase();
