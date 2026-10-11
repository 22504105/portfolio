import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";

/**
 * Supabase for server components, server actions and route handlers. Acts as
 * the signed-in user (or as an anonymous visitor), under row level security.
 */
export async function createSupabaseServerClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server components cannot write cookies. The session is refreshed
          // where they can be written, so this is safe to ignore.
        }
      },
    },
  });
}
