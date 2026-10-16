import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { env } from '@/lib/env';

/**
 * Service-role client. BYPASSES Row Level Security.
 *
 * Use ONLY in trusted server contexts (route handlers / server actions)
 * AFTER an explicit permission check, for operations the RLS model
 * intentionally forbids browser clients from performing:
 * audit writes, notifications, cross-user administrative mutations.
 *
 * Never import this module from client components.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.supabaseUrl(),
    env.supabaseServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
