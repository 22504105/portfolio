import { BUSINESS_TIME_ZONE } from "./config";

// Calendar dates are "YYYY-MM-DD" strings and clock times are "HH:MM" strings,
// both in the shop's time zone. Only instants are Date objects. Keeping the
// two apart is what makes the clock changes harmless.

const MINUTE = 60_000;
const DAY = 86_400_000;

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** The shop's wall clock at an instant, as if it were UTC, in milliseconds. */
function wallClock(instant: Date): number {
  const part: Record<string, number> = {};
  for (const { type, value } of partsFormat.formatToParts(instant)) part[type] = Number(value);
  return Date.UTC(part.year, part.month - 1, part.day, part.hour, part.minute, part.second);
}

/** How far the shop's clock is ahead of UTC at an instant, in milliseconds. */
function offsetAt(instant: Date): number {
  return wallClock(instant) - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The calendar date in the shop at an instant. */
export function businessDate(instant: Date): string {
  return new Date(wallClock(instant)).toISOString().slice(0, 10);
}

/** The instant at which the shop's clock shows the given date and time. */
export function zonedInstant(date: string, time: string): Date {
  const asUtc = new Date(`${date}T${time}:00Z`).getTime();
  // The offset is looked up twice: the first guess can land on the wrong side
  // of a clock change, the second look is taken from the corrected instant.
  const guess = asUtc - offsetAt(new Date(asUtc));
  return new Date(asUtc - offsetAt(new Date(guess)));
}

/** A calendar date some days later (or earlier). */
export function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);
}

/** ISO day of week of a calendar date: 1 is Monday, 7 is Sunday. */
export function isoWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
}

/** An instant some minutes later. */
export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE);
}
