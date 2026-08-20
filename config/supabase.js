const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

let supabase = null;

if (env.isSupabaseConfigured) {
  try {
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('[Database] Supabase client initialized successfully.');
  } catch (error) {
    console.error('[Database] Failed to initialize Supabase client:', error.message);
  }
} else {
  console.warn('[Database] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured. Running in Local Memory / Cache Fallback Mode.');
}

module.exports = {
  supabase,
  isConfigured: env.isSupabaseConfigured
};
