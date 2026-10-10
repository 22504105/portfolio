import { addMinutes, businessDate, zonedInstant } from "@/lib/business-time";
import { eligibleBarbers, totals, type Barber, type Catalog } from "@/lib/catalog";
import type { BookingGateway, Slot } from "./gateway";
import { slotsForDay, type Interval } from "./slots";

// A stand-in for the booking engine, used only when no database is configured,
// so the interface can be looked at with nothing set up. It runs in the
// browser, stores nothing and sends no email. The working hours and slot rules
// are real; the "existing bookings" are invented from the date so that a
// calendar looks lived-in and stays the same from one visit to the next.

/** A small stable hash, for repeatable pseudo-randomness. */
function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** Invented bookings for one barber on one day. */
function inventedBusy(barber: Barber, date: string): Interval[] {
  const busy: Interval[] = [];
  for (const [index, hour] of [10, 11, 12, 13, 15, 16, 17, 18].entries()) {
    const roll = hash(`${barber.id}:${date}:${index}`);
    if (roll % 3 !== 0) continue;
    const start = zonedInstant(date, `${hour}:${roll % 2 === 0 ? "00" : "30"}`);
    busy.push({ start, end: addMinutes(start, 45) });
  }
  return busy;
}

const wait = (milliseconds: number) => new Promise((done) => setTimeout(done, milliseconds));

export function createMockGateway(catalog: Catalog, now: () => Date = () => new Date()): BookingGateway {
  const { policy } = catalog.shop;

  const candidates = (serviceIds: string[], barberId: string | null) =>
    eligibleBarbers(catalog.barbers, serviceIds).filter((barber) => barberId === null || barber.id === barberId);

  const durationOf = (serviceIds: string[]) =>
    totals(catalog.services.filter((service) => serviceIds.includes(service.id))).durationMinutes;

  const availability = (serviceIds: string[], barberId: string | null, date: string): Slot[] => {
    const durationMinutes = durationOf(serviceIds);
    if (durationMinutes === 0) return [];

    const byStart = new Map<string, string[]>();
    for (const barber of candidates(serviceIds, barberId)) {
      const slots = slotsForDay({
        date,
        ranges: barber.hours,
        durationMinutes,
        intervalMinutes: policy.slotIntervalMinutes,
        earliest: addMinutes(now(), policy.minLeadMinutes),
        busy: inventedBusy(barber, date),
      });
      for (const slot of slots) {
        const startsAt = slot.toISOString();
        byStart.set(startsAt, [...(byStart.get(startsAt) ?? []), barber.id]);
      }
    }

    return [...byStart]
      .map(([startsAt, barberIds]) => ({ startsAt, barberIds }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  };

  return {
    async getAvailability({ serviceIds, barberId, date }) {
      await wait(350);
      return availability(serviceIds, barberId, date);
    },

    async createHold({ serviceIds, barberId, startsAt }) {
      await wait(900);
      const slot = availability(serviceIds, barberId, businessDate(new Date(startsAt))).find((candidate) => candidate.startsAt === startsAt);
      if (!slot) return { ok: false, code: "slot_taken" };

      return {
        ok: true,
        reference: `CC${(hash(`${startsAt}:${slot.barberIds[0]}`) % 9000) + 1000}DEMO`.slice(0, 10),
        barberId: slot.barberIds[0],
        expiresAt: addMinutes(now(), policy.holdMinutes).toISOString(),
      };
    },
  };
}
