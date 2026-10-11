# CUT&CO — Case study outline

An outline for the portfolio write-up. CUT&CO is a concept: there is no client
and no business behind it, and the write-up should say so in its first lines.

## 1. In one paragraph

A bilingual barbershop site with real online booking: a customer picks
services, a barber and a time, confirms from an email, and can move or cancel
the appointment; barbers see their day; the owner runs the calendar, the
catalog and the numbers. Built in five phases.

Screenshot: `screenshots/home.jpg`

## 2. The problem worth showing

Booking looks simple and is not. Three things make it hard, and each has a
section:

- two people wanting the same chair at the same moment;
- time: a shop in London, customers anywhere, clocks that change twice a year;
- trust: a guest with no account must be able to change their own booking and
  nobody else's.

## 3. Design

- Direction: ink, bone and one signal colour; condensed display type; rules
  and lists, not cards. Reference: `design-system.md`.
- The price list reads like a menu. Screenshot: `screenshots/services.jpg`
- The booking wizard keeps the appointment in view while it is built.
  Screenshots: `screenshots/booking.jpg`, `screenshots/mobile-booking.jpg`
- Russian is a first-class language, with a typeface chosen for Cyrillic.
  Screenshots: `screenshots/gallery-ru.jpg`, `screenshots/mobile-home-ru.jpg`
- A change made on review: headings lost their full stops and a size, because
  the first version shouted.

## 4. Engineering

- **A slot is never sold twice.** The rules live in the database: a lock per
  barber and an exclusion constraint. Test: ten customers at once, one wins.
- **Holds, not carts.** A time is held for fifteen minutes until the email is
  confirmed, then released by itself.
- **History does not change.** A booking keeps the name, price and duration it
  was made with, whatever happens to the catalog later.
- **Email links.** Random tokens, stored only as hashes, carried after the `#`
  so that no server log ever holds one; confirming takes a button, so mail
  scanners confirm nothing.
- **Three workspaces from one set of rules.** Client, barber, admin.
  Screenshots: `screenshots/admin-calendar.jpg`, `screenshots/admin-analytics.jpg`
- **A demo that cannot leak.** The public admin demo reads no database at all.
- **Installable, and honest offline.** No page is cached; offline says so and
  says nothing was booked.

## 5. How it was verified

248 tests, most against a real PostgreSQL; browser runs of every flow against
the production build; an accessibility sweep of every page in both languages.
What was not verified, stated plainly: `security.md`, "Residual risks".

## 6. What I would do next

A writable demo with per-visitor isolation; an independent security review;
real devices; a "send the link again" button.

## 7. Facts box

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL (Supabase) ·
next-intl · Vitest. English and Russian. Five phases.
