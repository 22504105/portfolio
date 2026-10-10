import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Email links and the session they open.
//
// A token is 32 random bytes. The link carries it; the database keeps only its
// SHA-256, so a copy of the database opens nothing. A token is high-entropy
// random data, which is why a plain hash is enough here and no salt or slow
// hash is needed.

export type BookingToken = { token: string; hash: Buffer };

export function newToken(): BookingToken {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

/** Whether a string has the shape of a token at all, before it is looked up. */
export function looksLikeToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

// The management session: a signed note saying "the holder opened a valid
// link for this booking, until this time". It lives in an HTTP-only cookie so
// the token itself can leave the address bar straight away.

export const MANAGE_SESSION_COOKIE = "cutco_manage";
export const MANAGE_SESSION_SECONDS = 30 * 60;

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function sealManageSession(bookingId: string, secret: string, now = Date.now()): string {
  const payload = `${bookingId}.${Math.floor(now / 1000) + MANAGE_SESSION_SECONDS}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** The booking a session cookie is for, or null if it is forged, malformed or expired. */
export function openManageSession(value: string | undefined, secret: string, now = Date.now()): string | null {
  const parts = value?.split(".");
  if (parts?.length !== 3) return null;
  const [bookingId, expires, signature] = parts;

  const expected = Buffer.from(sign(`${bookingId}.${expires}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!/^\d+$/.test(expires) || Number(expires) * 1000 <= now) return null;
  return bookingId;
}

/** A stable, anonymous key for throttling: the purpose and a hash of who is asking. */
export function throttleKey(purpose: string, subject: string): string {
  return `${purpose}:${createHash("sha256").update(subject.trim().toLowerCase()).digest("base64url").slice(0, 22)}`;
}
