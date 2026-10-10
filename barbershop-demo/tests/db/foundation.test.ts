import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mockCatalog } from "@/lib/catalog/mock";
import { startTestDatabase, type TestDatabase } from "./harness";

// PostgreSQL error codes.
const EXCLUSION_VIOLATION = "23P01";
const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";

let t: TestDatabase;

// People of the test shop.
const ids = { admin: "", barberUser: "", otherBarberUser: "", client: "", otherClient: "" };
const barbers = { marcus: "", daniyar: "" };
const bookings = { marcusClient: "", daniyarOther: "" };

async function createUser(email: string, meta: Record<string, string> = {}) {
  const { rows } = await t.db.query(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(meta)],
  );
  return rows[0].id as string;
}

let nextReference = 0;

type BookingInput = {
  barberId: string;
  customerId: string;
  start: string;
  end: string;
  status?: string;
  holdExpiresAt?: string | null;
};

async function insertBooking({ barberId, customerId, start, end, status = "confirmed", holdExpiresAt = null }: BookingInput) {
  const { rows } = await t.db.query(
    `insert into public.bookings
       (reference, barber_id, customer_id, customer_name, customer_phone, starts_at, ends_at,
        status, hold_expires_at, total_price_cents, total_duration_minutes)
     values ($1, $2, $3, 'Test Customer', '+44 20 7946 0000', $4, $5, $6, $7, 4500, 45)
     returning id`,
    [`TEST${String(++nextReference).padStart(4, "0")}`, barberId, customerId, start, end, status, holdExpiresAt],
  );
  return rows[0].id as string;
}

async function createCustomer(email: string, profileId: string | null = null) {
  const { rows } = await t.db.query(
    "insert into public.customers (email, profile_id) values ($1, $2) returning id",
    [email, profileId],
  );
  return rows[0].id as string;
}

/** The error code a statement fails with, or null if it succeeds. */
async function codeOf(run: () => Promise<unknown>) {
  try {
    await run();
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

beforeAll(async () => {
  t = await startTestDatabase();

  ids.admin = await createUser("admin@cutco.example");
  ids.barberUser = await createUser("marcus@cutco.example");
  ids.otherBarberUser = await createUser("daniyar@cutco.example");
  ids.client = await createUser("client@example.com", { full_name: "Ada Client", locale: "ru", role: "admin" });
  ids.otherClient = await createUser("other@example.com");

  await t.db.query("update public.profiles set role = 'admin' where id = $1", [ids.admin]);
  await t.db.query("update public.profiles set role = 'barber' where id = any($1)", [[ids.barberUser, ids.otherBarberUser]]);

  const linked = await t.db.query(
    `update public.barbers set profile_id = case slug when 'marcus-hale' then $1::uuid else $2::uuid end
     where slug in ('marcus-hale', 'daniyar-akhmetov') returning id, slug`,
    [ids.barberUser, ids.otherBarberUser],
  );
  for (const row of linked.rows) {
    if (row.slug === "marcus-hale") barbers.marcus = row.id;
    else barbers.daniyar = row.id;
  }

  const client = await createCustomer("client@example.com", ids.client);
  const other = await createCustomer("other@example.com", ids.otherClient);
  bookings.marcusClient = await insertBooking({
    barberId: barbers.marcus, customerId: client, start: "2030-03-05T10:00Z", end: "2030-03-05T10:45Z",
  });
  bookings.daniyarOther = await insertBooking({
    barberId: barbers.daniyar, customerId: other, start: "2030-03-06T11:00Z", end: "2030-03-06T11:45Z",
  });
}, 120_000);

afterAll(async () => {
  await t?.stop();
});

describe("migrations and seed", () => {
  it("seeds the bilingual catalog", async () => {
    const { rows } = await t.db.query(
      `select (select count(*) from public.services)::int as services,
              (select count(*) from public.barbers)::int as barbers,
              (select count(*) from public.services where name_ru = '' or description_ru = '')::int as untranslated,
              (select count(*) from public.shop_settings)::int as settings`,
    );
    expect(rows[0]).toEqual({ services: 8, barbers: 4, untranslated: 0, settings: 1 });
  });

  it("can be seeded twice without duplicates", async () => {
    await t.seed();
    const { rows } = await t.db.query(
      `select (select count(*) from public.services)::int as services,
              (select count(*) from public.working_hours)::int as hours,
              (select count(*) from public.barber_services)::int as eligibility`,
    );
    expect(rows[0]).toEqual({ services: 8, hours: 36, eligibility: 19 });
  });

  it("gives every seeded service a barber who can deliver it", async () => {
    const { rows } = await t.db.query(
      `select s.slug from public.services s
       where not exists (select 1 from public.barber_services bs where bs.service_id = s.id)`,
    );
    expect(rows).toEqual([]);
  });

  it("carries the approved booking policy in shop_settings", async () => {
    const { rows } = await t.db.query(
      `select timezone, currency, hold_minutes, slot_interval_minutes, min_lead_minutes, horizon_days, change_cutoff_hours
       from public.shop_settings`,
    );
    expect(rows[0]).toEqual({
      timezone: "Europe/London",
      currency: "USD",
      hold_minutes: 15,
      slot_interval_minutes: 30,
      min_lead_minutes: 120,
      horizon_days: 30,
      change_cutoff_hours: 12,
    });
  });

  // Phase 02 serves the catalog from a constant; it has to say what the seed says.
  it("matches the catalog the site is built from", async () => {
    const services = await t.db.query(
      `select slug, name_en, name_ru, description_en, description_ru, price_cents, duration_minutes
       from public.services order by sort_order`,
    );
    expect(services.rows).toEqual(
      mockCatalog.services.map((service) => ({
        slug: service.slug,
        name_en: service.name.en,
        name_ru: service.name.ru,
        description_en: service.description.en,
        description_ru: service.description.ru,
        price_cents: service.priceCents,
        duration_minutes: service.durationMinutes,
      })),
    );

    const seeded = await t.db.query(
      `select b.slug, b.name, b.title_en, b.title_ru, b.bio_en, b.bio_ru,
              (select array_agg(s.slug order by s.sort_order)
                 from public.barber_services bs join public.services s on s.id = bs.service_id
                where bs.barber_id = b.id) as services,
              (select array_agg(h.weekday || ' ' || to_char(h.start_time, 'HH24:MI') || '-' || to_char(h.end_time, 'HH24:MI')
                                order by h.weekday, h.start_time)
                 from public.working_hours h where h.barber_id = b.id) as hours
       from public.barbers b order by b.sort_order`,
    );
    const order = mockCatalog.services.map((service) => service.id);
    expect(seeded.rows).toEqual(
      mockCatalog.barbers.map((barber) => ({
        slug: barber.slug,
        name: barber.name,
        title_en: barber.title.en,
        title_ru: barber.title.ru,
        bio_en: barber.bio.en,
        bio_ru: barber.bio.ru,
        services: [...barber.serviceIds].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
        hours: [...barber.hours]
          .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
          .map((range) => `${range.weekday} ${range.start}-${range.end}`),
      })),
    );

    const shop = await t.db.query(
      `select name, address_line1, city, postcode, phone, email, hold_minutes, slot_interval_minutes,
              min_lead_minutes, horizon_days, change_cutoff_hours from public.shop_settings`,
    );
    const { policy, ...address } = mockCatalog.shop;
    expect(shop.rows[0]).toEqual({
      name: address.name,
      address_line1: address.addressLine1,
      city: address.city,
      postcode: address.postcode,
      phone: address.phone,
      email: address.email,
      hold_minutes: policy.holdMinutes,
      slot_interval_minutes: policy.slotIntervalMinutes,
      min_lead_minutes: policy.minLeadMinutes,
      horizon_days: policy.horizonDays,
      change_cutoff_hours: policy.changeCutoffHours,
    });
  });

  it("refuses any currency but USD", async () => {
    expect(await codeOf(() => t.db.query("update public.shop_settings set currency = 'GBP'"))).toBe(CHECK_VIOLATION);
  });
});

describe("confirmed bookings of one barber never overlap", () => {
  const customer = () => createCustomer(`overlap-${++nextReference}@example.com`);

  it("rejects an overlapping confirmed booking", async () => {
    const who = await customer();
    await insertBooking({ barberId: barbers.marcus, customerId: who, start: "2030-04-02T10:00Z", end: "2030-04-02T11:05Z" });
    const code = await codeOf(() =>
      insertBooking({ barberId: barbers.marcus, customerId: who, start: "2030-04-02T11:00Z", end: "2030-04-02T11:45Z" }),
    );
    expect(code).toBe(EXCLUSION_VIOLATION);
  });

  it("allows a booking that starts the minute the previous one ends", async () => {
    const who = await customer();
    await insertBooking({ barberId: barbers.marcus, customerId: who, start: "2030-04-03T10:00Z", end: "2030-04-03T11:05Z" });
    const code = await codeOf(() =>
      insertBooking({ barberId: barbers.marcus, customerId: who, start: "2030-04-03T11:05Z", end: "2030-04-03T11:50Z" }),
    );
    expect(code).toBeNull();
  });

  it("allows the same time with another barber", async () => {
    const who = await customer();
    await insertBooking({ barberId: barbers.marcus, customerId: who, start: "2030-04-04T10:00Z", end: "2030-04-04T10:45Z" });
    const code = await codeOf(() =>
      insertBooking({ barberId: barbers.daniyar, customerId: who, start: "2030-04-04T10:00Z", end: "2030-04-04T10:45Z" }),
    );
    expect(code).toBeNull();
  });

  it("frees the slot when a booking is cancelled", async () => {
    const who = await customer();
    const first = await insertBooking({ barberId: barbers.marcus, customerId: who, start: "2030-04-05T10:00Z", end: "2030-04-05T10:45Z" });
    await t.db.query("update public.bookings set status = 'cancelled' where id = $1", [first]);
    const code = await codeOf(() =>
      insertBooking({ barberId: barbers.marcus, customerId: who, start: "2030-04-05T10:00Z", end: "2030-04-05T10:45Z" }),
    );
    expect(code).toBeNull();
  });

  it("refuses to confirm a hold over a confirmed booking", async () => {
    const who = await customer();
    const hold = await insertBooking({
      barberId: barbers.marcus, customerId: who, start: "2030-04-06T10:00Z", end: "2030-04-06T10:45Z",
      status: "pending", holdExpiresAt: "2030-04-01T00:15Z",
    });
    await insertBooking({ barberId: barbers.marcus, customerId: who, start: "2030-04-06T10:30Z", end: "2030-04-06T11:15Z" });
    const code = await codeOf(() => t.db.query("update public.bookings set status = 'confirmed' where id = $1", [hold]));
    expect(code).toBe(EXCLUSION_VIOLATION);
  });

  it("requires a hold expiry on a pending booking", async () => {
    const who = await customer();
    const code = await codeOf(() =>
      insertBooking({ barberId: barbers.marcus, customerId: who, start: "2030-04-07T10:00Z", end: "2030-04-07T10:45Z", status: "pending" }),
    );
    expect(code).toBe(CHECK_VIOLATION);
  });
});

describe("accounts", () => {
  it("creates a client profile for a new user, whatever the sign-up data claims", async () => {
    const { rows } = await t.db.query("select role, full_name, locale from public.profiles where id = $1", [ids.client]);
    expect(rows[0]).toEqual({ role: "client", full_name: "Ada Client", locale: "ru" });
  });

  it("does not let a user change their own role", async () => {
    const code = await t.as("authenticated", ids.client, (db) =>
      codeOf(() => db.query("update public.profiles set role = 'admin' where id = $1", [ids.client])),
    );
    expect(code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("lets a user change their own name and language, and nobody else's", async () => {
    const changed = await t.as("authenticated", ids.client, async (db) => {
      const own = await db.query("update public.profiles set full_name = 'Ada L.', locale = 'en' where id = $1", [ids.client]);
      const other = await db.query("update public.profiles set full_name = 'Hacked' where id = $1", [ids.otherClient]);
      return [own.rowCount, other.rowCount];
    });
    expect(changed).toEqual([1, 0]);
  });
});

describe("row level security", () => {
  it("shows the public catalog to anonymous visitors", async () => {
    const counts = await t.as("anon", null, async (db) => {
      const services = await db.query("select count(*)::int as n from public.services");
      const barbersSeen = await db.query("select count(*)::int as n from public.barbers");
      const hours = await db.query("select count(*)::int as n from public.working_hours");
      return [services.rows[0].n, barbersSeen.rows[0].n, hours.rows[0].n];
    });
    expect(counts).toEqual([8, 4, 36]);
  });

  it("hides retired services from visitors but not from admins", async () => {
    await t.db.query("update public.services set is_active = false where slug = 'buzz-cut'");
    try {
      const seenByVisitor = await t.as("anon", null, (db) => db.query("select 1 from public.services where slug = 'buzz-cut'"));
      const seenByAdmin = await t.as("authenticated", ids.admin, (db) => db.query("select 1 from public.services where slug = 'buzz-cut'"));
      expect([seenByVisitor.rowCount, seenByAdmin.rowCount]).toEqual([0, 1]);
    } finally {
      await t.db.query("update public.services set is_active = true where slug = 'buzz-cut'");
    }
  });

  it.each([
    "bookings", "booking_services", "booking_events", "booking_tokens", "notification_jobs",
    "payment_records", "customers", "profiles", "time_off",
  ])("gives anonymous visitors no access to %s", async (table) => {
    const code = await t.as("anon", null, (db) => codeOf(() => db.query(`select 1 from public.${table} limit 1`)));
    expect(code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it.each(["booking_tokens", "notification_jobs"])("keeps %s from signed-in users, admins included", async (table) => {
    const code = await t.as("authenticated", ids.admin, (db) => codeOf(() => db.query(`select 1 from public.${table} limit 1`)));
    expect(code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("does not let visitors or clients write to the catalog", async () => {
    const insert = "insert into public.services (slug, name_en, name_ru, description_en, description_ru, price_cents, duration_minutes) values ('free', 'Free', 'Даром', 'x', 'x', 0, 5)";
    const asVisitor = await t.as("anon", null, (db) => codeOf(() => db.query(insert)));
    const asClient = await t.as("authenticated", ids.client, (db) => codeOf(() => db.query(insert)));
    const priceCut = await t.as("authenticated", ids.client, (db) => db.query("update public.services set price_cents = 1"));
    expect([asVisitor, asClient, priceCut.rowCount]).toEqual([INSUFFICIENT_PRIVILEGE, INSUFFICIENT_PRIVILEGE, 0]);
  });

  it("lets an admin manage the catalog and the weekly schedule", async () => {
    const changed = await t.as("authenticated", ids.admin, async (db) => {
      const price = await db.query("update public.services set price_cents = 4700 where slug = 'haircut'");
      const hours = await db.query("update public.working_hours set end_time = '18:00' where barber_id = $1 and weekday = 2 and start_time = '15:00'", [barbers.marcus]);
      return [price.rowCount, hours.rowCount];
    });
    expect(changed).toEqual([1, 1]);
  });

  it("does not let a barber change the weekly schedule, prices or roles", async () => {
    const result = await t.as("authenticated", ids.barberUser, async (db) => {
      const hours = await db.query("update public.working_hours set end_time = '23:00' where barber_id = $1", [barbers.marcus]);
      const price = await db.query("update public.services set price_cents = 1");
      const role = await codeOf(() => db.query("update public.profiles set role = 'admin' where id = $1", [ids.barberUser]));
      return [hours.rowCount, price.rowCount, role];
    });
    expect(result).toEqual([0, 0, INSUFFICIENT_PRIVILEGE]);
  });

  it("shows a client their own bookings only", async () => {
    const seen = await t.as("authenticated", ids.client, (db) => db.query("select id from public.bookings"));
    expect(seen.rows.map((row) => row.id)).toEqual([bookings.marcusClient]);
  });

  it("shows a barber their own bookings only, without customer emails", async () => {
    const result = await t.as("authenticated", ids.barberUser, async (db) => {
      const own = await db.query("select id from public.bookings where id = any($1)", [[bookings.marcusClient, bookings.daniyarOther]]);
      const emails = await db.query("select email from public.customers");
      const takings = await db.query("select 1 from public.payment_records");
      return [own.rows.map((row) => row.id), emails.rowCount, takings.rowCount];
    });
    expect(result).toEqual([[bookings.marcusClient], 0, 0]);
  });

  it("shows an admin every booking", async () => {
    const seen = await t.as("authenticated", ids.admin, (db) =>
      db.query("select id from public.bookings where id = any($1)", [[bookings.marcusClient, bookings.daniyarOther]]),
    );
    expect(seen.rowCount).toBe(2);
  });

  it("gives no API role a way to write bookings directly", async () => {
    const update = "update public.bookings set status = 'cancelled'";
    const codes = [];
    for (const user of [ids.client, ids.barberUser, ids.admin]) {
      codes.push(await t.as("authenticated", user, (db) => codeOf(() => db.query(update))));
    }
    expect(codes).toEqual([INSUFFICIENT_PRIVILEGE, INSUFFICIENT_PRIVILEGE, INSUFFICIENT_PRIVILEGE]);
  });

  it("stops treating a demoted barber as a barber", async () => {
    await t.db.query("update public.profiles set role = 'client' where id = $1", [ids.otherBarberUser]);
    try {
      const seen = await t.as("authenticated", ids.otherBarberUser, (db) => db.query("select id from public.bookings"));
      expect(seen.rowCount).toBe(0);
    } finally {
      await t.db.query("update public.profiles set role = 'barber' where id = $1", [ids.otherBarberUser]);
    }
  });
});

describe("audit history", () => {
  it("cannot be rewritten, even by the server", async () => {
    await t.db.query(
      "insert into public.booking_events (booking_id, type, to_status, actor) values ($1, 'created', 'confirmed', 'system')",
      [bookings.marcusClient],
    );
    const code = await codeOf(() => t.db.query("update public.booking_events set type = 'note' where booking_id = $1", [bookings.marcusClient]));
    expect(code).toBe("23001");
  });
});
