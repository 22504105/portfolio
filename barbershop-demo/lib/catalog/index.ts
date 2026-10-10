import { mockCatalog } from "./mock";
import type { Barber, Catalog, Service, WorkingRange } from "./types";

export type * from "./types";

/**
 * The shop's catalog. Phase 02 serves a constant; Phase 03 reads the database
 * behind this same function, so callers already treat it as asynchronous.
 */
export async function getCatalog(): Promise<Catalog> {
  return mockCatalog;
}

/** Barbers who can deliver every one of the given services. */
export function eligibleBarbers(barbers: Barber[], serviceIds: string[]): Barber[] {
  return barbers.filter((barber) => serviceIds.every((id) => barber.serviceIds.includes(id)));
}

/** Price and duration of several services taken one after another. */
export function totals(services: Service[]): { priceCents: number; durationMinutes: number } {
  return services.reduce(
    (sum, service) => ({
      priceCents: sum.priceCents + service.priceCents,
      durationMinutes: sum.durationMinutes + service.durationMinutes,
    }),
    { priceCents: 0, durationMinutes: 0 },
  );
}

export type OpeningHours = {
  /** ISO day of week: 1 is Monday, 7 is Sunday. */
  weekday: number;
  /** Earliest start and latest end among the barbers; null when the shop is closed. */
  open: string | null;
  close: string | null;
};

/** The shop's opening hours for each day of the week, from the barbers' hours. */
export function openingHours(barbers: Barber[]): OpeningHours[] {
  const ranges: WorkingRange[] = barbers.flatMap((barber) => barber.hours);

  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const today = ranges.filter((range) => range.weekday === weekday);
    if (today.length === 0) return { weekday, open: null, close: null };
    // "HH:MM" strings sort as times do.
    return {
      weekday,
      open: today.map((range) => range.start).sort()[0],
      close: today.map((range) => range.end).sort().at(-1)!,
    };
  });
}

/** The ISO weekdays a barber works on. */
export function workingDays(barber: Barber): number[] {
  return [...new Set(barber.hours.map((range) => range.weekday))].sort();
}
