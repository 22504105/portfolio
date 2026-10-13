import { isCurrencyCode } from "./currency";
import { parseRate } from "./fx";

// A rate offered from outside, for a person to accept or not. The source is
// the European Central Bank's daily reference table, read through
// frankfurter.dev: free, no key, no account. It is only ever a suggestion:
// nothing here records a rate. A person sees the figure and its date and
// adds it themselves, as they would one they typed, and from then on it is a
// rate like any other: kept with its day, never changed, never applied to
// days before it.

export type OfferedRate = {
  from: string;
  to: string;
  /** Exact decimal text, in the form every rate is kept in. */
  rate: string;
  /** The day the bank published it, YYYY-MM-DD: the latest working day, not always today. */
  date: string;
};

export const RATE_SOURCE = "https://api.frankfurter.dev/v1/latest";

/** The currencies the bank's table has. For any other the answer is "no rate", and the person types one. */
export const OFFERED_CURRENCIES: readonly string[] = ["TRY", "USD", "EUR", "GBP", "PLN", "CHF", "JPY"];

/** The address to ask, or null if the pair is not one the source can answer. */
export function rateQuery(from: unknown, to: unknown): string | null {
  if (!isCurrencyCode(from) || !isCurrencyCode(to) || from === to) return null;
  if (!OFFERED_CURRENCIES.includes(from) || !OFFERED_CURRENCIES.includes(to)) return null;
  return `${RATE_SOURCE}?base=${from}&symbols=${to}`;
}

/** What the source answered, checked: the pair asked for, a positive rate, a real date. Anything else is no rate. */
export function readOffer(body: unknown, from: string, to: string): OfferedRate | null {
  if (typeof body !== "object" || body === null) return null;
  const { base, date, rates } = body as { base?: unknown; date?: unknown; rates?: unknown };
  if (base !== from || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (typeof rates !== "object" || rates === null) return null;
  const value = (rates as Record<string, unknown>)[to];
  // The figure comes as a JSON number; its shortest decimal text is what was published.
  const rate =
    typeof value === "number" && Number.isFinite(value) ? parseRate(value.toString()) : typeof value === "string" ? parseRate(value) : null;
  return rate ? { from, to, rate, date } : null;
}
