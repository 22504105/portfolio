import type { Locale } from "@/i18n/routing";
import { BUSINESS_TIME_ZONE, CURRENCY, INTL_LOCALE } from "./config";

/**
 * A price for display, from integer US cents: "$45" or "45 $", with cents
 * only when there are any.
 */
export function formatMoney(cents: number, locale: Locale): string {
  if (!Number.isInteger(cents)) throw new RangeError(`Not a whole number of cents: ${cents}`);

  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: CURRENCY,
    // "$", not "US$": there is only one currency on the site.
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** A length of time in minutes: "45 mins", "1 hr 5 mins", "1 ч 5 мин". */
export function formatDuration(minutes: number, locale: Locale): string {
  const unit = (value: number, name: "hour" | "minute") =>
    new Intl.NumberFormat(INTL_LOCALE[locale], { style: "unit", unit: name, unitDisplay: "short" }).format(value);

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return unit(rest, "minute");
  return rest === 0 ? unit(hours, "hour") : `${unit(hours, "hour")} ${unit(rest, "minute")}`;
}

/** An instant as a date or time in the shop, never in the visitor's own zone. */
export function formatDateTime(
  instant: Date | string,
  locale: Locale,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone">,
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...options, timeZone: BUSINESS_TIME_ZONE }).format(
    new Date(instant),
  );
}
