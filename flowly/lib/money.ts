import Decimal from "decimal.js";

// Money never touches floating point. Amounts are parsed with decimal
// arithmetic and then held as whole minor units (cents), which JavaScript adds
// and subtracts exactly up to 9 quadrillion. The database stores numeric.

const exponents = new Map<string, number>();

/** How many decimal places a currency has: 2 for USD, 0 for JPY, 3 for KWD. */
export function minorUnitExponent(currency: string): number {
  let exponent = exponents.get(currency);
  if (exponent === undefined) {
    exponent = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    exponents.set(currency, exponent);
  }
  return exponent;
}

/**
 * A decimal amount as text ("19.90") in minor units (1990). Rounds half up to
 * the currency's precision. Returns null for anything that is not a finite number.
 */
export function toMinor(amount: string | number, currency: string): number | null {
  let value: Decimal;
  try {
    value = new Decimal(amount);
  } catch {
    return null;
  }
  if (!value.isFinite()) return null;
  const minor = value.times(new Decimal(10).pow(minorUnitExponent(currency))).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return minor.abs().lte(Number.MAX_SAFE_INTEGER) ? minor.toNumber() : null;
}

/** Minor units as an exact decimal string for storage and export: 1990 → "19.90". */
export function minorToDecimalString(minor: number, currency: string): string {
  const exponent = minorUnitExponent(currency);
  return new Decimal(minor).div(new Decimal(10).pow(exponent)).toFixed(exponent);
}

const formatters = new Map<string, Intl.NumberFormat>();

type MoneyFormat = { locale?: string; compact?: boolean };

/** Minor units for display: 123456 → "$1,234.56"; compact: "$1.2K". */
export function formatMoney(minor: number, currency: string, { locale = "en-US", compact = false }: MoneyFormat = {}): string {
  const key = `${locale}|${currency}|${compact}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
    });
    formatters.set(key, formatter);
  }
  return formatter.format(minor / 10 ** minorUnitExponent(currency));
}
