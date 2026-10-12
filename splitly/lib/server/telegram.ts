import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Checking that a sign-in really comes from Telegram.
//
// A Mini App is handed `initData` by Telegram: a query string that says who
// opened it and when, with a `hash` that only someone holding the bot's token
// can produce. The server recomputes that hash. If it matches, the data is
// Telegram's; if not, it is anybody's. The user's ID is read only after that.
//
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

export type TelegramUser = { id: number; firstName: string; lastName: string | null; username: string | null; languageCode: string | null };

export type Verified =
  { ok: true; user: TelegramUser; authDate: number } | { ok: false; reason: "malformed" | "signature" | "expired" | "no_user" };

/** How old a sign-in may be. Long enough for a slow start, short enough that a captured one is soon useless. */
export const MAX_AGE_SECONDS = 60 * 60;
/** How far ahead of the server's clock a sign-in may claim to be: clocks differ a little, never much. */
const MAX_SKEW_SECONDS = 60;
const MAX_LENGTH = 4096;

export function verifyInitData(initData: unknown, botToken: string, nowSeconds = Math.floor(Date.now() / 1000)): Verified {
  if (typeof initData !== "string" || initData.length === 0 || initData.length > MAX_LENGTH || !botToken)
    return { ok: false, reason: "malformed" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reason: "malformed" };

  // Every field except the hash itself, sorted by name, one per line.
  const lines: string[] = [];
  for (const [key, value] of params) if (key !== "hash") lines.push(`${key}=${value}`);
  lines.sort();

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(lines.join("\n")).digest();
  const given = Buffer.from(hash, "hex");
  // Compared in constant time: how long a comparison takes must not tell how much of a guess was right.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "signature" };

  // From here on the data is Telegram's own.
  const authDate = Number(params.get("auth_date"));
  if (!Number.isSafeInteger(authDate) || authDate > nowSeconds + MAX_SKEW_SECONDS || nowSeconds - authDate > MAX_AGE_SECONDS)
    return { ok: false, reason: "expired" };

  let user: Record<string, unknown>;
  try {
    user = JSON.parse(params.get("user") ?? "");
  } catch {
    return { ok: false, reason: "no_user" };
  }
  if (!user || typeof user.id !== "number" || !Number.isSafeInteger(user.id) || user.id <= 0) return { ok: false, reason: "no_user" };

  const text = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
  return {
    ok: true,
    authDate,
    user: {
      id: user.id,
      firstName: text(user.first_name, 64) ?? "Telegram user",
      lastName: text(user.last_name, 64),
      username: text(user.username, 32),
      languageCode: text(user.language_code, 8),
    },
  };
}
