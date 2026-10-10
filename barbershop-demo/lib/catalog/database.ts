import { db } from "@/lib/db";
import type { Barber, Catalog, Service, Shop, WorkingRange } from "./types";

/** The catalog as it is in the database: active services and barbers, in display order. */
export async function loadCatalog(): Promise<Catalog> {
  const pool = db();
  const [settings, services, barbers, eligibility, hours] = await Promise.all([
    pool.query("select * from public.shop_settings"),
    pool.query("select * from public.services where is_active order by sort_order, id"),
    pool.query("select * from public.barbers where is_active order by sort_order, id"),
    pool.query("select barber_id, service_id from public.barber_services"),
    pool.query(
      `select barber_id, weekday, to_char(start_time, 'HH24:MI') as start, to_char(end_time, 'HH24:MI') as "end"
       from public.working_hours order by weekday, start_time`,
    ),
  ]);

  const s = settings.rows[0];
  const shop: Shop = {
    name: s.name,
    addressLine1: s.address_line1,
    city: s.city,
    postcode: s.postcode,
    phone: s.phone,
    email: s.email,
    policy: {
      holdMinutes: s.hold_minutes,
      slotIntervalMinutes: s.slot_interval_minutes,
      minLeadMinutes: s.min_lead_minutes,
      horizonDays: s.horizon_days,
      changeCutoffHours: s.change_cutoff_hours,
    },
  };

  const active = new Set<string>(services.rows.map((row) => row.id));

  return {
    shop,
    services: services.rows.map(
      (row): Service => ({
        id: row.id,
        slug: row.slug,
        name: { en: row.name_en, ru: row.name_ru },
        description: { en: row.description_en, ru: row.description_ru },
        priceCents: row.price_cents,
        durationMinutes: row.duration_minutes,
      }),
    ),
    barbers: barbers.rows.map(
      (row): Barber => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        title: { en: row.title_en, ru: row.title_ru },
        bio: { en: row.bio_en, ru: row.bio_ru },
        serviceIds: eligibility.rows
          .filter((pair) => pair.barber_id === row.id && active.has(pair.service_id))
          .map((pair) => pair.service_id),
        hours: hours.rows
          .filter((range) => range.barber_id === row.id)
          .map((range): WorkingRange => ({ weekday: range.weekday, start: range.start, end: range.end })),
      }),
    ),
  };
}
