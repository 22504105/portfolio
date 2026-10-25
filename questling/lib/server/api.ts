import "server-only";
import { accountsConfigured, serverEnv, standalone, transaction, type Db } from "./db";
import { act, allowed, deleteStudent, exportData, join, ServiceError, signInWithTelegram, state } from "./service";
import { issueSession, issueTicket, readSession, readTicket } from "./session";
import { signInTeacher, StudioError, studioAct, studioState } from "./studio-service";
import { recover, signIn, signUp, teacherAuthConfigured, updatePassword } from "./teacher-auth";
import { deleteAudio, loadAudio, MAX_AUDIO_BYTES, mediaUrl, saveAudio, ticketOpens } from "./media";
import { verifyInitData } from "./telegram";

// The API, /api/v1/…: the student app's routes and Teacher Studio's (studio/…). Each request is
// parsed, the session read, and the work handed to the service inside one transaction. Errors carry
// a code and nothing a stranger could use. Teachers hold the same kind of session as students; every
// studio route checks that the session's user is a teacher and works on that teacher's things only.
// (Same shape as Splitly's, which is already reviewed and deployed.)

const MAX_BODY_BYTES = 16 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const fail = (code: string, status: number) => json({ error: code }, status);

class RequestError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

async function body(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) throw new RequestError("unsupported", 415);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new RequestError("too_large", 413);
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new RequestError("malformed", 400);
  }
}

/** A request that changes something must come from the site itself (a second lock besides the header session). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function sessionUser(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const userId = header.startsWith("Bearer ") ? readSession(header.slice(7), serverEnv().sessionSecret) : null;
  if (!userId) throw new RequestError("unauthenticated", 401);
  return userId;
}

function clientAddress(request: Request): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

type Limit = { scope: string; by: "address" | "user"; max: number; seconds: number };

async function enforce(request: Request, limit: Limit) {
  const subject = limit.by === "user" ? sessionUser(request) : clientAddress(request);
  if (!(await allowed(standalone, limit.scope, subject, limit.max, limit.seconds))) throw new RequestError("rate_limited", 429);
}

type Route = (context: { request: Request; db: Db }) => Promise<unknown>;

const email = (value: unknown) => {
  const clean = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (clean.length < 3 || clean.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new RequestError("invalid", 422);
  return clean;
};
const password = (value: unknown) => {
  if (typeof value !== "string" || value.length < 8 || value.length > 72) throw new RequestError("weak_password", 422);
  return value;
};
const studioLocale = (value: unknown) => (value === "en" ? "en" : "ru");
const siteOrigin = (request: Request) => new URL(request.url).origin;

function requireTeacherAuth() {
  if (!teacherAuthConfigured()) throw new RequestError("not_configured", 503);
}

const ROUTES: Record<string, [Route, Limit?]> = {
  // Trades Telegram's signed sign-in data for a session. The only route that needs no session.
  "POST session": [
    async ({ request, db }) => {
      const { initData } = await body(request);
      const verified = verifyInitData(initData, serverEnv().botToken);
      if (!verified.ok) throw new RequestError("unauthenticated", 401);
      const userId = await signInWithTelegram(db, verified.user);
      // Opened from a group's invite link: join it (a stale or wrong code is simply ignored).
      if (verified.startParam) await join(db, userId, verified.startParam).catch(() => null);
      const session = issueSession(userId, serverEnv().sessionSecret);
      return { token: session.token, expiresAt: session.expiresAt, ...(await state(db, userId)) };
    },
    { scope: "session", by: "address", max: 30, seconds: 600 },
  ],
  "GET state": [async ({ request, db }) => state(db, sessionUser(request))],
  // Joins a group by the code a teacher gave (the settings screen).
  "POST join": [
    async ({ request, db }) => join(db, sessionUser(request), (await body(request)).code),
    { scope: "join", by: "user", max: 20, seconds: 3600 },
  ],
  "POST actions": [
    async ({ request, db }) => {
      const userId = sessionUser(request);
      return act(db, userId, await body(request));
    },
    { scope: "action", by: "user", max: 600, seconds: 3600 },
  ],
  // The student's own data: all of it to download, or all of it deleted (the settings screen).
  // A link for Telegram's downloader, which sends no headers: the ticket in it stands for the session, five minutes.
  "POST export/ticket": [
    async ({ request }) => ({ url: `/api/v1/export?ticket=${issueTicket(sessionUser(request), "export", serverEnv().sessionSecret)}` }),
    { scope: "export", by: "user", max: 10, seconds: 3600 },
  ],
  "GET export": [
    async ({ request, db }) => {
      const ticket = new URL(request.url).searchParams.get("ticket");
      const userId = ticket ? readTicket(ticket, "export", serverEnv().sessionSecret) : sessionUser(request);
      if (!userId) throw new RequestError("unauthenticated", 401);
      return new Response(JSON.stringify(await exportData(db, userId), null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": 'attachment; filename="questling-my-data.json"',
          "Cache-Control": "no-store",
        },
      });
    },
  ],
  "POST account/delete": [
    async ({ request, db }) => {
      const userId = sessionUser(request);
      if ((await body(request)).confirm !== "delete") throw new RequestError("invalid", 422);
      await deleteStudent(db, userId);
      return { status: "deleted" };
    },
    { scope: "delete", by: "user", max: 5, seconds: 3600 },
  ],

  // ——— Teacher Studio ———

  // A new teacher: Supabase emails a confirmation link back to the studio's sign-in page.
  "POST studio/signup": [
    async ({ request }) => {
      requireTeacherAuth();
      const input = await body(request);
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (name.length < 2 || name.length > 60 || /[<>{}]/.test(name)) throw new RequestError("invalid", 422);
      const result = await signUp(
        email(input.email),
        password(input.password),
        name,
        `${siteOrigin(request)}/${studioLocale(input.locale)}/studio/login?confirmed=1`,
      );
      if (!result.ok)
        throw new RequestError(result.reason, result.reason === "unavailable" ? 502 : result.reason === "rate_limited" ? 429 : 409);
      return { status: "confirm_email" };
    },
    { scope: "studio-signup", by: "address", max: 5, seconds: 3600 },
  ],
  "POST studio/signin": [
    async ({ request, db }) => {
      requireTeacherAuth();
      const input = await body(request);
      const result = await signIn(email(input.email), typeof input.password === "string" ? input.password.slice(0, 72) : "");
      if (!result.ok)
        throw new RequestError(result.reason, result.reason === "unavailable" ? 502 : result.reason === "rate_limited" ? 429 : 401);
      if (!result.account.confirmed) throw new RequestError("email_not_confirmed", 401);
      const userId = await signInTeacher(db, result.account);
      const session = issueSession(userId, serverEnv().sessionSecret);
      return { token: session.token, expiresAt: session.expiresAt, facts: await studioState(db, userId) };
    },
    { scope: "studio-signin", by: "address", max: 20, seconds: 600 },
  ],
  "POST studio/recover": [
    async ({ request }) => {
      requireTeacherAuth();
      const input = await body(request);
      await recover(email(input.email), `${siteOrigin(request)}/${studioLocale(input.locale)}/studio/reset`);
      // The same answer whether or not the address has an account.
      return { status: "sent" };
    },
    { scope: "studio-recover", by: "address", max: 5, seconds: 3600 },
  ],
  "POST studio/password": [
    async ({ request }) => {
      requireTeacherAuth();
      const input = await body(request);
      const token = typeof input.accessToken === "string" && input.accessToken.length < 4096 ? input.accessToken : "";
      const result = await updatePassword(token, password(input.password));
      if (!result.ok) throw new RequestError(result.reason, result.reason === "unavailable" ? 502 : 401);
      return { status: "updated" };
    },
    { scope: "studio-password", by: "address", max: 10, seconds: 3600 },
  ],
  // A teacher's recording, as raw bytes (MP3, M4A or WAV; checked by content in lib/server/media.ts).
  "POST studio/media": [
    async ({ request, db }) => {
      const teacherId = sessionUser(request);
      const declared = Number(request.headers.get("content-length") ?? "0");
      if (declared > MAX_AUDIO_BYTES) throw new RequestError("too_large", 413);
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.length > MAX_AUDIO_BYTES) throw new RequestError("too_large", 413);
      const name = decodeURIComponent(request.headers.get("x-file-name") ?? "recording").slice(0, 200);
      const saved = await saveAudio(db, teacherId, name, bytes);
      if (!saved.ok) throw new RequestError(saved.reason, saved.reason === "not_teacher" ? 403 : saved.reason === "quota" ? 409 : 422);
      return { asset: { ...saved.asset, url: mediaUrl(teacherId, saved.asset.id) } };
    },
    { scope: "studio-media", by: "user", max: 60, seconds: 3600 },
  ],
  "POST studio/media/delete": [
    async ({ request, db }) => {
      const teacherId = sessionUser(request);
      const { id } = await body(request);
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) throw new RequestError("invalid", 422);
      const result = await deleteAudio(db, teacherId, id);
      if (result !== "deleted") throw new RequestError(result, result === "in_use" ? 409 : 404);
      return { status: "deleted" };
    },
    { scope: "studio-media", by: "user", max: 60, seconds: 3600 },
  ],
  "GET studio/state": [async ({ request, db }) => ({ facts: await studioState(db, sessionUser(request)) })],
  "POST studio/actions": [
    async ({ request, db }) => studioAct(db, sessionUser(request), await body(request)),
    { scope: "studio-action", by: "user", max: 900, seconds: 3600 },
  ],
};

/**
 * A recording, to whoever holds a ticket for it (a teacher's own, or a student's whose campaign or word
 * of the day uses it). Byte ranges are served: Safari on iOS will not play audio without them.
 */
async function serveMedia(request: Request, id: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}$/.test(id) || !ticketOpens(new URL(request.url).searchParams.get("ticket"), id)) return fail("forbidden", 403);
  const audio = await transaction((db) => loadAudio(db, id));
  if (!audio) return fail("not_found", 404);
  const total = audio.bytes.length;
  const headers = {
    "Content-Type": audio.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (!range) return new Response(new Uint8Array(audio.bytes), { headers: { ...headers, "Content-Length": String(total) } });
  let start = range[1] ? Number(range[1]) : total - Number(range[2]);
  let end = range[1] ? (range[2] ? Number(range[2]) : total - 1) : total - 1;
  start = Math.max(0, start);
  end = Math.min(total - 1, end);
  if (start > end || start >= total)
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${total}` } });
  return new Response(new Uint8Array(audio.bytes.subarray(start, end + 1)), {
    status: 206,
    headers: { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${total}` },
  });
}

/** Handles one API request. `path` is what follows /api/v1/. */
export async function handle(request: Request, path: string[]): Promise<Response> {
  if (!accountsConfigured()) return fail("not_configured", 503);
  if (request.method === "GET" && path.length === 2 && path[0] === "media") {
    try {
      return await serveMedia(request, path[1]);
    } catch (error) {
      console.error("media error", (error as Error).message);
      return fail("server_error", 500);
    }
  }
  const entry = ROUTES[`${request.method} ${path.join("/")}`];
  if (!entry) return fail("not_found", 404);
  if (request.method !== "GET" && !sameOrigin(request)) return fail("forbidden", 403);
  const [route, limit] = entry;
  try {
    if (limit) await enforce(request, limit);
    const result = await transaction((db) => route({ request, db }));
    return result instanceof Response ? result : json(result);
  } catch (error) {
    if (error instanceof RequestError) return fail(error.code, error.status);
    if (error instanceof ServiceError) return fail(error.code, error.status);
    if (error instanceof StudioError) return json({ error: error.code, problems: error.problems }, error.status);
    // The database refusing a second grant or a negative balance: the request was wrong, not the server.
    const code = (error as { code?: string }).code;
    if (code === "23505") return fail("already_done", 409);
    if (code === "23514" || code === "23503") return fail("invalid", 422);
    console.error("api error", request.method, path.join("/"), (error as Error).message);
    return fail("server_error", 500);
  }
}
