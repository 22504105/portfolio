# Flowly

Business intelligence for small businesses: a public demo on seeded sample
data, and (in later phases) private workspaces fed by CSV and Excel imports.
Portfolio project #03. Everything runs on free tiers.

**The sample shop, its customers and its orders are invented.**

## Status

**Phase 3 of 5 — accounts, persistence and imports.** Built and tested as far
as it can be without a live Supabase project:

- the import pipeline (CSV and XLSX, mapping, validation, duplicate handling),
  tested with unit tests and in a browser through the demo's Imports page;
- the database: schema, row level security and the import functions, tested
  on a real PostgreSQL, including that one account cannot reach another's data;
- sign-up, sign-in, sign-out, password reset, the private workspace and its
  pages: written, type-checked and built.

**Not yet verified:** anything that needs a real Supabase project — signing
up, storing an import, reading it back, deleting it. That needs the two
values in `.env.local` (see "Accounts and your own data").

Not built yet: reports and settings (Phase 4); hardening and deployment
(Phase 5).

| Phase | Scope                                  | State                                          |
| ----- | -------------------------------------- | ---------------------------------------------- |
| 1     | Foundation and architecture            | Done                                           |
| 2     | Demo dashboard and analytics           | Done                                           |
| 3     | Accounts, persistence, CSV/XLSX import | Built; live Supabase check pending credentials |
| 4     | Reports, settings, polish              | Not started                                    |
| 5     | Hardening, QA, deployment              | Not started                                    |

## What the demo does

- **Period**: seven ready-made periods or any custom range; every figure is
  compared with the same number of days just before.
- **Filters**: status, channel, category, product. They act the same on every
  page, and the period and filters follow you from one page to the next.
- **Overview**: four headline figures, repeat rate, refunds, revenue over
  time against the previous period, revenue by channel, top products, recent
  transactions. Conversion rate is shown as unavailable: there is no traffic
  data, and none is invented.
- **Analytics**: revenue by day, week or month; breakdown by channel,
  category or product as bars and as a table; the chart's numbers as a table.
- **Customers**: who bought in the period, what they spent then and in all,
  new or returning, with each customer's full order history.
- **Transactions**: every order, searchable and sortable, with its lines.
- **Downloads**: transactions, customers, the breakdown and the time series
  as CSV, holding exactly what the page shows. Cells that a spreadsheet would
  run as a formula are neutralised.
- Everything a page shows is in its address, so any view can be bookmarked or
  shared, and the back button undoes a filter.

## Running locally

Requires Node.js 22.12 or newer. No environment variables are needed.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The demo is at `/demo`. Without Supabase
configured, the account pages say that accounts are not set up.

## Accounts and your own data

1. Create a Supabase project (free tier).
2. Authentication → Sign In / Providers → Email: switch **Confirm email** off.
   (With it on, sign-up still works but asks the user to confirm first, and
   Supabase's built-in mailer sends only a few emails an hour.)
3. Authentication → URL Configuration: set the site URL and add
   `http://localhost:3000/**` (and the deployed address) to the redirect URLs,
   for password-reset links.
4. Copy `.env.example` to `.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (Project Settings → API). **The publishable key only, never a secret key.**
5. Apply the database migrations: put the pooler connection string in
   `.env.local` as `DATABASE_URL` and run `npm run db:migrate`, or paste the
   files of `supabase/migrations` into the SQL editor in name order.
6. `npm run dev`, open `/signup`.

**Importing.** Imports → drop a `.csv` or `.xlsx` → match the columns →
review what will be left out and why → confirm. Files are read in the browser
and never uploaded; only confirmed orders are stored. Limits: 5 MB and 10,000
rows per file, 50,000 orders per workspace. Sample files are on the Imports
page. Deleting an import removes its orders; figures are always calculated
from what is stored, so nothing needs recomputing.

**Email verification.** Off by design for this project: an account works as
soon as it is made. The reset link is the only email Flowly depends on.

## Scripts

| Command                           | Purpose                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                     | Development server                                                     |
| `npm run build` / `npm run start` | Production build and server                                            |
| `npm run typecheck`               | TypeScript                                                             |
| `npm run lint`                    | ESLint                                                                 |
| `npm run format` / `format:check` | Prettier                                                               |
| `npm run db:migrate`              | Apply `supabase/migrations` to the database in `DATABASE_URL`          |
| `npm test`                        | Unit and database tests (Vitest; starts a real PostgreSQL)             |
| `npm run test:e2e`                | End-to-end tests (Playwright; builds first, uses the installed Chrome) |

## Documents

- [`docs/brief.md`](docs/brief.md) — the specification.
- [`docs/architecture.md`](docs/architecture.md) — decisions, data model,
  routes, security plan, and where the build departs from the brief.
- [`docs/metrics.md`](docs/metrics.md) — what every figure means.
- [`docs/design-system.md`](docs/design-system.md) — tokens, type, contrast.

## Hosting

Vercel (Hobby), by the owner's decision; the brief's Cloudflare Workers target
was dropped. Not deployed yet.
