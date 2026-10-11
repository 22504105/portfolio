import "server-only";
import { loadCatalog } from "@/lib/catalog/database";
import { db } from "@/lib/db";
import type { AdminBooking, AdminSource, Analytics, BookingStatus } from "./types";

// The real admin's data, straight from the database. Callers have already
// established that the user is an admin (lib/auth.ts); nothing here checks
// again, and nothing here is reachable from the demo.

type Row = Record<string, unknown>;

const BOOKING = `
  select b.id, b.reference, b.status, b.starts_at, b.ends_at, b.barber_id, br.name as barber_name,
         b.customer_name, b.customer_phone, c.email::text as customer_email, b.locale, b.source,
         b.total_price_cents, b.total_duration_minutes, p.amount_cents as paid_cents, p.method as paid_method,
         (select coalesce(json_agg(json_build_object('en', s.name_en, 'ru', s.name_ru, 'price', s.price_cents) order by s.position), '[]'::json)
            from public.booking_services s where s.booking_id = b.id) as services
  from public.bookings b
  join public.barbers br on br.id = b.barber_id
  join public.customers c on c.id = b.customer_id
  left join public.payment_records p on p.booking_id = b.id`;

const toBooking = (row: Row): AdminBooking => ({
  id: row.id as string,
  reference: row.reference as string,
  status: row.status as BookingStatus,
  startsAt: row.starts_at as Date,
  endsAt: row.ends_at as Date,
  barberId: row.barber_id as string,
  barberName: row.barber_name as string,
  customerName: row.customer_name as string,
  customerPhone: row.customer_phone as string,
  customerEmail: row.customer_email as string,
  locale: row.locale as AdminBooking["locale"],
  source: row.source as AdminBooking["source"],
  services: (row.services as { en: string; ru: string; price: number }[]).map((service) => ({
    name: { en: service.en, ru: service.ru },
    priceCents: service.price,
  })),
  totalPriceCents: row.total_price_cents as number,
  totalDurationMinutes: row.total_duration_minutes as number,
  paidCents: row.paid_cents as number | null,
  paidMethod: row.paid_method as AdminBooking["paidMethod"],
});

/** Makes a search term literal for ILIKE. */
const pattern = (search: string) => `%${search.trim().replace(/[\\%_]/g, "\\$&")}%`;

export const liveSource: AdminSource = {
  readOnly: false,

  shop: async () => (await loadCatalog()).shop,

  async services() {
    const { rows } = await db().query("select * from public.services order by is_active desc, sort_order, id");
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: { en: row.name_en, ru: row.name_ru },
      description: { en: row.description_en, ru: row.description_ru },
      priceCents: row.price_cents,
      durationMinutes: row.duration_minutes,
      isActive: row.is_active,
    }));
  },

  async barbers() {
    const pool = db();
    const [barbers, eligibility, hours] = await Promise.all([
      pool.query("select * from public.barbers order by is_active desc, sort_order, id"),
      pool.query("select barber_id, service_id from public.barber_services"),
      pool.query(
        `select barber_id, weekday, to_char(start_time, 'HH24:MI') as start, to_char(end_time, 'HH24:MI') as "end"
         from public.working_hours order by weekday, start_time`,
      ),
    ]);
    return barbers.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      title: { en: row.title_en, ru: row.title_ru },
      bio: { en: row.bio_en, ru: row.bio_ru },
      serviceIds: eligibility.rows.filter((pair) => pair.barber_id === row.id).map((pair) => pair.service_id),
      hours: hours.rows
        .filter((range) => range.barber_id === row.id)
        .map((range) => ({ weekday: range.weekday, start: range.start, end: range.end })),
      isActive: row.is_active,
      hasAccount: row.profile_id !== null,
    }));
  },

  async bookingsBetween(from, to) {
    const { rows } = await db().query(
      `${BOOKING}
       where b.starts_at < $2 and b.ends_at > $1 and b.status in ('confirmed', 'completed', 'no_show', 'cancelled')
       order by b.starts_at`,
      [from, to],
    );
    return rows.map(toBooking);
  },

  async findBookings({ status, search }) {
    const { rows } = await db().query(
      `${BOOKING}
       where ($1::public.booking_status is null or b.status = $1)
         and ($2::text is null or b.reference ilike $2 or b.customer_name ilike $2 or b.customer_phone ilike $2 or c.email::text ilike $2)
       order by b.starts_at desc
       limit 200`,
      [status ?? null, search?.trim() ? pattern(search) : null],
    );
    return rows.map(toBooking);
  },

  async booking(id) {
    // An id that is not a UUID is simply not a booking.
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const pool = db();
    const { rows } = await pool.query(`${BOOKING} where b.id = $1::uuid`, [id]);
    if (!rows[0]) return null;
    const events = await pool.query(
      "select created_at, type, actor, from_status, to_status from public.booking_events where booking_id = $1 order by id",
      [id],
    );
    return {
      booking: toBooking(rows[0]),
      events: events.rows.map((row) => ({
        at: row.created_at,
        type: row.type,
        actor: row.actor,
        fromStatus: row.from_status,
        toStatus: row.to_status,
      })),
    };
  },

  async awaitingOutcome() {
    const { rows } = await db().query(`${BOOKING} where b.status = 'confirmed' and b.ends_at <= clock_timestamp() order by b.starts_at`);
    return rows.map(toBooking);
  },

  async timeOff() {
    const { rows } = await db().query(
      `select t.id, t.barber_id, br.name as barber_name, t.kind, t.status, t.starts_at, t.ends_at, t.reason
       from public.time_off t
       left join public.barbers br on br.id = t.barber_id
       where t.ends_at > clock_timestamp() and t.status <> 'rejected' and t.kind <> 'break'
       order by (t.status = 'requested') desc, t.starts_at`,
    );
    return rows.map((row) => ({
      id: row.id,
      barberId: row.barber_id,
      barberName: row.barber_name,
      kind: row.kind,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      reason: row.reason,
    }));
  },

  async clients() {
    // The name and phone are the ones given with the customer's latest booking.
    const { rows } = await db().query(
      `select c.email::text as email, c.profile_id is not null as has_account,
              (select b.customer_name from public.bookings b where b.customer_id = c.id order by b.created_at desc limit 1) as name,
              (select b.customer_phone from public.bookings b where b.customer_id = c.id order by b.created_at desc limit 1) as phone,
              count(b.id) filter (where b.status = 'completed')::int as visits,
              count(b.id) filter (where b.status = 'no_show')::int as no_shows,
              max(b.starts_at) filter (where b.status = 'completed') as last_visit,
              min(b.starts_at) filter (where b.status = 'confirmed' and b.starts_at > clock_timestamp()) as next_visit
       from public.customers c
       join public.bookings b on b.customer_id = c.id and b.status in ('confirmed', 'completed', 'no_show', 'cancelled')
       group by c.id
       order by visits desc, name
       limit 500`,
    );
    return rows.map((row) => ({
      email: row.email,
      name: row.name ?? "",
      phone: row.phone ?? "",
      hasAccount: row.has_account,
      visits: row.visits,
      noShows: row.no_shows,
      lastVisit: row.last_visit,
      nextVisit: row.next_visit,
    }));
  },

  async analytics(from, to) {
    const { rows } = await db().query("select public.admin_analytics($1::date, $2::date) as a", [from, to]);
    const a = rows[0].a as Row & { top_services: Row[]; barbers: Row[]; by_status: Analytics["byStatus"] };
    return {
      from,
      to,
      bookings: Number(a.bookings),
      byStatus: a.by_status,
      paidCents: Number(a.paid_cents),
      payments: Number(a.payments),
      topServices: a.top_services.map((service) => ({
        name: { en: service.name_en as string, ru: service.name_ru as string },
        visits: service.visits as number,
        listedCents: Number(service.listed_cents),
      })),
      barbers: a.barbers.map((barber) => ({
        id: barber.id as string,
        name: barber.name as string,
        completed: barber.completed as number,
        noShows: barber.no_shows as number,
        cancelled: barber.cancelled as number,
        bookedMinutes: barber.booked_minutes as number,
        availableMinutes: barber.available_minutes as number,
        paidCents: Number(barber.paid_cents),
      })),
    };
  },
};
