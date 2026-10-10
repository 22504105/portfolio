import "server-only";
import type { Locale } from "@/i18n/routing";
import { asUser } from "./db";

// What a signed-in person sees of the calendar: a client their own bookings, a
// barber their own appointments and time off. Every read runs under the
// user's row level security as well as its own filter.

export type BookingSummary = {
  id: string;
  reference: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";
  startsAt: Date;
  endsAt: Date;
  barberName: string;
  customerName: string;
  customerPhone: string;
  services: Record<Locale, string>[];
  totalPriceCents: number;
  totalDurationMinutes: number;
};

type Row = Record<string, unknown>;

const SUMMARY = `
  select b.id, b.reference, b.status, b.starts_at, b.ends_at, b.customer_name, b.customer_phone,
         b.total_price_cents, b.total_duration_minutes, br.name as barber_name,
         (select coalesce(json_agg(json_build_object('en', s.name_en, 'ru', s.name_ru) order by s.position), '[]'::json)
            from public.booking_services s where s.booking_id = b.id) as services
  from public.bookings b
  join public.barbers br on br.id = b.barber_id`;

const toSummary = (row: Row): BookingSummary => ({
  id: row.id as string,
  reference: row.reference as string,
  status: row.status as BookingSummary["status"],
  startsAt: row.starts_at as Date,
  endsAt: row.ends_at as Date,
  barberName: row.barber_name as string,
  customerName: row.customer_name as string,
  customerPhone: row.customer_phone as string,
  services: row.services as Record<Locale, string>[],
  totalPriceCents: row.total_price_cents as number,
  totalDurationMinutes: row.total_duration_minutes as number,
});

/** A client's own bookings, newest first. Holds that were never confirmed are left out. */
export async function listClientBookings(userId: string): Promise<BookingSummary[]> {
  return asUser(userId, async (query) => {
    const { rows } = await query(
      `${SUMMARY}
       join public.customers c on c.id = b.customer_id
       where c.profile_id = $1 and b.status in ('confirmed', 'completed', 'cancelled', 'no_show')
       order by b.starts_at desc
       limit 100`,
      [userId],
    );
    return rows.map(toSummary);
  });
}

/** Whether a booking belongs to the client, as their row level security sees it. */
export async function clientOwnsBooking(userId: string, bookingId: string): Promise<boolean> {
  return asUser(userId, async (query) => {
    const { rowCount } = await query(
      `select 1 from public.bookings b join public.customers c on c.id = b.customer_id
       where b.id = $2::uuid and c.profile_id = $1`,
      [userId, bookingId],
    );
    return rowCount === 1;
  });
}

/** A barber's appointments in a range of time, earliest first. */
export async function listBarberBookings(userId: string, barberId: string, from: Date, to: Date): Promise<BookingSummary[]> {
  return asUser(userId, async (query) => {
    const { rows } = await query(
      `${SUMMARY}
       where b.barber_id = $1 and b.starts_at < $3 and b.ends_at > $2
         and b.status in ('confirmed', 'completed', 'no_show')
       order by b.starts_at`,
      [barberId, from, to],
    );
    return rows.map(toSummary);
  });
}

/** A barber's appointments that are over and still have no outcome. */
export async function listAwaitingOutcome(userId: string, barberId: string): Promise<BookingSummary[]> {
  return asUser(userId, async (query) => {
    const { rows } = await query(
      `${SUMMARY}
       where b.barber_id = $1 and b.status = 'confirmed' and b.ends_at <= clock_timestamp()
       order by b.starts_at`,
      [barberId],
    );
    return rows.map(toSummary);
  });
}

export type TimeOffEntry = {
  id: string;
  kind: "break" | "time_off" | "holiday";
  status: "requested" | "approved" | "rejected";
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
  /** Whether the barber may still withdraw it. */
  removable: boolean;
};

/** A barber's own breaks and time off that have not ended yet. */
export async function listBarberTimeOff(userId: string, barberId: string): Promise<TimeOffEntry[]> {
  return asUser(userId, async (query) => {
    const { rows } = await query(
      `select id, kind, status, starts_at, ends_at, reason,
              starts_at > clock_timestamp() and (kind = 'break' or status <> 'approved') as removable
       from public.time_off
       where barber_id = $1 and ends_at > clock_timestamp()
       order by starts_at`,
      [barberId],
    );
    return rows.map((row: Row) => ({
      id: row.id as string,
      kind: row.kind as TimeOffEntry["kind"],
      status: row.status as TimeOffEntry["status"],
      startsAt: row.starts_at as Date,
      endsAt: row.ends_at as Date,
      reason: row.reason as string | null,
      removable: row.removable as boolean,
    }));
  });
}
