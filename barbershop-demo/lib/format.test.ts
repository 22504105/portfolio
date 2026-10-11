import { describe, expect, it } from "vitest";
import { formatDateTime, formatDuration, formatMoney, formatWeekday, formatWeekdays } from "./format";

// Intl separates with no-break spaces; compare on plain ones.
const plain = (text: string) => text.replace(/[  ]/g, " ");

describe("formatMoney", () => {
  it("shows whole dollar amounts without cents", () => {
    expect(formatMoney(4500, "en")).toBe("$45");
    expect(plain(formatMoney(4500, "ru"))).toBe("45 $");
  });

  it("shows cents when there are any", () => {
    expect(formatMoney(4550, "en")).toBe("$45.50");
    expect(plain(formatMoney(4550, "ru"))).toBe("45,50 $");
  });

  it("groups thousands the way each language does", () => {
    expect(formatMoney(1234500, "en")).toBe("$12,345");
    expect(plain(formatMoney(1234500, "ru"))).toBe("12 345 $");
  });

  it("formats zero", () => {
    expect(formatMoney(0, "en")).toBe("$0");
  });

  it("refuses amounts that are not whole cents", () => {
    expect(() => formatMoney(45.5, "en")).toThrow(RangeError);
    expect(() => formatMoney(Number.NaN, "en")).toThrow(RangeError);
  });
});

describe("formatDuration", () => {
  it("formats minutes under an hour", () => {
    expect(plain(formatDuration(45, "en"))).toBe("45 mins");
    expect(plain(formatDuration(45, "ru"))).toBe("45 мин");
  });

  it("formats whole hours", () => {
    expect(plain(formatDuration(120, "en"))).toBe("2 hrs");
    expect(plain(formatDuration(120, "ru"))).toBe("2 ч");
  });

  it("formats hours and minutes", () => {
    expect(plain(formatDuration(65, "en"))).toBe("1 hr 5 mins");
    expect(plain(formatDuration(65, "ru"))).toBe("1 ч 5 мин");
  });
});

describe("formatDateTime", () => {
  const time = { hour: "2-digit", minute: "2-digit" } as const;

  it("shows London time, not the time of the machine or of UTC", () => {
    // In July London is an hour ahead of UTC.
    expect(formatDateTime("2030-07-10T09:00:00Z", "en", time)).toBe("10:00");
    // In January it is not.
    expect(formatDateTime("2030-01-10T09:00:00Z", "en", time)).toBe("09:00");
  });

  it("follows the clock change on the night it happens", () => {
    // 31 March 2030: 01:00 GMT becomes 02:00 BST.
    expect(formatDateTime("2030-03-31T00:30:00Z", "en", time)).toBe("00:30");
    expect(formatDateTime("2030-03-31T01:30:00Z", "en", time)).toBe("02:30");
  });

  it("writes dates in the language asked for", () => {
    const date = { weekday: "long", day: "numeric", month: "long" } as const;
    expect(formatDateTime("2030-07-10T09:00:00Z", "en", date)).toBe("Wednesday 10 July");
    expect(formatDateTime("2030-07-10T09:00:00Z", "ru", date)).toBe("среда, 10 июля");
  });

  it("puts a late evening in London on the London date", () => {
    // 23:30 UTC on 9 July is already 00:30 on the 10th in London.
    expect(formatDateTime("2030-07-09T23:30:00Z", "en", { day: "numeric", month: "long" })).toBe("10 July");
  });
});

describe("formatWeekday", () => {
  it("names ISO weekdays, Monday first", () => {
    expect(formatWeekday(1, "en")).toBe("Monday");
    expect(formatWeekday(7, "en")).toBe("Sunday");
    expect(formatWeekday(1, "ru")).toBe("Понедельник");
  });

  it("lists working days in short form", () => {
    expect(formatWeekdays([2, 3, 6], "en")).toBe("Tue, Wed, Sat");
    expect(formatWeekdays([2, 3, 6], "ru")).toBe("Вт, Ср, Сб");
  });
});
