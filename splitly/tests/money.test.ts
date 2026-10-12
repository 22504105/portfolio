import { describe, expect, it } from "vitest";
import { allocate, checkExact, splitByPercent, splitByShares, splitEqually } from "@/lib/money/allocate";
import { formatMoney, minorFromString, parseAmount, toDecimalString } from "@/lib/money/amount";
import { assertMinor, isCurrencyCode, MAX_MINOR, minorExponent } from "@/lib/money/currency";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** A small seeded generator, so "random" cases are the same on every run. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("currencies", () => {
  it("knows that not every currency has two decimals", () => {
    expect([minorExponent("TRY"), minorExponent("USD"), minorExponent("JPY"), minorExponent("KWD")]).toEqual([2, 2, 0, 3]);
  });

  it("tells a currency code from something shaped like one", () => {
    expect([isCurrencyCode("TRY"), isCurrencyCode("try"), isCurrencyCode("TR"), isCurrencyCode("₺"), isCurrencyCode(949)]).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("refuses amounts that are not whole minor units within range", () => {
    expect(assertMinor(1250)).toBe(1250);
    for (const bad of [12.5, Number.NaN, Infinity, MAX_MINOR + 1, -MAX_MINOR - 1]) expect(() => assertMinor(bad)).toThrow(RangeError);
  });
});

describe("reading what a person typed", () => {
  it("takes a comma or a point as the decimal separator", () => {
    const cases: [string, string, number | null][] = [
      ["12,50", "TRY", 1250],
      ["12.50", "TRY", 1250],
      ["12,5", "TRY", 1250],
      ["12", "TRY", 1200],
      ["1 234,50", "TRY", 123450],
      ["1.234,50", "TRY", 123450],
      ["1,234.50", "USD", 123450],
      ["1.234.567", "TRY", 123456700],
      ["1,234,567.89", "USD", 123456789],
      ["0,05", "TRY", 5],
      [",5", "TRY", 50],
      ["-12,50", "TRY", -1250],
      ["1500", "JPY", 1500],
      ["1,234", "KWD", 1234],
      ["1.5", "KWD", 1500],
    ];
    for (const [input, currency, expected] of cases)
      expect([input, currency, parseAmount(input, currency)]).toEqual([input, currency, expected]);
  });

  it("refuses what is not an amount, and never rounds a price to fit", () => {
    for (const [input, currency] of [
      ["", "TRY"],
      ["abc", "TRY"],
      ["12,505", "TRY"],
      ["1.234", "TRY"],
      ["1,234", "USD"],
      ["1.23.4", "TRY"],
      ["12.5", "JPY"],
      ["1e5", "TRY"],
      ["=1+1", "TRY"],
      ["12,,5", "TRY"],
      ["99999999999999999", "TRY"],
    ]) {
      expect([input, parseAmount(input, currency)]).toEqual([input, null]);
    }
  });

  it("writes amounts back exactly, and reads the database's text form", () => {
    expect([toDecimalString(1250, "TRY"), toDecimalString(5, "TRY"), toDecimalString(1500, "JPY"), toDecimalString(-1234, "KWD")]).toEqual([
      "12.50",
      "0.05",
      "1500",
      "-1.234",
    ]);
    expect(minorFromString("123450")).toBe(123450);
    for (const bad of ["12.5", "1e3", "", "12a", "99999999999999999999"]) expect(() => minorFromString(bad)).toThrow(RangeError);
  });

  it("shows an amount with its currency code in the reader's own number format", () => {
    expect(formatMoney(123450, "TRY")).toBe("1,234.50 TRY");
    expect(formatMoney(123450, "TRY", { locale: "ru" })).toBe("1 234,50 TRY");
    expect(formatMoney(1500, "JPY")).toBe("1,500 JPY");
    expect(formatMoney(-500, "USD", { sign: true })).toBe("-5.00 USD");
    expect(formatMoney(500, "USD", { sign: true })).toBe("+5.00 USD");
    expect(formatMoney(0, "USD", { sign: true })).toBe("0.00 USD");
  });
});

describe("splitting an amount", () => {
  it("gives the leftover minor units to the first people, one each", () => {
    expect(splitEqually(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEqually(1001, 3)).toEqual([334, 334, 333]);
    expect(splitEqually(2, 3)).toEqual([1, 1, 0]);
    expect(splitEqually(0, 3)).toEqual([0, 0, 0]);
    expect(splitEqually(999, 1)).toEqual([999]);
  });

  it("gives leftover units to the largest cut-off fractions first", () => {
    // Exact shares of 100 by 1:1:3 are 20, 20, 60: nothing left over.
    expect(allocate(100, [1, 1, 3])).toEqual([20, 20, 60]);
    // Exact shares of 101 by 50:30:20 are 50.5, 30.3, 20.2: the one unit goes to the .5.
    expect(allocate(101, [50, 30, 20])).toEqual([51, 30, 20]);
    // Of 10 by 1:1:1:4 they are 1.43, 1.43, 1.43, 5.71: the .71 first, then the first of the .43s.
    expect(allocate(10, [1, 1, 1, 4])).toEqual([2, 1, 1, 6]);
  });

  it("is stable: the same input always gives the same split", () => {
    const first = allocate(100003, [7, 7, 7, 3, 3]);
    for (let i = 0; i < 20; i++) expect(allocate(100003, [7, 7, 7, 3, 3])).toEqual(first);
  });

  it("gives nothing to a weight of zero, not even a leftover unit", () => {
    expect(allocate(100, [0, 1, 1, 1])).toEqual([0, 34, 33, 33]);
    expect(allocate(1, [0, 0, 5])).toEqual([0, 0, 1]);
  });

  it("splits a refund as the mirror image of the purchase", () => {
    const purchase = allocate(1001, [1, 1, 1]);
    const refund = allocate(-1001, [1, 1, 1]);
    expect(refund).toEqual(purchase.map((part) => -part));
    expect(sum(refund)).toBe(-1001);
    // No "negative zero" hiding in a result.
    expect(allocate(-1, [1, 1]).map((part) => Object.is(part, -0))).toEqual([false, false]);
  });

  it("stays exact with amounts far beyond what floating point multiplies safely", () => {
    const parts = allocate(MAX_MINOR, [3, 3, 3, 1]);
    expect(sum(parts)).toBe(MAX_MINOR);
    expect(parts).toEqual([3_000_000_000_000, 3_000_000_000_000, 3_000_000_000_000, 1_000_000_000_000]);
    // 10^13 × 3 would already be past what a number multiplies exactly with a larger weight; BigInt does not care.
    expect(sum(allocate(MAX_MINOR, [999_999_937, 1, 62]))).toBe(MAX_MINOR);
  });

  it("never loses or invents a minor unit, and never strays more than one from the exact share", () => {
    const random = seeded(20261012);
    for (let run = 0; run < 3000; run++) {
      const total = Math.floor(random() * 5_000_000) - (random() < 0.15 ? 2_500_000 : 0);
      const weights = Array.from({ length: 1 + Math.floor(random() * 9) }, () => Math.floor(random() * 50));
      if (!weights.some((weight) => weight > 0)) weights[0] = 1;
      const parts = allocate(total, weights);
      expect(sum(parts)).toBe(total);
      const weightSum = sum(weights);
      parts.forEach((part, index) => {
        const exact = (total * weights[index]) / weightSum;
        expect(Math.abs(part - exact)).toBeLessThan(1);
        expect(Number.isInteger(part)).toBe(true);
        if (weights[index] === 0) expect(part).toBe(0);
      });
    }
  });

  it("refuses to split between nobody, by negative or fractional weights, or with every weight zero", () => {
    expect(() => allocate(100, [])).toThrow(RangeError);
    expect(() => allocate(100, [0, 0])).toThrow(RangeError);
    expect(() => allocate(100, [1, -1])).toThrow(RangeError);
    expect(() => allocate(100, [0.5, 0.5])).toThrow(RangeError);
    expect(() => splitEqually(100, 0)).toThrow(RangeError);
    expect(() => allocate(10.5, [1, 1])).toThrow(RangeError);
  });

  it("splits by percentages only when they add up to a hundred", () => {
    expect(splitByPercent(1000, [5000, 2500, 2500])).toEqual([500, 250, 250]);
    expect(splitByPercent(100, [3333, 3333, 3334])).toEqual([33, 33, 34]);
    expect(() => splitByPercent(1000, [5000, 2500])).toThrow(/add up to 100/);
    expect(() => splitByPercent(1000, [5000, 5001])).toThrow(/add up to 100/);
  });

  it("splits by shares", () => {
    expect(splitByShares(900, [2, 1])).toEqual([600, 300]);
    expect(splitByShares(1000, [2, 1])).toEqual([667, 333]);
  });

  it("checks exact amounts instead of adjusting them", () => {
    expect(checkExact(1000, [400, 600])).toEqual({ ok: true });
    expect(checkExact(1000, [400, 500])).toEqual({ ok: false, differenceMinor: 100 });
    expect(checkExact(1000, [700, 400])).toEqual({ ok: false, differenceMinor: -100 });
  });
});
