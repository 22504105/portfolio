import type { DayRange } from "@/lib/domain/types";

// Instants are stored in UTC. Which day an order belongs to is decided in the
// workspace time zone: an order placed at 23:30 in New York on the 31st is a
// sale of the 31st, although it is already the 1st in UTC.

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar day ("YYYY-MM-DD") an instant falls on in a time zone. */
export function dayKey(utcMs: number, timezone: string): string {
  let formatter = dayFormatters.get(timezone);
  if (!formatter) {
    // en-CA writes dates as YYYY-MM-DD.
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(timezone, formatter);
  }
  return formatter.format(utcMs);
}

const DAY_MS = 86_400_000;

// Calendar days are counted on a UTC clock, where every day has 24 hours, so
// daylight saving never makes a range a day longer or shorter.
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
const fromDayNumber = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

export function addDays(day: string, count: number): string {
  return fromDayNumber(dayNumber(day) + count);
}

/** How many days a range covers, both ends included. */
export function daysIn(range: DayRange): number {
  return dayNumber(range.to) - dayNumber(range.from) + 1;
}

/** The range of the same length that ends the day before this one begins. */
export function previousRange(range: DayRange): DayRange {
  const length = daysIn(range);
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

export function inRange(day: string, range: DayRange): boolean {
  return day >= range.from && day <= range.to;
}

/** Whether a string is a real calendar day in the form YYYY-MM-DD. */
export function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && fromDayNumber(dayNumber(value)) === value;
}

/** A range for display: "Sep 1 – Sep 30, 2026". */
export function formatRange(range: DayRange, locale = "en-US"): string {
  const format = (day: string, withYear: boolean) =>
    new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) }).format(
      Date.parse(`${day}T00:00:00Z`),
    );
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  return `${format(range.from, !sameYear)} – ${format(range.to, true)}`;
}
