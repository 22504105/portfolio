# CUT&CO

A barbershop website and booking application: public site, online booking with
email verification, client, barber and admin workspaces, and an installable
PWA. English and Russian, prices in US dollars.

**This is a concept portfolio project. CUT&CO is not a real business, and
nothing here can be booked, bought or visited.**

## Status

**Phase 03 of 05, part one — the booking engine.** In place: the bilingual
public site, and real booking for guests: availability from the database, a
slot held for fifteen minutes, confirmation by email link, a page to view,
reschedule or cancel a booking, and an email queue with reminders.

**Not built yet:** accounts and sign-in for clients and staff, the barber
workspace (the rest of Phase 03, which needs a Supabase project), the admin
panel and the public demo (Phase 04).

Without a database configured the site still runs: it serves its built-in
catalog, and the booking page shows the same wizard on a mock, labelled as a
preview.

| Phase | Scope | State |
|---|---|---|
| 01 | Architecture and foundation | Done |
| 02 | Public website and booking interface | Done |
| 03 | Booking engine, email and accounts | Engine, email and guest management done; accounts and barber workspace to do |
| 04 | Admin panel, analytics and public demo | Not started |
| 05 | Final QA, security and deployment | Not started |

## Technology

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · next-intl ·
Supabase (PostgreSQL, Auth) · Zod · Vitest

## Running locally

Requires Node.js 22.12 or newer.

```bash
npm install
npm run db:dev    # in one terminal: a local PostgreSQL, no Docker, no account
npm run dev       # in another
```

Open http://localhost:3000. `npm run db:dev` creates the database with the
migrations and the seed applied and writes `.env.local` on its first run.
Skip it and the site still runs, with the booking page in preview mode.

Emails are not sent in development. They are written to `.tmp/mail` and shown
at http://localhost:3000/en/dev/mail, with their links: book an appointment,
open that page, and follow the confirmation link. `npm run jobs` sends whatever
is due on the queue, the way the scheduler does in production.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run db:dev` | Local PostgreSQL for development (`-- --reset` to start over) |
| `npm run jobs` | Run the email queue once against the local server |
| `npm test` | Unit tests and database tests |
| `npm run images -- <folder>` | Rebuild `public/images` from the raw photographs |

The database tests start a real PostgreSQL from the `embedded-postgres`
package (no Docker), apply the migrations and the seed, and run against it.

## Database

`supabase/migrations` holds the schema and the row level security policies;
`supabase/seed.sql` holds the fictional shop: four barbers, eight services,
their weekly hours. To set up a Supabase project, run the migration files in
name order and then the seed in the SQL editor, or link the project and use
the Supabase CLI:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

Staff accounts are not seeded. An account becomes a barber or an admin when
its `profiles.role` is set by someone with database access.

The application reaches the database directly, with `DATABASE_URL`, for
everything to do with bookings. See `.env.example` for every variable.

### Scheduler

`GET /api/cron/notifications` with `Authorization: Bearer <CRON_SECRET>` sends
the emails that are due and expires stale holds. Reminders need it to run every
few minutes. Vercel's free plan runs cron jobs once a day at most, so on that
plan the call has to come from elsewhere: Supabase `pg_cron` with `pg_net`, or
any external scheduler. Emails caused by an action (verification, confirmation,
cancellation) do not wait for it: they are sent right after the action.

## Structure

```
app/            Routes; everything user-facing is under [locale]
components/     Shared components
i18n/           Locale routing and navigation helpers
lib/            Configuration, formatting, environment, Supabase clients
messages/       Interface text: en.json and ru.json
supabase/       Migrations and seed
tests/          Database tests and catalog checks
data/           Image registry
scripts/        Image processing
docs/           Brief, architecture, design system, image brief
```

- [`docs/architecture.md`](docs/architecture.md) — data model, concurrency
  strategy, permission matrix, security review.
- [`docs/design-system.md`](docs/design-system.md) — colour, type, layout.
- [`docs/image-brief.md`](docs/image-brief.md) — the photographs the site needs.

## Photographs

The photographs are generated for the project and supplied separately
(`docs/image-brief.md`). Until one is supplied, its place shows an empty frame
with a caption. `npm run images -- <folder>` processes whatever is in the
folder and can be run again as more arrive.
