import { createHash, randomBytes } from "node:crypto";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "./harness";

let t: TestDatabase;
const services: Record<string, string> = {};
const barbers: Record<string, string> = {};

type Result = { ok: boolean; code?: string; booking_id?: string; barber_id?: string; reference?: string; expires_at?: string; [key: string]: unknown };

let people = 0;
const someone = () => `guest${++people}@example.com`;
const ids = (slugs: string[]) => slugs.map((slug) => services[slug]);
const london = (instant: string | Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(instant));

async function availability(serviceSlugs: string[], barber: string | null, date: string, now?: string, db: Client = t.db) {
  const { rows } = await db.query(
    "select slot_start, free_barbers from public.get_availability($1, $2, $3, coalesce($4::timestamptz, clock_timestamp()))",
    [ids(serviceSlugs), barber ? barbers[barber] : null, date, now ?? null],
  );
  return rows as { slot_start: Date; free_barbers: string[] }[];
}

/** The first free start for these services at least a few days from now, by the real clock. */
async function freeSlot(serviceSlugs: string[], barber: string | null, fromDay = 3) {
  for (let day = fromDay; day <= 28; day++) {
    const date = new Date(Date.now() + day * 86_400_000).toISOString().slice(0, 10);
    const slots = await availability(serviceSlugs, barber, date);
    if (slots.length) return slots[0].slot_start.toISOString();
  }
  throw new Error("no free slot found");
}

async function hold(serviceSlugs: string[], barber: string | null, startsAt: string, email = someone(), db: Client = t.db): Promise<Result> {
  const { rows } = await db.query("select public.create_booking_hold($1, $2, $3, $4, $5, $6, $7) as result", [
    ids(serviceSlugs), barber ? barbers[barber] : null, startsAt, "Test Guest", email, "+44 20 7946 0000", "en",
  ]);
  return rows[0].result;
}

/** Issues a verification token for a booking, as the email sender does, and returns its hash. */
async function verifyToken(bookingId: string) {
  const hash = createHash("sha256").update(randomBytes(32)).digest();
  await t.db.query(
    "insert into public.booking_tokens (booking_id, purpose, token_hash, expires_at) values ($1, 'verify', $2, now() + interval '15 minutes')",
    [bookingId, hash],
  );
  return hash;
}

async function confirm(hash: Buffer, db: Client = t.db): Promise<Result> {
  return (await db.query("select public.confirm_booking($1) as result", [hash])).rows[0].result;
}

/** A confirmed booking, made the way a customer makes one. */
async function confirmed(serviceSlugs: string[], barber: string | null, startsAt?: string) {
  const start = startsAt ?? (await freeSlot(serviceSlugs, barber));
  const held = await hold(serviceSlugs, barber, start);
  expect(held.ok).toBe(true);
  expect((await confirm(await verifyToken(held.booking_id!))).ok).toBe(true);
  return { id: held.booking_id!, barberId: held.barber_id!, start };
}

const booking = async (id: string) => (await t.db.query("select * from public.bookings where id = $1", [id])).rows[0];
const jobs = async (id: string) =>
  (await t.db.query("select type, status from public.notification_jobs where booking_id = $1", [id])).rows
    .map((row) => `${row.type}:${row.status}`)
    .sort();
const events = async (id: string) =>
  (await t.db.query("select type from public.booking_events where booking_id = $1 order by id", [id])).rows.map((row) => row.type);

beforeAll(async () => {
  t = await startTestDatabase();
  for (const row of (await t.db.query("select id, slug from public.services")).rows) services[row.slug] = row.id;
  for (const row of (await t.db.query("select id, slug from public.barbers")).rows) barbers[row.slug] = row.id;
}, 120_000);

afterAll(async () => {
  await t?.stop();
});

describe("availability", () => {
  // Wednesday 10 July 2030, asked on 1 July: Marcus works 10:00-14:00 and 15:00-19:00.
  const NOW = "2030-07-01T08:00:00Z";
  const DAY = "2030-07-10";

  it("offers a start every half hour while the visit fits a working range", async () => {
    const slots = await availability(["haircut"], "marcus-hale", DAY, NOW);
    expect(slots.map((slot) => london(slot.slot_start))).toEqual([
      "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00",
      "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
    ]);
  });

  it("blocks the whole length of a visit that is not a multiple of thirty minutes", async () => {
    // Haircut & Beard takes 65 minutes: 13:00 would run into lunch, 18:00 past closing.
    const slots = (await availability(["haircut-and-beard"], "marcus-hale", DAY, NOW)).map((slot) => london(slot.slot_start));
    expect(slots).toEqual(["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"]);
  });

  it("adds up several services", async () => {
    // 45 + 40 minutes.
    const slots = (await availability(["haircut", "hot-towel-shave"], "marcus-hale", DAY, NOW)).map((slot) => london(slot.slot_start));
    expect([slots[0], slots.at(-1), slots.includes("13:00")]).toEqual(["10:00", "17:30", false]);
  });

  it("offers nothing on a day off", async () => {
    expect(await availability(["haircut"], null, "2030-07-08", NOW)).toEqual([]);
  });

  it("offers nothing sooner than two hours from now", async () => {
    const slots = await availability(["haircut"], "marcus-hale", DAY, "2030-07-10T08:10:00Z"); // 09:10 in London
    expect(london(slots[0].slot_start)).toBe("11:30");
  });

  it("opens thirty days ahead, counted in London dates", async () => {
    expect((await availability(["haircut"], "marcus-hale", DAY, "2030-06-09T12:00:00Z")).length).toBe(0);
    expect((await availability(["haircut"], "marcus-hale", DAY, "2030-06-10T12:00:00Z")).length).toBe(14);
    // 23:30 UTC on 9 June is already 10 June in London.
    expect((await availability(["haircut"], "marcus-hale", DAY, "2030-06-09T23:30:00Z")).length).toBe(14);
  });

  it("keeps London hours across both clock changes", async () => {
    // Sundays: Daniyar works 11:00-17:00. 31 March 2030 is the first day of summer time, 27 October the first of winter time.
    const spring = await availability(["haircut"], "daniyar-akhmetov", "2030-03-31", "2030-03-20T12:00:00Z");
    const autumn = await availability(["haircut"], "daniyar-akhmetov", "2030-10-27", "2030-10-20T12:00:00Z");
    expect([spring[0].slot_start.toISOString(), london(spring[0].slot_start)]).toEqual(["2030-03-31T10:00:00.000Z", "11:00"]);
    expect([autumn[0].slot_start.toISOString(), london(autumn[0].slot_start)]).toEqual(["2030-10-27T11:00:00.000Z", "11:00"]);
    expect(spring.length).toBe(autumn.length);
  });

  it("offers only barbers who deliver every chosen service", async () => {
    const both = await availability(["haircut", "hot-towel-shave"], null, "2030-07-12", NOW);
    const who = new Set(both.flatMap((slot) => slot.free_barbers));
    expect([...who].sort()).toEqual([barbers["leon-fischer"], barbers["marcus-hale"]].sort());
    expect(await availability(["skin-fade", "grey-blending"], null, "2030-07-12", NOW)).toEqual([]);
    expect(await availability(["skin-fade"], "marcus-hale", "2030-07-12", NOW)).toEqual([]);
  });

  it("offers nothing for unknown, retired or repeated services", async () => {
    const ask = (list: string[]) =>
      t.db.query("select * from public.get_availability($1, null, $2, $3)", [list, DAY, NOW]).then((result) => result.rowCount);
    expect(await ask(["00000000-0000-0000-0000-000000000000"])).toBe(0);
    expect(await ask([services.haircut, services.haircut])).toBe(0);
    expect(await ask([])).toBe(0);
  });

  it("respects time off and shop holidays", async () => {
    await t.db.query("begin");
    try {
      await t.db.query(
        "insert into public.time_off (barber_id, kind, starts_at, ends_at) values ($1, 'break', '2030-07-10T10:00+01', '2030-07-10T11:30+01')",
        [barbers["marcus-hale"]],
      );
      const withBreak = (await availability(["haircut"], "marcus-hale", DAY, NOW)).map((slot) => london(slot.slot_start));
      expect(withBreak.slice(0, 2)).toEqual(["11:30", "12:00"]);

      await t.db.query("insert into public.time_off (kind, starts_at, ends_at) values ('holiday', '2030-07-10T00:00+01', '2030-07-11T00:00+01')");
      expect(await availability(["haircut"], null, DAY, NOW)).toEqual([]);
    } finally {
      await t.db.query("rollback");
    }
  });
});

describe("holding a slot", () => {
  it("creates a pending booking held for fifteen minutes, priced from the catalog", async () => {
    const start = await freeSlot(["haircut", "beard-trim"], "marcus-hale");
    const result = await hold(["beard-trim", "haircut"], "marcus-hale", start, "Ada@Example.com ");
    expect(result).toMatchObject({ ok: true, barber_id: barbers["marcus-hale"] });
    expect(result.reference).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    const row = await booking(result.booking_id!);
    expect([row.status, row.total_price_cents, row.total_duration_minutes, row.any_barber_requested]).toEqual(["pending", 7300, 70, false]);
    expect(row.ends_at.getTime() - row.starts_at.getTime()).toBe(70 * 60_000);
    const heldFor = (row.hold_expires_at.getTime() - Date.now()) / 60_000;
    expect(heldFor).toBeGreaterThan(14);
    expect(heldFor).toBeLessThanOrEqual(15);

    const lines = await t.db.query("select position, name_en, name_ru, price_cents from public.booking_services where booking_id = $1 order by position", [row.id]);
    expect(lines.rows).toEqual([
      { position: 1, name_en: "Haircut", name_ru: "Стрижка", price_cents: 4500 },
      { position: 2, name_en: "Beard Trim", name_ru: "Оформление бороды", price_cents: 2800 },
    ]);
    const customer = await t.db.query("select email::text, email_verified_at from public.customers where id = $1", [row.customer_id]);
    expect(customer.rows[0]).toEqual({ email: "ada@example.com", email_verified_at: null });
    expect([await events(row.id), await jobs(row.id)]).toEqual([["created"], ["verification:pending"]]);
  });

  it("keeps the booked price when the catalog changes afterwards", async () => {
    const held = await hold(["haircut"], "marcus-hale", await freeSlot(["haircut"], "marcus-hale"));
    await t.db.query("begin");
    try {
      await t.db.query("update public.services set price_cents = 9900, name_en = 'Deluxe Haircut' where slug = 'haircut'");
      const line = await t.db.query("select name_en, price_cents from public.booking_services where booking_id = $1", [held.booking_id]);
      expect([line.rows[0], (await booking(held.booking_id!)).total_price_cents]).toEqual([{ name_en: "Haircut", price_cents: 4500 }, 4500]);
    } finally {
      await t.db.query("rollback");
    }
  });

  it("refuses a slot that is already held", async () => {
    const start = await freeSlot(["haircut"], "theo-okafor");
    expect((await hold(["haircut"], "theo-okafor", start)).ok).toBe(true);
    expect(await hold(["haircut"], "theo-okafor", start)).toEqual({ ok: false, code: "slot_taken" });
    // An overlapping start is refused too; the half hour after the visit ends is not.
    const later = (minutes: number) => new Date(new Date(start).getTime() + minutes * 60_000).toISOString();
    expect((await hold(["haircut"], "theo-okafor", later(30))).code).toBe("slot_taken");
    expect((await hold(["haircut"], "theo-okafor", later(60))).ok).toBe(true);
  });

  it("refuses times the policy does not allow", async () => {
    const start = await freeSlot(["haircut"], "leon-fischer");
    const shifted = (minutes: number) => new Date(new Date(start).getTime() + minutes * 60_000).toISOString();
    expect((await hold(["haircut"], "leon-fischer", shifted(10))).code).toBe("off_grid");
    expect((await hold(["haircut"], "leon-fischer", new Date(Date.now() + 3_600_000).toISOString().slice(0, 13) + ":00:00Z")).code).toBe("too_soon");
    expect((await hold(["haircut"], "leon-fischer", shifted(60 * 24 * 60))).code).toBe("outside_horizon");
    // Outside working hours: 03:00 London, three days on.
    const night = new Date(new Date(start).toISOString().slice(0, 10) + "T03:00:00Z").toISOString();
    expect((await hold(["haircut"], "leon-fischer", night)).code).toBe("slot_taken");
  });

  it("refuses requests the server cannot honour", async () => {
    const start = await freeSlot(["haircut"], null);
    expect((await hold(["skin-fade"], "marcus-hale", start)).code).toBe("not_eligible");
    expect((await hold(["skin-fade", "grey-blending"], null, start)).code).toBe("not_eligible");
    const raw = (list: string[], email: string) =>
      t.db.query("select public.create_booking_hold($1, null, $2, 'Test Guest', $3, '+44 20 7946 0000', 'en') as r", [list, start, email]).then((result) => result.rows[0].r.code);
    expect(await raw(["00000000-0000-0000-0000-000000000000"], someone())).toBe("invalid");
    expect(await raw([services.haircut], "not-an-email")).toBe("invalid");
  });

  it("limits one address to two unverified holds at a time", async () => {
    const email = someone();
    for (const barber of ["marcus-hale", "leon-fischer"]) {
      expect((await hold(["haircut"], barber, await freeSlot(["haircut"], barber), email)).ok).toBe(true);
    }
    expect((await hold(["haircut"], "theo-okafor", await freeSlot(["haircut"], "theo-okafor"), email)).code).toBe("too_many_holds");
  });

  it("gives 'any available' to the barber with the least work that day", async () => {
    // Only Marcus and Leon do both of these. Find a day when both are free at the same time.
    const combo = ["haircut", "hot-towel-shave"];
    let day: { slot_start: Date; free_barbers: string[] }[] = [];
    for (let ahead = 5; ahead < 28 && day.filter((slot) => slot.free_barbers.length === 2).length < 3; ahead++) {
      day = await availability(combo, null, new Date(Date.now() + ahead * 86_400_000).toISOString().slice(0, 10));
    }
    const shared = day.filter((slot) => slot.free_barbers.length === 2).map((slot) => slot.slot_start.toISOString());
    expect(shared.length).toBeGreaterThanOrEqual(3);

    const first = await hold(combo, null, shared[0]);
    expect((await booking(first.booking_id!)).any_barber_requested).toBe(true);
    // Whoever took the first visit now has more work that day than the other,
    // so the second goes to the other, and the third back to the first: the
    // 85-minute visits alternate.
    const other = [barbers["marcus-hale"], barbers["leon-fischer"]].find((id) => id !== first.barber_id);
    expect((await hold(combo, null, shared.at(-1)!)).barber_id).toBe(other);
  });

  it("is not executable by the API roles", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      const code = await t.as(role, null, async (db) => {
        try {
          await db.query("select public.create_booking_hold('{}', null, now(), 'x', 'x@example.com', '1234567', 'en')");
          return null;
        } catch (error) {
          return (error as { code: string }).code;
        }
      });
      expect(code).toBe("42501");
    }
  });
});

describe("confirming", () => {
  it("confirms a hold, verifies the address and queues the emails", async () => {
    const held = await hold(["haircut"], "daniyar-akhmetov", await freeSlot(["haircut"], "daniyar-akhmetov"));
    const result = await confirm(await verifyToken(held.booking_id!));
    expect(result).toMatchObject({ ok: true, already_confirmed: false });

    const row = await booking(held.booking_id!);
    expect([row.status, row.hold_expires_at, row.confirmed_at !== null]).toEqual(["confirmed", null, true]);
    const customer = await t.db.query("select email_verified_at is not null as verified from public.customers where id = $1", [row.customer_id]);
    expect(customer.rows[0].verified).toBe(true);
    expect(await events(row.id)).toEqual(["created", "confirmed"]);
    expect(await jobs(row.id)).toEqual(["confirmation:pending", "reminder_24h:pending", "reminder_2h:pending", "verification:pending"]);
  });

  it("answers a second use of the link without confirming twice", async () => {
    const held = await hold(["haircut"], "daniyar-akhmetov", await freeSlot(["haircut"], "daniyar-akhmetov"));
    const token = await verifyToken(held.booking_id!);
    await confirm(token);
    expect(await confirm(token)).toMatchObject({ ok: true, already_confirmed: true });
    expect((await events(held.booking_id!)).filter((type) => type === "confirmed").length).toBe(1);
  });

  it("refuses an unknown token", async () => {
    expect(await confirm(createHash("sha256").update("guess").digest())).toEqual({ ok: false, code: "invalid_token" });
  });

  it("refuses a late confirmation and never brings the hold back", async () => {
    const start = await freeSlot(["haircut"], "leon-fischer");
    const held = await hold(["haircut"], "leon-fischer", start);
    const token = await verifyToken(held.booking_id!);
    await t.db.query("update public.bookings set hold_expires_at = now() - interval '1 second' where id = $1", [held.booking_id]);

    expect(await confirm(token)).toEqual({ ok: false, code: "hold_expired" });
    expect((await booking(held.booking_id!)).status).toBe("expired");
    // The slot is still free, and it makes no difference.
    expect(await confirm(token)).toEqual({ ok: false, code: "hold_expired" });
    expect(await events(held.booking_id!)).toEqual(["created", "expired"]);
  });

  it("frees the slot the moment a hold runs out, before any cleanup", async () => {
    const start = await freeSlot(["haircut"], "theo-okafor");
    const abandoned = await hold(["haircut"], "theo-okafor", start);
    expect((await hold(["haircut"], "theo-okafor", start)).code).toBe("slot_taken");

    await t.db.query("update public.bookings set hold_expires_at = now() - interval '1 second' where id = $1", [abandoned.booking_id]);
    // Still "pending" in the table: nothing has cleaned it up.
    expect((await booking(abandoned.booking_id!)).status).toBe("pending");
    expect((await hold(["haircut"], "theo-okafor", start)).ok).toBe(true);
  });

  it("marks stale holds expired and withdraws their emails", async () => {
    const held = await hold(["haircut"], "marcus-hale", await freeSlot(["haircut"], "marcus-hale"));
    await t.db.query("update public.bookings set hold_expires_at = now() - interval '1 second' where id = $1", [held.booking_id]);
    const { rows } = await t.db.query("select public.expire_stale_holds() as n");
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
    expect([(await booking(held.booking_id!)).status, await jobs(held.booking_id!), (await events(held.booking_id!)).at(-1)]).toEqual([
      "expired", ["verification:cancelled"], "expired",
    ]);
  });
});

describe("cancelling", () => {
  it("cancels, frees the slot, withdraws the reminders and tells the customer", async () => {
    const made = await confirmed(["haircut"], "leon-fischer");
    const result = (await t.db.query("select public.cancel_booking($1, 'guest') as r", [made.id])).rows[0].r;
    expect(result).toMatchObject({ ok: true, already_cancelled: false });
    expect((await booking(made.id)).status).toBe("cancelled");
    expect(await jobs(made.id)).toEqual(
      ["cancellation:pending", "confirmation:pending", "reminder_24h:cancelled", "reminder_2h:cancelled", "verification:pending"].sort(),
    );
    expect((await hold(["haircut"], "leon-fischer", made.start)).ok).toBe(true);
    // Asking again changes nothing.
    expect((await t.db.query("select public.cancel_booking($1, 'guest') as r", [made.id])).rows[0].r.already_cancelled).toBe(true);
  });

  it("refuses a customer inside twelve hours, and lets staff through", async () => {
    const made = await confirmed(["haircut"], "daniyar-akhmetov");
    await t.db.query("update public.bookings set starts_at = now() + interval '11 hours 59 minutes', ends_at = now() + interval '12 hours 44 minutes' where id = $1", [made.id]);
    expect((await t.db.query("select public.cancel_booking($1, 'guest') as r", [made.id])).rows[0].r).toEqual({ ok: false, code: "past_cutoff" });
    expect((await booking(made.id)).status).toBe("confirmed");
    expect((await t.db.query("select public.cancel_booking($1, 'admin', null, false) as r", [made.id])).rows[0].r.ok).toBe(true);
  });

  it("allows a customer just outside twelve hours", async () => {
    const made = await confirmed(["haircut"], "daniyar-akhmetov");
    await t.db.query("update public.bookings set starts_at = now() + interval '12 hours 1 minute', ends_at = now() + interval '12 hours 46 minutes' where id = $1", [made.id]);
    expect((await t.db.query("select public.cancel_booking($1, 'guest') as r", [made.id])).rows[0].r.ok).toBe(true);
  });

  it("does not cancel what is not confirmed", async () => {
    const held = await hold(["haircut"], "marcus-hale", await freeSlot(["haircut"], "marcus-hale"));
    expect((await t.db.query("select public.cancel_booking($1, 'guest') as r", [held.booking_id])).rows[0].r.code).toBe("not_changeable");
    expect((await t.db.query("select public.cancel_booking($1, 'guest') as r", ["00000000-0000-0000-0000-000000000000"])).rows[0].r.code).toBe("not_found");
  });
});

describe("rescheduling", () => {
  const reschedule = async (id: string, startsAt: string, actor = "guest", enforce = true, db: Client = t.db): Promise<Result> =>
    (await db.query("select public.reschedule_booking($1, $2, $3, null, $4) as r", [id, startsAt, actor, enforce])).rows[0].r;

  it("moves the booking, frees the old slot and replaces the reminders", async () => {
    const made = await confirmed(["haircut"], "theo-okafor");
    const target = await freeSlot(["haircut"], "theo-okafor");
    expect(target).not.toBe(made.start);

    expect((await reschedule(made.id, target)).ok).toBe(true);
    const row = await booking(made.id);
    expect([row.status, row.starts_at.toISOString(), row.barber_id]).toEqual(["confirmed", target, barbers["theo-okafor"]]);
    expect(row.ends_at.getTime() - row.starts_at.getTime()).toBe(45 * 60_000);

    // History keeps both times.
    const moved = await t.db.query("select data from public.booking_events where booking_id = $1 and type = 'rescheduled'", [made.id]);
    expect(new Date(moved.rows[0].data.from).toISOString()).toBe(made.start);
    expect(new Date(moved.rows[0].data.to).toISOString()).toBe(target);

    // Old reminders withdrawn, new ones queued for the new time.
    const reminders = await t.db.query(
      "select status, due_at from public.notification_jobs where booking_id = $1 and type = 'reminder_2h' order by created_at",
      [made.id],
    );
    expect(reminders.rows.map((row) => row.status)).toEqual(["cancelled", "pending"]);
    expect(reminders.rows[1].due_at.getTime()).toBe(new Date(target).getTime() - 2 * 3_600_000);

    expect((await hold(["haircut"], "theo-okafor", made.start)).ok).toBe(true);
    expect((await hold(["haircut"], "theo-okafor", target)).code).toBe("slot_taken");
  });

  it("offers the booking's own time among the times it can move to", async () => {
    const made = await confirmed(["haircut-and-beard"], "marcus-hale");
    const date = made.start.slice(0, 10);
    const forNew = (await availability(["haircut-and-beard"], "marcus-hale", date)).map((slot) => slot.slot_start.toISOString());
    const forMove = (await t.db.query("select slot_start from public.get_reschedule_availability($1, $2)", [made.id, date])).rows.map(
      (row) => row.slot_start.toISOString(),
    );
    expect(forNew).not.toContain(made.start);
    expect(forMove).toContain(made.start);
  });

  it("refuses a time that is taken and leaves the booking where it was", async () => {
    const made = await confirmed(["haircut"], "leon-fischer");
    const other = await confirmed(["haircut"], "leon-fischer");
    expect(await reschedule(made.id, other.start)).toEqual({ ok: false, code: "slot_taken" });
    expect((await booking(made.id)).starts_at.toISOString()).toBe(made.start);
  });

  it("applies the same twelve-hour rule as cancelling", async () => {
    const made = await confirmed(["haircut"], "daniyar-akhmetov");
    const target = await freeSlot(["haircut"], "daniyar-akhmetov");
    await t.db.query("update public.bookings set starts_at = now() + interval '11 hours', ends_at = now() + interval '11 hours 45 minutes' where id = $1", [made.id]);
    // Moving it far away first would be the way round the cancellation rule.
    expect(await reschedule(made.id, target)).toEqual({ ok: false, code: "past_cutoff" });
    expect((await reschedule(made.id, target, "admin", false)).ok).toBe(true);
  });

  it("holds the new time to the booking policy", async () => {
    const made = await confirmed(["haircut"], "marcus-hale");
    const offGrid = new Date(new Date(made.start).getTime() + 10 * 60_000).toISOString();
    expect((await reschedule(made.id, offGrid)).code).toBe("off_grid");
    expect((await reschedule(made.id, new Date(new Date(made.start).getTime() + 60 * 86_400_000).toISOString())).code).toBe("outside_horizon");
  });
});

describe("races", () => {
  /** Runs the tasks at the same instant, each on its own connection. */
  async function together<T>(tasks: ((db: Client) => Promise<T>)[]) {
    const clients = await Promise.all(tasks.map(() => t.connect()));
    return Promise.all(tasks.map((task, index) => task(clients[index])));
  }

  it("gives one slot to exactly one of ten simultaneous customers", async () => {
    const start = await freeSlot(["haircut"], "marcus-hale");
    const results = await together(Array.from({ length: 10 }, () => (db: Client) => hold(["haircut"], "marcus-hale", start, someone(), db)));
    expect(results.filter((result) => result.ok).length).toBe(1);
    expect(results.filter((result) => result.code === "slot_taken").length).toBe(9);
    const rows = await t.db.query(
      "select count(*)::int as n from public.bookings where barber_id = $1 and starts_at = $2 and status = 'pending' and hold_expires_at > now()",
      [barbers["marcus-hale"], start],
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it("never lets overlapping visits through, whatever their starts", async () => {
    // 65-minute visits starting half an hour apart overlap one another.
    const first = await freeSlot(["haircut-and-beard"], "leon-fischer", 6);
    const starts = [0, 30, 60, 90, 120].map((minutes) => new Date(new Date(first).getTime() + minutes * 60_000).toISOString());
    await together(starts.flatMap((start) => [0, 1].map(() => (db: Client) => hold(["haircut-and-beard"], "leon-fischer", start, someone(), db))));
    const overlaps = await t.db.query(
      `select count(*)::int as n
       from public.bookings a join public.bookings b on a.barber_id = b.barber_id and a.id < b.id
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at)
       where a.barber_id = $1
         and (a.status = 'confirmed' or (a.status = 'pending' and a.hold_expires_at > now()))
         and (b.status = 'confirmed' or (b.status = 'pending' and b.hold_expires_at > now()))`,
      [barbers["leon-fischer"]],
    );
    expect(overlaps.rows[0].n).toBe(0);
  });

  it("gives 'any available' to as many customers as there are free barbers, each a different one", async () => {
    const combo = ["haircut", "hot-towel-shave"];
    let start: string | undefined;
    for (let ahead = 8; ahead < 28 && !start; ahead++) {
      const day = await availability(combo, null, new Date(Date.now() + ahead * 86_400_000).toISOString().slice(0, 10));
      start = day.find((slot) => slot.free_barbers.length === 2)?.slot_start.toISOString();
    }
    const results = await together(Array.from({ length: 8 }, () => (db: Client) => hold(combo, null, start!, someone(), db)));
    const won = results.filter((result) => result.ok);
    expect(won.length).toBe(2);
    expect(new Set(won.map((result) => result.barber_id)).size).toBe(2);
  });

  it("lets a new customer have the slot of a hold that expired, while its late confirmation fails", async () => {
    const start = await freeSlot(["haircut"], "theo-okafor");
    const late = await hold(["haircut"], "theo-okafor", start);
    const token = await verifyToken(late.booking_id!);
    await t.db.query("update public.bookings set hold_expires_at = now() - interval '1 second' where id = $1", [late.booking_id]);

    const [confirmation, fresh] = await together<Result>([
      (db) => confirm(token, db),
      (db) => hold(["haircut"], "theo-okafor", start, someone(), db),
    ]);
    expect([confirmation.code, fresh.ok]).toEqual(["hold_expired", true]);
  });

  it("settles a reschedule and a new booking that want the same time", async () => {
    const made = await confirmed(["haircut"], "daniyar-akhmetov");
    const target = await freeSlot(["haircut"], "daniyar-akhmetov");
    const [moved, fresh] = await together<Result>([
      (db) => db.query("select public.reschedule_booking($1, $2, 'guest') as r", [made.id, target]).then((result) => result.rows[0].r),
      (db) => hold(["haircut"], "daniyar-akhmetov", target, someone(), db),
    ]);
    expect([moved.ok, fresh.ok].filter(Boolean).length).toBe(1);
    expect([moved.code, fresh.code].filter(Boolean)).toEqual(["slot_taken"]);
  });

  it("confirms a hold once when the link is opened twice at the same moment", async () => {
    const held = await hold(["haircut"], "marcus-hale", await freeSlot(["haircut"], "marcus-hale"));
    const token = await verifyToken(held.booking_id!);
    const results = await together<Result>([(db) => confirm(token, db), (db) => confirm(token, db), (db) => confirm(token, db)]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.filter((result) => result.already_confirmed === false).length).toBe(1);
    expect((await jobs(held.booking_id!)).filter((job) => job.startsWith("confirmation")).length).toBe(1);
  });
});

describe("email queue", () => {
  const claim = async (limit: number, db: Client = t.db) =>
    (await db.query("select id, type, attempts from public.claim_notification_jobs($1)", [limit])).rows as { id: string; type: string; attempts: number }[];

  it("hands each due job to one worker only", async () => {
    await t.db.query("update public.notification_jobs set status = 'cancelled' where status in ('pending', 'failed', 'sending')");
    const made = await confirmed(["haircut"], "leon-fischer");
    // Verification and confirmation are due now; the reminders are not.
    const [a, b] = await Promise.all([t.connect(), t.connect()]);
    const [first, second] = await Promise.all([claim(10, a), claim(10, b)]);
    const claimed = [...first, ...second];
    expect(claimed.map((job) => job.type).sort()).toEqual(["confirmation", "verification"]);
    expect(new Set(claimed.map((job) => job.id)).size).toBe(2);
    expect(await claim(10)).toEqual([]);
    expect((await jobs(made.id)).filter((job) => job.endsWith(":sending")).length).toBe(2);
  });

  it("records a sent job and does not send it again", async () => {
    await t.db.query("update public.notification_jobs set status = 'cancelled' where status in ('pending', 'failed', 'sending')");
    const held = await hold(["haircut"], "marcus-hale", await freeSlot(["haircut"], "marcus-hale"));
    const [job] = await claim(10);
    await t.db.query("select public.finish_notification_job($1, 'msg_123')", [job.id]);
    const row = await t.db.query("select status, provider_message_id, sent_at is not null as sent from public.notification_jobs where id = $1", [job.id]);
    expect(row.rows[0]).toEqual({ status: "sent", provider_message_id: "msg_123", sent: true });
    expect(await claim(10)).toEqual([]);
    expect(await jobs(held.booking_id!)).toEqual(["verification:sent"]);
  });

  it("retries a failed job later, five times at most, and keeps the error", async () => {
    await t.db.query("update public.notification_jobs set status = 'cancelled' where status in ('pending', 'failed', 'sending')");
    await hold(["haircut"], "marcus-hale", await freeSlot(["haircut"], "marcus-hale"));
    let [job] = await claim(10);
    await t.db.query("select public.fail_notification_job($1, 'provider down')", [job.id]);

    const failed = await t.db.query("select status, last_error, attempts, due_at > now() + interval '1 minute' as later from public.notification_jobs where id = $1", [job.id]);
    expect(failed.rows[0]).toEqual({ status: "failed", last_error: "provider down", attempts: 1, later: true });
    expect(await claim(10)).toEqual([]);

    for (let attempt = 2; attempt <= 5; attempt++) {
      await t.db.query("update public.notification_jobs set due_at = now() where id = $1", [job.id]);
      [job] = await claim(10);
      expect(job.attempts).toBe(attempt);
      await t.db.query("select public.fail_notification_job($1, 'still down')", [job.id]);
    }
    await t.db.query("update public.notification_jobs set due_at = now() where id = $1", [job.id]);
    expect(await claim(10)).toEqual([]);
    const final = await t.db.query("select status, last_error from public.notification_jobs where id = $1", [job.id]);
    expect(final.rows[0]).toEqual({ status: "failed", last_error: "still down" });
  });

  it("picks up a job abandoned by a worker that died", async () => {
    await t.db.query("update public.notification_jobs set status = 'cancelled' where status in ('pending', 'failed', 'sending')");
    await hold(["haircut"], "marcus-hale", await freeSlot(["haircut"], "marcus-hale"));
    const [job] = await claim(10);
    expect(await claim(10)).toEqual([]);
    await t.db.query("update public.notification_jobs set locked_at = now() - interval '6 minutes' where id = $1", [job.id]);
    expect((await claim(10)).map((again) => again.id)).toEqual([job.id]);
  });

  it("does not queue the same email twice", async () => {
    const made = await confirmed(["haircut"], "theo-okafor");
    await t.db.query("select app.enqueue_notification($1, 'confirmation', now(), 'en', $2)", [made.id, `${made.id}:confirmation`]);
    expect((await jobs(made.id)).filter((job) => job.startsWith("confirmation")).length).toBe(1);
  });

  it("queues no reminder whose moment has already passed", async () => {
    // The nearest bookable slot is a little over two hours away: too close for the day-before reminder.
    const soon = await freeSlot(["buzz-cut"], null, 0);
    const hours = (new Date(soon).getTime() - Date.now()) / 3_600_000;
    const made = await confirmed(["buzz-cut"], null, soon);
    const queued = (await jobs(made.id)).filter((job) => job.startsWith("reminder"));
    expect(queued).toEqual(hours > 24 ? ["reminder_24h:pending", "reminder_2h:pending"] : ["reminder_2h:pending"]);
  });
});

describe("throttling", () => {
  it("allows up to the limit in a window, then refuses", async () => {
    const hit = async () => (await t.db.query("select public.hit_rate_limit('test:key', 3, 3600) as ok")).rows[0].ok;
    expect([await hit(), await hit(), await hit(), await hit(), await hit()]).toEqual([true, true, true, false, false]);
    expect((await t.db.query("select public.hit_rate_limit('test:other', 3, 3600) as ok")).rows[0].ok).toBe(true);
  });
});
