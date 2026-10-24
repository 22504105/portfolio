import "server-only";
import { accountsConfigured, serverEnv, standalone, transaction, type Db } from "./db";
import { act, allowed, ServiceError, signInWithTelegram, state } from "./service";
import { issueSession, readSession } from "./session";
import { verifyInitData } from "./telegram";

// The student API, /api/v1/…. Each request is parsed, the session read, and the work handed to
// the service inside one transaction. Errors carry a code and nothing a stranger could use.
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

const ROUTES: Record<string, [Route, Limit?]> = {
  // Trades Telegram's signed sign-in data for a session. The only route that needs no session.
  "POST session": [
    async ({ request, db }) => {
      const { initData } = await body(request);
      const verified = verifyInitData(initData, serverEnv().botToken);
      if (!verified.ok) throw new RequestError("unauthenticated", 401);
      const userId = await signInWithTelegram(db, verified.user);
      const session = issueSession(userId, serverEnv().sessionSecret);
      return { token: session.token, expiresAt: session.expiresAt, ...(await state(db, userId)) };
    },
    { scope: "session", by: "address", max: 30, seconds: 600 },
  ],
  "GET state": [async ({ request, db }) => state(db, sessionUser(request))],
  "POST actions": [
    async ({ request, db }) => {
      const userId = sessionUser(request);
      return act(db, userId, await body(request));
    },
    { scope: "action", by: "user", max: 600, seconds: 3600 },
  ],
};

/** Handles one API request. `path` is what follows /api/v1/. */
export async function handle(request: Request, path: string[]): Promise<Response> {
  if (!accountsConfigured()) return fail("not_configured", 503);
  const entry = ROUTES[`${request.method} ${path.join("/")}`];
  if (!entry) return fail("not_found", 404);
  if (request.method !== "GET" && !sameOrigin(request)) return fail("forbidden", 403);
  const [route, limit] = entry;
  try {
    if (limit) await enforce(request, limit);
    return json(await transaction((db) => route({ request, db })));
  } catch (error) {
    if (error instanceof RequestError) return fail(error.code, error.status);
    if (error instanceof ServiceError) return fail(error.code, error.status);
    // The database refusing a second grant or a negative balance: the request was wrong, not the server.
    const code = (error as { code?: string }).code;
    if (code === "23505") return fail("already_done", 409);
    if (code === "23514" || code === "23503") return fail("invalid", 422);
    console.error("api error", request.method, path.join("/"), (error as Error).message);
    return fail("server_error", 500);
  }
}
