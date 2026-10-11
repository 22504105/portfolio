import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The colour tokens of both themes, read straight from the stylesheet, and the
// contrast of every pair that is used together for text. If a colour is
// changed and a pair drops below what WCAG 2.2 AA asks, this fails.

const css = readFileSync(join(import.meta.dirname, "../app/globals.css"), "utf8");

/** The custom properties declared in one rule, by its selector. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `rule ${selector}`).toBeGreaterThan(-1);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((match) => [match[1], match[2].toLowerCase()]),
  );
}

const light = tokens(":root");
// The dark theme only names what it changes; everything else is the light value.
const dark = { ...light, ...tokens('[data-theme="dark"]') };

function luminance(hex: string): number {
  const channel = (index: number) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

// [text, background]: every way text is set on a surface in the application.
const TEXT_PAIRS: [string, string][] = [
  ["ink", "canvas"],
  ["ink", "surface"],
  ["ink", "surface-2"],
  ["ink-muted", "canvas"],
  ["ink-muted", "surface"],
  ["ink-muted", "surface-2"],
  ["accent-hover", "canvas"],
  ["accent-hover", "surface"],
  ["accent-hover", "accent-tint"],
  ["positive", "surface"],
  ["negative", "surface"],
  ["warning", "surface"],
  ["nav-ink", "nav"],
  ["nav-ink-muted", "nav"],
  ["nav-ink-muted", "nav-raised"],
];

// White text on solid fills.
const FILLS = ["accent-base", "accent-strong", "negative-fill"];

describe.each([
  ["light", light],
  ["dark", dark],
])("the %s theme", (_, theme) => {
  it.each(TEXT_PAIRS)("%s on %s is readable (4.5:1)", (text, background) => {
    expect(theme[text], text).toBeDefined();
    expect(theme[background], background).toBeDefined();
    expect(contrast(theme[text], theme[background])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(FILLS)("white text on %s is readable (4.5:1)", (fill) => {
    expect(contrast("#ffffff", theme[fill])).toBeGreaterThanOrEqual(4.5);
  });

  it("chart series stand out from the surface they are drawn on (3:1)", () => {
    for (const index of [1, 2, 3, 4, 5]) expect([index, contrast(theme[`series-${index}`], theme.surface) >= 3]).toEqual([index, true]);
  });

  it("field borders can be told from the surface (non-text contrast is not required of them, but they must not vanish)", () => {
    expect(contrast(theme["field-border"], theme.surface)).toBeGreaterThan(1.3);
  });
});

describe("the dark theme", () => {
  it("is actually dark, and built from greys", () => {
    for (const name of ["canvas", "surface", "surface-2", "nav"]) expect([name, luminance(dark[name]) < 0.03]).toEqual([name, true]);
    // Greys: the three channels of each surface stay within a few steps of each other.
    for (const name of ["canvas", "surface", "surface-2", "line"]) {
      const channels = [1, 3, 5].map((index) => parseInt(dark[name].slice(index, index + 2), 16));
      expect([name, Math.max(...channels) - Math.min(...channels) <= 16]).toEqual([name, true]);
    }
  });

  it("layers its surfaces: each step up is a little lighter", () => {
    expect(luminance(dark.canvas)).toBeLessThan(luminance(dark.surface));
    expect(luminance(dark.surface)).toBeLessThan(luminance(dark["surface-2"]));
    expect(luminance(dark.nav)).toBeLessThan(luminance(dark.canvas));
  });

  it("prints as the light theme: paper is white", () => {
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toMatch(/\[data-theme="dark"\]\s*\{[^}]*--surface:\s*#ffffff/);
    expect(print).toMatch(/\[data-theme="dark"\]\s*\{[^}]*--ink:\s*#20242d/);
  });
});
