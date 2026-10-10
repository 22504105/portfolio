# CUT&CO

A barbershop website and booking application: public site, online booking with
email verification, client, barber and admin workspaces, and an installable
PWA. English and Russian, prices in US dollars.

**This is a concept portfolio project. CUT&CO is not a real business, and
nothing here can be booked, bought or visited.**

## Status

**Phase 02 of 05 — public website and booking interface.** In place: the
bilingual public site (home, services, barbers, gallery, about, contact), the
booking wizard, the design system, the database schema with row level security
and seed data, and the tests.

**Booking is not operational yet.** The wizard runs on a mock in the browser:
the working hours and slot rules are real, the "existing bookings" are invented,
nothing is stored and no email is sent. The pages say so. The booking engine,
email, accounts and the admin panel come in the next phases.

| Phase | Scope | State |
|---|---|---|
| 01 | Architecture and foundation | Done |
| 02 | Public website and booking interface | Done, awaiting visual review |
| 03 | Booking engine, email and accounts | Not started |
| 04 | Admin panel, analytics and public demo | Not started |
| 05 | Final QA, security and deployment | Not started |

## Technology

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · next-intl ·
Supabase (PostgreSQL, Auth) · Zod · Vitest

## Running locally

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The pages built so far need no environment
variables. For later phases, copy `.env.example` to `.env.local`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
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
