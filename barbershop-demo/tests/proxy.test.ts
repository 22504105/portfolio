import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The matcher decides which requests get language routing at all. A wrong
// pattern fails silently: pages still render, links just stop being redirected
// to a language. Read from the source, since Next.js needs it to be a literal.
const source = readFileSync(resolve(import.meta.dirname, "../proxy.ts"), "utf8");
const literal = source.match(/matcher:\s*("(?:[^"\\]|\\.)*")/)?.[1];
const matcher = new RegExp(`^${JSON.parse(literal ?? '""')}$`);

describe("proxy matcher", () => {
  it.each(["/", "/en", "/ru/book", "/about", "/booking/manage"])("routes %s through language handling", (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each(["/api/cron/reminders", "/_next/static/chunk.js", "/_vercel/insights", "/icon.svg", "/images/shop.jpg", "/manifest.webmanifest"])(
    "leaves %s alone",
    (path) => {
      expect(matcher.test(path)).toBe(false);
    },
  );
});
