import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "./harness";

// The server's booking code and the email worker, against a real database:
// the path a customer takes, from holding a slot to the emails it produces.

let t: TestDatabase;
let store: typeof import("@/lib/booking/store");
let worker: typeof import("@/lib/email/worker");
let closeDb: () => Promise<void>;

type Sent = { to: string; subject: string; text: string; html: string; idempotencyKey: string };
const outbox: Sent[] = [];
const transport = async (email: Sent) => {
  outbox.push(email);
  return `test:${outbox.length}`;
};
/** Sends everything that is due and returns what went out. */
async function deliver() {
  const before = outbox.length;
  const report = await worker.processDueJobs(20, transport);
  return { report, sent: outbox.slice(before) };
}

const services: Record<string, string> = {};
const barbers: Record<string, string> = {};
let people = 0;

const tokenIn = (email: Sent) => new URL(email.text.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;

async function freeSlot(serviceSlugs: string[], barber: string) {
  for (let day = 3; day <= 28; day++) {
    const date = new Date(Date.now() + day * 86_400_000).toISOString().slice(0, 10);
    const slots = await store.getAvailability(serviceSlugs.map((slug) => services[slug]), barbers[barber], date);
    if (slots.length) return slots[0].startsAt;
  }
  throw new Error("no free slot");
}

async function holdFor(locale: "en" | "ru", barber = "marcus-hale", name = "Ada Lovelace") {
  const email = `flow${++people}@example.com`;
  const startsAt = await freeSlot(["haircut"], barber);
  const result = await store.createHold({
    serviceIds: [services.haircut],
    barberId: barbers[barber],
    startsAt,
    contact: { name, email, phone: "+44 20 7946 0000" },
    locale,
  });
  if (!result.ok) throw new Error(`hold refused: ${result.code}`);
  const id = (await t.db.query("select id from public.bookings where reference = $1", [result.reference])).rows[0].id as string;
  return { id, email, startsAt, result };
}

/** A confirmed booking with its emails delivered; returns the management token from the confirmation. */
async function confirmedBooking(locale: "en" | "ru" = "en", barber = "marcus-hale") {
  const held = await holdFor(locale, barber);
  const verification = (await deliver()).sent.find((email) => email.to === held.email)!;
  await store.confirmByToken(tokenIn(verification));
  const confirmation = (await deliver()).sent.find((email) => email.to === held.email)!;
  return { ...held, manageToken: tokenIn(confirmation) };
}

beforeAll(async () => {
  t = await startTestDatabase();
  process.env.DATABASE_URL = t.url;
  process.env.APP_URL = "https://cutco.test/";
  process.env.SESSION_SECRET = "s".repeat(40);
  store = await import("@/lib/booking/store");
  worker = await import("@/lib/email/worker");
  closeDb = (await import("@/lib/db")).closeDb;
  for (const row of (await t.db.query("select id, slug from public.services")).rows) services[row.slug] = row.id;
  for (const row of (await t.db.query("select id, slug from public.barbers")).rows) barbers[row.slug] = row.id;
}, 120_000);

afterAll(async () => {
  await closeDb?.();
  await t?.stop();
});

describe("from hold to confirmation", () => {
  it("sends a verification email with a link that confirms the booking", async () => {
    const held = await holdFor("en");
    expect(held.result).toMatchObject({ ok: true, barberId: barbers["marcus-hale"] });

    const { sent } = await deliver();
    const email = sent.find((candidate) => candidate.to === held.email)!;
    expect(email.subject).toBe("Confirm your booking at CUT&CO");
    expect(email.text).toContain("Hello Ada Lovelace.");
    expect(email.text).toContain("for 15 minutes");
    expect(email.text).toContain("Haircut");
    expect(email.text).toContain("$45");
    expect(email.text).toMatch(/https:\/\/cutco\.test\/en\/booking\/confirm\?token=[A-Za-z0-9_-]{43}/);
    expect(email.text).toContain("not a real barbershop");

    expect(await store.confirmByToken(tokenIn(email))).toEqual({ ok: true, bookingId: held.id, alreadyConfirmed: false });
    expect((await store.getBookingView(held.id))?.status).toBe("confirmed");
  });

  it("stores only the hash of a token", async () => {
    const held = await holdFor("en");
    const token = tokenIn((await deliver()).sent.find((email) => email.to === held.email)!);
    const stored = await t.db.query("select encode(token_hash, 'hex') as hash from public.booking_tokens where booking_id = $1", [held.id]);
    expect(stored.rows.length).toBe(1);
    expect(stored.rows[0].hash).not.toContain(token);
    expect(JSON.stringify((await t.db.query("select * from public.notification_jobs where booking_id = $1", [held.id])).rows)).not.toContain(token);
  });

  it("follows confirmation with one confirmation email and holds the reminders until they are due", async () => {
    const held = await holdFor("en");
    const verification = (await deliver()).sent.find((email) => email.to === held.email)!;
    await store.confirmByToken(tokenIn(verification));

    const { sent } = await deliver();
    const mine = sent.filter((email) => email.to === held.email);
    expect(mine.map((email) => email.subject)).toEqual([expect.stringMatching(/^Booked: .+ at CUT&CO$/)]);
    expect(mine[0].text).toMatch(/https:\/\/cutco\.test\/en\/booking\/manage\/open\?token=/);
    // Nothing more goes out however often the worker runs.
    expect((await deliver()).sent.filter((email) => email.to === held.email)).toEqual([]);
  });

  it("writes every email in the language of the booking", async () => {
    const held = await holdFor("ru", "daniyar-akhmetov", "Иван Петров");
    const verification = (await deliver()).sent.find((email) => email.to === held.email)!;
    expect(verification.subject).toBe("Подтвердите запись в CUT&CO");
    expect(verification.text).toContain("Здравствуйте, Иван Петров.");
    expect(verification.text).toContain("Стрижка");
    expect(verification.text).toMatch(/45\s\$/);
    expect(verification.text).toContain("/ru/booking/confirm?token=");
    expect(verification.html).toContain('<html lang="ru">');
    expect(verification.text).not.toMatch(/Hello|Barber:|Haircut/);

    await store.confirmByToken(tokenIn(verification));
    const confirmation = (await deliver()).sent.find((email) => email.to === held.email)!;
    expect(confirmation.subject).toMatch(/^Вы записаны: /);
    expect(confirmation.text).toContain("/ru/booking/manage/open?token=");
  });

  it("escapes what the customer typed", async () => {
    const held = await holdFor("en", "leon-fischer", '<img src=x onerror=alert(1)> "Bob"');
    const email = (await deliver()).sent.find((candidate) => candidate.to === held.email)!;
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img src=x onerror=alert(1)&gt; &quot;Bob&quot;");
  });

  it("sends no verification email for a hold that has already run out", async () => {
    const held = await holdFor("en", "theo-okafor");
    await t.db.query("update public.bookings set hold_expires_at = now() - interval '1 second' where id = $1", [held.id]);
    const { sent, report } = await deliver();
    expect(sent.filter((email) => email.to === held.email)).toEqual([]);
    expect(report.expired).toBeGreaterThanOrEqual(1);
    expect((await store.getBookingView(held.id))?.status).toBe("expired");
  });

  it("refuses a confirmation link that was guessed or has expired", async () => {
    expect(await store.confirmByToken("A".repeat(43))).toEqual({ ok: false, code: "invalid_token" });
    const held = await holdFor("en", "theo-okafor");
    const token = tokenIn((await deliver()).sent.find((email) => email.to === held.email)!);
    await t.db.query("update public.bookings set hold_expires_at = now() - interval '1 second' where id = $1", [held.id]);
    expect(await store.confirmByToken(token)).toEqual({ ok: false, code: "hold_expired" });
  });
});

describe("managing a booking", () => {
  it("opens a booking from its management link, and from no other", async () => {
    const made = await confirmedBooking();
    expect(await store.openManageToken(made.manageToken)).toBe(made.id);
    expect(await store.openManageToken("B".repeat(43))).toBeNull();

    const view = (await store.getBookingView(made.id))!;
    expect(view).toMatchObject({
      status: "confirmed",
      changeable: true,
      barber: { slug: "marcus-hale", name: "Marcus Hale" },
      customer: { name: "Ada Lovelace", email: made.email },
      totalPriceCents: 4500,
    });
    expect(view.services).toEqual([{ name: { en: "Haircut", ru: "Стрижка" }, priceCents: 4500, durationMinutes: 45 }]);
  });

  it("does not let a verification token open the management page", async () => {
    const held = await holdFor("en", "leon-fischer");
    const verifyToken = tokenIn((await deliver()).sent.find((email) => email.to === held.email)!);
    expect(await store.openManageToken(verifyToken)).toBeNull();
  });

  it("stops a management link working once the appointment is over", async () => {
    const made = await confirmedBooking("en", "daniyar-akhmetov");
    await t.db.query("update public.booking_tokens set expires_at = now() - interval '1 second' where booking_id = $1", [made.id]);
    expect(await store.openManageToken(made.manageToken)).toBeNull();
  });

  it("cancels, sends a cancellation and sends no reminders afterwards", async () => {
    const made = await confirmedBooking("ru", "leon-fischer");
    expect(await store.cancelByCustomer(made.id)).toEqual({ ok: true });

    const { sent } = await deliver();
    expect(sent.filter((email) => email.to === made.email).map((email) => email.subject)).toEqual(["Запись в CUT&CO отменена"]);
    expect(sent.find((email) => email.to === made.email)!.text).not.toMatch(/https?:\/\//);

    // Even if a reminder were somehow still queued and due, it would be dropped.
    await t.db.query("update public.notification_jobs set status = 'pending', due_at = now() where booking_id = $1 and type = 'reminder_2h'", [made.id]);
    const again = await deliver();
    expect(again.sent.filter((email) => email.to === made.email)).toEqual([]);
    expect(again.report.skipped).toBeGreaterThanOrEqual(1);
  });

  it("reschedules, tells the customer the new time and reminds for the new time only", async () => {
    const made = await confirmedBooking("en", "theo-okafor");
    const target = await freeSlot(["haircut"], "theo-okafor");
    expect(await store.rescheduleByCustomer(made.id, target)).toEqual({ ok: true });

    const moved = (await deliver()).sent.filter((email) => email.to === made.email);
    expect(moved.map((email) => email.subject)).toEqual([expect.stringMatching(/^Moved: /)]);

    // Make every reminder due: only those for the new time are sent.
    await t.db.query("update public.notification_jobs set status = 'pending', due_at = now() where booking_id = $1 and type in ('reminder_24h', 'reminder_2h')", [made.id]);
    const reminders = (await deliver()).sent.filter((email) => email.to === made.email);
    expect(reminders.map((email) => email.subject).sort()).toEqual([
      "In two hours at CUT&CO",
      expect.stringMatching(/^Tomorrow at CUT&CO: /),
    ]);
  });

  it("refuses a customer's change inside twelve hours", async () => {
    const made = await confirmedBooking("en", "daniyar-akhmetov");
    await t.db.query("update public.bookings set starts_at = now() + interval '5 hours', ends_at = now() + interval '5 hours 45 minutes' where id = $1", [made.id]);
    expect((await store.getBookingView(made.id))?.changeable).toBe(false);
    expect(await store.cancelByCustomer(made.id)).toEqual({ ok: false, code: "past_cutoff" });
    expect(await store.rescheduleByCustomer(made.id, await freeSlot(["haircut"], "daniyar-akhmetov"))).toEqual({ ok: false, code: "past_cutoff" });
  });
});

describe("delivery failures", () => {
  it("keeps a failed email on the queue with its error, and sends it on a later run without a second booking", async () => {
    const held = await holdFor("en", "leon-fischer");
    const failing = async () => {
      throw new Error("Email provider answered 503");
    };
    const report = await worker.processDueJobs(20, failing);
    expect(report.failed).toBeGreaterThanOrEqual(1);

    const job = await t.db.query("select status, last_error, attempts from public.notification_jobs where booking_id = $1", [held.id]);
    expect(job.rows[0]).toEqual({ status: "failed", last_error: "Email provider answered 503", attempts: 1 });

    await t.db.query("update public.notification_jobs set due_at = now() where booking_id = $1", [held.id]);
    const { sent } = await deliver();
    expect(sent.filter((email) => email.to === held.email).length).toBe(1);
    expect((await t.db.query("select count(*)::int as n from public.bookings where id = $1", [held.id])).rows[0].n).toBe(1);
  });

  it("gives the provider the same idempotency key on every attempt", async () => {
    const held = await holdFor("en", "marcus-hale");
    const keys: string[] = [];
    await worker.processDueJobs(20, async (email) => {
      keys.push(email.idempotencyKey);
      throw new Error("timeout");
    });
    await t.db.query("update public.notification_jobs set due_at = now() where booking_id = $1", [held.id]);
    await worker.processDueJobs(20, async (email) => {
      keys.push(email.idempotencyKey);
      return "ok";
    });
    const mine = keys.filter((key) => key.startsWith(held.id));
    expect(mine).toEqual([`${held.id}:verification`, `${held.id}:verification`]);
  });
});
