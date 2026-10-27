# CUT&CO

**A booking platform for barbershops: appointment scheduling, staff management, client workflows
and administrative analytics.**

**Live demo:** https://barbershop-demo-sable.vercel.app (admin demo:
https://barbershop-demo-sable.vercel.app/en/demo/admin) ·
**Code:** https://github.com/22504105/portfolio/tree/main/barbershop-demo

**Role:** Full-Stack Developer responsible for implementing application functionality,
integrating frontend and backend components, and testing the resulting software.

## Overview

A website and booking system for a barbershop: a bilingual public site (English and Russian),
online booking with email confirmation, client accounts, a barber's workspace and an admin
workspace with analytics, installable as a PWA. A concept project for a fictional shop in London;
prices in US dollars.

## Problem

Online booking for a service business looks simple and is not. Two clients must never get the
same barber at the same minute; a time held by someone who never confirms must free itself; a
guest must be able to move or cancel without an account, but nobody else may see their booking;
barbers must see their day and nothing more; the owner needs numbers that come from real visits
and payments, not from reservations.

## Key features

- Bilingual public site: home, services, barbers, gallery, about, contact
- Booking of several services at once, with a chosen barber or "any available"
- 15-minute holds, email confirmation, changes up to 12 hours before
- Client account with upcoming and past bookings
- Barber workspace: day view, visit outcomes, breaks, time-off requests
- Admin workspace: calendar, staff bookings, payments at the counter, catalogue, hours, clients,
  analytics
- Read-only public admin demo on invented data
- Installable PWA

## Design and user experience

Urban editorial, like a magazine cover: black pages, warm white type, large condensed capitals and
one signal colour used sparingly. Booking is a five-step flow that is comfortable on a phone, the
site is in English and Russian, and it can be installed as an app (PWA). The barber and admin
workspaces share the same visual language.

## How it works

The booking rules live in the database. Booking, confirming and rescheduling are PostgreSQL
functions that take a per-barber lock, and an exclusion constraint makes overlapping confirmed
bookings impossible. A hold expires by its timestamp, so it stops blocking even if cleanup runs
late. Guests manage bookings through emailed links whose tokens are stored only as hashes. Row
level security and server-side role checks separate clients, barbers and admins. The admin demo
uses the same pages with invented data generated in memory, so it can never touch real records.

## What was built

- Requirements analysis, data model and booking concurrency design (`docs/architecture.md`).
- PostgreSQL schema, migrations, seed, row level security and booking functions.
- Five-step booking interface; email-link management; client, barber and admin workspaces.
- Email queue with idempotent reminders 24 and 2 hours before a visit.
- Analytics from recorded payments and working hours, with the method stated on the page.
- PWA with an honest offline page, security headers, personal-data retention and erasure.
- 248 automated tests on a real PostgreSQL, including racing bookings and daylight-saving days.
- Security review and deployment to Vercel with Supabase.

## Technology

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, next-intl, Supabase (PostgreSQL,
Auth), node-postgres, Zod, Vitest, embedded PostgreSQL for tests. Vercel hosting.

## Technical challenges

- **Concurrency.** "Check, then insert" lets two people book the same slot. A per-barber
  transaction lock plus an exclusion constraint makes it impossible, and tests race real
  concurrent requests against PostgreSQL.
- **Expiry without a job.** A static constraint cannot depend on the current time, so holds carry
  an expiry timestamp that every availability query respects.
- **Rescheduling safely.** The new slot is secured before the old one is released, under the same
  12-hour rule as cancelling, so one cannot be used to bypass the other.
- **Time zones.** Slots are generated in Europe/London local time and stored as instants; tests
  cover the days when clocks change.
- **A demo that cannot leak.** The admin demo has no database at all: a second implementation of
  the same data interface builds invented records in memory.

## Screenshots

See [`screenshots.md`](screenshots.md).

## About this demo

The public preview uses demonstration data. Live account and booking services are not enabled in
this showcase: the booking flow can be walked through as a preview, and the admin demo shows the
workspaces on invented data.

## Short summary

A full booking system for a barbershop: bilingual site, online booking with email confirmation,
client, barber and admin workspaces with analytics, PWA. Concurrency-safe booking enforced in
PostgreSQL, tested with 248 automated tests. Next.js, TypeScript, Supabase.

## Contact

Evgeniy, Full-Stack Web Developer

- Telegram: [@Maybemol](https://t.me/Maybemol)
- Email: [evgeniyshade@gmail.com](mailto:evgeniyshade@gmail.com)
- GitHub: [github.com/22504105](https://github.com/22504105)

Pricing and timelines are discussed individually based on project requirements.
