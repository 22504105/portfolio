# CUT&CO - Product requirements

The specification the application was built against. Where `architecture.md`
records a decision that settles or departs from a point here, it says so.

## Product

A full-stack, responsive barbershop website and booking application with a
staff and admin workspace and an installable PWA. The business is fictional
and located in London; the project is labelled as a concept everywhere.

- Interface languages: English (default) and Russian, with a visible switcher
  on every part of the product.
- Currency: US dollars only, stored as integer cents. No exchange rates.
- Business time zone: Europe/London, safe across daylight-saving changes.

## Users and what they can do

| Role | Can |
|---|---|
| Guest | Browse the site, book without an account, confirm by email, view, move or cancel a booking from the email link |
| Client | Everything a guest can, plus an account with upcoming and past bookings and a profile |
| Barber | See their own calendar and clients, mark visits completed or no-show, manage breaks and time-off requests. Cannot change base hours, prices, roles or other barbers' bookings |
| Admin | Full calendar, bookings made by staff, clients, services, barbers and their eligibility, working hours, holidays, time off, booking states, payments taken at the counter, analytics |
| Demo visitor | A clearly labelled admin workspace on invented data, with no access to real data, no email and nothing destructive |

## Booking policy

- Guests book without an account; email verification is mandatory.
- A slot is held for 15 minutes. An expired hold stops blocking the time even
  if the cleanup job is late, and confirming after expiry fails safely.
- Several consecutive services per booking, all by one qualified barber.
  Duration is the sum of the services; names, prices and durations are
  snapshotted into the booking.
- "Any available" picks only barbers qualified for every selected service,
  among those truly free, with a deterministic tie-break.
- Up to 30 days ahead; starts every 30 minutes; at least 2 hours' notice.
  Services may last any number of minutes and block the whole interval.
- Cancelling and rescheduling allowed until 12 hours before the start, under
  one shared rule. Rescheduling secures the new slot before releasing the old.
- Payment in person only; the admin records it. No payment gateway.
- Emails: verification and confirmation, reminders 24 and 2 hours before.
  Reminders are suppressed for cancelled or expired bookings and sent once.

States: pending -> confirmed or expired; confirmed -> completed, cancelled or
no-show. Every change is recorded in an append-only history. Payment state is
independent of booking state.

## Engineering requirements

- Concurrency-safe booking in PostgreSQL: two people can never hold the same
  barber at the same time, and expired holds never block.
- Authorisation both in server code and in row level security. Prices,
  durations, eligibility, roles and statuses are never taken from the client.
- Email tokens: cryptographically random, stored only as hashes, expiring,
  single-use where appropriate, throttled, never logged.
- Analytics computed from stored records: bookings by status, cancellations,
  no-shows, paid revenue, top services, barber performance and utilisation,
  with the method stated.
- PWA: installable, with an honest offline page; booking never pretends to
  work offline.
- Accessibility: keyboard navigation, accessible dialogs, visible focus,
  reduced-motion support. Mobile first.
- Personal data: retention and deletion policy, logging without secrets.
- Tests for time zones, durations, overlaps, racing bookings, expiry, late
  confirmation, email retries, the cancellation boundary, role bypass and
  payment reporting.

## Technology

Next.js App Router, TypeScript, Tailwind CSS, Supabase (PostgreSQL and Auth),
a transactional email provider, scheduled jobs, Vercel. Free tiers only.
