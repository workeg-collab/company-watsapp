require('dotenv').config();

const env = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || 'power_of_media_verify_token_2026',
  META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION || 'v21.0',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || '',
  isSupabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
};

module.exports = env;
