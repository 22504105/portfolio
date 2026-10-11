"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth";
import { addDays, zonedInstant } from "@/lib/business-time";
import { db } from "@/lib/db";
import { processDueJobs } from "@/lib/email/worker";
import { parseDollarsToCents } from "@/lib/money";

// Everything an admin can change. Each action starts by establishing, from
// the session and the database, that the caller is an admin; a form posted by
// anyone else changes nothing. The public demo has no actions at all.
//
// Actions answer by redirecting back to the page with a notice in the address
// (?notice=saved or ?notice=error:code), so every form works without
// JavaScript and the page shows what happened.

const uuid = z.uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);
const text = (max: number) => z.string().trim().min(1).max(max);

async function admin(form: FormData): Promise<{ id: string; locale: Locale }> {
  const locale = hasLocale(routing.locales, form.get("locale")) ? (form.get("locale") as Locale) : routing.defaultLocale;
  const user = await getSessionUser();
  if (user?.role !== "admin") return redirect({ href: "/login", locale });
  return { id: user.id, locale };
}

/** Sends the admin back to a page of the admin area, with what happened. */
function back(locale: Locale, path: string, notice: string): never {
  revalidatePath("/[locale]/admin", "layout");
  const [pathname, search] = path.split("?");
  const query = Object.fromEntries(new URLSearchParams(search ?? ""));
  return redirect({ href: { pathname: `/admin${pathname}`, query: { ...query, notice } }, locale });
}

const failure = (code: unknown) => `error:${typeof code === "string" ? code : "failed"}`;

/** A path inside the admin area to return to, taken from the form. */
const returnTo = (form: FormData, fallback: string) => {
  const value = form.get("returnTo");
  // "" is the overview. Anything else must be a path inside the admin area.
  return typeof value === "string" && (value === "" || /^\/[a-z0-9/-]*(\?[\w=&%.-]*)?$/i.test(value)) ? value : fallback;
};

const sendQueuedEmails = () =>
  after(async () => {
    try {
      await processDueJobs();
    } catch (error) {
      console.error("Email queue run failed:", error instanceof Error ? error.message : error);
    }
  });

type Outcome = { ok: boolean; code?: string; [key: string]: unknown };
const run = async (sql: string, params: unknown[]): Promise<Outcome> => (await db().query(`select ${sql} as result`, params)).rows[0].result;

// --- Bookings ---------------------------------------------------------------

export async function recordOutcome(form: FormData): Promise<void> {
  const { id, locale } = await admin(form);
  const parsed = z.object({ bookingId: uuid, outcome: z.enum(["completed", "no_show"]) }).safeParse(Object.fromEntries(form));
  const to = returnTo(form, "/bookings");
  if (!parsed.success) back(locale, to, failure("invalid"));
  const result = await run("public.close_booking($1, $2, 'admin', $3, null)", [parsed.data.bookingId, parsed.data.outcome, id]);
  back(locale, to, result.ok ? "outcome" : failure(result.code));
}

export async function cancelBooking(form: FormData): Promise<void> {
  const { id, locale } = await admin(form);
  const bookingId = uuid.safeParse(form.get("bookingId"));
  const to = returnTo(form, "/bookings");
  if (!bookingId.success) back(locale, to, failure("invalid"));
  // Staff are not bound by the twelve-hour rule.
  const result = await run("public.cancel_booking($1, 'admin', $2, false)", [bookingId.data, id]);
  if (result.ok) sendQueuedEmails();
  back(locale, to, result.ok ? "cancelled" : failure(result.code));
}

export async function moveBooking(form: FormData): Promise<void> {
  const { id, locale } = await admin(form);
  const parsed = z.object({ bookingId: uuid, startsAt: z.iso.datetime({ offset: true }) }).safeParse(Object.fromEntries(form));
  const to = returnTo(form, "/bookings");
  if (!parsed.success) back(locale, to, failure("invalid"));
  const result = await run("public.reschedule_booking($1, $2, 'admin', $3, false)", [parsed.data.bookingId, parsed.data.startsAt, id]);
  if (result.ok) sendQueuedEmails();
  back(locale, `/bookings/${parsed.data.bookingId}`, result.ok ? "moved" : failure(result.code));
}

export async function recordPayment(form: FormData): Promise<void> {
  const { id, locale } = await admin(form);
  const parsed = z
    .object({ bookingId: uuid, amount: z.string(), method: z.enum(["cash", "card_terminal"]), note: z.string().max(200) })
    .safeParse(Object.fromEntries(form));
  const to = returnTo(form, "/bookings");
  const cents = parsed.success ? parseDollarsToCents(parsed.data.amount) : null;
  if (!parsed.success || cents === null) back(locale, to, failure("invalid"));
  const result = await run("public.record_payment($1, $2, $3, $4, $5)", [parsed.data.bookingId, cents, parsed.data.method, parsed.data.note, id]);
  back(locale, to, result.ok ? "paid" : failure(result.code));
}

export async function removePayment(form: FormData): Promise<void> {
  const { id, locale } = await admin(form);
  const bookingId = uuid.safeParse(form.get("bookingId"));
  const to = returnTo(form, "/bookings");
  if (!bookingId.success) back(locale, to, failure("invalid"));
  const result = await run("public.remove_payment($1, $2)", [bookingId.data, id]);
  back(locale, to, result.ok ? "unpaid" : failure(result.code));
}

export async function createBooking(form: FormData): Promise<void> {
  const { id, locale } = await admin(form);
  const to = returnTo(form, "/bookings/new");
  const parsed = z
    .object({
      services: z.array(uuid).min(1).max(6),
      barberId: uuid,
      startsAt: z.iso.datetime({ offset: true }),
      name: text(80),
      email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
      phone: text(40),
      language: z.enum(routing.locales),
    })
    .safeParse({ ...Object.fromEntries(form), services: form.getAll("services") });
  if (!parsed.success) back(locale, to, failure("invalid"));

  const { services, barberId, startsAt, name, email, phone, language } = parsed.data;
  const result = await run("public.create_admin_booking($1::uuid[], $2, $3, $4, $5, $6, $7, $8)", [services, barberId, startsAt, name, email, phone, language, id]);
  if (!result.ok) back(locale, to, failure(result.code));
  sendQueuedEmails();
  back(locale, `/bookings/${result.booking_id as string}`, "created");
}

// --- Time off ---------------------------------------------------------------

export async function decideTimeOff(form: FormData): Promise<void> {
  const { id, locale } = await admin(form);
  const parsed = z.object({ id: uuid, decision: z.enum(["approve", "decline"]) }).safeParse(Object.fromEntries(form));
  const to = returnTo(form, "");
  if (!parsed.success) back(locale, to, failure("invalid"));
  const result = await run("public.decide_time_off($1, $2, $3)", [parsed.data.id, parsed.data.decision === "approve", id]);
  back(locale, to, result.ok ? "decided" : failure(result.code));
}

export async function addClosure(form: FormData): Promise<void> {
  const { id, locale } = await admin(form);
  const parsed = z.object({ first: date, last: date, reason: z.string().trim().max(200) }).safeParse(Object.fromEntries(form));
  if (!parsed.success || parsed.data.last < parsed.data.first) back(locale, "/settings", failure("invalid"));
  // Whole days in the shop's time.
  const result = await run("public.add_time_off(null, 'holiday', $1, $2, $3, $4, true)", [
    zonedInstant(parsed.data.first, "00:00"),
    zonedInstant(addDays(parsed.data.last, 1), "00:00"),
    parsed.data.reason,
    id,
  ]);
  back(locale, "/settings", result.ok ? "saved" : failure(result.code));
}

// --- Catalog ----------------------------------------------------------------

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function saveService(form: FormData): Promise<void> {
  const { locale } = await admin(form);
  const parsed = z
    .object({
      id: uuid.optional(),
      nameEn: text(80),
      nameRu: text(80),
      descEn: text(300),
      descRu: text(300),
      price: z.string(),
      duration: z.coerce.number().int().min(5).max(480),
    })
    .safeParse(Object.fromEntries([...form].filter(([, value]) => value !== "")));
  const cents = parsed.success ? parseDollarsToCents(parsed.data.price) : null;
  if (!parsed.success || cents === null) back(locale, "/services", failure("invalid"));

  const { id, nameEn, nameRu, descEn, descRu, duration } = parsed.data;
  const active = form.get("active") === "on";
  const slug = slugify(nameEn);
  // A new service needs a name the address of its booking link can be made from.
  if (!id && !slug) back(locale, "/services", failure("invalid"));
  try {
    if (id) {
      // Bookings already made keep their own snapshot of name, price and duration.
      await db().query(
        `update public.services set name_en = $2, name_ru = $3, description_en = $4, description_ru = $5,
                                    price_cents = $6, duration_minutes = $7, is_active = $8 where id = $1`,
        [id, nameEn, nameRu, descEn, descRu, cents, duration, active],
      );
    } else {
      await db().query(
        `insert into public.services (slug, name_en, name_ru, description_en, description_ru, price_cents, duration_minutes, is_active, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7, $8, (select coalesce(max(sort_order), 0) + 10 from public.services))`,
        [slug, nameEn, nameRu, descEn, descRu, cents, duration, active],
      );
    }
  } catch (error) {
    // 23505: the slug made from the name is taken.
    back(locale, "/services", failure((error as { code?: string }).code === "23505" ? "duplicate" : "failed"));
  }
  revalidatePath("/[locale]", "layout");
  back(locale, "/services", "saved");
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export async function saveBarber(form: FormData): Promise<void> {
  const { locale } = await admin(form);
  const parsed = z
    .object({ id: uuid, name: text(80), titleEn: text(80), titleRu: text(80), bioEn: text(400), bioRu: text(400) })
    .safeParse(Object.fromEntries(form));
  const services = z.array(uuid).max(50).safeParse(form.getAll("services"));
  if (!parsed.success || !services.success) back(locale, "/barbers", failure("invalid"));

  // Up to two ranges a day. A range is used when both its ends are filled in.
  const hours: { weekday: number; start: string; end: string }[] = [];
  for (const weekday of WEEKDAYS) {
    for (const part of ["a", "b"]) {
      const start = form.get(`hours-${weekday}-${part}-start`);
      const end = form.get(`hours-${weekday}-${part}-end`);
      if (!start && !end) continue;
      if (!time.safeParse(start).success || !time.safeParse(end).success || (end as string) <= (start as string)) {
        back(locale, "/barbers", failure("invalid"));
      }
      hours.push({ weekday, start: start as string, end: end as string });
    }
    const day = hours.filter((range) => range.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start));
    if (day.length === 2 && day[1].start < day[0].end) back(locale, "/barbers", failure("invalid"));
  }

  const { id, name, titleEn, titleRu, bioEn, bioRu } = parsed.data;
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query(
      "update public.barbers set name = $2, title_en = $3, title_ru = $4, bio_en = $5, bio_ru = $6, is_active = $7 where id = $1",
      [id, name, titleEn, titleRu, bioEn, bioRu, form.get("active") === "on"],
    );
    await client.query("delete from public.barber_services where barber_id = $1", [id]);
    await client.query("insert into public.barber_services (barber_id, service_id) select $1, unnest($2::uuid[])", [id, services.data]);
    await client.query("delete from public.working_hours where barber_id = $1", [id]);
    for (const range of hours) {
      await client.query("insert into public.working_hours (barber_id, weekday, start_time, end_time) values ($1, $2, $3, $4)", [
        id,
        range.weekday,
        range.start,
        range.end,
      ]);
    }
    await client.query("commit");
  } catch {
    await client.query("rollback");
    client.release();
    back(locale, "/barbers", failure("failed"));
  }
  client.release();
  revalidatePath("/[locale]", "layout");
  back(locale, "/barbers", "saved");
}

export async function saveSettings(form: FormData): Promise<void> {
  const { locale } = await admin(form);
  const whole = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
  const parsed = z
    .object({
      name: text(80),
      address: text(120),
      city: text(80),
      postcode: text(20),
      phone: text(40),
      email: z.string().trim().max(254).pipe(z.email()),
      hold: whole(1, 120),
      lead: whole(0, 1440),
      horizon: whole(1, 365),
      cutoff: whole(0, 168),
      maxBreak: whole(5, 480),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) back(locale, "/settings", failure("invalid"));

  const s = parsed.data;
  // Currency, time zone and the slot interval are not settings: the product is built on them.
  await db().query(
    `update public.shop_settings set name = $1, address_line1 = $2, city = $3, postcode = $4, phone = $5, email = $6,
            hold_minutes = $7, min_lead_minutes = $8, horizon_days = $9, change_cutoff_hours = $10, max_break_minutes = $11`,
    [s.name, s.address, s.city, s.postcode, s.phone, s.email, s.hold, s.lead, s.horizon, s.cutoff, s.maxBreak],
  );
  revalidatePath("/[locale]", "layout");
  back(locale, "/settings", "saved");
}
