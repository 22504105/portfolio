import { addDays, addMinutes, businessDate, isoWeekday, zonedInstant } from "@/lib/business-time";
import { mockCatalog } from "@/lib/catalog/mock";
import { computeAnalytics } from "./analytics";
import type { AdminBarber, AdminBooking, AdminClient, AdminSource, AdminTimeOff, BookingEvent, BookingStatus } from "./types";

// The public demo's data: invented, in memory, the same for every visitor and
// rebuilt from the calendar on each request. It reads no database, holds no
// real person's details, sends no email and has nothing that can be changed —
// there is no path from here to the real shop, because there is no connection.

/** A small stable hash, for repeatable pseudo-randomness. */
function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

// Invented people. No name here belongs to a customer of anything.
const FIRST = ["Oliver", "Amir", "Jonas", "Tariq", "Felix", "Mateo", "Idris", "Hugo", "Kenji", "Lukas", "Samir", "Noah", "Elias", "Dmitri", "Arlo", "Yusuf"];
const LAST = ["Whitlock", "Banerjee", "Okonkwo", "Lindqvist", "Marlowe", "Castellan", "Abernathy", "Voss", "Tanaka", "Delacroix", "Hartwell", "Nakamura"];

const person = (seed: number) => {
  const first = FIRST[seed % FIRST.length];
  const last = LAST[Math.floor(seed / FIRST.length) % LAST.length];
  return {
    name: `${first} ${last}`,
    email: `${first}.${last}`.toLowerCase() + "@demo.example",
    // From the range Ofcom reserves for drama: these numbers reach nobody.
    phone: `+44 20 7946 0${String(100 + (seed % 900))}`,
  };
};

const barbers: AdminBarber[] = mockCatalog.barbers.map((barber) => ({ ...barber, isActive: true, hasAccount: true }));

/** Minutes since midnight of an "HH:MM". */
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const timeOf = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** The invented bookings of one barber on one date. */
function dayOf(barber: AdminBarber, date: string, now: Date): AdminBooking[] {
  const made: AdminBooking[] = [];
  const offered = mockCatalog.services.filter((service) => barber.serviceIds.includes(service.id));

  for (const range of barber.hours.filter((candidate) => candidate.weekday === isoWeekday(date))) {
    let cursor = minutesOf(range.start);
    const close = minutesOf(range.end);

    for (let slot = 0; cursor < close; slot++) {
      // Unsigned throughout: every piece taken from it below uses `>>>` and `%` on a non-negative number.
      const roll = hash(`${barber.id}:${date}:${range.start}:${slot}`);
      const service = offered[roll % offered.length];
      const second = roll % 7 === 0 ? offered[(roll >>> 3) % offered.length] : null;
      const services = second && second.id !== service.id ? [service, second] : [service];
      const duration = services.reduce((sum, item) => sum + item.durationMinutes, 0);
      // About one slot in four stays empty.
      if (roll % 4 === 3 || cursor + duration > close) {
        cursor += 30;
        continue;
      }

      const startsAt = zonedInstant(date, timeOf(cursor));
      const endsAt = addMinutes(startsAt, duration);
      const price = services.reduce((sum, item) => sum + item.priceCents, 0);
      const who = person(roll >>> 5);
      const past = endsAt <= now;
      const fate = (roll >>> 9) % 100;
      const status: BookingStatus = fate < 9 ? "cancelled" : !past ? "confirmed" : fate < 15 ? "no_show" : "completed";
      // Most completed visits have a payment recorded; a few are still to be entered, one in ten was discounted.
      const paid = status === "completed" && fate % 11 !== 0;

      made.push({
        // The start time is part of the id: a day has several working ranges, each with its own slots.
        id: `demo-${barber.slug}-${date}-${timeOf(cursor).replace(":", "")}`,
        reference: `D${String(roll % 9_000_000).padStart(7, "0")}`,
        status,
        startsAt,
        endsAt,
        barberId: barber.id,
        barberName: barber.name,
        customerName: who.name,
        customerPhone: who.phone,
        customerEmail: who.email,
        locale: roll % 5 === 0 ? "ru" : "en",
        source: roll % 6 === 0 ? "admin" : "web",
        services: services.map((item) => ({ name: item.name, priceCents: item.priceCents })),
        totalPriceCents: price,
        totalDurationMinutes: duration,
        paidCents: paid ? (fate % 10 === 3 ? price - 500 : price) : null,
        paidMethod: paid ? (roll % 3 === 0 ? "cash" : "card_terminal") : null,
      });
      // Visits sit on the half-hour grid.
      cursor += Math.ceil(duration / 30) * 30;
    }
  }
  return made;
}

/** Thirty days back and a week ahead, as the real admin would have. */
function allBookings(now: Date): AdminBooking[] {
  const today = businessDate(now);
  const bookings: AdminBooking[] = [];
  for (let offset = -30; offset <= 7; offset++) {
    const date = addDays(today, offset);
    if (timeOff(now).some((entry) => entry.kind === "holiday" && businessDate(entry.startsAt) === date)) continue;
    for (const barber of barbers) bookings.push(...dayOf(barber, date, now));
  }
  return bookings.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function timeOff(now: Date): AdminTimeOff[] {
  const today = businessDate(now);
  const day = (offset: number, time = "00:00") => zonedInstant(addDays(today, offset), time);
  return [
    { id: "demo-off-1", barberId: barbers[2].id, barberName: barbers[2].name, kind: "time_off", status: "requested", startsAt: day(12), endsAt: day(15), reason: "Family visit" },
    { id: "demo-off-2", barberId: barbers[0].id, barberName: barbers[0].name, kind: "time_off", status: "approved", startsAt: day(9), endsAt: day(10), reason: null },
    { id: "demo-off-3", barberId: null, barberName: null, kind: "holiday", status: "approved", startsAt: day(-12), endsAt: day(-11), reason: "Shop closed for refitting" },
  ];
}

const visible = (booking: AdminBooking) => booking.status !== "pending" && booking.status !== "expired";

export function createDemoSource(now: () => Date = () => new Date()): AdminSource {
  const bookings = () => allBookings(now());

  return {
    readOnly: true,
    shop: async () => mockCatalog.shop,
    services: async () => mockCatalog.services.map((service) => ({ ...service, isActive: true })),
    barbers: async () => barbers,

    bookingsBetween: async (from, to) => bookings().filter((booking) => visible(booking) && booking.startsAt < to && booking.endsAt > from),

    findBookings: async ({ status, search }) => {
      const needle = search?.trim().toLowerCase();
      return bookings()
        .filter((booking) => !status || booking.status === status)
        .filter(
          (booking) =>
            !needle ||
            [booking.reference, booking.customerName, booking.customerPhone, booking.customerEmail].some((field) =>
              field.toLowerCase().includes(needle),
            ),
        )
        .reverse()
        .slice(0, 200);
    },

    booking: async (id) => {
      const booking = bookings().find((candidate) => candidate.id === id);
      if (!booking) return null;
      const events: BookingEvent[] = [
        { at: addMinutes(booking.startsAt, -3 * 24 * 60), type: "created", actor: booking.source === "admin" ? "admin" : "guest", fromStatus: null, toStatus: booking.source === "admin" ? "confirmed" : "pending" },
      ];
      if (booking.source === "web") events.push({ at: addMinutes(booking.startsAt, -3 * 24 * 60 + 4), type: "confirmed", actor: "guest", fromStatus: "pending", toStatus: "confirmed" });
      if (booking.status === "cancelled") events.push({ at: addMinutes(booking.startsAt, -30 * 60), type: "cancelled", actor: "guest", fromStatus: "confirmed", toStatus: "cancelled" });
      if (booking.status === "completed" || booking.status === "no_show") events.push({ at: addMinutes(booking.endsAt, 5), type: booking.status, actor: "barber", fromStatus: "confirmed", toStatus: booking.status });
      if (booking.paidCents !== null) events.push({ at: addMinutes(booking.endsAt, 8), type: "payment_recorded", actor: "admin", fromStatus: null, toStatus: null });
      return { booking, events };
    },

    awaitingOutcome: async () => [],
    timeOff: async () => timeOff(now()).filter((entry) => entry.endsAt > now()),

    clients: async () => {
      const clients = new Map<string, AdminClient>();
      const moment = now();
      for (const booking of bookings()) {
        const client = clients.get(booking.customerEmail) ?? {
          email: booking.customerEmail,
          name: booking.customerName,
          phone: booking.customerPhone,
          hasAccount: hash(booking.customerEmail) % 3 === 0,
          visits: 0,
          noShows: 0,
          lastVisit: null,
          nextVisit: null,
        };
        if (booking.status === "completed") {
          client.visits++;
          client.lastVisit = booking.startsAt;
        }
        if (booking.status === "no_show") client.noShows++;
        if (booking.status === "confirmed" && booking.startsAt > moment && !client.nextVisit) client.nextVisit = booking.startsAt;
        clients.set(booking.customerEmail, client);
      }
      return [...clients.values()].sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name));
    },

    analytics: async (from, to) => computeAnalytics(bookings(), barbers, timeOff(now()), from, to),
  };
}
