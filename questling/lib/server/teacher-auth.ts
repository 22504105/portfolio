import "server-only";

// Teachers sign in with email and password, kept by Supabase Auth (free tier). The server speaks to
// its REST API itself (no client library): the password goes from the studio's form to our server and
// on to Supabase, never anywhere else, and what comes back is only used to learn the account's id.
// After that the teacher holds Questling's own session, like a student (lib/server/session.ts).
// Supabase sends the confirmation and password-reset emails; its free mailer allows a few an hour.

export type AuthAccount = { id: string; email: string; confirmed: boolean; displayName: string | null };

export type AuthResult =
  | { ok: true; account: AuthAccount }
  | {
      ok: false;
      reason: "invalid_credentials" | "email_not_confirmed" | "already_registered" | "weak_password" | "rate_limited" | "unavailable";
    };

export function authConfig() {
  return { url: process.env.SUPABASE_URL ?? "", key: process.env.SUPABASE_ANON_KEY ?? "" };
}

export const teacherAuthConfigured = () => {
  const { url, key } = authConfig();
  return url.startsWith("https://") && key.length > 10;
};

async function call(path: string, body: unknown, fetcher: typeof fetch = fetch) {
  const { url, key } = authConfig();
  const response = await fetcher(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response) return { status: 0, data: {} as Record<string, unknown> };
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, data };
}

const codeOf = (data: Record<string, unknown>) => String(data.error_code ?? data.code ?? data.error ?? "");

function account(user: unknown): AuthAccount | null {
  const u = user as { id?: unknown; email?: unknown; email_confirmed_at?: unknown; user_metadata?: { display_name?: unknown } } | null;
  if (!u || typeof u.id !== "string" || typeof u.email !== "string") return null;
  const name = u.user_metadata?.display_name;
  return { id: u.id, email: u.email.toLowerCase(), confirmed: !!u.email_confirmed_at, displayName: typeof name === "string" ? name : null };
}

/** A new teacher account. Supabase emails a confirmation link (to `redirectTo`); signing in works after it. */
export async function signUp(
  email: string,
  password: string,
  displayName: string,
  redirectTo: string,
  fetcher?: typeof fetch,
): Promise<AuthResult> {
  const { status, data } = await call(
    `signup?redirect_to=${encodeURIComponent(redirectTo)}`,
    { email, password, data: { display_name: displayName } },
    fetcher,
  );
  if (status === 429) return { ok: false, reason: "rate_limited" };
  const code = codeOf(data);
  if (code === "user_already_exists" || code === "email_exists") return { ok: false, reason: "already_registered" };
  if (code === "weak_password") return { ok: false, reason: "weak_password" };
  // With confirmation on, an address already registered gets a user with no identities (Supabase hides which).
  const user = (data.user ?? data) as { identities?: unknown[] };
  if (status === 200 && Array.isArray(user.identities) && user.identities.length === 0) return { ok: false, reason: "already_registered" };
  const found = account(user);
  return status === 200 && found ? { ok: true, account: found } : { ok: false, reason: "unavailable" };
}

export async function signIn(email: string, password: string, fetcher?: typeof fetch): Promise<AuthResult> {
  const { status, data } = await call("token?grant_type=password", { email, password }, fetcher);
  if (status === 429) return { ok: false, reason: "rate_limited" };
  const code = codeOf(data);
  if (code === "email_not_confirmed") return { ok: false, reason: "email_not_confirmed" };
  if (status === 400 || code === "invalid_credentials" || code === "invalid_grant") return { ok: false, reason: "invalid_credentials" };
  const found = account(data.user);
  return status === 200 && found ? { ok: true, account: found } : { ok: false, reason: "unavailable" };
}

/** Sends the password-reset email. Says nothing about whether the address exists. */
export async function recover(email: string, redirectTo: string, fetcher?: typeof fetch): Promise<boolean> {
  const { status } = await call(`recover?redirect_to=${encodeURIComponent(redirectTo)}`, { email }, fetcher);
  return status === 200 || status === 429 || status === 400;
}

/** Sets a new password with the one-time token of a reset link (Supabase puts it in the link's #fragment). */
export async function updatePassword(accessToken: string, password: string, fetcher: typeof fetch = fetch): Promise<AuthResult> {
  const { url, key } = authConfig();
  const response = await fetcher(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response) return { ok: false, reason: "unavailable" };
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (codeOf(data) === "weak_password") return { ok: false, reason: "weak_password" };
  if (response.status === 401 || response.status === 403) return { ok: false, reason: "invalid_credentials" };
  const found = account(data);
  return response.ok && found ? { ok: true, account: found } : { ok: false, reason: "unavailable" };
}
