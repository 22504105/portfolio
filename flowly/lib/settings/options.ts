// What a workspace can be set to.

/** Currencies offered when a workspace is created. Any ISO currency would work; this keeps the menu short. */
export const CURRENCIES = [
  { code: "USD", name: "US dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "Pound sterling" },
  { code: "CAD", name: "Canadian dollar" },
  { code: "AUD", name: "Australian dollar" },
  { code: "CHF", name: "Swiss franc" },
  { code: "SEK", name: "Swedish krona" },
  { code: "PLN", name: "Polish złoty" },
  { code: "CZK", name: "Czech koruna" },
  { code: "JPY", name: "Japanese yen" },
  { code: "KZT", name: "Kazakhstani tenge" },
  { code: "UAH", name: "Ukrainian hryvnia" },
  { code: "TRY", name: "Turkish lira" },
  { code: "BRL", name: "Brazilian real" },
  { code: "MXN", name: "Mexican peso" },
  { code: "INR", name: "Indian rupee" },
  { code: "SGD", name: "Singapore dollar" },
  { code: "AED", name: "UAE dirham" },
] as const;

let zones: Set<string> | undefined;

/** Every time zone the runtime knows, by its IANA name. */
export function timezones(): string[] {
  return ["UTC", ...Intl.supportedValuesOf("timeZone").filter((zone) => zone !== "UTC")];
}

export function isTimezone(value: unknown): value is string {
  zones ??= new Set(timezones());
  return typeof value === "string" && zones.has(value);
}
