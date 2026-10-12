import "server-only";
import { accountsConfigured, serverEnv, standalone, transaction, type Db } from "./db";
import * as service from "./service";
import { ServiceError } from "./service";
import { issueSession, readSession } from "./session";
import { verifyInitData } from "./telegram";

// The server's API: /api/v1/…. Each request is parsed, the session read, and
// the work handed to the service inside one transaction. Nothing here decides
// who may do what; the service does, from the session's user.
//
// Answers are JSON. Errors carry a code and no detail a stranger could use:
// a group you are not in and a group that does not exist are both "not_found".

const MAX_BODY_BYTES = 64 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const fail = (code: string, status: number, details?: unknown) => json({ error: code, ...(details ? { details } : {}) }, status);

const STATUS: Record<ServiceError["code"], number> = { not_found: 404, forbidden: 403, invalid: 422, limit: 429, conflict: 409 };

class RequestError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

/** The body of a request as an object. Refuses anything that is not JSON, or is too large to be an honest request. */
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

/**
 * A request that changes something must come from the site itself. Browsers
 * state where a request comes from; one that states somewhere else is refused.
 * (The session travels in a header that only the site's own script can set,
 * so this is a second lock, not the only one.)
 */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Not a browser: there is no ambient session for it to abuse.
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

/** The address a request came from, as the host reports it: for limiting attempts before anyone is signed in. */
function clientAddress(request: Request): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

/** A limit on how often a route may be used: by one address (before anyone is signed in) or by one person. */
type Limit = { scope: string; by: "address" | "user"; max: number; seconds: number };

/**
 * Counts an attempt and refuses it when there have been too many. Done before
 * the request's transaction opens, on a connection of its own: a request that
 * is then refused is rolled back, and its attempt must not be rolled back
 * with it. (Nor may a request hold one connection while waiting for another.)
 */
async function enforce(request: Request, limit: Limit) {
  const subject = limit.by === "user" ? sessionUser(request) : clientAddress(request);
  if (!(await service.allowed(standalone, limit.scope, subject, limit.max, limit.seconds))) throw new RequestError("rate_limited", 429);
}

type Route = (context: { request: Request; db: Db; parts: string[] }) => Promise<unknown>;

/** method + path pattern (":x" matches one segment) → what to do. */
const ROUTES: [string, string, Route, Limit?][] = [
  // Trades Telegram's signed sign-in data for a Splitly session. The only route that needs no session.
  [
    "POST",
    "session",
    async ({ request, db }) => {
      const { initData } = await body(request);
      const verified = verifyInitData(initData, serverEnv().botToken);
      // One answer for every way sign-in data can be wrong.
      if (!verified.ok) throw new RequestError("unauthenticated", 401);
      const userId = await service.signInWithTelegram(db, verified.user);
      const session = issueSession(userId, serverEnv().sessionSecret);
      return { token: session.token, expiresAt: session.expiresAt, profile: await service.profile(db, userId) };
    },
    { scope: "session", by: "address", max: 30, seconds: 600 },
  ],
  ["GET", "me", async ({ request, db }) => service.profile(db, sessionUser(request))],
  [
    "DELETE",
    "me",
    async ({ request, db }) => {
      await service.deleteAccount(db, sessionUser(request));
      return { ok: true };
    },
  ],
  ["GET", "groups", async ({ request, db }) => ({ groups: await service.listGroups(db, sessionUser(request)) })],
  [
    "POST",
    "groups",
    async ({ request, db }) => {
      const userId = sessionUser(request);
      return { id: await service.createGroup(db, userId, await body(request)) };
    },
    { scope: "group.create", by: "user", max: 20, seconds: 3600 },
  ],
  ["GET", "groups/:group", async ({ request, db, parts }) => ({ group: await service.getGroup(db, sessionUser(request), parts[1]) })],
  [
    "PATCH",
    "groups/:group",
    async ({ request, db, parts }) => {
      await service.updateGroup(db, sessionUser(request), parts[1], await body(request));
      return { ok: true };
    },
  ],
  [
    "DELETE",
    "groups/:group",
    async ({ request, db, parts }) => {
      await service.deleteGroup(db, sessionUser(request), parts[1]);
      return { ok: true };
    },
  ],
  [
    "POST",
    "groups/:group/members",
    async ({ request, db, parts }) => ({ id: await service.addGuest(db, sessionUser(request), parts[1], (await body(request)).name) }),
  ],
  [
    "PATCH",
    "groups/:group/members/:member",
    async ({ request, db, parts }) => {
      await service.setRole(db, sessionUser(request), parts[1], parts[3], (await body(request)).role);
      return { ok: true };
    },
  ],
  [
    "DELETE",
    "groups/:group/members/:member",
    async ({ request, db, parts }) => {
      await service.removeMember(db, sessionUser(request), parts[1], parts[3]);
      return { ok: true };
    },
  ],
  [
    "POST",
    "groups/:group/invites",
    async ({ request, db, parts }) => {
      const userId = sessionUser(request);
      return { invite: await service.createInvite(db, userId, parts[1], await body(request)) };
    },
    { scope: "invite.create", by: "user", max: 30, seconds: 3600 },
  ],
  [
    "DELETE",
    "groups/:group/invites",
    async ({ request, db, parts }) => ({ revoked: await service.revokeInvites(db, sessionUser(request), parts[1]) }),
  ],
  [
    "POST",
    "invites/preview",
    async ({ request, db }) => {
      sessionUser(request);
      return service.previewInvite(db, (await body(request)).token);
    },
    // Guessing tokens is hopeless (256 random bits), and limited all the same.
    { scope: "invite.try", by: "user", max: 30, seconds: 600 },
  ],
  [
    "POST",
    "invites/accept",
    async ({ request, db }) => {
      const userId = sessionUser(request);
      const { token, claimMemberId } = await body(request);
      return { groupId: await service.acceptInvite(db, userId, token, claimMemberId) };
    },
    { scope: "invite.try", by: "user", max: 30, seconds: 600 },
  ],
  [
    "POST",
    "groups/:group/expenses",
    async ({ request, db, parts }) => {
      const userId = sessionUser(request);
      const { idempotencyKey, expense } = await body(request);
      return service.createExpense(db, userId, parts[1], idempotencyKey, expense);
    },
    { scope: "expense.write", by: "user", max: 300, seconds: 3600 },
  ],
  [
    "PUT",
    "groups/:group/expenses/:expense",
    async ({ request, db, parts }) => {
      const userId = sessionUser(request);
      const { idempotencyKey, expense } = await body(request);
      return service.replaceExpense(db, userId, parts[1], parts[3], idempotencyKey, expense);
    },
    { scope: "expense.write", by: "user", max: 300, seconds: 3600 },
  ],
  [
    "DELETE",
    "groups/:group/expenses/:expense",
    async ({ request, db, parts }) => {
      await service.cancelExpense(db, sessionUser(request), parts[1], parts[3]);
      return { ok: true };
    },
  ],
];

function match(method: string, parts: string[]): { route: Route; limit?: Limit } | null {
  for (const [routeMethod, pattern, route, limit] of ROUTES) {
    const segments = pattern.split("/");
    if (
      routeMethod === method &&
      segments.length === parts.length &&
      segments.every((segment, index) => segment.startsWith(":") || segment === parts[index])
    )
      return { route, limit };
  }
  return null;
}

/** Handles one API request. `path` is what follows /api/v1/. */
export async function handle(request: Request, path: string[]): Promise<Response> {
  if (!accountsConfigured()) return fail("not_configured", 503);

  const matched = match(request.method, path);
  if (!matched) return fail("not_found", 404);
  if (request.method !== "GET" && !sameOrigin(request)) return fail("forbidden", 403);

  try {
    if (matched.limit) await enforce(request, matched.limit);
    return json(await transaction((db) => matched.route({ request, db, parts: path })));
  } catch (error) {
    if (error instanceof RequestError) return fail(error.code, error.status);
    if (error instanceof ServiceError) return fail(error.code, STATUS[error.code], error.details);
    // The database refusing an unbalanced expense or a duplicate: the request was wrong, not the server.
    const code = (error as { code?: string }).code;
    if (code === "23514" || code === "23503") return fail("invalid", 422);
    if (code === "23505") return fail("conflict", 409);
    // Anything else is ours. Say so without saying what: the log has the rest, and it never includes a request's body.
    console.error("api error", request.method, path.map((part) => (part.length > 20 ? ":id" : part)).join("/"), (error as Error).message);
    return fail("server_error", 500);
  }
}
