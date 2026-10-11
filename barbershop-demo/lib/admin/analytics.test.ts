import { describe, expect, it } from "vitest";
import { mockCatalog } from "@/lib/catalog/mock";
import { availableMinutes, computeAnalytics, presetRange, utilisation } from "./analytics";
import { createDemoSource } from "./demo";
import type { AdminBarber, AdminBooking, AdminTimeOff } from "./types";

const barbers: AdminBarber[] = mockCatalog.barbers.map((barber) => ({ ...barber, isActive: true, hasAccount: false }));
const marcus = barbers[0];
let n = 0;

function booking(start: string, minutes: number, status: AdminBooking["status"], paidCents: number | null = null, price = 4500): AdminBooking {
  const startsAt = new Date(start);
  return {
    id: `b${++n}`,
    reference: `R${n}`,
    status,
    startsAt,
    endsAt: new Date(startsAt.getTime() + minutes * 60_000),
    barberId: marcus.id,
    barberName: marcus.name,
    customerName: "Test",
    customerPhone: "1",
    customerEmail: "t@example.com",
    locale: "en",
    source: "web",
    services: [{ name: { en: "Haircut", ru: "Стрижка" }, priceCents: price }],
    totalPriceCents: price,
    totalDurationMinutes: minutes,
    paidCents,
    paidMethod: paidCents === null ? null : "cash",
  };
}

// Monday 5 May to Sunday 11 May 2031, in British Summer Time. The same week,
// with the same bookings, as the database test of admin_analytics.
const week = [
  booking("2031-05-06T10:00+01:00", 45, "completed", 4500),
  booking("2031-05-06T11:00+01:00", 65, "completed", 6000, 6800),
  booking("2031-05-06T15:00+01:00", 45, "no_show"),
  booking("2031-05-07T10:00+01:00", 45, "cancelled"),
  booking("2031-05-07T11:00+01:00", 45, "confirmed"),
  booking("2031-05-13T10:00+01:00", 45, "completed", 4500),
];
const off: AdminTimeOff[] = [
  { id: "1", barberId: marcus.id, barberName: marcus.name, kind: "time_off", status: "approved", startsAt: new Date("2031-05-08T10:00+01:00"), endsAt: new Date("2031-05-08T14:00+01:00"), reason: null },
  { id: "2", barberId: marcus.id, barberName: marcus.name, kind: "time_off", status: "requested", startsAt: new Date("2031-05-09T10:00+01:00"), endsAt: new Date("2031-05-09T20:00+01:00"), reason: null },
];

describe("analytics, by the same definitions as the database", () => {
  const a = computeAnalytics(week, barbers, off, "2031-05-05", "2031-05-11");

  it("counts the bookings of the range by status", () => {
    expect([a.bookings, a.byStatus]).toEqual([5, { completed: 2, no_show: 1, cancelled: 1, confirmed: 1 }]);
  });

  it("counts as revenue only money recorded for completed visits", () => {
    expect([a.paidCents, a.payments]).toEqual([10500, 2]);
  });

  it("counts booked minutes from completed and confirmed visits", () => {
    const row = a.barbers.find((barber) => barber.id === marcus.id)!;
    expect([row.bookedMinutes, row.completed, row.noShows, row.cancelled, row.paidCents]).toEqual([155, 2, 1, 1, 10500]);
  });

  it("takes approved time off, and only approved, out of the available minutes", () => {
    expect(availableMinutes(marcus, off, "2031-05-05", "2031-05-11")).toBe(37 * 60);
    expect(availableMinutes(marcus, [], "2031-05-05", "2031-05-11")).toBe(41 * 60);
  });

  it("closes the shop for everyone on a holiday", () => {
    const holiday: AdminTimeOff[] = [
      { id: "h", barberId: null, barberName: null, kind: "holiday", status: "approved", startsAt: new Date("2031-06-03T00:00+01:00"), endsAt: new Date("2031-06-04T00:00+01:00"), reason: null },
    ];
    expect(barbers.map((barber) => availableMinutes(barber, holiday, "2031-06-03", "2031-06-03"))).toEqual([0, 0, 0, 0]);
  });

  it("gives utilisation as a percentage, and none when there was no working time", () => {
    expect(utilisation(155, 37 * 60)).toBe(7);
    expect(utilisation(0, 0)).toBeNull();
  });

  it("builds the preset ranges back from today", () => {
    expect(presetRange("today", "2031-05-11")).toEqual({ from: "2031-05-11", to: "2031-05-11" });
    expect(presetRange("7d", "2031-05-11")).toEqual({ from: "2031-05-05", to: "2031-05-11" });
    expect(presetRange("30d", "2031-05-11")).toEqual({ from: "2031-04-12", to: "2031-05-11" });
  });
});

describe("demo data", () => {
  // A Wednesday afternoon in London.
  const now = () => new Date("2031-05-07T14:00:00+01:00");
  const demo = createDemoSource(now);

  it("is read-only and the same on every request", async () => {
    expect(demo.readOnly).toBe(true);
    const first = await demo.findBookings({});
    const second = await createDemoSource(now).findBookings({});
    expect(first.length).toBeGreaterThan(50);
    expect(second.map((booking) => booking.id)).toEqual(first.map((booking) => booking.id));
  });

  it("gives every booking a name, and a believable mix of outcomes", async () => {
    const bookings = await demo.findBookings({});
    expect(bookings.filter((booking) => !/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(booking.customerName)).map((booking) => booking.customerName)).toEqual([]);
    expect(bookings.filter((booking) => /undefined|NaN/.test(JSON.stringify(booking)))).toEqual([]);

    // Of the visits whose time has passed, most happened; some were cancelled, a few missed.
    const past = (await demo.bookingsBetween(new Date("2031-04-07T00:00:00Z"), now())).filter((booking) => booking.endsAt <= now());
    const share = (status: string) => past.filter((booking) => booking.status === status).length / past.length;
    expect(past.length).toBeGreaterThan(200);
    expect(share("cancelled")).toBeGreaterThan(0.03);
    expect(share("cancelled")).toBeLessThan(0.2);
    expect(share("no_show")).toBeLessThan(0.12);
    expect(share("completed")).toBeGreaterThan(0.7);
  });

  it("uses only invented contact details", async () => {
    const bookings = await demo.findBookings({});
    expect(bookings.every((booking) => booking.customerEmail.endsWith("@demo.example"))).toBe(true);
    expect(bookings.every((booking) => booking.customerPhone.startsWith("+44 20 7946 0"))).toBe(true);
  });

  it("never lets one barber's visits overlap, and keeps them inside working hours", async () => {
    const bookings = (await demo.bookingsBetween(new Date("2031-04-01T00:00Z"), new Date("2031-06-01T00:00Z"))).filter((booking) => booking.status !== "cancelled");
    for (const barber of barbers) {
      const own = bookings.filter((booking) => booking.barberId === barber.id);
      for (let index = 1; index < own.length; index++) {
        expect(own[index].startsAt.getTime()).toBeGreaterThanOrEqual(own[index - 1].endsAt.getTime());
      }
    }
  });

  it("has no completed visit in the future and no payment without a completed visit", async () => {
    const bookings = await demo.findBookings({});
    expect(bookings.filter((booking) => booking.status === "completed" && booking.endsAt > now())).toEqual([]);
    expect(bookings.filter((booking) => booking.paidCents !== null && booking.status !== "completed")).toEqual([]);
    expect(bookings.some((booking) => booking.status === "completed" && booking.paidCents === null)).toBe(true);
  });

  it("gives figures that add up", async () => {
    const a = await demo.analytics("2031-04-08", "2031-05-07");
    expect(a.bookings).toBe(Object.values(a.byStatus).reduce((sum, count) => sum + count, 0));
    expect(a.paidCents).toBe(a.barbers.reduce((sum, barber) => sum + barber.paidCents, 0));
    expect(a.barbers.every((barber) => barber.bookedMinutes <= barber.availableMinutes)).toBe(true);
  });

  it("filters and finds", async () => {
    const cancelled = await demo.findBookings({ status: "cancelled" });
    expect(cancelled.length).toBeGreaterThan(0);
    expect(cancelled.every((booking) => booking.status === "cancelled")).toBe(true);
    const [one] = await demo.findBookings({});
    expect((await demo.findBookings({ search: one.reference })).map((booking) => booking.id)).toEqual([one.id]);
    expect((await demo.booking(one.id))?.booking.reference).toBe(one.reference);
    expect(await demo.booking("nope")).toBeNull();
  });
});
