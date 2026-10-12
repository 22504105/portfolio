import { isCurrencyCode } from "@/lib/money/currency";

// What a person prefers, kept on their device only: nothing here is sent anywhere.

const CURRENCY_KEY = "splitly-currency-v1";

/** The currency offered first for a new group: the one they chose, or lira. */
export function preferredCurrency(): string {
  try {
    const stored = window.localStorage.getItem(CURRENCY_KEY);
    return isCurrencyCode(stored) ? stored : "TRY";
  } catch {
    return "TRY";
  }
}

export function rememberCurrency(currency: string): void {
  try {
    window.localStorage.setItem(CURRENCY_KEY, currency);
  } catch {
    // No storage: the choice holds until the page is closed.
  }
}
