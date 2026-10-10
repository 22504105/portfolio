import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";

/**
 * Supabase with the service role, which bypasses row level security. For
 * server code that has already decided the caller may do what is asked:
 * booking operations, email jobs, staff provisioning. Never reaches the browser.
 */
export function createSupabaseAdminClient() {
  return createClient(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
