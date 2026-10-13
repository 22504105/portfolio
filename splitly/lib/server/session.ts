import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Splitly's own session: a short note saying "this is user X, until time T",
// signed with the server's secret. The page keeps it in memory and sends it
// in the Authorization header. It is never a cookie: inside Telegram Web the
// app is a frame of another site, where cookies are often blocked, and a
// header can only be sent by the page's own script, so no other site can make
// a signed-in browser act on its behalf.

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
    const { u, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; e?: unknown };
    if (typeof u !== "string" || !/^[0-9a-f-]{36}$/.test(u) || typeof e !== "number" || e <= nowSeconds) return null;
    return u;
  } catch {
    return null;
  }
}

// A download ticket: a short note saying "user X may fetch this one file, until time T", signed like a session
// but under a name of its own, so that neither can ever pass for the other. Telegram's downloader fetches a file
// by its address alone, with no header of ours, so the permission has to travel in the address. It is good for a
// few minutes and for exactly the file it names, and it only ever reads.

export const TICKET_SECONDS = 5 * 60;

const signTicket = (payload: string, secret: string) => createHmac("sha256", secret).update(`download:${payload}`).digest("base64url");

export function issueTicket(userId: string, file: unknown, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: nowSeconds + TICKET_SECONDS, f: file })).toString("base64url");
  return `${payload}.${signTicket(payload, secret)}`;
}

/** Whose ticket it is and what file it names, or null if it is forged, damaged or out of date. */
export function readTicket(
  token: unknown,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): { userId: string; file: unknown } | null {
  if (typeof token !== "string" || token.length > 2048 || !secret) return null;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  const given = Buffer.from(signature, "base64url");
  const expected = Buffer.from(signTicket(payload, secret), "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const { u, e, f } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; e?: unknown; f?: unknown };
    if (typeof u !== "string" || !/^[0-9a-f-]{36}$/.test(u) || typeof e !== "number" || e <= nowSeconds) return null;
    return { userId: u, file: f };
  } catch {
    return null;
  }
}
