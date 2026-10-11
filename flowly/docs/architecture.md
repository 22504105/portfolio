# Flowly — Architecture

The brief is `docs/brief.md`. This document records how it is being built and
every place where the build departs from it, with the reason. Order of
authority: brief → this document → `metrics.md` → `design-system.md`.

## 1. Decisions that depart from the brief

| Brief                                                        | Decision                          | Why                                                                                                                                                                                               |
| ------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting on Cloudflare Workers Free; adapter spike in Phase 1 | **Vercel (Hobby)**                | Owner's decision, 2026-10-11. No adapter, no 10 ms CPU limit, the same free host as the other portfolio projects. The Cloudflare spike was not run                                                |
| Exactly three subagents                                      | Roles simulated by the lead agent | The brief allows it when stated honestly. Subagents are used only if a task warrants it; each phase report says which                                                                             |
| Email verification on sign-up                                | **Off**                           | Owner's decision. Supabase's built-in mailer sends a few emails an hour; password reset still uses it                                                                                             |
| Russian localisation                                         | Architecture only                 | Owner's decision. All interface text is in `lib/i18n/en.ts`; a second language is one more file of the same type                                                                                  |
| One `Transaction/Order` table                                | `orders` + `order_lines`          | See section 4                                                                                                                                                                                     |
| `Customer.first_order_at` stored                             | Derived when read                 | A stored copy goes stale when an import is deleted                                                                                                                                                |
| TanStack Table, date-fns, React Hook Form in the demo        | Not installed                     | Sorting, paging and filtering are done on the server from the address, and dates by `Intl`; the libraries would have nothing to do. They are added if a later phase needs them (forms in Phase 3) |
| Muted text `#737A86`, warning `#A66A20`                      | `#646B77`, `#9A6119`              | Contrast: see `design-system.md`                                                                                                                                                                  |

## 2. Technology

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 ·
shadcn/ui components copied into `components/ui` (the current shadcn default
builds on Base UI primitives) · Lucide icons · Geist (OFL) through `next/font`
· decimal.js · Zod · Vitest · Playwright.

To come, when their phase needs them: Recharts, TanStack Table, date-fns,
React Hook Form (Phase 2–4); Papa Parse, read-excel-file, write-excel-file,
`@supabase/supabase-js`, `@supabase/ssr` (Phase 3). All MIT or Apache-2.0;
each is checked again when installed.

Production dependencies have no known vulnerabilities (`npm audit --omit=dev`).
`npm audit` reports five in the lint toolchain (`eslint-config-next` →
`fast-glob` → `braces`), which never ships.

## 3. Routes

| Address                                | What                                                                                      | Phase              |
| -------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------ |
| `/`                                    | Landing page; its preview is the product's own KPI component on demo data                 | 1                  |
| `/demo`                                | Redirects to `/demo/overview`                                                             | 1                  |
| `/demo/<section>`                      | The public demo: overview, analytics, customers, transactions, imports, reports, settings | 1 shell, 2–4 pages |
| `/demo/export/<kind>`                  | CSV downloads: transactions, customers, breakdown, series                                 | 2                  |
| `/app/<section>`                       | The same sections for a signed-in workspace                                               | 3                  |
| `/login`, `/signup`, `/reset-password` | Accounts                                                                                  | 3                  |
| `/privacy`                             | Data handling                                                                             | 4                  |

Until a page is written, its address shows a notice that says so, or (for
`/app`) leads to the sign-in page. No address is a dead end, and no control is
shown that does nothing.

`lib/routes.ts` is the single list of sections; links are built from a root
(`/demo` or `/app`) and a section.

## 4. Data model

```
workspaces 1 ─── * import_batches 1 ─── * orders 1 ─── * order_lines
     │                                     │
     └──────────── * customers 1 ─── * ────┘   (orders.customer_id may be null)
```

- **Order and order line are separate.** The brief lists one table with both
  an order identifier and a product, and asks that an order with several lines
  is never counted twice. With one table that cannot be guaranteed by a
  constraint; with two it is structural: `orders` has one row per
  `(workspace, external_order_id)`, and its lines hang off it.
- **Two ways to read a file.** _Order per row_: each row is a whole order and
  becomes one order with one line. _Line per row_: rows with the same order
  identifier become one order with several lines; order-level fields (date,
  customer, channel, status) must agree across them, and a file where they do
  not is reported, not guessed.
- **Duplicates.** `unique (workspace_id, external_order_id)`. Importing a file
  twice cannot double its orders. The wizard offers _skip_ (keep what is
  there) or _replace_ (delete the earlier order, insert the new one).
- **Customers.** A customer is identified by the file's customer ID, or
  failing that by email (lower-cased). A row with neither belongs to no
  customer: it counts as an order and as revenue, never as a person.
- **Currency.** One currency per workspace. `orders` has a composite foreign
  key to `workspaces (id, currency_code)`, so an order in another currency
  cannot exist and a workspace's currency cannot be changed while it has
  orders (amounts would be relabelled, not converted).
- **Money** is `numeric(16,4)` in the database and whole minor units in
  memory (`lib/money.ts`); parsing uses decimal arithmetic. Floating point
  never holds an amount.
- **Time.** `timestamptz` in the database, UTC milliseconds in memory. Days
  are decided in the workspace time zone (`lib/time.ts`).

In memory both the demo and a real workspace are a `Dataset`
(`lib/domain/types.ts`): workspace, orders with their lines, customers.

## 5. One engine, two sources

Every figure on every page comes from pure functions in `lib/metrics` applied
to a `Dataset`. There are two producers of a `Dataset`:

- **Demo** — `lib/demo/dataset.ts` generates it from a fixed seed: 5,559
  orders, 1,180 customers, 34 products, 5 channels, 1 August 2025 to 30
  September 2026. No clock, no `Math.random`, no network. It is pinned by a
  snapshot test.
- **Workspace** (Phase 3) — the signed-in user's rows, read from Supabase
  under row level security.

Because pages never calculate anything themselves, the demo and a real
workspace cannot diverge, and two pages cannot disagree.

**State lives in the address.** The period (`from`, `to`), the filters
(`status`, `channel`, `category`, `product`), the chart's grouping (`g`), the
breakdown's dimension (`by`), search (`q`), sort (`sort`, `dir`), the page
number and the open drawer (`order`, `customer`) are search parameters.
`lib/view/state.ts` reads them and validates every one; anything unrecognised
is ignored. Controls are links, a plain GET form (search) and three menus that
change the address. There is no client-side store and no data-fetching library.

**Pages are rendered on the server.** A page reads its address, narrows the
orders (`loadPage` in `lib/workspace.ts`), calls the metric functions and
sends HTML. Only the chart, the period picker, the menus, the drawer and the
navigation are client components. The demo's 5,559 orders are generated once
per server process and each request is a few milliseconds of arithmetic.

**Filters by line.** Status and channel keep or drop whole orders. Category
and product narrow an order to its matching lines, with the amounts and the
share of any refund that belong to those lines, so "revenue for Coffee" is the
revenue of coffee lines.

**Downloads** (`/demo/export/<kind>`) are built from the same page data as the
screen they are offered on, so a file cannot disagree with the page.

**Page components are shared.** `components/pages/*` take a `PageData` and
know nothing about where it came from; `app/demo/*` are a few lines each. The
signed-in workspace (Phase 3) will reuse them with its own data.

## 6. Security plan

- **Isolation.** Row level security on every table (`…_rls.sql`), by
  ownership of the workspace. `anon` has no grants at all. Cross-account
  denial is tested against a real PostgreSQL in Phase 3.
- **Least privilege.** Imported rows can be inserted and deleted, not edited.
  No service-role key anywhere in the application; account deletion will be a
  database function that acts on `auth.uid()` only.
- **Imports are untrusted.** Files are parsed in the browser and never
  uploaded. Only validated, normalised rows are sent, in bounded chunks; the
  database re-checks them with constraints. Formulas and macros are never
  run; cell text is rendered as text.
- **Exports** escape cells that begin with `=`, `+`, `-`, `@`, tab or carriage
  return (CSV/spreadsheet formula injection).
- **Headers** on every response (`next.config.ts`): content security policy,
  no framing, no content-type sniffing, referrer and permissions policies,
  HSTS. Inline scripts stay allowed because Next.js starts pages with them.
- **The demo** reads no database, writes nothing, and contains invented
  people only (`@example.com`).
- **No tracking**, no analytics cookies.
- **Rate limiting.** Supabase Auth limits sign-in attempts itself. Vercel's
  free plan has no per-route limiter; database writes are bounded by row
  limits instead. Documented as a free-tier limitation.

## 7. Folders

```
app/            Routes
components/ui   shadcn components (copied in, owned by the project)
components/…    brand, shell, dashboard, landing
lib/domain      Types shared by everything
lib/metrics     The calculation engine (pure functions)
lib/demo        The seeded demo dataset
lib/i18n        Interface text
supabase/       Migrations
tests/          Unit tests (Vitest)
e2e/            End-to-end tests (Playwright)
docs/           Brief, architecture, metrics, design system
```

## 8. Testing

- `npm test` — unit tests: metric definitions against a hand-worked fixture,
  time zones and daylight saving, money parsing, invariants of the demo data.
- `npm run test:e2e` — Playwright against a production build, desktop and
  phone: demo entry, navigation, no horizontal overflow, 404s, headers.
- `npm run typecheck`, `npm run lint`, `npm run format:check`.
- CI: `.github/workflows/flowly.yml` at the repository root runs all of them.

## 9. Accounts, persistence and imports (Phase 3)

**Accounts.** Supabase Auth with email and password, through `@supabase/ssr`.
Sessions are cookies; `proxy.ts` renews them; every page under `/app` checks
the user with the auth server (`currentUser`) and the workspace before it
reads anything. There is no service-role key anywhere in the application.
Answers never reveal whether an address has an account. After sign-in only
paths inside the application are followed (`lib/safe-next.ts`).

**One workspace per account**, made on first sign-in (`/app/welcome`): name,
currency, time zone.

**Reading.** `lib/data/workspace.ts` loads the workspace's orders with their
lines, and its customers, a thousand rows at a time, and builds the same
`Dataset` the demo generates. The page components are the demo's. A workspace
is capped at 50,000 orders so that this stays reasonable.

**Importing** happens in the browser, in four steps:

1. _Upload_ — `lib/import/table.ts` and `read.ts`. The file is checked by
   name and by content; a workbook's unpacked size is read from its zip
   directory before anything is unpacked; text is decoded as UTF-8, UTF-16 or,
   failing that, Windows-1252 with a note; the delimiter is detected. Limits:
   5 MB, 10,000 rows, 100 columns.
2. _Map_ — `lib/import/mapping.ts` suggests a column for each field from the
   headings; the user confirms. They also say what a row is (an order or an
   order line), how `03/04/2026` should be read if the file does not settle
   it, and what to do with rows that have no status. Nothing is assumed
   silently: no default status, no guessed date order, no generated order
   numbers unless asked for.
3. _Validate_ — `lib/import/validate.ts` turns rows into orders or into
   issues with a line number and a reason. Errors keep a row out; warnings
   say what was adjusted. Lines of one order that contradict each other keep
   the whole order out. Orders the workspace already has are skipped or
   replaced, as chosen.
4. _Confirm_ — `lib/import/persist.ts` creates a batch and sends the orders in
   chunks of 400 to `import_orders`, then closes the batch with
   `finish_import`. If anything fails, `delete_import` removes what was
   written: an import happens or it does not.

**The database checks everything again.** `import_orders` runs with the
caller's rights, so row level security applies inside it; it refuses orders
that do not add up to their lines, more than 500 orders per request, a closed
batch, and a workspace over its limit, and takes each chunk whole or not at
all. Constraints reject negative amounts, unknown statuses and a second order
with the same number.

**Untrusted content.** Cells are rendered as text by React, never as markup.
Formulas are never evaluated: a formula where a number belongs is "not a
number". Exports neutralise cells that a spreadsheet would run.

**The demo's Imports page** is the real wizard with storing switched off: a
visitor can take their own file to the last step and see exactly what would
be imported, and nothing leaves their browser.

**Tests.** `tests/import.test.ts` (dates, money, files, mapping, validation),
`tests/samples.test.ts` (the sample files import cleanly),
`tests/db/isolation.test.ts` (a real PostgreSQL: cross-account denial for
every table and function, atomic chunks, duplicates, limits, cascading
deletes), `e2e/imports.spec.ts` (the wizard in a browser).
