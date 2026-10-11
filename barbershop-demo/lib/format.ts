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

/** The name of a day of the week. ISO numbering: 1 is Monday, 7 is Sunday. */
export function formatWeekday(weekday: number, locale: Locale, width: "long" | "short" = "long"): string {
  // 1 January 2024 was a Monday.
  const date = new Date(Date.UTC(2024, 0, weekday));
  const name = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: width, timeZone: "UTC" }).format(date);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Several days of the week as a list: "Tue, Wed, Thu". */
export function formatWeekdays(weekdays: number[], locale: Locale): string {
  return weekdays.map((weekday) => formatWeekday(weekday, locale, "short")).join(", ");
}
