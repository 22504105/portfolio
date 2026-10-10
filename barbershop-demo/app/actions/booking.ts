"use server";

import { hasLocale } from "next-intl";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { normalizeContact, validateContact } from "@/lib/booking/contact";
import type { AvailabilityRequest, HoldRequest, HoldResult, Slot } from "@/lib/booking/gateway";
import { openSession, sessionBookingId } from "@/lib/booking/session";
import * as store from "@/lib/booking/store";
import { looksLikeToken, throttleKey } from "@/lib/booking/tokens";
import { processDueJobs } from "@/lib/email/worker";

// Everything the browser can ask of the booking engine. Each action checks
// what it is given as if it came from a stranger, because it does: prices,
// durations, the barber assigned and every status are decided by the database
// and never taken from the request.

const uuid = z.uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instant = z.iso.datetime({ offset: true });

const availabilityRequest = z.object({
  serviceIds: z.array(uuid).min(1).max(6),
  barberId: uuid.nullable(),
  date,
});

const holdRequest = z.object({
  serviceIds: z.array(uuid).min(1).max(6),
  barberId: uuid.nullable(),
  startsAt: instant,
  contact: z.object({ name: z.string().max(200), email: z.string().max(320), phone: z.string().max(60) }),
  locale: z.string(),
});

/** The address the request came from, as far as the platform tells us. */
async function clientAddress(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || "unknown";
}

/** Emails queued by an action leave as soon as the response has been sent. */
function sendQueuedEmails() {
  after(async () => {
    try {
      await processDueJobs();
    } catch (error) {
      console.error("Email queue run failed:", error instanceof Error ? error.message : error);
    }
  });
}

export async function fetchAvailability(request: AvailabilityRequest): Promise<Slot[]> {
  const parsed = availabilityRequest.safeParse(request);
  if (!parsed.success) return [];
  // Generous: a customer browsing dates makes many of these.
  if (!(await store.allowed(throttleKey("availability:ip", await clientAddress()), 240, 600))) return [];
  return store.getAvailability(parsed.data.serviceIds, parsed.data.barberId, parsed.data.date);
}

export async function submitHold(request: HoldRequest): Promise<HoldResult> {
  const parsed = holdRequest.safeParse(request);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const { locale } = parsed.data;
  if (!hasLocale(routing.locales, locale)) return { ok: false, code: "invalid" };

  const contact = normalizeContact(parsed.data.contact);
  if (Object.keys(validateContact(contact)).length > 0) return { ok: false, code: "invalid" };

  // Per address and per email: enough for a person, too few to flood a calendar
  // with holds or someone's inbox with emails.
  const [byAddress, byEmail] = await Promise.all([
    store.allowed(throttleKey("hold:ip", await clientAddress()), 10, 3600),
    store.allowed(throttleKey("hold:email", contact.email), 5, 3600),
  ]);
  if (!byAddress || !byEmail) return { ok: false, code: "too_many_holds" };

  try {
    const result = await store.createHold({ ...parsed.data, contact, locale });
    if (result.ok) sendQueuedEmails();
    return result;
  } catch (error) {
    console.error("Hold failed:", error instanceof Error ? error.message : error);
    return { ok: false, code: "unavailable" };
  }
}

export type ConfirmOutcome = "confirmed" | "expired" | "invalid";

/**
 * Confirms a booking from its email link and opens the management session for
 * it. Called from a button, not on page load: mail scanners that follow links
 * must not be able to confirm anything.
 */
export async function confirmBooking(token: string): Promise<ConfirmOutcome> {
  if (!looksLikeToken(token)) return "invalid";
  if (!(await store.allowed(throttleKey("confirm:ip", await clientAddress()), 30, 600))) return "invalid";

  const result = await store.confirmByToken(token);
  if (!result.ok) return result.code === "hold_expired" ? "expired" : "invalid";

  await openSession(result.bookingId);
  if (!result.alreadyConfirmed) sendQueuedEmails();
  return "confirmed";
}

export async function fetchRescheduleAvailability(day: string): Promise<Slot[]> {
  const bookingId = await sessionBookingId();
  if (!bookingId || !date.safeParse(day).success) return [];
  return store.getRescheduleAvailability(bookingId, day);
}

export async function cancelBooking(): Promise<store.ChangeResult> {
  const bookingId = await sessionBookingId();
  if (!bookingId) return { ok: false, code: "not_changeable" };
  const result = await store.cancelByCustomer(bookingId);
  if (result.ok) sendQueuedEmails();
  return result;
}

export async function rescheduleBooking(startsAt: string): Promise<store.ChangeResult> {
  const bookingId = await sessionBookingId();
  if (!bookingId || !instant.safeParse(startsAt).success) return { ok: false, code: "not_changeable" };
  const result = await store.rescheduleByCustomer(bookingId, startsAt);
  if (result.ok) sendQueuedEmails();
  return result;
}
