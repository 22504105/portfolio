import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { supabaseEnv } from "./env";

/**
 * Supabase for server components, server actions and route handlers. It acts
 * as the signed-in user, under row level security: there is no service-role
 * key anywhere in the application. Null when accounts are not configured.
 */
export async function createSupabaseServerClient() {
  const env = supabaseEnv();
  if (!env) return null;
  const cookieStore = await cookies();

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server components cannot write cookies. The session is renewed in
          // proxy.ts, where they can be written, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Who is signed in, checked with the auth server (not just read from a
 * cookie, which a visitor could have written themselves). Once per request.
 */
export const currentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
});
