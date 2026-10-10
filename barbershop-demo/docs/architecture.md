# CUT&CO — Architecture

The decisions behind the foundation, in the order the brief asks for them.
`docs/brief.md` is the specification; where this document and the brief
disagree, the brief wins and this document is wrong.

Status: Phase 01 (foundation). Sections marked **Phase 03** or **Phase 04**
describe an agreed design that is not implemented yet.

## 1. Information architecture

Every page lives under a language prefix: `/en/...` or `/ru/...`. English is
the default. A visit to an unprefixed path is redirected to the visitor's
language if it is Russian or English, to English otherwise; the choice is kept
for a year in the `NEXT_LOCALE` cookie and, for registered users, in
`profiles.locale`. A booking remembers the language it was made in
(`bookings.locale`), and every email about it uses that language.

| Area | Routes | Who |
|---|---|---|
| Public site | `/`, `/services`, `/barbers`, `/gallery`, `/about`, `/contact` | Everyone |
| Booking | `/book`, `/booking/confirm`, `/booking/manage` | Everyone; the last two need a valid email link |
| Client account | `/account` | Signed-in client |
| Barber workspace | `/barber`, `/barber/calendar` | Barber |
| Admin | `/admin`, `/admin/calendar`, `/admin/bookings`, `/admin/services`, `/admin/barbers`, `/admin/clients`, `/admin/analytics`, `/admin/settings` | Admin |
| Public demo | `/demo/admin` | Everyone, against a separate demo database |
| Machine endpoints | `/api/cron/*` | The scheduler, with `CRON_SECRET` |

Only the language shell and a placeholder home page exist after Phase 01.

## 2. Technology

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript | As the brief asks; same major versions as the rest of the portfolio |
| Styling | Tailwind CSS 4, tokens in `app/globals.css` | One source of truth for the design system |
| Motion | `motion` | Installed; first used in Phase 02 |
| i18n | `next-intl` 4 | Typed message catalog, locale routing, server components |
| Database and auth | Supabase (PostgreSQL, Auth), hosted | Free tier; no Docker on the development machine |
| Validation | Zod 4 | Environment now, every server input later |
| Email | Resend | **Phase 03.** Free tier; server-only key |
| Scheduler | Vercel Cron calling `/api/cron/*` | **Phase 03.** No extra service |
| Tests | Vitest; a real PostgreSQL through `embedded-postgres` | Concurrency cannot be tested against a mock |
| Hosting | Vercel | As the brief asks |

Two Supabase projects are planned: one for the application and one for the
public demo, so the demo cannot reach real data even if a policy is wrong.

### Database migrations

`supabase/migrations/*.sql` are plain SQL, applied in file-name order, followed
by `supabase/seed.sql`. They run unchanged on Supabase and, in tests, on a
plain PostgreSQL prepared by `tests/db/supabase-shim.sql` (the three API roles,
the `auth` schema, `auth.uid()`).

## 3. Money, time and language

- **Money** is integer US cents in every column, variable and message
  (`price_cents`, `total_price_cents`, `amount_cents`). `lib/format.ts` is the
  only place cents become text: `$45` in English, `45 $` in Russian. There is
  no other currency and no conversion; `shop_settings.currency` is constrained
  to `USD`.
- **Instants** are `timestamptz`. **Weekly hours** are local times of the shop
  (`working_hours`), turned into instants with `AT TIME ZONE` when slots are
  generated, which is what makes the clock changes safe. Everything shown to a
  person is formatted in `Europe/London`, whatever their own time zone.
- **Catalog text** is stored in both languages (`name_en`, `name_ru`, ...), and
  a booking snapshots both, so an email in either language can be rebuilt later.
- **Interface text** lives in `messages/en.json` and `messages/ru.json`. Keys
  are type-checked against the English catalog, and a test keeps the Russian
  catalog complete.

## 4. Data model

Tables are defined in `supabase/migrations/20261010000100_schema.sql`, which is
the authority; this is the map.

| Table | Holds | Notes |
|---|---|---|
| `shop_settings` | One row: name, address, time zone, booking policy | Policy numbers live in data: 15-minute hold, 30-minute slots, 2-hour lead, 30-day horizon, 12-hour change cutoff |
| `profiles` | One row per account, with its role | Created by a trigger as `client`; sign-up data cannot set a role |
| `barbers` | Public staff profiles | `profile_id` links the staff account |
| `customers` | One row per email address | The only place a customer's email is stored |
| `services` | Catalog: bilingual text, `price_cents`, `duration_minutes` | Retired with `is_active`, never deleted |
| `barber_services` | Which barber can deliver which service | |
| `working_hours` | Weekly local-time ranges per barber | ISO weekdays; several ranges a day allow a lunch gap |
| `time_off` | Breaks, time off, shop holidays | A row without a barber closes the shop |
| `bookings` | Barber, customer, instants, status, hold expiry, totals, payment state | Reschedule updates the row in place; history is in `booking_events` |
| `booking_services` | Ordered snapshot of names, prices, durations | Catalog edits never rewrite a booking |
| `booking_events` | Append-only audit trail | Updates are refused by a trigger |
| `booking_tokens` | SHA-256 hashes of email-link tokens | No API role can read it |
| `notification_jobs` | Outgoing email queue | Unique `idempotency_key` |
| `payment_records` | Money taken at the counter | Revenue is reported from here, not from bookings |

### Booking states

```
pending ──▶ confirmed ──▶ completed
   │            ├───────▶ cancelled
   ▼            └───────▶ no_show
expired
```

`pending` is a hold waiting for email verification. Nothing leaves `expired`,
`cancelled`, `completed` or `no_show`, with one exception for admins:
`completed` and `no_show` may be swapped to correct a mistake, which is
recorded as an event. Payment state is a separate column and a separate table.

## 5. Concurrency: how a slot is never sold twice

The guarantee: **for one barber, the time ranges of confirmed bookings and of
unexpired holds never overlap.**

It rests on two mechanisms.

1. **A durable constraint** (implemented). `bookings_no_confirmed_overlap` is
   an exclusion constraint over `(barber_id, tstzrange(starts_at, ends_at))`
   for `status = 'confirmed'`. Ranges are half-open, so a booking may start the
   minute the previous one ends. No code path, bug or manual `UPDATE` can put
   two confirmed bookings on top of each other.
2. **A per-barber lock** (**Phase 03**). Holds depend on the clock — a hold
   stops blocking the moment `hold_expires_at` passes — and a constraint cannot
   read the clock. So every operation that takes or moves a slot runs in one
   database function that:
   1. takes `pg_advisory_xact_lock` on the barber (on all barbers involved, in
      id order, so two operations cannot deadlock);
   2. reads the time with `clock_timestamp()` *after* the lock is held;
   3. looks for a conflict: any booking of that barber overlapping the range
      that is `confirmed`, or `pending` with `hold_expires_at` in the future;
   4. writes, or returns a typed refusal (`slot_taken`, `hold_expired`,
      `too_soon`, `outside_horizon`, `not_eligible`, `past_cutoff`).

   Under the lock the check and the write cannot be interleaved with another
   booking for the same barber, so "check then insert" is safe here.

Consequences:

- **Expired holds never block**, whether or not the cleanup job has run: they
  fail the conflict test by their timestamp. Cleanup only tidies the status and
  writes the `expired` event.
- **Late confirmation fails safely.** Confirming re-reads the booking under the
  lock; if the hold has passed it is marked `expired` and the customer is asked
  to book again, even if the slot happens to be free still.
- **Reschedule is one statement.** With both barbers locked, the new range is
  checked (ignoring the booking itself) and the row is updated in place. There
  is no moment at which the customer holds neither slot or both.
- **Any Available** locks the eligible barbers, keeps those who are free, and
  picks the one with the fewest booked minutes that day, then that week, then
  by `sort_order` and id — deterministic for the same data.
- **Changes to time off** take the same lock, so a day off cannot be approved
  across a booking being made at the same instant.
- Lock keys are hashes; a collision between two barbers only makes them wait
  for each other, it cannot cause a double booking.

Tested now: the constraint (overlap, adjacency, other barber, cancelled frees
the slot, a hold cannot be confirmed onto a confirmed booking). Phase 03 adds
the functions and tests that race real connections against each other.

## 6. Roles and permissions

Roles are `client`, `barber` and `admin` in `profiles.role`; a visitor without
an account is `anon`. Two layers enforce the matrix: row level security (below,
implemented and tested) and server-side checks in every action (**Phase 03**
onwards). The service role is used only by server code.

| Data | Visitor | Client | Barber | Admin | Server only |
|---|---|---|---|---|---|
| Services, barbers, eligibility, weekly hours, shop settings | read active | read active | read active | read all, write | |
| Own profile (name, phone, language) | — | read, update | read, update | read, update | role changes |
| Other profiles | — | — | — | read | |
| Customers (email addresses) | — | own | — | read | write |
| Bookings and their services | — | own | own appointments | read all | every write |
| Time off | — | — | own, read | read all | write |
| Audit events, payment records | — | — | — | read | write |
| Email-link tokens, email queue | — | — | — | — | everything |

Points the tests pin down:

- No API role can write a booking, a payment, a token or an email job directly.
  Prices, durations, eligibility and state transitions are decided on the
  server and are never taken from the client.
- A user cannot change their own role: `authenticated` has no `UPDATE` grant on
  `profiles.role`.
- A barber sees the name and phone on their own appointments, not email
  addresses, takings, or other barbers' appointments, and cannot change the
  weekly schedule or prices.
- A barber who is demoted or deactivated loses barber access immediately.
- A guest has no database identity at all. Guest access to a booking goes
  through the server with an email-link token (section 7).

## 7. Email links and email delivery — Phase 03

- **Tokens.** 32 random bytes from the system CSPRNG, base64url in the link,
  SHA-256 in `booking_tokens`. A verification token lives as long as the hold
  and is consumed on use. A management token lives until the appointment ends;
  opening it sets a short-lived, signed, HTTP-only session for that booking,
  and cancelling or rescheduling needs that session.
- **No enumeration.** Responses to "resend my link" and to bad or expired
  tokens are the same whether or not the booking exists. Tokens never appear in
  logs or analytics; pages that receive one set `Referrer-Policy: no-referrer`.
- **Throttling.** Limits per IP and per email on creating holds and on resends,
  and a cap on simultaneous unverified holds per email, kept in PostgreSQL.
- **Queue.** Verification, confirmation, 24-hour and 2-hour reminders are rows
  in `notification_jobs`, enqueued in the same transaction as the booking
  change that causes them. The idempotency key (`booking id : type : start
  time`) makes a second enqueue a no-op and is passed to the provider so a
  retried send is not delivered twice. A cron handler claims due jobs with
  `FOR UPDATE SKIP LOCKED`, sends, and records the result; failures are retried
  with backoff and stay visible in the table. Reminders for cancelled, expired
  or rescheduled bookings are cancelled, and the sender checks the booking
  again just before sending.
- **Development.** Without `RESEND_API_KEY` nothing is sent: messages are
  written to a local mail sink that the tests read.

## 8. Public demo — Phase 04

A second Supabase project with synthetic data only, its own keys, no email
provider key and no path to the application database. Demo sessions get a
limited role; writes, if enabled, are isolated per session and reset on a
schedule. The demo is labelled as a demo on every screen.

## 9. Security review of the booking strategy

The brief asks for this review before further work. It was done by the Lead
Agent against the design above; the QA subagent's independent audit comes with
the implementation in Phase 03.

| Risk | Severity | Answer |
|---|---|---|
| Two people book the same slot at the same instant | Critical | Per-barber lock plus the exclusion constraint (section 5) |
| A slot stays blocked by abandoned holds | High | Holds expire by timestamp; cap on unverified holds per email and IP |
| Confirming after the hold expired resurrects it | High | Confirmation checks the expiry under the lock and expires the booking |
| A management link is guessed, leaked or replayed | High | 256-bit tokens, hashes only, expiry, no referrer, session needed to change anything |
| A client forges price, duration, barber or status | High | Server reads them from the database; API roles cannot write bookings |
| A user promotes themselves | High | No column grant on `role`; trigger ignores sign-up metadata — tested |
| A barber reads other barbers' clients or the takings | Medium | Row level security — tested |
| "Resend link" reveals who has a booking | Medium | Uniform responses and throttling |
| Duplicate or late reminder emails | Medium | Idempotency key, re-check before sending |
| The demo reaches real data | High | Separate project and keys |
| Cancelling past the cutoff by rescheduling first | Medium | One cutoff rule shared by both operations |

Open questions for Phase 03, none of which change the schema: the exact
throttling limits, and whether a registered client must also verify by email
for each booking (the brief makes verification mandatory for guests).
