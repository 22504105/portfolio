import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "./harness";

let t: TestDatabase;
let marcus = "";
let n = 0;

const row = async (sql: string, params: unknown[] = []) => (await t.db.query(sql, params)).rows[0];
const count = async (table: string, where = "true", params: unknown[] = []) => (await row(`select count(*)::int as n from public.${table} where ${where}`, params)).n as number;

/** A booking with everything that hangs off one: a service line, an event, a token, an email job and, if completed, a payment. */
async function booking(email: string, status: string, closedDaysAgo: number | null = null) {
  const customer = (await row("insert into public.customers (email) values ($1) on conflict (email) do update set updated_at = now() returning id", [email])).id;
  const start = `2029-0${1 + (n % 9)}-1${n % 9}T1${n % 9}:00+00`;
  const id = (
    await row(
      `insert into public.bookings (reference, barber_id, customer_id, customer_name, customer_phone, starts_at, ends_at, status, total_price_cents, total_duration_minutes, closed_at)
       values ($1, $2, $3, 'Private Person', '+44 20 7946 0999', $4::timestamptz, $4::timestamptz + interval '45 minutes', $5::public.booking_status, 4500, 45,
               case when $6::int is null then null else now() - make_interval(days => $6::int) end)
       returning id`,
      [`RT${String(++n).padStart(6, "0")}`, marcus, customer, start, status, closedDaysAgo],
    )
  ).id as string;
  await t.db.query("insert into public.booking_services (booking_id, position, name_en, name_ru, price_cents, duration_minutes) values ($1, 1, 'Haircut', 'Стрижка', 4500, 45)", [id]);
  await t.db.query("insert into public.booking_events (booking_id, type, actor) values ($1, 'created', 'guest')", [id]);
  await t.db.query("insert into public.booking_tokens (booking_id, purpose, token_hash, expires_at) values ($1::uuid, 'manage', sha256((($1::uuid)::text || random()::text)::bytea), now() + interval '1 day')", [id]);
  await t.db.query("insert into public.notification_jobs (booking_id, type, due_at, idempotency_key) values ($1::uuid, 'confirmation', now(), ($1::uuid)::text || ':c')", [id]);
  if (status === "completed") await t.db.query("insert into public.payment_records (booking_id, amount_cents, method) values ($1, 4500, 'cash')", [id]);
  return id;
}

beforeAll(async () => {
  t = await startTestDatabase();
  marcus = (await row("select id from public.barbers where slug = 'marcus-hale'")).id;
}, 120_000);

afterAll(async () => {
  await t?.stop();
});

describe("erasing a customer", () => {
  it("removes the person and everything recorded about their bookings", async () => {
    const first = await booking("erase-me@example.com", "completed");
    const second = await booking("erase-me@example.com", "cancelled");
    const other = await booking("keep-me@example.com", "completed");

    const result = (await row("select public.erase_customer($1) as r", [" Erase-Me@Example.com "])).r;
    expect(result).toEqual({ ok: true, bookings_removed: 2 });

    for (const table of ["bookings", "booking_services", "booking_events", "booking_tokens", "notification_jobs", "payment_records"]) {
      const column = table === "bookings" ? "id" : "booking_id";
      expect([table, await count(table, `${column} = any($1)`, [[first, second]])]).toEqual([table, 0]);
    }
    expect(await count("customers", "email = 'erase-me@example.com'")).toBe(0);
    // Nothing of it is left anywhere a search for the name or the phone would find.
    expect(await count("bookings", "customer_name = 'Private Person' and customer_id not in (select id from public.customers)")).toBe(0);

    // Someone else's records are untouched.
    expect(await count("bookings", "id = $1", [other])).toBe(1);
    expect(await count("payment_records", "booking_id = $1", [other])).toBe(1);
  });

  it("says so when there is no such customer", async () => {
    expect((await row("select public.erase_customer('nobody@example.com') as r")).r).toEqual({ ok: false, code: "not_found" });
  });

  it("is not callable through the API", async () => {
    const code = await t.as("authenticated", null, async (db) => {
      try {
        await db.query("select public.erase_customer('keep-me@example.com')");
        return null;
      } catch (error) {
        return (error as { code: string }).code;
      }
    });
    expect(code).toBe("42501");
  });
});

describe("clearing out stale data", () => {
  it("removes old unconfirmed holds and the orphaned records they leave, and keeps the shop's records", async () => {
    const oldHold = await booking("abandoned@example.com", "expired", 45);
    const recentHold = await booking("recent@example.com", "expired", 3);
    const kept = await booking("regular@example.com", "completed", 400);
    await t.db.query("update public.customers set created_at = now() - interval '60 days' where email in ('abandoned@example.com', 'regular@example.com')");
    await t.db.query("insert into public.rate_limits (key, window_start, hits) values ('old', now() - interval '3 days', 5), ('fresh', now(), 1)");
    // An old token and an old sent email on the booking that stays.
    await t.db.query("update public.booking_tokens set expires_at = now() - interval '90 days' where booking_id = $1", [kept]);
    await t.db.query("update public.notification_jobs set status = 'sent' where booking_id = $1", [kept]);
    await t.db.query("alter table public.notification_jobs disable trigger notification_jobs_touch");
    await t.db.query("update public.notification_jobs set updated_at = now() - interval '90 days' where booking_id = $1", [kept]);
    await t.db.query("alter table public.notification_jobs enable trigger notification_jobs_touch");

    const result = (await row("select public.purge_stale_data(30) as r")).r;
    expect(result).toMatchObject({ expired_holds: 1, customers: 1, tokens: 1, email_jobs: 1 });

    expect(await count("bookings", "id = $1", [oldHold])).toBe(0);
    expect(await count("customers", "email = 'abandoned@example.com'")).toBe(0);
    // A hold that expired a few days ago is still within the window.
    expect(await count("bookings", "id = $1", [recentHold])).toBe(1);
    // A completed visit from over a year ago stays, with its payment and its history.
    expect(await count("bookings", "id = $1", [kept])).toBe(1);
    expect(await count("payment_records", "booking_id = $1", [kept])).toBe(1);
    expect(await count("booking_events", "booking_id = $1", [kept])).toBe(1);
    expect(await count("customers", "email = 'regular@example.com'")).toBe(1);
    expect(await count("rate_limits", "key = 'old'")).toBe(0);
    expect(await count("rate_limits", "key = 'fresh'")).toBe(1);
  });

  it("keeps the customer record of someone with an account, bookings or not", async () => {
    const user = (await row("insert into auth.users (email, email_confirmed_at) values ('member@example.com', now()) returning id")).id;
    await t.db.query("select public.link_customer_account($1)", [user]);
    await t.db.query("update public.customers set created_at = now() - interval '90 days' where email = 'member@example.com'");
    await t.db.query("select public.purge_stale_data(30)");
    expect(await count("customers", "email = 'member@example.com'")).toBe(1);
  });

  it("does nothing the second time", async () => {
    expect((await row("select public.purge_stale_data(30) as r")).r).toEqual({ expired_holds: 0, customers: 0, tokens: 0, email_jobs: 0 });
  });
});
