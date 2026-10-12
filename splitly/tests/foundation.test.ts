import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fill, getDictionary, isLocale, LOCALES, pickLocale, switchLocalePath } from "@/lib/i18n";

// ------------------------------------------------------------------ languages

/** Every path to a string in a dictionary, with what kind of thing sits there. */
function shape(value: unknown, path = ""): string[] {
  if (typeof value === "string") return [`${path}: text`];
  if (Array.isArray(value))
    return [`${path}: list of ${value.length}`, ...value.flatMap((item, index) => shape(item, `${path}[${index}]`))];
  return Object.entries(value as object).flatMap(([key, item]) => shape(item, path ? `${path}.${key}` : key));
}

describe("the two languages", () => {
  const en = getDictionary("en");
  const ru = getDictionary("ru");

  it("say the same things: neither has a key, or a list item, the other lacks", () => {
    expect(shape(ru)).toEqual(shape(en));
  });

  it("leave nothing empty and nothing untranslated by accident", () => {
    const texts = (value: unknown): string[] =>
      typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(texts) : Object.values(value as object).flatMap(texts);
    for (const text of [...texts(en), ...texts(ru)]) expect(text.trim().length).toBeGreaterThan(0);
    // Russian text is in Cyrillic, apart from the product's name and the language names themselves.
    const latinOnly = texts(ru).filter((text) => !/[а-яё]/i.test(text));
    expect(latinOnly.sort()).toEqual(["English", "Splitly"]);
  });

  it("use the same placeholders", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    expect(placeholders(ru.stage.title)).toEqual(placeholders(en.stage.title));
    expect(fill(en.stage.title, { stage: 2 })).toBe("This screen is built in stage 2");
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });
});

describe("choosing a language for someone who did not ask for one", () => {
  it("takes the first of theirs that Splitly speaks", () => {
    expect(pickLocale("ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("ru");
    expect(pickLocale("tr-TR,tr;q=0.9,ru;q=0.5,en;q=0.4")).toBe("ru");
    expect(pickLocale("en-GB,en;q=0.9")).toBe("en");
    expect(pickLocale("ru")).toBe("ru");
  });

  it("respects the order of preference, not the order of writing", () => {
    expect(pickLocale("en;q=0.3,ru;q=0.9")).toBe("ru");
  });

  it("falls back to English for anything else, including nonsense", () => {
    for (const input of [null, undefined, "", "tr-TR", "*", ";;;", "ru;q=abc,en"])
      expect([input, pickLocale(input)]).toEqual([input, "en"]);
  });

  it("knows its own languages", () => {
    expect(LOCALES).toEqual(["en", "ru"]);
    expect([isLocale("ru"), isLocale("RU"), isLocale("tr"), isLocale(undefined)]).toEqual([true, false, false, false]);
  });

  it("finds the same screen in the other language", () => {
    expect(switchLocalePath("/en/demo/groups", "ru")).toBe("/ru/demo/groups");
    expect(switchLocalePath("/ru", "en")).toBe("/en");
    expect(switchLocalePath("/demo", "ru")).toBe("/ru/demo");
    expect(switchLocalePath("/", "ru")).toBe("/ru/");
  });
});

// --------------------------------------------------------------------- colours

const css = readFileSync(join(import.meta.dirname, "../app/globals.css"), "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `rule ${selector}`).toBeGreaterThan(-1);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((match) => [match[1], match[2].toLowerCase()]),
  );
}

const light = tokens(":root");
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

// [text, background]: every way text is set on a surface.
const PAIRS: [string, string][] = [
  ["ink", "canvas"],
  ["ink", "surface"],
  ["ink", "surface-2"],
  ["ink-muted", "canvas"],
  ["ink-muted", "surface"],
  ["ink-muted", "surface-2"],
  ["on-primary", "primary"],
  ["on-primary", "primary-hover"],
  ["on-accent", "accent"],
  ["on-accent", "accent-soft"],
  ["positive", "canvas"],
  ["positive", "surface"],
  ["danger", "surface"],
  ["danger", "canvas"],
  ["warning", "surface"],
  ["warning", "canvas"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("the %s theme", (_, theme) => {
  it.each(PAIRS)("%s on %s is readable (WCAG AA, 4.5:1)", (text, background) => {
    expect(theme[text], text).toBeDefined();
    expect(theme[background], background).toBeDefined();
    expect(contrast(theme[text], theme[background])).toBeGreaterThanOrEqual(4.5);
  });

  it("white text on the danger fill is readable", () => {
    expect(contrast("#ffffff", theme["danger-fill"])).toBeGreaterThanOrEqual(4.5);
  });

  it("the primary button stands out from the page (3:1 for controls)", () => {
    expect(contrast(theme.primary, theme.canvas)).toBeGreaterThanOrEqual(3);
  });
});

describe("the palette", () => {
  it("keeps the brief's colours where they pass, and says where it had to move", () => {
    expect([light.canvas, light.primary, light.accent, light.ink, light.line]).toEqual([
      "#f8f7f3",
      "#173d35",
      "#b9e4c9",
      "#232826",
      "#e5e9e3",
    ]);
    expect([dark.canvas, dark.surface, dark.ink, dark["ink-muted"], dark.primary]).toEqual([
      "#111a17",
      "#1b2923",
      "#f2f5f0",
      "#a5b5aa",
      "#a7d8ba",
    ]);
    // The brief's muted, danger and warning fall short of 4.5:1 as text on the light canvas; ours do not.
    expect(contrast("#737c76", light.canvas)).toBeLessThan(4.5);
    expect(contrast("#c75b57", light.surface)).toBeLessThan(4.5);
    expect(contrast("#a66b26", light.surface)).toBeLessThan(4.5);
  });
});
