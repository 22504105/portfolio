import "server-only";
import { db } from "@/lib/db";

// Free times as staff see them. The same rules as for customers, except the
// lead time: staff may book a walk-in into the slot that has just begun. The
// database functions that write the booking apply the same allowance.

/** How far back "now" is moved for the question, matching create_admin_booking. */
const STAFF_NOW = "clock_timestamp() - make_interval(mins => (select min_lead_minutes from public.shop_settings) + 30)";

export async function staffAvailability(serviceIds: string[], barberId: string, date: string): Promise<Date[]> {
  const { rows } = await db().query(
    `select slot_start from public.get_availability($1::uuid[], $2::uuid, $3::date, ${STAFF_NOW}) where slot_start > clock_timestamp() - interval '30 minutes'`,
    [serviceIds, barberId, date],
  );
  return rows.map((row) => row.slot_start as Date);
}

export async function staffRescheduleAvailability(bookingId: string, date: string): Promise<Date[]> {
  const { rows } = await db().query(
    `select slot_start from public.get_reschedule_availability($1::uuid, $2::date, ${STAFF_NOW}) where slot_start > clock_timestamp() - interval '30 minutes'`,
    [bookingId, date],
  );
  return rows.map((row) => row.slot_start as Date);
}
