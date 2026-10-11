"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { clientOwnsBooking } from "@/lib/account";
import { getSessionUser } from "@/lib/auth";
import { openSession } from "@/lib/booking/session";
import { addDays, zonedInstant } from "@/lib/business-time";
import { db } from "@/lib/db";

// What signed-in clients and barbers can do. Every action starts from the
// session: who the caller is and which barber they are comes from the server,
// never from the form.

const uuid = z.uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);

/** Opens the page where a client views, moves or cancels one of their own bookings. */
export async function openMyBooking(form: FormData): Promise<void> {
  const locale = hasLocale(routing.locales, form.get("locale")) ? (form.get("locale") as "en" | "ru") : routing.defaultLocale;
  const user = await getSessionUser();
  const bookingId = uuid.safeParse(form.get("bookingId"));
  if (!user) return redirect({ href: "/login", locale });
  // Not theirs, or not a booking: back to the list, with no explanation to probe.
  if (!bookingId.success || !(await clientOwnsBooking(user.id, bookingId.data))) return redirect({ href: "/account", locale });

  await openSession(bookingId.data);
  redirect({ href: "/booking/manage", locale });
}

export type StaffState = { error?: string; done?: "added" | "requested" };

/**
 * Makes the barber's pages read their lists again. A server action does not
 * refresh the page it was sent from unless it says something has changed.
 */
const refreshWorkspace = () => revalidatePath("/[locale]/barber", "layout");

/** The barber the caller is, or null: decided by the session and the database. */
async function actingBarber() {
  const user = await getSessionUser();
  return user?.role === "barber" && user.barberId ? { userId: user.id, barberId: user.barberId } : null;
}

/** Records that a client came, or did not. Only the barber's own, and only once it has started. */
export async function closeAppointment(form: FormData): Promise<void> {
  const barber = await actingBarber();
  const parsed = z.object({ bookingId: uuid, outcome: z.enum(["completed", "no_show"]) }).safeParse(Object.fromEntries(form));
  if (!barber || !parsed.success) return;

  await db().query("select public.close_booking($1, $2, 'barber', $3, $4)", [
    parsed.data.bookingId,
    parsed.data.outcome,
    barber.userId,
    barber.barberId,
  ]);
  refreshWorkspace();
}

export async function addBreak(_: StaffState, form: FormData): Promise<StaffState> {
  const barber = await actingBarber();
  if (!barber) return { error: "forbidden" };
  const parsed = z.object({ date, from: time, to: time }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid" };

  const { rows } = await db().query("select public.add_time_off($1, 'break', $2, $3, null, $4) as result", [
    barber.barberId,
    zonedInstant(parsed.data.date, parsed.data.from),
    zonedInstant(parsed.data.date, parsed.data.to),
    barber.userId,
  ]);
  if (!rows[0].result.ok) return { error: rows[0].result.code };
  refreshWorkspace();
  return { done: "added" };
}

export async function requestTimeOff(_: StaffState, form: FormData): Promise<StaffState> {
  const barber = await actingBarber();
  if (!barber) return { error: "forbidden" };
  const parsed = z.object({ first: date, last: date, reason: z.string().trim().max(200) }).safeParse(Object.fromEntries(form));
  if (!parsed.success || parsed.data.last < parsed.data.first) return { error: "invalid" };

  // Whole days in the shop's time: from the start of the first to the start of the day after the last.
  const { rows } = await db().query("select public.add_time_off($1, 'time_off', $2, $3, $4, $5) as result", [
    barber.barberId,
    zonedInstant(parsed.data.first, "00:00"),
    zonedInstant(addDays(parsed.data.last, 1), "00:00"),
    parsed.data.reason,
    barber.userId,
  ]);
  if (!rows[0].result.ok) return { error: rows[0].result.code };
  refreshWorkspace();
  return { done: "requested" };
}

export async function removeTimeOff(form: FormData): Promise<void> {
  const barber = await actingBarber();
  const id = uuid.safeParse(form.get("id"));
  if (!barber || !id.success) return;
  await db().query("select public.remove_time_off($1, $2)", [id.data, barber.barberId]);
  refreshWorkspace();
}
