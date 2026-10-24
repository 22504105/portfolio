import { describe, expect, it } from "vitest";
import { getDictionary, pickLocale, plural, switchLocalePath } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { ru } from "@/lib/i18n/ru";
import { xpPercent } from "@/lib/student/home";

describe("home helpers", () => {
  it("writes Russian plural forms of days", () => {
    const days = getDictionary("ru").common.days;
    expect([1, 2, 5, 6, 11, 12, 21, 22, 25, 111, 101].map((n) => plural("ru", n, days))).toEqual([
      "1 день",
      "2 дня",
      "5 дней",
      "6 дней",
      "11 дней",
      "12 дней",
      "21 день",
      "22 дня",
      "25 дней",
      "111 дней",
      "101 день",
    ]);
  });

  it("writes English plural forms of days", () => {
    const days = getDictionary("en").common.days;
    expect([1, 2, 6, 21].map((n) => plural("en", n, days))).toEqual(["1 day", "2 days", "6 days", "21 days"]);
  });

  it("keeps the XP bar between 0 and 100", () => {
    expect(xpPercent(340, 500)).toBe(68);
    expect(xpPercent(0, 500)).toBe(0);
    expect(xpPercent(600, 500)).toBe(100);
    expect(xpPercent(10, 0)).toBe(0);
  });
});

describe("languages", () => {
  it("offers the visitor's language, Russian when neither is asked for", () => {
    expect(pickLocale("en-GB,en;q=0.9")).toBe("en");
    expect(pickLocale("de-DE,ru;q=0.5,en;q=0.8")).toBe("en");
    expect(pickLocale("ru")).toBe("ru");
    expect(pickLocale("de-DE")).toBe("ru");
    expect(pickLocale(null)).toBe("ru");
  });

  it("swaps the language of an address and keeps the rest", () => {
    expect(switchLocalePath("/ru/demo/settings", "en")).toBe("/en/demo/settings");
    expect(switchLocalePath("/demo/home", "ru")).toBe("/ru/demo/home");
  });

  it("has every Russian text in English too, and none left empty", () => {
    const keys = (o: object, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
    expect(keys(en)).toEqual(keys(ru));
    const values = (o: object): unknown[] => Object.values(o).flatMap((v) => (typeof v === "object" ? values(v) : [v]));
    expect(values(en).every((v) => typeof v === "string" && v.trim() !== "")).toBe(true);
  });
});
