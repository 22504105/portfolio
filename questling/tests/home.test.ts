import { describe, expect, it } from "vitest";
import { pluralDays, xpPercent } from "@/lib/student/home";

describe("home helpers", () => {
  it("writes Russian plural forms of days", () => {
    expect([1, 2, 5, 6, 11, 12, 21, 22, 25, 111, 101].map(pluralDays)).toEqual([
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

  it("keeps the XP bar between 0 and 100", () => {
    expect(xpPercent(340, 500)).toBe(68);
    expect(xpPercent(0, 500)).toBe(0);
    expect(xpPercent(600, 500)).toBe(100);
    expect(xpPercent(10, 0)).toBe(0);
  });
});
