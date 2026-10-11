import { addDays, businessDate, isoWeekday, zonedInstant } from "@/lib/business-time";
import type { AdminBarber, AdminBooking, AdminTimeOff, Analytics } from "./types";

// The analytics definitions, in TypeScript. The real admin's figures come from
// the database function admin_analytics; the demo has no database, so its
// invented bookings are counted here, by the same rules:
//
//   * a booking belongs to the shop-local date it starts on;
//   * revenue is money recorded for completed visits only;
//   * booked minutes count completed and still-confirmed visits;
//   * available minutes are working hours less approved time off.

const MINUTE = 60_000;

/** Minutes two ranges of time have in common. */
const overlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  Math.max(0, Math.min(aEnd.getTime(), bEnd.getTime()) - Math.max(aStart.getTime(), bStart.getTime())) / MINUTE;

/** A barber's working minutes on the dates from..to, less approved time off and closures. */
export function availableMinutes(barber: AdminBarber, timeOff: AdminTimeOff[], from: string, to: string): number {
  const approved = timeOff.filter((entry) => entry.status === "approved" && (entry.barberId === barber.id || entry.barberId === null));
  let minutes = 0;
  for (let date = from; date <= to; date = addDays(date, 1)) {
    for (const range of barber.hours.filter((candidate) => candidate.weekday === isoWeekday(date))) {
      const start = zonedInstant(date, range.start);
      const end = zonedInstant(date, range.end);
      const length = (end.getTime() - start.getTime()) / MINUTE;
      const off = approved.reduce((sum, entry) => sum + overlap(start, end, entry.startsAt, entry.endsAt), 0);
      minutes += length - Math.min(length, off);
    }
  }
  return Math.round(minutes);
}

export function computeAnalytics(
  bookings: AdminBooking[],
  barbers: AdminBarber[],
  timeOff: AdminTimeOff[],
  from: string,
  to: string,
): Analytics {
  const inRange = bookings.filter((booking) => {
    const date = businessDate(booking.startsAt);
    return date >= from && date <= to;
  });
  const completed = inRange.filter((booking) => booking.status === "completed");
  const paid = completed.filter((booking) => booking.paidCents !== null);

  const byStatus: Analytics["byStatus"] = {};
  for (const booking of inRange) byStatus[booking.status] = (byStatus[booking.status] ?? 0) + 1;

  const services = new Map<string, Analytics["topServices"][number]>();
  for (const booking of completed) {
    for (const service of booking.services) {
      const entry = services.get(service.name.en) ?? { name: service.name, visits: 0, listedCents: 0 };
      entry.visits++;
      entry.listedCents += service.priceCents;
      services.set(service.name.en, entry);
    }
  }

  return {
    from,
    to,
    bookings: inRange.length,
    byStatus,
    paidCents: paid.reduce((sum, booking) => sum + booking.paidCents!, 0),
    payments: paid.length,
    topServices: [...services.values()].sort((a, b) => b.visits - a.visits || a.name.en.localeCompare(b.name.en)),
    barbers: barbers.map((barber) => {
      const own = inRange.filter((booking) => booking.barberId === barber.id);
      const count = (status: AdminBooking["status"]) => own.filter((booking) => booking.status === status).length;
      return {
        id: barber.id,
        name: barber.name,
        completed: count("completed"),
        noShows: count("no_show"),
        cancelled: count("cancelled"),
        bookedMinutes: own
          .filter((booking) => booking.status === "completed" || booking.status === "confirmed")
          .reduce((sum, booking) => sum + booking.totalDurationMinutes, 0),
        availableMinutes: availableMinutes(barber, timeOff, from, to),
        paidCents: own
          .filter((booking) => booking.status === "completed" && booking.paidCents !== null)
          .reduce((sum, booking) => sum + booking.paidCents!, 0),
      };
    }),
  };
}

/** Utilisation as a whole percentage, or null when the barber had no working time in the range. */
export function utilisation(bookedMinutes: number, available: number): number | null {
  return available > 0 ? Math.round((bookedMinutes / available) * 100) : null;
}

/** The preset ranges of the analytics page, as shop-local dates ending today. */
export function presetRange(preset: "today" | "7d" | "30d", today: string): { from: string; to: string } {
  const days = preset === "today" ? 0 : preset === "7d" ? 6 : 29;
  return { from: addDays(today, -days), to: today };
}
