# CUT&CO

A barbershop website and booking application: public site, online booking with
email verification, client, barber and admin workspaces, and an installable
PWA. English and Russian, prices in US dollars.

**This is a concept portfolio project. CUT&CO is not a real business, and
nothing here can be booked, bought or visited.**

## Status

**Phase 01 of 05 — architecture and foundation.** In place: the bilingual
application shell, the design tokens, the database schema with row level
security and seed data, and the test setup. The public site, the booking flow,
accounts, the admin panel and email are not built yet.

| Phase | Scope | State |
|---|---|---|
| 01 | Architecture and foundation | Done |
| 02 | Public website and booking interface | Not started |
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
docs/           Brief, architecture, design system
```

- [`docs/architecture.md`](docs/architecture.md) — data model, concurrency
  strategy, permission matrix, security review.
- [`docs/design-system.md`](docs/design-system.md) — colour, type, layout.
