import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { issueSession, readSession, SESSION_SECONDS } from "@/lib/server/session";
import { MAX_AGE_SECONDS, telegramPhoto, verifyInitData } from "@/lib/server/telegram";

const TOKEN = "1234567890:TEST-ONLY-token-for-signing-fixtures-0";
const NOW = 1_800_000_000;

function sign(fields: Record<string, string>, token = TOKEN): string {
  const params = new URLSearchParams(fields);
  const check = [...params]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return params.toString();
}

const USER = JSON.stringify({ id: 42, first_name: "Ayşe", last_name: "Yılmaz", username: "ayse", language_code: "tr" });

describe("verifying Telegram sign-in data", () => {
  it("accepts what Telegram signed, and reads the user only from it", () => {
    const result = verifyInitData(sign({ auth_date: String(NOW - 30), query_id: "AAF", user: USER }), TOKEN, NOW);
    expect(result).toEqual({
      ok: true,
      authDate: NOW - 30,
      user: { id: 42, firstName: "Ayşe", lastName: "Yılmaz", username: "ayse", languageCode: "tr", photoUrl: null },
    });
  });

  it("covers every field, including ones added later: changing or adding any breaks the signature", () => {
    const good = sign({ auth_date: String(NOW), user: USER, chat_instance: "123", signature: "ed25519-part" });
    expect(verifyInitData(good, TOKEN, NOW).ok).toBe(true);
    for (const tamper of [
      (p: URLSearchParams) => p.set("user", USER.replace("42", "43")),
      (p: URLSearchParams) => p.set("auth_date", String(NOW + 1)),
      (p: URLSearchParams) => p.set("extra", "1"),
      (p: URLSearchParams) => p.delete("chat_instance"),
    ]) {
      const params = new URLSearchParams(good);
      tamper(params);
      expect(verifyInitData(params.toString(), TOKEN, NOW)).toEqual({ ok: false, reason: "signature" });
    }
  });

  it("refuses data signed with a different bot's token", () => {
    expect(verifyInitData(sign({ auth_date: String(NOW), user: USER }, "999:other"), TOKEN, NOW)).toEqual({
      ok: false,
      reason: "signature",
    });
  });

  it("refuses data that is too old, or from the future", () => {
    const at = (authDate: number) => verifyInitData(sign({ auth_date: String(authDate), user: USER }), TOKEN, NOW);
    expect(at(NOW - MAX_AGE_SECONDS).ok).toBe(true);
    expect(at(NOW - MAX_AGE_SECONDS - 1)).toEqual({ ok: false, reason: "expired" });
    expect(at(NOW + 30).ok).toBe(true);
    expect(at(NOW + 600)).toEqual({ ok: false, reason: "expired" });
    expect(verifyInitData(sign({ auth_date: "soon", user: USER }), TOKEN, NOW)).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses correctly signed data that names no usable user", () => {
    for (const user of ["", "not json", "{}", JSON.stringify({ id: "42" }), JSON.stringify({ id: -1 }), JSON.stringify({ id: 1.5 })]) {
      expect(verifyInitData(sign({ auth_date: String(NOW), ...(user ? { user } : {}) }), TOKEN, NOW)).toEqual({
        ok: false,
        reason: "no_user",
      });
    }
  });

  it("refuses what is not sign-in data at all, without throwing", () => {
    for (const bad of [undefined, null, 42, {}, "", "hash=xyz", "user=1", "hash=" + "g".repeat(64), "a".repeat(5000)]) {
      expect(verifyInitData(bad, TOKEN, NOW)).toEqual({ ok: false, reason: "malformed" });
    }
    expect(verifyInitData(sign({ auth_date: String(NOW), user: USER }), "", NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("trims what it takes from a profile", () => {
    const long = JSON.stringify({ id: 7, first_name: "x".repeat(300), last_name: "   " });
    const result = verifyInitData(sign({ auth_date: String(NOW), user: long }), TOKEN, NOW);
    expect(result.ok && [result.user.firstName.length, result.user.lastName, result.user.username]).toEqual([64, null, null]);
  });
});

describe("a person's Telegram photo", () => {
  it("is taken from signed sign-in data when it is on Telegram's own servers", () => {
    const withPhoto = JSON.stringify({ id: 42, first_name: "Ayşe", photo_url: "https://t.me/i/userpic/320/abc.svg" });
    const result = verifyInitData(sign({ auth_date: String(NOW), user: withPhoto }), TOKEN, NOW);
    expect(result.ok && result.user.photoUrl).toBe("https://t.me/i/userpic/320/abc.svg");
  });

  it("accepts Telegram's servers and nothing else, whatever the sign-in data says", () => {
    for (const good of [
      "https://t.me/i/userpic/320/x.jpg",
      "https://cdn4.telesco.pe/file/abc.jpg",
      "https://api.telegram.org/file/x.jpg",
      "https://cdn5.telegram-cdn.org/file/x.jpg",
    ]) {
      expect(telegramPhoto(good)).toBe(good);
    }
    for (const bad of [
      "http://t.me/i/userpic/320/x.jpg",
      "https://evil.example/t.me/x.jpg",
      "https://t.me.evil.example/x.jpg",
      "https://nott.me/x.jpg",
      "https://user:pass@t.me/x.jpg",
      "javascript:alert(1)",
      "data:image/svg+xml,<svg onload=alert(1)>",
      "//t.me/x.jpg",
      "t.me/x.jpg",
      `https://t.me/${"x".repeat(600)}`,
      "",
      null,
      undefined,
      42,
      { url: "https://t.me/x.jpg" },
    ]) {
      expect([String(bad).slice(0, 40), telegramPhoto(bad)]).toEqual([String(bad).slice(0, 40), null]);
    }
  });
});

describe("sessions", () => {
  const SECRET = "test-only-session-secret-of-at-least-32-characters";
  const USER_ID = "3f2b1c9e-8a47-4d6b-9c1e-5a7d2f0b6e11";

  it("round-trips the user until it expires", () => {
    const { token, expiresAt } = issueSession(USER_ID, SECRET, NOW);
    expect(expiresAt).toBe(NOW + SESSION_SECONDS);
    expect(readSession(token, SECRET, NOW)).toBe(USER_ID);
    expect(readSession(token, SECRET, expiresAt - 1)).toBe(USER_ID);
    expect(readSession(token, SECRET, expiresAt)).toBeNull();
  });

  it("is useless if altered, signed with another secret, or not a session at all", () => {
    const { token } = issueSession(USER_ID, SECRET, NOW);
    const [payload, signature] = token.split(".");
    const other = Buffer.from(JSON.stringify({ u: "00000000-0000-4000-8000-000000000000", e: NOW + 999_999 })).toString("base64url");
    for (const bad of [
      `${other}.${signature}`,
      `${payload}.${signature.slice(0, -2)}AA`,
      `${payload}.`,
      payload,
      `${token}.extra`,
      "",
      "a.b",
      null,
      42,
      "x".repeat(600),
    ]) {
      expect([String(bad).slice(0, 16), readSession(bad, SECRET, NOW)]).toEqual([String(bad).slice(0, 16), null]);
    }
    expect(readSession(token, "another-secret-entirely-of-32-characters!!", NOW)).toBeNull();
    expect(readSession(token, "", NOW)).toBeNull();
  });

  it("does not accept a payload that verifies but is not shaped like a session", () => {
    const forge = (data: unknown) => {
      const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
      return `${payload}.${createHmac("sha256", SECRET).update(payload).digest("base64url")}`;
    };
    for (const data of [{ u: "not-a-uuid", e: NOW + 100 }, { u: USER_ID }, { u: USER_ID, e: "later" }, { e: NOW + 100 }, [], "x"]) {
      expect(readSession(forge(data), SECRET, NOW)).toBeNull();
    }
  });
});
