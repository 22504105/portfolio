// The two public settings that switch accounts on. Both are meant for the
// browser. Without them the site still runs: the demo needs no backend, and
// the account pages say that accounts are not set up here.

export type SupabaseEnv = { url: string; key: string };

export function supabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // A secret key in a public variable would be sent to every visitor. Refuse to start with one.
  if (key.startsWith("sb_secret_")) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a secret key. Use the publishable key.");
  return { url, key };
}

export const accountsEnabled = () => supabaseEnv() !== null;
