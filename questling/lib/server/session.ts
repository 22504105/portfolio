import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Questling's own session: a short note saying "this is user X, until time T", signed with
// the server's secret. The page keeps it in memory and sends it in the Authorization header.
// It is never a cookie: inside Telegram Web the app is a frame of another site, where cookies
// are often blocked, and a header can only be sent by the page's own script, so no other site
// can make a signed-in browser act on its behalf. (Carried over from Splitly.)

export const SESSION_SECONDS = 6 * 60 * 60;

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function issueSession(
  userId: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): { token: string; expiresAt: number } {
  const expiresAt = nowSeconds + SESSION_SECONDS;
  const payload = Buffer.from(JSON.stringify({ u: userId, e: expiresAt })).toString("base64url");
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt };
}

/** The user a token belongs to, or null if it is forged, damaged or out of date. */
export function readSession(token: unknown, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): string | null {
  if (typeof token !== "string" || token.length > 512 || !secret) return null;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  const given = Buffer.from(signature, "base64url");
  const expected = Buffer.from(sign(payload, secret), "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const { u, e, p } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; e?: unknown; p?: unknown };
    // A ticket (it names its purpose) is never a session.
    if (p !== undefined || typeof u !== "string" || !/^[0-9a-f-]{36}$/.test(u) || typeof e !== "number" || e <= nowSeconds) return null;
    return u;
  } catch {
    return null;
  }
}

// A ticket: like a session, but for one purpose and five minutes, and it goes in a link's query. Telegram's
// own downloader (WebApp.downloadFile) fetches a plain address with no headers, so the student's data file
// is fetched with a ticket the page asked for with its session. Signed with a separate key so that one
// can never be read as the other.
export const TICKET_SECONDS = 5 * 60;

const ticketKey = (secret: string) => createHmac("sha256", secret).update("questling-ticket").digest("base64url");

export function issueTicket(userId: string, purpose: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: nowSeconds + TICKET_SECONDS, p: purpose })).toString("base64url");
  return `${payload}.${sign(payload, ticketKey(secret))}`;
}

/** The user a ticket was issued to for this purpose, or null. */
export function readTicket(token: unknown, purpose: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): string | null {
  if (typeof token !== "string" || token.length > 512 || !secret) return null;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;
  const given = Buffer.from(signature, "base64url");
  const expected = Buffer.from(sign(payload, ticketKey(secret)), "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { u, e, p } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; e?: unknown; p?: unknown };
    if (p !== purpose || typeof u !== "string" || !/^[0-9a-f-]{36}$/.test(u) || typeof e !== "number" || e <= nowSeconds) return null;
    return u;
  } catch {
    return null;
  }
}
