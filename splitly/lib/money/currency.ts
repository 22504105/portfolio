// What Splitly knows about currencies. Amounts are whole numbers of a
// currency's minor unit (kuruş, cents, kopecks; whole yen), never fractions and
// never floating point. How many minor units make one unit differs by
// currency, so it is always looked up, never assumed to be a hundred.

/** Currencies offered in menus. Any ISO 4217 code the runtime knows can still be stored. */
export const CURRENCIES = ["TRY", "USD", "EUR", "RUB", "GBP", "KZT", "GEL", "AED", "UAH", "PLN", "CHF", "JPY", "KWD"] as const;
export type CurrencyCode = string;

const exponents = new Map<string, number>();

/** Decimal places of a currency: 2 for TRY, 0 for JPY, 3 for KWD. Throws for a code that is not a currency. */
export function minorExponent(currency: CurrencyCode): number {
  let exponent = exponents.get(currency);
  if (exponent === undefined) {
    if (!/^[A-Z]{3}$/.test(currency)) throw new RangeError(`Not a currency code: ${currency}`);
    exponent = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    exponents.set(currency, exponent);
  }
  return exponent;
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) return false;
  try {
    minorExponent(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * The largest amount Splitly accepts, in minor units: far beyond any shared
 * dinner, and far inside what a JavaScript number holds exactly, so sums of
 * many such amounts stay exact too.
 */
export const MAX_MINOR = 100_000_000_000_00;

/** Guards every amount that enters a calculation: a whole number within range, nothing else. */
export function assertMinor(value: number, label = "amount"): number {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_MINOR)
    throw new RangeError(`${label} is not a valid amount in minor units: ${value}`);
  return value;
}
