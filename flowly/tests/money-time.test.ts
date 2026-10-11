import { describe, expect, it } from "vitest";
import { formatMoney, minorToDecimalString, minorUnitExponent, toMinor } from "@/lib/money";
import { addDays, daysIn, formatRange, isDay, previousRange } from "@/lib/time";

describe("money", () => {
  it("knows how many decimals a currency has", () => {
    expect([minorUnitExponent("USD"), minorUnitExponent("JPY"), minorUnitExponent("KWD")]).toEqual([2, 0, 3]);
  });

  it("turns decimal text into minor units without floating point", () => {
    expect(toMinor("19.90", "USD")).toBe(1990);
    // 0.1 + 0.2 is not 0.3 in floating point; as text it is exact.
    expect(toMinor("0.30", "USD")).toBe(30);
    expect(toMinor("1.005", "USD")).toBe(101);
    expect(toMinor("1200", "JPY")).toBe(1200);
    expect(toMinor(8.2, "USD")).toBe(820);
  });

  it("refuses what is not a number", () => {
    expect(toMinor("twelve", "USD")).toBeNull();
    expect(toMinor("", "USD")).toBeNull();
    expect(toMinor("Infinity", "USD")).toBeNull();
    expect(toMinor("1e30", "USD")).toBeNull();
  });

  it("writes minor units back as an exact decimal", () => {
    expect(minorToDecimalString(1990, "USD")).toBe("19.90");
    expect(minorToDecimalString(-5, "USD")).toBe("-0.05");
    expect(minorToDecimalString(1200, "JPY")).toBe("1200");
  });

  it("formats for reading", () => {
    expect(formatMoney(123456, "USD")).toBe("$1,234.56");
    expect(formatMoney(4812300, "USD", { compact: true })).toBe("$48.1K");
  });
});

describe("calendar days", () => {
  it("counts days with both ends included", () => {
    expect(daysIn({ from: "2026-09-01", to: "2026-09-30" })).toBe(30);
    expect(daysIn({ from: "2026-09-30", to: "2026-09-30" })).toBe(1);
  });

  it("is not thrown by daylight saving or month ends", () => {
    // Clocks change in New York on 1 November 2026; the day count does not.
    expect(daysIn({ from: "2026-10-26", to: "2026-11-08" })).toBe(14);
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("finds the period just before, of the same length", () => {
    expect(previousRange({ from: "2026-09-01", to: "2026-09-30" })).toEqual({ from: "2026-08-02", to: "2026-08-31" });
  });

  it("tells a real day from something shaped like one", () => {
    expect(isDay("2026-02-28")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-2-3")).toBe(false);
    expect(isDay(20260228)).toBe(false);
  });

  it("writes a range for reading", () => {
    expect(formatRange({ from: "2026-09-01", to: "2026-09-30" })).toBe("Sep 1 – Sep 30, 2026");
    expect(formatRange({ from: "2025-12-20", to: "2026-01-18" })).toBe("Dec 20, 2025 – Jan 18, 2026");
  });
});
