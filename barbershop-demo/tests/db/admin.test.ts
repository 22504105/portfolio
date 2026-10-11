import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "./harness";

let t: TestDatabase;
const services: Record<string, string> = {};
const barbers: Record<string, string> = {};
let n = 0;

type Result = { ok: boolean; code?: string; [key: string]: unknown };
const call = async (sql: string, params: unknown[]): Promise<Result> => (await t.db.query(`select ${sql} as r`, params)).rows[0].r;
const row = async (sql: string, params: unknown[] = []) => (await t.db.query(sql, params)).rows[0];

/** A booking written straight into the table, at a fixed London time, in any state. */
async function seedBooking(barber: string, startsAt: string, minutes: number, status: string, priceCents = 4500, serviceSlug = "haircut") {
  const customer = (await row("insert into public.customers (email) values ($1) returning id", [`admin-test-${++n}@example.com`])).id;
  const id = (
    await row(
      `insert into public.bookings (reference, barber_id, customer_id, customer_name, customer_phone, starts_at, ends_at, status,
                                    hold_expires_at, total_price_cents, total_duration_minutes)
       values ($1, $2, $3, 'Test', '+44 20 7946 0000', $4::timestamptz, $4::timestamptz + make_interval(mins => $5::int), $6::public.booking_status,
               case when $6::text = 'pending' then now() + interval '15 minutes' end, $7, $5::int)
       returning id`,
      [`AD${String(n).padStart(6, "0")}`, barbers[barber], customer, startsAt, minutes, status, priceCents],
    )
  ).id as string;
  await t.db.query(
    `insert into public.booking_services (booking_id, service_id, position, name_en, name_ru, price_cents, duration_minutes)
     select $1::uuid, id, 1, name_en, name_ru, $3::int, $4::int from public.services where slug = $2`,
    [id, serviceSlug, priceCents, minutes],
  );
  return id;
}

const pay = (id: string, cents: number, method = "cash") => call("public.record_payment($1, $2, $3, null, null)", [id, cents, method]);

beforeAll(async () => {
  t = await startTestDatabase();
  for (const r of (await t.db.query("select id, slug from public.services")).rows) services[r.slug] = r.id;
  for (const r of (await t.db.query("select id, slug from public.barbers")).rows) barbers[r.slug] = r.id;
}, 120_000);

afterAll(async () => {
  await t?.stop();
});

describe("a booking made by staff", () => {
  const book = (serviceSlugs: string[], barber: string, startsAt: string, email = `walkin-${++n}@example.com`) =>
    call("public.create_admin_booking($1, $2, $3, 'Walk In', $4, '+44 20 7946 0000', 'en', null)", [
      serviceSlugs.map((slug) => services[slug]), barbers[barber], startsAt, email,
    ]);

  /** A free start for a barber some days ahead, by the real clock. */
  async function freeSlot(barber: string, fromDay = 4) {
    for (let day = fromDay; day < 28; day++) {
      const date = new Date(Date.now() + day * 86_400_000).toISOString().slice(0, 10);
      const { rows } = await t.db.query("select slot_start from public.get_availability($1, $2, $3)", [[services.haircut], barbers[barber], date]);
      if (rows.length) return (rows[0].slot_start as Date).toISOString();
    }
    throw new Error("no slot");
  }

  it("is confirmed at once, with no hold and no verification email", async () => {
    const start = await freeSlot("marcus-hale");
    const result = await book(["haircut", "beard-trim"], "marcus-hale", start);
    expect(result.ok).toBe(true);

    const booking = await row("select status, source, hold_expires_at, total_price_cents, total_duration_minutes from public.bookings where id = $1", [result.booking_id]);
    expect(booking).toEqual({ status: "confirmed", source: "admin", hold_expires_at: null, total_price_cents: 7300, total_duration_minutes: 70 });
    const jobs = (await t.db.query("select type from public.notification_jobs where booking_id = $1 order by type", [result.booking_id])).rows.map((r) => r.type);
    expect(jobs).toEqual(["confirmation", "reminder_24h", "reminder_2h"]);
    const event = await row("select type, to_status, actor from public.booking_events where booking_id = $1", [result.booking_id]);
    expect(event).toEqual({ type: "created", to_status: "confirmed", actor: "admin" });
  });

  it("takes the slot like any other booking, and respects one that is taken", async () => {
    const start = await freeSlot("leon-fischer");
    expect((await book(["haircut"], "leon-fischer", start)).ok).toBe(true);
    expect((await book(["haircut"], "leon-fischer", start)).code).toBe("slot_taken");
    const online = await call("public.create_booking_hold($1, $2, $3, 'Guest', 'g@example.com', '+44 20 7946 0000', 'en')", [[services.haircut], barbers["leon-fischer"], start]);
    expect(online.code).toBe("slot_taken");
  });

  it("holds to working hours, the grid, eligibility and the horizon, but not to the two-hour lead", async () => {
    const start = await freeSlot("theo-okafor");
    const shifted = (minutes: number) => new Date(new Date(start).getTime() + minutes * 60_000).toISOString();
    expect((await book(["haircut"], "theo-okafor", shifted(10))).code).toBe("off_grid");
    expect((await book(["hot-towel-shave"], "theo-okafor", start)).code).toBe("not_eligible");
    expect((await book(["haircut"], "theo-okafor", shifted(60 * 24 * 60))).code).toBe("outside_horizon");
    expect((await book(["haircut"], "theo-okafor", new Date(start.slice(0, 10) + "T03:00:00Z").toISOString())).code).toBe("slot_taken");
    expect((await book(["haircut"], "theo-okafor", new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 13) + ":00:00Z")).code).toBe("in_the_past");

    // A walk-in within the two hours that an online customer must leave.
    const soon = (
      await t.db.query(
        `select d.slot_start, d.free_barbers from generate_series(0, 6) as day
         cross join lateral public.get_availability($1, null, (now() at time zone 'Europe/London')::date + day, now() - interval '2 hours') as d
         where d.slot_start > now() and d.slot_start < now() + interval '2 hours' limit 1`,
        [[services["buzz-cut"]]],
      )
    ).rows[0];
    // Only when the shop happens to be open in the next two hours as the test runs.
    if (soon) {
      const free = await row(
        "select b.slug from public.barbers b where b.id = any($1::uuid[]) order by b.sort_order limit 1",
        [soon.free_barbers],
      );
      expect((await book(["buzz-cut"], free.slug, soon.slot_start.toISOString())).ok).toBe(true);
    }
  });

  it("is not callable through the API", async () => {
    const code = await t.as("authenticated", null, async (db) => {
      try {
        await db.query("select public.create_admin_booking('{}', null, now(), 'x', 'x@example.com', '1234567', 'en', null)");
        return null;
      } catch (error) {
        return (error as { code: string }).code;
      }
    });
    expect(code).toBe("42501");
  });
});

describe("payments at the counter", () => {
  it("records a payment for a completed visit and marks it paid", async () => {
    const id = await seedBooking("marcus-hale", "2031-03-04T10:00+00", 45, "completed");
    expect((await pay(id, 4500)).ok).toBe(true);
    expect(await row("select amount_cents, method from public.payment_records where booking_id = $1", [id])).toEqual({ amount_cents: 4500, method: "cash" });
    expect((await row("select payment_status from public.bookings where id = $1", [id])).payment_status).toBe("paid");
  });

  it("corrects a payment instead of adding a second one", async () => {
    const id = await seedBooking("marcus-hale", "2031-03-04T11:00+00", 45, "completed");
    await pay(id, 4500);
    await pay(id, 5000, "card_terminal");
    const records = await t.db.query("select amount_cents, method from public.payment_records where booking_id = $1", [id]);
    expect(records.rows).toEqual([{ amount_cents: 5000, method: "card_terminal" }]);
  });

  it("refuses payment for a visit that did not happen", async () => {
    for (const status of ["confirmed", "cancelled", "no_show", "pending"]) {
      const id = await seedBooking("leon-fischer", `2031-03-0${["confirmed", "cancelled", "no_show", "pending"].indexOf(status) + 4}T12:00+00`, 45, status);
      expect((await pay(id, 4500)).code).toBe("not_completed");
    }
    expect((await pay("00000000-0000-0000-0000-000000000000", 4500)).code).toBe("not_found");
  });

  it("refuses amounts and methods that make no sense", async () => {
    const id = await seedBooking("marcus-hale", "2031-03-04T12:00+00", 45, "completed");
    expect((await pay(id, -1)).code).toBe("invalid");
    expect((await pay(id, 4500, "barter")).code).toBe("invalid");
  });

  it("can be removed, leaving the visit unpaid and the history intact", async () => {
    const id = await seedBooking("marcus-hale", "2031-03-04T15:00+00", 45, "completed");
    await pay(id, 4500);
    expect((await call("public.remove_payment($1, null)", [id])).ok).toBe(true);
    expect((await row("select payment_status from public.bookings where id = $1", [id])).payment_status).toBe("unpaid");
    const events = (await t.db.query("select type from public.booking_events where booking_id = $1 order by id", [id])).rows.map((r) => r.type);
    expect(events).toEqual(["payment_recorded", "payment_removed"]);
  });

  it("drops the payment when an admin changes the outcome to missed", async () => {
    // In the past: an outcome can only be recorded for a visit that has started.
    const id = await seedBooking("marcus-hale", "2025-03-04T16:00+00", 45, "completed");
    await pay(id, 4500);
    expect((await call("public.close_booking($1, 'no_show', 'admin', null, null)", [id])).ok).toBe(true);
    expect((await row("select count(*)::int as n from public.payment_records where booking_id = $1", [id])).n).toBe(0);
    expect((await row("select payment_status from public.bookings where id = $1", [id])).payment_status).toBe("unpaid");
  });
});

describe("decisions on time off", () => {
  const request = async (barber: string, start: string, end: string) =>
    (await row("insert into public.time_off (barber_id, kind, status, starts_at, ends_at) values ($1, 'time_off', 'requested', $2, $3) returning id", [barbers[barber], start, end])).id as string;
  const decide = (id: string, approve: boolean) => call("public.decide_time_off($1, $2, null)", [id, approve]);

  it("approves a request, which then blocks the time", async () => {
    const id = await request("theo-okafor", "2031-04-08T00:00+01", "2031-04-09T00:00+01");
    const before = await t.db.query("select 1 from public.get_availability($1, $2, '2031-04-08', '2031-04-01T08:00Z')", [[services.haircut], barbers["theo-okafor"]]);
    expect(before.rowCount).toBeGreaterThan(0);
    expect(await decide(id, true)).toMatchObject({ ok: true, status: "approved" });
    const after = await t.db.query("select 1 from public.get_availability($1, $2, '2031-04-08', '2031-04-01T08:00Z')", [[services.haircut], barbers["theo-okafor"]]);
    expect(after.rowCount).toBe(0);
  });

  it("declines a request, which blocks nothing", async () => {
    const id = await request("theo-okafor", "2031-04-10T00:00+01", "2031-04-11T00:00+01");
    expect(await decide(id, false)).toMatchObject({ ok: true, status: "rejected" });
    const after = await t.db.query("select 1 from public.get_availability($1, $2, '2031-04-10', '2031-04-01T08:00Z')", [[services.haircut], barbers["theo-okafor"]]);
    expect(after.rowCount).toBeGreaterThan(0);
  });

  it("will not approve over an appointment, and decides only once", async () => {
    await seedBooking("leon-fischer", "2031-04-15T11:00+01", 45, "confirmed");
    const blocked = await request("leon-fischer", "2031-04-15T00:00+01", "2031-04-16T00:00+01");
    expect((await decide(blocked, true)).code).toBe("has_bookings");
    expect((await decide(blocked, false)).ok).toBe(true);
    expect((await decide(blocked, true)).code).toBe("already_decided");
  });
});

describe("analytics", () => {
  // A week of May 2031 that nothing else in this file touches. Monday 5 May to Sunday 11 May.
  const analytics = async (from: string, to: string) => (await row("select public.admin_analytics($1, $2) as a", [from, to])).a;

  beforeAll(async () => {
    // Marcus: two completed (one paid in full, one paid less than listed), one missed, one cancelled, one still confirmed.
    const paidFull = await seedBooking("marcus-hale", "2031-05-06T10:00+01", 45, "completed", 4500, "haircut");
    const paidLess = await seedBooking("marcus-hale", "2031-05-06T11:00+01", 65, "completed", 6800, "haircut-and-beard");
    await seedBooking("marcus-hale", "2031-05-06T15:00+01", 45, "no_show", 4500, "haircut");
    await seedBooking("marcus-hale", "2031-05-07T10:00+01", 45, "cancelled", 4500, "haircut");
    await seedBooking("marcus-hale", "2031-05-07T11:00+01", 45, "confirmed", 4500, "haircut");
    // Leon: one completed, not paid.
    await seedBooking("leon-fischer", "2031-05-06T10:00+01", 45, "completed", 4500, "haircut");
    // An expired hold, and a booking outside the range.
    await seedBooking("theo-okafor", "2031-05-06T10:00+01", 45, "expired", 4500, "haircut");
    await seedBooking("marcus-hale", "2031-05-13T10:00+01", 45, "completed", 4500, "haircut");
    await pay(paidFull, 4500);
    await pay(paidLess, 6000);
    // Marcus takes Thursday morning off: 4 working hours fewer.
    await t.db.query("insert into public.time_off (barber_id, kind, status, starts_at, ends_at) values ($1, 'time_off', 'approved', '2031-05-08T10:00+01', '2031-05-08T14:00+01')", [barbers["marcus-hale"]]);
    // A request that was never approved takes nothing away.
    await t.db.query("insert into public.time_off (barber_id, kind, status, starts_at, ends_at) values ($1, 'time_off', 'requested', '2031-05-09T10:00+01', '2031-05-09T20:00+01')", [barbers["marcus-hale"]]);
  });

  it("counts bookings by status for the dates asked", async () => {
    const a = await analytics("2031-05-05", "2031-05-11");
    expect(a.bookings).toBe(7);
    expect(a.by_status).toEqual({ completed: 3, no_show: 1, cancelled: 1, confirmed: 1, expired: 1 });
  });

  it("counts as revenue only money recorded for completed visits", async () => {
    const a = await analytics("2031-05-05", "2031-05-11");
    // 45.00 + 60.00. Leon's completed visit has no payment and adds nothing; the listed 68.00 is not used.
    expect([a.paid_cents, a.payments]).toEqual([10500, 2]);
  });

  it("ranks services by completed visits", async () => {
    const a = await analytics("2031-05-05", "2031-05-11");
    expect(a.top_services).toEqual([
      { name_en: "Haircut", name_ru: "Стрижка", visits: 2, listed_cents: 9000 },
      { name_en: "Haircut & Beard", name_ru: "Стрижка и борода", visits: 1, listed_cents: 6800 },
    ]);
  });

  it("works out each barber's utilisation from working hours less approved time off", async () => {
    const a = await analytics("2031-05-05", "2031-05-11");
    const marcus = a.barbers.find((barber: { name: string }) => barber.name === "Marcus Hale");
    // Tue-Thu 8h, Fri 9h, Sat 8h = 41h, less 4h off on Thursday = 37h.
    expect(marcus).toMatchObject({ completed: 2, no_shows: 1, cancelled: 1, paid_cents: 10500, available_minutes: 37 * 60 });
    // Completed 45 + 65 and the confirmed 45. The missed and the cancelled visits add nothing.
    expect(marcus.booked_minutes).toBe(155);

    const leon = a.barbers.find((barber: { name: string }) => barber.name === "Leon Fischer");
    expect(leon).toMatchObject({ completed: 1, paid_cents: 0, booked_minutes: 45, available_minutes: (8 + 7 + 9 + 8) * 60 });
    expect(a.barbers.map((barber: { name: string }) => barber.name)).toEqual(["Marcus Hale", "Daniyar Akhmetov", "Theo Okafor", "Leon Fischer"]);
  });

  it("puts a booking on its London date", async () => {
    // 00:30 on 12 May in London is still 11 May in UTC.
    await seedBooking("daniyar-akhmetov", "2031-05-11T23:30Z", 30, "completed", 3000, "buzz-cut");
    expect((await analytics("2031-05-12", "2031-05-12")).bookings).toBe(1);
    expect((await analytics("2031-05-05", "2031-05-11")).bookings).toBe(7);
  });

  it("answers with zeros for a range with nothing in it", async () => {
    const a = await analytics("2032-01-01", "2032-01-07");
    expect([a.bookings, a.by_status, a.paid_cents, a.top_services]).toEqual([0, {}, 0, []]);
    expect(a.barbers.length).toBe(4);
  });

  it("shuts the shop for everyone on a holiday", async () => {
    await t.db.query("insert into public.time_off (kind, status, starts_at, ends_at) values ('holiday', 'approved', '2031-06-03T00:00+01', '2031-06-04T00:00+01')");
    const a = await analytics("2031-06-03", "2031-06-03");
    expect(a.barbers.every((barber: { available_minutes: number }) => barber.available_minutes === 0)).toBe(true);
  });
});
