# Flowly

Business intelligence for small businesses: a public demo on seeded sample
data, and (in later phases) private workspaces fed by CSV and Excel imports.
Portfolio project #03. Everything runs on free tiers.

**The sample shop, its customers and its orders are invented.**

## Status

**Phase 2 of 5 — the demo dashboard.** The public demo is complete for its
four data pages: Overview, Analytics, Customers and Transactions, with a
period picker, filters, sorting, search, paging, detail drawers and CSV
downloads, all calculated from one seeded dataset.

Not built yet: accounts, persistence and imports (Phase 3); reports and
settings (Phase 4); hardening and deployment (Phase 5). The Imports, Reports
and Settings pages say that they are not written yet; sign-in pages say that
accounts open later.

| Phase | Scope | State |
| ----- | -------------------------------------- | --------------------- |
| 1 | Foundation and architecture | Done |
| 2 | Demo dashboard and analytics | Done, awaiting review |
| 3 | Accounts, persistence, CSV/XLSX import | Not started |
| 4 | Reports, settings, polish | Not started |
| 5 | Hardening, QA, deployment | Not started |

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

Open http://localhost:3000. The demo is at `/demo`.

## Scripts

| Command                           | Purpose                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                     | Development server                                                     |
| `npm run build` / `npm run start` | Production build and server                                            |
| `npm run typecheck`               | TypeScript                                                             |
| `npm run lint`                    | ESLint                                                                 |
| `npm run format` / `format:check` | Prettier                                                               |
| `npm test`                        | Unit tests (Vitest)                                                    |
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
