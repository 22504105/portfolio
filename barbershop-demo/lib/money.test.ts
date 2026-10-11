import { describe, expect, it } from "vitest";
import { centsToInput, parseDollarsToCents } from "./money";

describe("parseDollarsToCents", () => {
  it("reads whole and decimal amounts as integer cents", () => {
    expect(parseDollarsToCents("45")).toBe(4500);
    expect(parseDollarsToCents("45.5")).toBe(4550);
    expect(parseDollarsToCents("45.50")).toBe(4550);
    expect(parseDollarsToCents("45,50")).toBe(4550);
    expect(parseDollarsToCents(" $ 45.05 ")).toBe(4505);
    expect(parseDollarsToCents("0")).toBe(0);
  });

  it("does not suffer from floating point", () => {
    // 19.99 * 100 is 1998.9999999999998 in floating point.
    expect(parseDollarsToCents("19.99")).toBe(1999);
    expect(parseDollarsToCents("0.07")).toBe(7);
    expect(parseDollarsToCents("1234567.89")).toBe(123456789);
  });

  it("refuses anything that is not a plain amount", () => {
    for (const text of ["", "abc", "-5", "45.505", "4 5", "1e3", "45.", ".50", "12345678", "45 USD", "£45"]) {
      expect(parseDollarsToCents(text)).toBeNull();
    }
  });
});

describe("centsToInput", () => {
  it("round-trips through the parser", () => {
    for (const cents of [0, 5, 4500, 4550, 4505, 123456789]) {
      expect(parseDollarsToCents(centsToInput(cents))).toBe(cents);
    }
    expect([centsToInput(4500), centsToInput(4550), centsToInput(7)]).toEqual(["45", "45.50", "0.07"]);
  });
});
