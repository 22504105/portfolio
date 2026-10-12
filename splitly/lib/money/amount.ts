import Decimal from "decimal.js";
import { assertMinor, MAX_MINOR, minorExponent, type CurrencyCode } from "./currency";

// Reading, writing and showing amounts. Decimal arithmetic is used at the
// edges (what a person typed, an exchange rate); between the edges everything
// is whole minor units.

/**
 * What a person typed ("12,50", "1 234.5", "12.5") as minor units, or null if
 * it is not an amount. A comma or a point may be the decimal separator; the
 * other, and spaces, are taken as grouping. More decimals than the currency
 * has is refused, not rounded, and so is anything that could be read two
 * ways ("1.234"): a price is never changed or guessed silently.
 */
export function parseAmount(input: string, currency: CurrencyCode): number | null {
  const text = input.replace(/[\s  ']/g, "");
  if (!/^-?[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const negative = text.startsWith("-");
  const digits = negative ? text.slice(1) : text;
  const lastComma = digits.lastIndexOf(",");
  const lastPoint = digits.lastIndexOf(".");
  const separator = Math.max(lastComma, lastPoint);

  let whole = digits;
  let fraction = "";
  if (separator !== -1) {
    const tail = digits.slice(separator + 1);
    const head = digits.slice(0, separator);
    const mark = digits[separator];
    const both = lastComma !== -1 && lastPoint !== -1;
    const repeated = digits.split(mark).length > 2;
    if (repeated && !both) {
      // "1.234.567": one kind of mark, several times, can only be grouping.
      if (!/^\d{1,3}([.,]\d{3})+$/.test(digits)) return null;
    } else {
      // "1.234" in a currency of two decimals could be a thousand or a slip of the finger for 1.23.
      // An amount is never guessed: it is refused, and the form asks for it to be typed plainly.
      if (!both && tail.length === 3 && minorExponent(currency) !== 3) return null;
      whole = head;
      fraction = tail;
    }
  }
  whole = whole.replace(/[.,]/g, "");
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fraction) || (whole === "" && fraction === "")) return null;

  const exponent = minorExponent(currency);
  if (fraction.length > exponent) return null;
  const minor = new Decimal(`${whole || "0"}.${fraction || "0"}`).times(new Decimal(10).pow(exponent));
  if (!minor.isInteger() || minor.gt(MAX_MINOR)) return null;
  return negative ? -minor.toNumber() : minor.toNumber();
}

/** Minor units as an exact decimal string, for storage, export and exchange: 1250 TRY → "12.50". */
export function toDecimalString(minor: number, currency: CurrencyCode): string {
  const exponent = minorExponent(currency);
  return new Decimal(assertMinor(minor)).div(new Decimal(10).pow(exponent)).toFixed(exponent);
}

/** An amount that crossed JSON as text (the database's bigint) back into a number, refusing anything that is not one. */
export function minorFromString(value: string): number {
  if (!/^-?\d{1,16}$/.test(value)) throw new RangeError(`Not an amount in minor units: ${value}`);
  return assertMinor(Number(value));
}

const formatters = new Map<string, Intl.NumberFormat>();

type FormatOptions = { locale?: string; sign?: boolean };

/**
 * An amount for reading, always with its currency code, never a bare symbol:
 * "1,234.50 TRY" in English, "1 234,50 TRY" in Russian. `sign` shows a plus
 * for positive amounts, for balances.
 */
export function formatMoney(minor: number, currency: CurrencyCode, { locale = "en", sign = false }: FormatOptions = {}): string {
  const exponent = minorExponent(currency);
  const key = `${locale}|${exponent}|${sign}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
      signDisplay: sign ? "exceptZero" : "auto",
    });
    formatters.set(key, formatter);
  }
  // Division only for display; the stored value stays the integer.
  return `${formatter.format(new Decimal(assertMinor(minor)).div(new Decimal(10).pow(exponent)).toNumber())} ${currency}`;
}
