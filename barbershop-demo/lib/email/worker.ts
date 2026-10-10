import { getBookingView, issueToken, type BookingView } from "@/lib/booking/store";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import type { EmailType } from "./copy";
import { renderEmail } from "./render";
import { defaultTransport, type EmailTransport } from "./transport";

// The queue worker: takes due email jobs, checks each is still wanted, writes
// the email in the booking's language and sends it. Run after every booking
// action (so a verification email leaves at once) and by the scheduler.

type Job = { id: string; booking_id: string; type: EmailType; idempotency_key: string };

export type WorkerReport = { expired: number; sent: number; skipped: number; failed: number };

/**
 * Whether an email still makes sense for the booking as it is now. A reminder
 * for a booking that was cancelled or moved since it was queued must not go out.
 */
function stillWanted(job: Job, booking: BookingView, now: Date): boolean {
  // Reminders and reschedule notices carry the start time they were queued for.
  const queuedFor = Number(job.idempotency_key.split(":").at(-1));
  const sameStart = queuedFor === Math.floor(booking.startsAt.getTime() / 1000);

  switch (job.type) {
    case "verification":
      return booking.status === "pending" && booking.holdExpiresAt !== null && booking.holdExpiresAt > now;
    case "confirmation":
      return booking.status === "confirmed";
    case "reschedule":
      return booking.status === "confirmed" && sameStart;
    case "reminder_24h":
    case "reminder_2h":
      return booking.status === "confirmed" && sameStart && booking.startsAt > now;
    case "cancellation":
      return booking.status === "cancelled";
  }
}

/** The link an email carries, with a token made for this email alone. */
async function linkFor(type: EmailType, booking: BookingView, appUrl: string): Promise<string | undefined> {
  if (type === "cancellation") return undefined;
  if (type === "verification") {
    const token = await issueToken(booking.id, "verify", booking.holdExpiresAt!);
    return `${appUrl}/${booking.locale}/booking/confirm?token=${token}`;
  }
  // A management link works until the appointment is over.
  const token = await issueToken(booking.id, "manage", booking.endsAt);
  return `${appUrl}/${booking.locale}/booking/manage/open?token=${token}`;
}

export async function processDueJobs(limit = 10, transport: EmailTransport = defaultTransport()): Promise<WorkerReport> {
  const pool = db();
  const { APP_URL } = getServerEnv();
  const report: WorkerReport = { expired: 0, sent: 0, skipped: 0, failed: 0 };

  report.expired = (await pool.query("select public.expire_stale_holds() as n")).rows[0].n;

  const jobs = (await pool.query("select id, booking_id, type, idempotency_key from public.claim_notification_jobs($1)", [limit]))
    .rows as Job[];
  if (jobs.length === 0) return report;

  const s = (await pool.query("select address_line1, city, postcode, hold_minutes, change_cutoff_hours from public.shop_settings")).rows[0];
  const shop = {
    addressLine1: s.address_line1,
    city: s.city,
    postcode: s.postcode,
    holdMinutes: s.hold_minutes,
    changeCutoffHours: s.change_cutoff_hours,
  };

  for (const job of jobs) {
    try {
      const booking = await getBookingView(job.booking_id);
      if (!booking || !stillWanted(job, booking, new Date())) {
        await pool.query("select public.skip_notification_job($1)", [job.id]);
        report.skipped++;
        continue;
      }

      const email = renderEmail({ type: job.type, booking, shop, link: await linkFor(job.type, booking, APP_URL) });
      const messageId = await transport({ ...email, to: booking.customer.email, idempotencyKey: job.idempotency_key });
      await pool.query("select public.finish_notification_job($1, $2)", [job.id, messageId]);
      report.sent++;
    } catch (error) {
      // The message only: never the email, the address or a link.
      await pool.query("select public.fail_notification_job($1, $2)", [job.id, error instanceof Error ? error.message : "unknown error"]);
      report.failed++;
    }
  }

  return report;
}
