import Decimal from "decimal.js";
import { MAX_MINOR, minorExponent } from "./currency";

// Exchange rates, and the one place an amount in one currency becomes an
// amount in another. Rates are typed in by people and kept as exact decimal
// text; nothing here fetches a rate, and nothing ever guesses one. A rate is
// never changed once recorded: a new rate is a new record with its own date,
// and what was converted with an old one stays explainable.
//
// Conversions are for looking at totals in one currency. They never change
// what anyone owes: debts stay in the currency of the expense.

export type Rate = {
  id: string;
  /** One unit of `from`… */
  from: string;
  /** …is this many units of `to`. */
  to: string;
  /** Exact decimal text: "34.25", "0.0292". Never a float. */
  rate: string;
  /** The day it holds from, YYYY-MM-DD. */
  effectiveDate: string;
  createdAt: string;
};

export type RateInput = { from: string; to: string; rate: string; effectiveDate: string };

/** A rate as typed ("34,25", "34.25") in the exact form it is kept in, or null if it is not a positive number of sane size. */
export function parseRate(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const clean = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,12}(\.\d{1,12})?$/.test(clean)) return null;
  const value = new Decimal(clean);
  if (!value.gt(0)) return null;
  // No trailing zeros, no bare point: one way to write each rate.
  return value.toFixed();
}

export type Applied = {
  /** How many `to` one `from` is, as exact text. */
  rate: string;
  effectiveDate: string;
  /** True when no rate was recorded this way round and the opposite one was turned over. */
  inverted: boolean;
};

/**
 * The rate in force on a day: the most recent one recorded for that pair
 * with a date on or before it. If the pair was only ever recorded the other
 * way round, that rate is turned over. Null if there is nothing: then there
 * is no conversion, and the screen says so.
 */
export function rateOn(rates: readonly Rate[], from: string, to: string, day: string): Applied | null {
  if (from === to) return { rate: "1", effectiveDate: day, inverted: false };
  const latest = (a: string, b: string) =>
    rates
      .filter((rate) => rate.from === a && rate.to === b && rate.effectiveDate <= day)
      .sort((x, y) => y.effectiveDate.localeCompare(x.effectiveDate) || y.createdAt.localeCompare(x.createdAt))[0];
  const direct = latest(from, to);
  const opposite = latest(to, from);
  // Whichever was recorded more recently speaks for that day.
  if (direct && (!opposite || direct.effectiveDate >= opposite.effectiveDate))
    return { rate: direct.rate, effectiveDate: direct.effectiveDate, inverted: false };
  if (opposite)
    return {
      rate: new Decimal(1).div(opposite.rate).toSignificantDigits(12).toFixed(),
      effectiveDate: opposite.effectiveDate,
      inverted: true,
    };
  return null;
}

/**
 * An amount in minor units of one currency as minor units of another, at a
 * rate. Rounded to the nearest unit, halves away from zero: the same rule
 * every time, so the same expense always converts to the same figure.
 */
export function convert(minor: number, from: string, to: string, rate: string): number {
  if (from === to) return minor;
  const result = new Decimal(minor)
    .div(new Decimal(10).pow(minorExponent(from)))
    .times(rate)
    .times(new Decimal(10).pow(minorExponent(to)))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  if (result.abs().gt(MAX_MINOR)) throw new RangeError("converted amount is out of range");
  return result.toNumber();
}
