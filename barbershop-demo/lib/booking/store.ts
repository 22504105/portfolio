import type { Locale } from "@/i18n/routing";
import { db } from "@/lib/db";
import type { Contact } from "./contact";
import type { HoldRefusal, HoldResult, Slot } from "./gateway";
import { hashToken, newToken } from "./tokens";

// The server's side of booking: thin calls into the database functions of
// supabase/migrations/20261011000100_booking_engine.sql, which hold the rules.
// Nothing here decides whether a slot is free.

type Row = Record<string, unknown>;

/** Everything about one booking that a page or an email shows. */
export type BookingView = {
  id: string;
  reference: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";
  locale: Locale;
  startsAt: Date;
  endsAt: Date;
  holdExpiresAt: Date | null;
  barber: { id: string; slug: string; name: string };
  customer: { name: string; email: string };
  services: { name: Record<Locale, string>; priceCents: number; durationMinutes: number }[];
  totalPriceCents: number;
  totalDurationMinutes: number;
  /** Whether the customer may still cancel or reschedule. */
  changeable: boolean;
};

/** Reasons the database gives that mean "this time cannot be booked any more". */
const TIME_GONE = new Set(["slot_taken", "too_soon", "outside_horizon", "off_grid"]);

function refusal(code: string): HoldRefusal {
  if (TIME_GONE.has(code)) return "slot_taken";
  if (code === "too_many_holds") return "too_many_holds";
  if (code === "invalid" || code === "not_eligible") return "invalid";
  return "unavailable";
}

const toSlots = (rows: Row[]): Slot[] =>
  rows.map((row) => ({ startsAt: (row.slot_start as Date).toISOString(), barberIds: row.free_barbers as string[] }));

export async function getAvailability(serviceIds: string[], barberId: string | null, date: string): Promise<Slot[]> {
  const { rows } = await db().query("select slot_start, free_barbers from public.get_availability($1::uuid[], $2::uuid, $3::date)", [
    serviceIds,
    barberId,
    date,
  ]);
  return toSlots(rows);
}

export async function getRescheduleAvailability(bookingId: string, date: string): Promise<Slot[]> {
  const { rows } = await db().query("select slot_start, free_barbers from public.get_reschedule_availability($1::uuid, $2::date)", [
    bookingId,
    date,
  ]);
  return toSlots(rows);
}

type HoldInput = {
  serviceIds: string[];
  barberId: string | null;
  startsAt: string;
  contact: Contact;
  locale: Locale;
};

export async function createHold({ serviceIds, barberId, startsAt, contact, locale }: HoldInput): Promise<HoldResult> {
  const { rows } = await db().query(
    "select public.create_booking_hold($1::uuid[], $2::uuid, $3::timestamptz, $4, $5, $6, $7) as result",
    [serviceIds, barberId, startsAt, contact.name, contact.email, contact.phone, locale],
  );
  const result = rows[0].result as Row;
  if (!result.ok) return { ok: false, code: refusal(result.code as string) };
  return {
    ok: true,
    reference: result.reference as string,
    barberId: result.barber_id as string,
    expiresAt: new Date(result.expires_at as string).toISOString(),
  };
}

export type ConfirmResult =
  | { ok: true; bookingId: string; alreadyConfirmed: boolean }
  | { ok: false; code: "hold_expired" | "invalid_token" | "slot_taken" };

export async function confirmByToken(token: string): Promise<ConfirmResult> {
  const { rows } = await db().query("select public.confirm_booking($1) as result", [hashToken(token)]);
  const result = rows[0].result as Row;
  if (!result.ok) return { ok: false, code: result.code as "hold_expired" | "invalid_token" | "slot_taken" };
  return { ok: true, bookingId: result.booking_id as string, alreadyConfirmed: Boolean(result.already_confirmed) };
}

export type ChangeRefusal = "past_cutoff" | "slot_taken" | "not_changeable" | "unavailable";
export type ChangeResult = { ok: true } | { ok: false; code: ChangeRefusal };

function changeResult(result: Row): ChangeResult {
  if (result.ok) return { ok: true };
  const code = result.code as string;
  if (code === "past_cutoff") return { ok: false, code };
  if (TIME_GONE.has(code)) return { ok: false, code: "slot_taken" };
  if (code === "not_changeable" || code === "not_found") return { ok: false, code: "not_changeable" };
  return { ok: false, code: "unavailable" };
}

/** Cancels on behalf of the customer: the twelve-hour rule applies. */
export async function cancelByCustomer(bookingId: string): Promise<ChangeResult> {
  const { rows } = await db().query("select public.cancel_booking($1::uuid, 'guest') as result", [bookingId]);
  return changeResult(rows[0].result);
}

/** Reschedules on behalf of the customer: the twelve-hour rule applies. */
export async function rescheduleByCustomer(bookingId: string, startsAt: string): Promise<ChangeResult> {
  const { rows } = await db().query("select public.reschedule_booking($1::uuid, $2::timestamptz, 'guest') as result", [
    bookingId,
    startsAt,
  ]);
  return changeResult(rows[0].result);
}

export async function getBookingView(bookingId: string): Promise<BookingView | null> {
  const pool = db();
  const { rows } = await pool.query(
    `select b.*, c.email::text as customer_email, br.slug as barber_slug, br.name as barber_name,
            b.status = 'confirmed'
              and b.starts_at - clock_timestamp() >= make_interval(hours => (select change_cutoff_hours from public.shop_settings))
              as changeable
     from public.bookings b
     join public.customers c on c.id = b.customer_id
     join public.barbers br on br.id = b.barber_id
     where b.id = $1::uuid`,
    [bookingId],
  );
  const row = rows[0];
  if (!row) return null;

  const lines = await pool.query(
    "select name_en, name_ru, price_cents, duration_minutes from public.booking_services where booking_id = $1 order by position",
    [bookingId],
  );

  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    locale: row.locale,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    holdExpiresAt: row.hold_expires_at,
    barber: { id: row.barber_id, slug: row.barber_slug, name: row.barber_name },
    customer: { name: row.customer_name, email: row.customer_email },
    services: lines.rows.map((line) => ({
      name: { en: line.name_en, ru: line.name_ru },
      priceCents: line.price_cents,
      durationMinutes: line.duration_minutes,
    })),
    totalPriceCents: row.total_price_cents,
    totalDurationMinutes: row.total_duration_minutes,
    changeable: row.changeable,
  };
}

/** Creates an email-link token for a booking and returns it. Only its hash is stored. */
export async function issueToken(bookingId: string, purpose: "verify" | "manage", expiresAt: Date): Promise<string> {
  const { token, hash } = newToken();
  await db().query("insert into public.booking_tokens (booking_id, purpose, token_hash, expires_at) values ($1, $2, $3, $4)", [
    bookingId,
    purpose,
    hash,
    expiresAt,
  ]);
  return token;
}

/** The booking a management link is for, or null if the link is unknown or has run out. */
export async function openManageToken(token: string): Promise<string | null> {
  const { rows } = await db().query(
    "select booking_id from public.booking_tokens where token_hash = $1 and purpose = 'manage' and expires_at > clock_timestamp()",
    [hashToken(token)],
  );
  return rows[0]?.booking_id ?? null;
}

/** Counts a hit against a limit and says whether it is still allowed. */
export async function allowed(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { rows } = await db().query("select public.hit_rate_limit($1, $2, $3) as ok", [key, limit, windowSeconds]);
  return rows[0].ok;
}
