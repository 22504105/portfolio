import { describe, expect, it } from "vitest";
import { hashToken, looksLikeToken, newToken, openManageSession, sealManageSession, throttleKey } from "@/lib/booking/tokens";
import { EMAIL_COPY } from "@/lib/email/copy";

const flatten = (value: unknown, prefix = ""): [string, string][] =>
  typeof value === "string"
    ? [[prefix, value]]
    : Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) => flatten(inner, prefix ? `${prefix}.${key}` : key));

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join();

describe("email copy", () => {
  const english = new Map(flatten(EMAIL_COPY.en));
  const russian = new Map(flatten(EMAIL_COPY.ru));

  it("has the same messages in both languages", () => {
    expect([...russian.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("uses the same placeholders in both languages", () => {
    const mismatched = [...english.keys()].filter((key) => placeholders(english.get(key)!) !== placeholders(russian.get(key)!));
    expect(mismatched).toEqual([]);
  });

  it("is actually translated", () => {
    expect([...russian].filter(([, text]) => !/[а-яё]/i.test(text)).map(([key]) => key)).toEqual([]);
    expect([...english].filter(([, text]) => /[а-яё]/i.test(text)).map(([key]) => key)).toEqual([]);
  });

  it("says in every language that the shop is fictional", () => {
    expect(EMAIL_COPY.en.concept).toMatch(/not a real barbershop/);
    expect(EMAIL_COPY.ru.concept).toMatch(/не настоящий барбершоп/);
  });
});

describe("tokens", () => {
  it("are long, random and stored as a hash", () => {
    const a = newToken();
    const b = newToken();
    expect(a.token).not.toBe(b.token);
    expect(looksLikeToken(a.token)).toBe(true);
    expect(a.hash.length).toBe(32);
    expect(a.hash.equals(hashToken(a.token))).toBe(true);
    expect(a.hash.toString("hex")).not.toContain(a.token);
  });

  it("rejects anything that is not shaped like a token before looking it up", () => {
    for (const value of ["", "short", "A".repeat(44), "A".repeat(42) + "!", undefined, null, 42, ["A".repeat(43)]]) {
      expect(looksLikeToken(value)).toBe(false);
    }
  });
});

describe("management session", () => {
  const SECRET = "a-secret-that-is-long-enough-to-sign-with";
  const BOOKING = "0b0e8f0c-3a5e-4c53-9d6a-2f1f4a7f9c11";
  const NOW = 1_900_000_000_000;

  it("opens for the booking it was sealed for", () => {
    expect(openManageSession(sealManageSession(BOOKING, SECRET, NOW), SECRET, NOW + 60_000)).toBe(BOOKING);
  });

  it("expires after half an hour", () => {
    const sealed = sealManageSession(BOOKING, SECRET, NOW);
    expect(openManageSession(sealed, SECRET, NOW + 29 * 60_000)).toBe(BOOKING);
    expect(openManageSession(sealed, SECRET, NOW + 31 * 60_000)).toBeNull();
  });

  it("cannot be forged, extended or pointed at another booking", () => {
    const sealed = sealManageSession(BOOKING, SECRET, NOW);
    const [id, expires, signature] = sealed.split(".");
    expect(openManageSession(sealed, "another-secret-that-is-also-long-enough", NOW)).toBeNull();
    expect(openManageSession(`${id}.${Number(expires) + 9999}.${signature}`, SECRET, NOW)).toBeNull();
    expect(openManageSession(`11111111-1111-4111-8111-111111111111.${expires}.${signature}`, SECRET, NOW)).toBeNull();
    expect(openManageSession(`${id}.${expires}.`, SECRET, NOW)).toBeNull();
    expect(openManageSession("garbage", SECRET, NOW)).toBeNull();
    expect(openManageSession(undefined, SECRET, NOW)).toBeNull();
  });
});

describe("throttle keys", () => {
  it("do not contain what they were made from", () => {
    const key = throttleKey("hold:email", "Ada@Example.com");
    expect(key).not.toMatch(/ada|example/i);
    expect(key).toBe(throttleKey("hold:email", " ada@example.com "));
    expect(key).not.toBe(throttleKey("hold:ip", "ada@example.com"));
  });
});
