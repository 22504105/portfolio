/**
 * Whether a string has the shape of an email-link token at all: 32 random
 * bytes in base64url. Checked before a token is looked up, in the browser and
 * on the server. Kept apart from ./tokens.ts, which uses Node's crypto and
 * cannot be loaded in a browser.
 */
export function looksLikeToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
