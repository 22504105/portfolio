// The academy's calendar. Daily quests, the word of the day, streaks and the weekly chest
// all turn over at midnight Moscow time, for everyone: one schedule, the same on the server
// and in the browser, whatever the device's clock zone. (Most learners are in that zone;
// a per-student zone can be added later without changing anything stored.)

export const ACADEMY_TIMEZONE = "Europe/Moscow";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: ACADEMY_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** The academy day of an instant: "2026-10-24". */
export function dayOf(instant: Date | string | number): string {
  return dayFormat.format(new Date(instant));
}

/** Days since 1970-01-01 of an academy day: for rotations and for counting days in a row. */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function dayFromNumber(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

/** The Monday that starts the academy week of a day: the weekly chest's period. */
export function weekOf(day: string): string {
  const n = dayNumber(day);
  // 1970-01-01 was a Thursday: (n + 3) % 7 is 0 on Mondays.
  return dayFromNumber(n - ((n + 3) % 7));
}

/** Milliseconds until the next academy midnight, for "Обновится через 6ч 12м". */
export function msUntilNextDay(now: Date): number {
  const today = dayNumber(dayOf(now));
  // Moscow has no daylight saving time: midnight there is 21:00 UTC of the day before.
  const nextMidnightUtc = (today + 1) * 86_400_000 - 3 * 3_600_000;
  return Math.max(0, nextMidnightUtc - now.getTime());
}
