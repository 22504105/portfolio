import { describe, expect, it } from "vitest";
import { issueSession, issueTicket, readSession, readTicket, SESSION_SECONDS, TICKET_SECONDS } from "@/lib/server/session";
import { MAX_AGE_SECONDS, telegramPhoto, verifyInitData } from "@/lib/server/telegram";
import { sign, TOKEN } from "./telegram-fixture";

// Carried over from Splitly with the code they test: Telegram sign-in and sessions.

const NOW = 1_800_000_000;

const USER = JSON.stringify({ id: 42, first_name: "Ayşe", last_name: "Yılmaz", username: "ayse", language_code: "tr" });

describe("verifying Telegram sign-in data", () => {
  it("accepts what Telegram signed, and reads the user only from it", () => {
    const result = verifyInitData(sign({ auth_date: String(NOW - 30), query_id: "AAF", user: USER }), TOKEN, NOW);
    expect(result).toEqual({
      ok: true,
      authDate: NOW - 30,
      startParam: null,
      user: { id: 42, firstName: "Ayşe", lastName: "Yılmaz", username: "ayse", languageCode: "tr", photoUrl: null },
    });
  });

  it("reads a group's invite code from the signed start parameter, and nothing that is not a code", () => {
    const opened = verifyInitData(sign({ auth_date: String(NOW), user: USER, start_param: "DETA2XYZ" }), TOKEN, NOW);
    expect(opened.ok && opened.startParam).toBe("DETA2XYZ");
    const odd = verifyInitData(sign({ auth_date: String(NOW), user: USER, start_param: "<script>" }), TOKEN, NOW);
    expect(odd.ok && odd.startParam).toBeNull();
    // Added after signing: the signature breaks, so a code cannot be slipped in.
    const params = new URLSearchParams(sign({ auth_date: String(NOW), user: USER }));
    params.set("start_param", "DETA2XYZ");
    expect(verifyInitData(params.toString(), TOKEN, NOW)).toEqual({ ok: false, reason: "signature" });
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
});

describe("a person's Telegram photo", () => {
  it("accepts Telegram's servers and nothing else", () => {
    expect(telegramPhoto("https://t.me/i/userpic/320/x.jpg")).toBe("https://t.me/i/userpic/320/x.jpg");
    for (const bad of [
      "http://t.me/x.jpg",
      "https://evil.example/t.me/x.jpg",
      "https://t.me.evil.example/x.jpg",
      "javascript:alert(1)",
      null,
      42,
    ]) {
      expect(telegramPhoto(bad)).toBeNull();
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
      null,
      42,
    ]) {
      expect(readSession(bad, SECRET, NOW)).toBeNull();
    }
    expect(readSession(token, "another-secret-entirely-of-32-characters!!", NOW)).toBeNull();
  });

  it("issues short download tickets that open one thing and are never a session", () => {
    const ticket = issueTicket(USER_ID, "export", SECRET, NOW);
    expect(readTicket(ticket, "export", SECRET, NOW)).toBe(USER_ID);
    expect(readTicket(ticket, "export", SECRET, NOW + TICKET_SECONDS)).toBeNull();
    expect(readTicket(ticket, "other", SECRET, NOW)).toBeNull();
    // A ticket in the Authorization header opens nothing, and a session is not a ticket.
    expect(readSession(ticket, SECRET, NOW)).toBeNull();
    expect(readTicket(issueSession(USER_ID, SECRET, NOW).token, "export", SECRET, NOW)).toBeNull();
  });
});
