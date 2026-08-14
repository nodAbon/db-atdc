import { createClient } from '@supabase/supabase-js';

// Server-side queries must use a private, explicit URL variable. Keep the
// public variable as a backwards-compatible fallback for existing deployments.
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase server environment is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Never use the service-role client for password sign-in. Supabase stores the
// resulting user session on the client instance, which can accidentally make
// later server-side data queries run with the user's RLS context.
export const supabaseAuth = anonKey
  ? createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
