import { addDays, addMinutes, businessDate, isoWeekday, zonedInstant } from "@/lib/business-time";
import type { WorkingRange } from "@/lib/catalog";

// The slot rules of the booking policy as pure functions. In Phase 02 they
// feed the interface from a mock; the authority from Phase 03 on is the
// database, which applies the same rules under a lock.

export type Interval = { start: Date; end: Date };

type SlotsInput = {
  /** Calendar date in the shop, "YYYY-MM-DD". */
  date: string;
  /** The barber's weekly hours; the ranges of other weekdays are ignored. */
  ranges: WorkingRange[];
  /** Total length of the visit. Need not be a multiple of the interval. */
  durationMinutes: number;
  /** Starts are offered on this grid of the clock: every 30 minutes. */
  intervalMinutes: number;
  /** No start before this instant (now plus the minimum lead time). */
  earliest: Date;
  /** Time already taken: bookings, holds, time off. */
  busy: Interval[];
};

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const timeOf = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * The start times on one day at which the whole visit fits: inside a single
 * working range, clear of everything already booked, and not too soon.
 */
export function slotsForDay({ date, ranges, durationMinutes, intervalMinutes, earliest, busy }: SlotsInput): Date[] {
  const weekday = isoWeekday(date);
  const slots: Date[] = [];

  for (const range of ranges.filter((candidate) => candidate.weekday === weekday)) {
    const close = minutesOf(range.end);
    // First point of the clock grid at or after opening.
    const first = Math.ceil(minutesOf(range.start) / intervalMinutes) * intervalMinutes;

    for (let minutes = first; minutes + durationMinutes <= close; minutes += intervalMinutes) {
      const start = zonedInstant(date, timeOf(minutes));
      const end = addMinutes(start, durationMinutes);
      if (start < earliest) continue;
      // Half-open intervals: touching another booking is not overlapping it.
      if (busy.some((taken) => start < taken.end && taken.start < end)) continue;
      slots.push(start);
    }
  }

  return slots.sort((a, b) => a.getTime() - b.getTime());
}

/** The calendar dates open for booking: today in the shop and the days of the horizon after it. */
export function bookableDates(now: Date, horizonDays: number): string[] {
  const today = businessDate(now);
  return Array.from({ length: horizonDays + 1 }, (_, days) => addDays(today, days));
}
