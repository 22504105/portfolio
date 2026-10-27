# CUT&CO — Architecture

The decisions behind the application. The requirements are in
[`requirements.md`](requirements.md); where this document departs from them,
it says so.

Status: all five development phases are implemented. The **Phase NN** markers
below were written while the work was in progress and show the phase in which
a part was built.

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

Built so far: the public site, `/book`, `/booking/confirm`, `/booking/manage`,
`/login`, `/register`, `/forgot-password`, `/account`, `/barber`,
`/barber/calendar`, `/admin` with its sections, `/demo/admin` with the same
sections, and `/api/cron/notifications`.

## 2. Technology

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript | As required; same major versions as the rest of the portfolio |
| Styling | Tailwind CSS 4, tokens in `app/globals.css` | One source of truth for the design system |
| Motion | `motion` | Installed; first used in Phase 02 |
| i18n | `next-intl` 4 | Typed message catalog, locale routing, server components |
| Database and auth | Supabase (PostgreSQL, Auth), hosted | Free tier; no Docker on the development machine |
| Database access | `pg`, directly from server code | Booking runs in database functions inside transactions; see section 11 |
| Validation | Zod 4 | Environment now, every server input later |
| Email | Resend | **Phase 03.** Free tier; server-only key |
| Scheduler | Vercel Cron calling `/api/cron/*` | **Phase 03.** No extra service |
| Tests | Vitest; a real PostgreSQL through `embedded-postgres` | Concurrency cannot be tested against a mock |
| Hosting | Vercel | As required |

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
2. **A per-barber lock** (implemented). Holds depend on the clock — a hold
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

Tested (`tests/db/booking.test.ts`, on a real PostgreSQL, with separate
connections racing each other):

- ten simultaneous customers for one slot: exactly one gets it;
- overlapping visits of 65 minutes started half an hour apart: none overlap;
- eight simultaneous "any available" requests with two free barbers: exactly
  two succeed, with different barbers;
- a late confirmation racing a new customer for the same slot: the late one
  fails, the new one gets it;
- a reschedule racing a new booking for the same time: exactly one wins;
- one link opened three times at once: confirmed once.

One difference from the plan above, decided while building: rescheduling keeps
the same barber, so it needs one lock, and the requirements do not ask for more.

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

## 7. Email links and email delivery

- **Tokens.** 32 random bytes from the system CSPRNG, base64url in the link,
  SHA-256 in `booking_tokens`. A token is made when its email is written, so
  the raw value exists only in that email. A verification token lives as long
  as the hold. A management token lives until the appointment ends; opening it
  sets a signed, HTTP-only session for that booking for thirty minutes and
  moves on to a clean address, and cancelling or rescheduling needs that session.
- **Tokens travel after the `#`** (`/booking/confirm#token=…`). That part of
  an address is never sent to a server, so a token reaches no access log and
  no Referer header. The page reads it in the browser (`lib/use-link-token.ts`),
  removes it from the address bar and sends it to a server action in the body
  of a POST. These two pages therefore need JavaScript, and say so without it.
- **Confirmation takes a button.** Opening the link shows a page with a button;
  only pressing it confirms. Mail scanners that follow links confirm nothing.
- **No enumeration.** Responses to "resend my link" and to bad or expired
  tokens are the same whether or not the booking exists. Tokens never appear in
  logs or analytics; pages that receive one set `Referrer-Policy: no-referrer`.
- **Throttling.** Kept in PostgreSQL (`rate_limits`, keys hashed): ten holds an
  hour per address and five per email, thirty link openings per ten minutes per
  address, and at most two unverified holds per email at a time. There is no
  "resend" button yet; a lapsed hold is simply booked again.
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
  written to `.tmp/mail` and shown at `/en/dev/mail`, which does not exist in
  production. In production an empty key makes jobs fail and stay queued.
- **Scheduler.** `/api/cron/notifications` runs the queue. Emails caused by an
  action are also sent right after it, so only reminders depend on the
  scheduler. Vercel's free plan cannot call it often enough (once a day); the
  call has to come from Supabase `pg_cron` or another scheduler.

## 8. Public demo

`/demo/admin` shows the admin workspace to anyone, read-only.

The requirements prefer a separate demo database and accept a read-only demo. What
was built is stricter than a separate database: **the demo has no database at
all.** The admin pages read through one interface (`lib/admin/types.ts`,
`AdminSource`) with two implementations. The real admin gets `live.ts`, which
queries PostgreSQL. The demo gets `demo.ts`, which builds invented bookings in
memory from the date, the same for every visitor.

What that gives:

- **No real data can leak**, because none is read. Names are invented, email
  addresses end in `@demo.example`, phone numbers are from the range reserved
  for drama.
- **Nothing can be changed.** The source is marked read-only, and the shared
  pages then render no form with an action; settings are shown switched off.
  A browser check counts the forms and the editable fields on every demo page
  and expects none.
- **No email can be sent**: nothing in the demo enqueues or sends.
- **The admin actions are unreachable in effect.** They live in the same
  application, and each begins by requiring an admin session, so a visitor
  cannot use them by posting from anywhere.
- **Demo figures are labelled.** The analytics page says in the demo that its
  numbers come from invented data and are not the results of a business.

The cost: the demo cannot show what happens when an admin changes something.
A writable demo would need the separate project the requirements describe, with
per-session isolation and a reset; that is a possible later step, not a gap in
safety.

## 9. Security review of the booking strategy

This review of the design above was made before the booking engine was
built. The review of the finished application is in [`security.md`](security.md).

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
| The demo reaches real data | High | The demo reads no database (section 8) |
| Cancelling past the cutoff by rescheduling first | Medium | One cutoff rule shared by both operations |

Decided with accounts: a signed-in client still confirms each booking from an
email link, like a guest. Their details are filled in for them, and the
booking appears in their account once confirmed. One rule for everyone, and
"email verification is mandatory" holds without exceptions.

## 10. The booking interface and its two back ends

The interface talks to the booking engine through one contract,
`lib/booking/gateway.ts`: `getAvailability` and `createHold`, with typed
refusals (`slot_taken`, `too_many_holds`, `invalid`, `unavailable`). With a
database configured it is answered by server actions and the booking engine
(`lib/booking/live-gateway.ts`). Without one it is answered by
`lib/booking/mock-gateway.ts`, in the browser, so the interface can be looked
at with nothing set up. The table is about that mock.

| Part | Real in the mock | Invented in the mock |
|---|---|---|
| Catalog | Same content as the seed, checked by a test | Served from a constant, not from the database |
| Slot rules | 30-minute grid, any duration, lunch gaps, 2-hour lead, 30-day horizon, London time across clock changes (`lib/booking/slots.ts`, tested) | — |
| Existing bookings | — | Invented from the date, so a calendar looks used and stays stable |
| Eligibility | Only barbers who deliver every chosen service | — |
| Any Available | — | Takes the first free barber; the real rule is in section 5 |
| Holding a slot | — | Nothing is stored; the reference is invented |
| Email | — | Nothing is sent |

The wizard itself is a state machine without React (`lib/booking/wizard.ts`,
tested): each choice clears what it makes stale, a step cannot be skipped, a
submission cannot be doubled, and a slot that has gone sends the customer back
to choose another time with their details kept.

The mock is labelled in the interface (a notice on `/book` and on the final
screen) and in the code. Nothing outside `lib/booking/mock-gateway.ts`,
`lib/catalog/mock.ts` and the one line that chooses the gateway in
`components/booking/BookingWizard.tsx` knows it exists.

## 11. How the server reaches the database

Server code connects to PostgreSQL directly (`lib/db.ts`, `DATABASE_URL`), as
the database owner. Booking operations are single calls to the functions of
`supabase/migrations/20261011000100_booking_engine.sql`; nothing in TypeScript
decides whether a slot is free.

Why not the Supabase client for this: a booking is several statements that
must happen in one transaction under a lock, which is what a database function
called over one connection gives, and the same code then runs against a plain
PostgreSQL in tests and in local development. It also means the browser never
talks to the database about bookings at all. Supabase's client remains for
what it is for: Auth, when accounts are built.

Consequences to keep in mind:

- The connection bypasses row level security, like the service role. The
  policies still protect anything reached with the public key; server code
  must check the caller itself (the management session, and roles later).
- `lib/catalog/index.ts` is types and pure helpers and may be imported by
  client components. `lib/catalog/server.ts`, `lib/db.ts` and
  `lib/booking/store.ts` must not be: they pull the database client in.
- On Supabase use the transaction pooler. The connection is encrypted; its
  certificate is verified only when `DATABASE_CA_CERT` is set.


## 12. Accounts and staff

- **Sign-in** is email and password through Supabase Auth, with the session in
  cookies (`@supabase/ssr`). Every request that needs a user asks the auth
  server to verify the session (`getUser`), and reads the role from
  `profiles` in the database. A role is never taken from the session or the
  form, and a demotion takes effect on the next request.
- **Sign-up** always creates a client. Supabase sends the confirmation email;
  the link lands on `/auth/callback`, which opens the session.
- **Linking bookings to an account** happens by email address, and only once
  the address is confirmed (`link_customer_account`). Otherwise registering
  with someone else's address would hand over their bookings.
- **One general answer** for a wrong password, an unknown address and an
  unconfirmed one; sign-up and password reset answer the same whether or not
  the address has an account.
- **A client changing a booking** from the account goes through the same
  management page as a guest: the server checks the booking is theirs and
  opens the management session, with no email link needed.
- **Reads on behalf of a user** (`lib/account.ts`) run in a transaction under
  the `authenticated` role with the user's id in the JWT claims, so row level
  security applies on top of the code's own filter.
- **A barber** sees their own appointments with the client's name and phone,
  never the email address or the takings; records whether a client came, once
  the appointment has started; takes a break of up to `max_break_minutes` at
  once; and requests whole days off, which block nothing until an admin
  approves them (Phase 04). A break cannot be placed on top of an appointment.
  All of it is refused by the database functions, not only by the pages.
- **Staff accounts** are created with `npm run user:create`, which writes to
  the auth tables with the database owner's connection. There is no way to
  become staff through the site.
- **Throttling** covers sign-in (by address and by account), sign-up and
  password reset.

Checked in a browser against a real Supabase project: redirect to sign-in and
back, refusal of a wrong password, a client's booking appearing in the
account, opening it for changes, refusal of another customer's booking id,
profile changes that cannot touch the role, a client turned away from the
barber's pages, a barber recording an outcome and adding and withdrawing a
break. Not checked: the emails Supabase itself sends (address confirmation and
password reset), which need a real inbox.

## 13. Admin

- **Access.** Every page under `/admin` requires the admin role before any
  data is read; every admin action checks it again from the session and the
  database. A client or a barber who asks for an admin page is sent to their
  own, with no hint of what is there.
- **Bookings made by staff** (`create_admin_booking`) are confirmed at once and
  send a confirmation, not a verification. The two-hour lead does not apply; the
  grid, the horizon, working hours, time off and other bookings do.
- **Staff are not bound by the twelve-hour rule** when cancelling or moving a
  booking. The customer is told by email either way.
- **Outcomes.** An appointment can be marked completed or missed once it has
  started. An admin can correct an outcome; a barber cannot.
- **Payment is separate from outcome.** `record_payment` writes what was taken
  at the counter for a completed visit; nothing marks a visit paid by itself.
  Correcting a completed visit to missed removes its payment.
- **Catalog edits** change the catalog, not history: bookings keep the names,
  prices and durations they were made with. Services and barbers are retired,
  not deleted. Changing a barber's hours does not move existing appointments.
- **Settings** hold the numbers of the booking policy. Currency, time zone and
  the thirty-minute grid are not settings.
- **Forms work without JavaScript.** Each action answers by redirecting back
  with a notice in the address, which the page turns into a message.

### Analytics: what each figure means

`admin_analytics(from, to)` computes everything from stored rows when asked.
The page prints these definitions under the numbers.

| Figure | Definition |
|---|---|
| Bookings | Those that start on a London date in the range |
| Paid revenue | Sum of `payment_records` for completed visits in the range. A completed visit with no payment adds nothing; so does a booking that was only made |
| Top services | Services of completed visits, with their value at list price (not what was paid) |
| Booked time | Service minutes of completed and still-confirmed visits. Cancelled, missed and expired add nothing |
| Available time | Working hours on the dates of the range, less approved time off and shop closures |
| Utilisation | Booked time divided by available time |

The same definitions exist in TypeScript (`lib/admin/analytics.ts`) for the
demo, which has no database. Both are tested against the same week of
bookings with the same expected figures.

## 14. Final review: headers, PWA, retention

The findings and the residual risks are in `docs/security.md`. What the review
added to the design:

- **Headers** for every response, in `next.config.ts`: a content security
  policy (own origin only; Supabase Auth for connections; no frames; forms
  post to the site only), `X-Frame-Options`, `nosniff`, a referrer policy, a
  permissions policy, HSTS. Inline scripts stay allowed: Next.js needs them
  unless every page is rendered on demand with a nonce.
- **Client address** for throttling comes from `lib/request.ts`, which prefers
  the headers the platform sets itself.
- **PWA.** `app/manifest.ts`, icons drawn by `scripts/make-icons.mjs`, and
  `public/sw.js`. The service worker keeps only files whose address changes
  with their content (`/_next/static`, icons, images) and the two offline
  pages. It never keeps a page: a cached booking page would offer times that
  are gone, and a cached account would show one person's bookings to the next.
  Offline, any navigation gets `public/offline-<locale>.html`.
- **The offline page is a plain file, not a route.** Served in place of
  another address, an application page starts its router, which fetches that
  address again, fails, and replaces the message with the error screen.
- **Retention** (`20261013000100_retention.sql`): `purge_stale_data(30)` runs
  with the scheduler; `erase_customer(email)` is run by hand on request.
- **Errors.** `app/[locale]/error.tsx` shows a plain message and a reference
  code, never the failure itself.
