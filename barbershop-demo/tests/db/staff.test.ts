import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, businessDate, zonedInstant } from "@/lib/business-time";
import { startTestDatabase, type TestDatabase } from "./harness";

let t: TestDatabase;
const services: Record<string, string> = {};
const barbers: Record<string, string> = {};
let people = 0;

type Result = { ok: boolean; code?: string; [key: string]: unknown };
const call = async (sql: string, params: unknown[]): Promise<Result> => (await t.db.query(`select ${sql} as r`, params)).rows[0].r;

async function user(email: string, confirmed = true) {
  const { rows } = await t.db.query(
    "insert into auth.users (email, email_confirmed_at) values ($1, case when $2 then now() end) returning id",
    [email, confirmed],
  );
  return rows[0].id as string;
}

/** A confirmed booking for a barber, starting some hours from now (negative: in the past). */
async function booking(barber: string, hoursFromNow: number, email = `staff-test-${++people}@example.com`) {
  const customer = (
    await t.db.query(
      "insert into public.customers (email) values ($1) on conflict (email) do update set updated_at = now() returning id",
      [email],
    )
  ).rows[0].id;
  const { rows } = await t.db.query(
    `insert into public.bookings (reference, barber_id, customer_id, customer_name, customer_phone, starts_at, ends_at,
                                  status, total_price_cents, total_duration_minutes, confirmed_at)
     values ($1, $2, $3, 'Test Guest', '+44 20 7946 0000', now() + make_interval(mins => $4), now() + make_interval(mins => $4 + 45),
             'confirmed', 4500, 45, now())
     returning id`,
    [`ST${String(++people).padStart(6, "0")}`, barbers[barber], customer, Math.round(hoursFromNow * 60)],
  );
  return rows[0].id as string;
}

const status = async (id: string) => (await t.db.query("select status from public.bookings where id = $1", [id])).rows[0].status;
const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();
/**
 * A London clock time some days from today. Breaks must fall inside one London
 * day, so their tests name a time of day: "so many hours from now" lands on
 * midnight at some hour of the night the tests are run.
 */
const at = (days: number, time: string) => zonedInstant(addDays(businessDate(new Date()), days), time).toISOString();
const hoursUntil = (instant: string) => (new Date(instant).getTime() - Date.now()) / 3_600_000;

beforeAll(async () => {
  t = await startTestDatabase();
  for (const row of (await t.db.query("select id, slug from public.services")).rows) services[row.slug] = row.id;
  for (const row of (await t.db.query("select id, slug from public.barbers")).rows) barbers[row.slug] = row.id;
}, 120_000);

afterAll(async () => {
  await t?.stop();
});

describe("linking an account to its bookings", () => {
  it("ties a confirmed address to the bookings made with it as a guest", async () => {
    const id = await booking("marcus-hale", 48, "returning@example.com");
    const account = await user("Returning@Example.com");
    const customer = (await t.db.query("select public.link_customer_account($1) as id", [account])).rows[0].id;
    expect(customer).not.toBeNull();

    const seen = await t.as("authenticated", account, (db) => db.query("select id from public.bookings"));
    expect(seen.rows.map((row) => row.id)).toEqual([id]);
  });

  it("does not link an address that has not been confirmed", async () => {
    await booking("marcus-hale", 50, "victim@example.com");
    const impostor = await user("victim@example.com", false);
    expect((await t.db.query("select public.link_customer_account($1) as id", [impostor])).rows[0].id).toBeNull();
    const seen = await t.as("authenticated", impostor, (db) => db.query("select id from public.bookings"));
    expect(seen.rowCount).toBe(0);
  });

  it("creates the customer record for an account that has never booked", async () => {
    const account = await user("newcomer@example.com");
    await t.db.query("select public.link_customer_account($1)", [account]);
    const row = await t.db.query("select profile_id, email_verified_at is not null as verified from public.customers where email = 'newcomer@example.com'");
    expect(row.rows[0]).toEqual({ profile_id: account, verified: true });
  });

  it("is safe to repeat, and does not take a record that belongs to another account", async () => {
    const first = await user("shared@example.com");
    await t.db.query("select public.link_customer_account($1)", [first]);
    await t.db.query("select public.link_customer_account($1)", [first]);
    expect((await t.db.query("select count(*)::int as n from public.customers where email = 'shared@example.com'")).rows[0].n).toBe(1);

    // Cannot happen through sign-up, where addresses are unique, but the function holds anyway.
    await t.db.query("update auth.users set email = 'old-shared@example.com' where id = $1", [first]);
    const second = await user("shared@example.com");
    expect((await t.db.query("select public.link_customer_account($1) as id", [second])).rows[0].id).toBeNull();
    expect((await t.db.query("select profile_id from public.customers where email = 'shared@example.com'")).rows[0].profile_id).toBe(first);
  });
});

describe("closing an appointment", () => {
  const close = (id: string, outcome: string, barber: string | null, actor = barber ? "barber" : "admin") =>
    call("public.close_booking($1, $2, $3, null, $4)", [id, outcome, actor, barber ? barbers[barber] : null]);

  it("lets a barber mark their own past appointment completed or missed", async () => {
    const came = await booking("marcus-hale", -2);
    const missed = await booking("marcus-hale", -4);
    expect((await close(came, "completed", "marcus-hale")).ok).toBe(true);
    expect((await close(missed, "no_show", "marcus-hale")).ok).toBe(true);
    expect([await status(came), await status(missed)]).toEqual(["completed", "no_show"]);
    const events = await t.db.query("select type, from_status, to_status, actor from public.booking_events where booking_id = $1", [came]);
    expect(events.rows).toEqual([{ type: "completed", from_status: "confirmed", to_status: "completed", actor: "barber" }]);
  });

  it("does not assume a completed visit was paid", async () => {
    const id = await booking("marcus-hale", -3);
    await close(id, "completed", "marcus-hale");
    const row = await t.db.query("select payment_status from public.bookings where id = $1", [id]);
    expect(row.rows[0].payment_status).toBe("unpaid");
    expect((await t.db.query("select count(*)::int as n from public.payment_records where booking_id = $1", [id])).rows[0].n).toBe(0);
  });

  it("refuses an appointment that has not started", async () => {
    const id = await booking("marcus-hale", 5);
    expect(await close(id, "completed", "marcus-hale")).toEqual({ ok: false, code: "too_early" });
    expect(await close(id, "no_show", "marcus-hale")).toEqual({ ok: false, code: "too_early" });
  });

  it("hides other barbers' appointments from a barber", async () => {
    const id = await booking("leon-fischer", -2);
    expect(await close(id, "completed", "marcus-hale")).toEqual({ ok: false, code: "not_found" });
    expect(await close("00000000-0000-0000-0000-000000000000", "completed", "marcus-hale")).toEqual({ ok: false, code: "not_found" });
    expect(await status(id)).toBe("confirmed");
  });

  it("lets only an admin correct an outcome", async () => {
    const id = await booking("theo-okafor", -2);
    await close(id, "no_show", "theo-okafor");
    expect((await close(id, "completed", "theo-okafor")).code).toBe("not_changeable");
    expect((await close(id, "completed", null)).ok).toBe(true);
    expect(await status(id)).toBe("completed");
  });

  it("refuses anything but the two outcomes, and anything already cancelled", async () => {
    const id = await booking("theo-okafor", -2);
    expect((await close(id, "cancelled", "theo-okafor")).code).toBe("invalid");
    await t.db.query("update public.bookings set status = 'cancelled' where id = $1", [id]);
    expect((await close(id, "completed", null)).code).toBe("not_changeable");
  });

  it("withdraws reminders that have not gone out", async () => {
    const id = await booking("daniyar-akhmetov", -1);
    await t.db.query(
      "insert into public.notification_jobs (booking_id, type, due_at, idempotency_key) values ($1, 'reminder_2h', now(), $2)",
      [id, `${id}:reminder_2h:test`],
    );
    await close(id, "completed", "daniyar-akhmetov");
    expect((await t.db.query("select status from public.notification_jobs where booking_id = $1", [id])).rows[0].status).toBe("cancelled");
  });
});

describe("breaks and time off", () => {
  const add = (barber: string | null, kind: string, start: string, end: string, byAdmin = false) =>
    call("public.add_time_off($1, $2, $3, $4, 'test', null, $5)", [barber ? barbers[barber] : null, kind, start, end, byAdmin]);

  it("lets a barber take a short break at once, and it blocks that time", async () => {
    const day = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
    const before = await t.db.query("select slot_start from public.get_availability($1, $2, $3)", [[services.haircut], barbers["marcus-hale"], day]);
    // Find a working day for Marcus near then.
    let slots = before.rows;
    let date = day;
    for (let i = 10; slots.length === 0 && i < 20; i++) {
      date = new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10);
      slots = (await t.db.query("select slot_start from public.get_availability($1, $2, $3)", [[services.haircut], barbers["marcus-hale"], date])).rows;
    }
    const start = slots[2].slot_start as Date;
    const end = new Date(start.getTime() + 60 * 60_000);

    const result = await add("marcus-hale", "break", start.toISOString(), end.toISOString());
    expect(result).toMatchObject({ ok: true, status: "approved" });

    const after = (await t.db.query("select slot_start from public.get_availability($1, $2, $3)", [[services.haircut], barbers["marcus-hale"], date])).rows.map((row) => row.slot_start.getTime());
    expect(after).not.toContain(start.getTime());
    expect(after).not.toContain(start.getTime() + 30 * 60_000);
    expect(after).toContain(end.getTime());
  });

  it("refuses a break longer than the shop allows, or one that runs into another day", async () => {
    expect((await add("leon-fischer", "break", at(2, "12:00"), at(2, "15:00"))).code).toBe("break_too_long");
    expect((await add("leon-fischer", "break", at(2, "23:30"), at(3, "00:30"))).code).toBe("break_too_long");
    expect((await add("leon-fischer", "break", at(2, "12:00"), at(2, "12:30"))).ok).toBe(true);
  });

  it("makes longer time off a request for an admin, which blocks nothing until approved", async () => {
    const start = hours(24 * 12);
    const result = await add("theo-okafor", "time_off", start, hours(24 * 14));
    expect(result).toMatchObject({ ok: true, status: "requested" });
    const blocking = await t.db.query("select count(*)::int as n from public.time_off where barber_id = $1 and status = 'approved'", [barbers["theo-okafor"]]);
    expect(blocking.rows[0].n).toBe(0);
  });

  it("refuses a break on top of an appointment", async () => {
    const id = await booking("daniyar-akhmetov", hoursUntil(at(2, "11:00")));
    const row = (await t.db.query("select starts_at, ends_at from public.bookings where id = $1", [id])).rows[0];
    expect((await add("daniyar-akhmetov", "break", row.starts_at.toISOString(), row.ends_at.toISOString())).code).toBe("has_bookings");
    // After it is fine. (A minute after: this test's booking ends on a fraction
    // of a second that a JavaScript date cannot carry back exactly.)
    const from = new Date(row.ends_at.getTime() + 60_000).toISOString();
    const to = new Date(row.ends_at.getTime() + 31 * 60_000).toISOString();
    expect(await add("daniyar-akhmetov", "break", from, to)).toMatchObject({ ok: true });
  });

  it("refuses the past, nonsense ranges and holidays from a barber", async () => {
    expect((await add("marcus-hale", "break", at(-1, "12:00"), at(-1, "13:00"))).code).toBe("in_the_past");
    expect((await add("marcus-hale", "break", hours(5), hours(4))).code).toBe("invalid");
    expect((await add("marcus-hale", "holiday", hours(100), hours(124))).code).toBe("forbidden");
    expect((await add(null, "break", hours(100), hours(101))).code).toBe("invalid");
  });

  it("lets an admin close the shop, unless someone is booked", async () => {
    const id = await booking("leon-fischer", 24 * 20);
    const row = (await t.db.query("select starts_at from public.bookings where id = $1", [id])).rows[0];
    const dayStart = new Date(row.starts_at.getTime() - 3_600_000).toISOString();
    const dayEnd = new Date(row.starts_at.getTime() + 3_600_000).toISOString();
    expect((await add(null, "holiday", dayStart, dayEnd, true)).code).toBe("has_bookings");
    expect((await add(null, "holiday", hours(24 * 25), hours(24 * 26), true))).toMatchObject({ ok: true, status: "approved" });
  });

  it("lets a barber withdraw their own future break, and nothing else", async () => {
    const mine = await add("marcus-hale", "break", at(3, "12:00"), at(3, "13:00"));
    const theirs = await add("leon-fischer", "break", at(3, "14:00"), at(3, "15:00"));
    const remove = (id: unknown, barber: string) => call("public.remove_time_off($1, $2)", [id, barbers[barber]]);

    expect((await remove(theirs.id, "marcus-hale")).code).toBe("not_found");
    expect((await remove(mine.id, "marcus-hale")).ok).toBe(true);
    expect((await t.db.query("select count(*)::int as n from public.time_off where id = $1", [mine.id])).rows[0].n).toBe(0);

    const approved = await add("marcus-hale", "time_off", hours(24 * 16), hours(24 * 17), true);
    expect((await remove(approved.id, "marcus-hale")).code).toBe("forbidden");
  });

  it("keeps these functions from the API roles", async () => {
    for (const sql of [
      "select public.close_booking('00000000-0000-0000-0000-000000000000', 'completed', 'barber', null, null)",
      "select public.add_time_off(null, 'holiday', now(), now() + interval '1 day', 'x', null, true)",
      "select public.link_customer_account('00000000-0000-0000-0000-000000000000')",
    ]) {
      const code = await t.as("authenticated", null, async (db) => {
        try {
          await db.query(sql);
          return null;
        } catch (error) {
          return (error as { code: string }).code;
        }
      });
      expect(code).toBe("42501");
    }
  });
});
