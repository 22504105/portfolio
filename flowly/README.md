# Flowly

Business intelligence for small businesses: a public demo on seeded sample
data, and (in later phases) private workspaces fed by CSV and Excel imports.
Portfolio project #03. Everything runs on free tiers.

**The sample shop, its customers and its orders are invented.**

## Status

**Phase 1 of 5 — foundation.** In place: the application shell (sidebar, rail,
drawer), the landing page, the seeded demo dataset, the core of the metric
engine with the four headline figures on the demo overview, the database
schema and row level security policies, unit and end-to-end tests, CI.

Not built yet: charts, filters and the other demo pages (Phase 2); accounts,
persistence and imports (Phase 3); reports and settings (Phase 4); hardening
and deployment (Phase 5). Pages that are not written say so.

| Phase | Scope                                  | State                 |
| ----- | -------------------------------------- | --------------------- |
| 1     | Foundation and architecture            | Done, awaiting review |
| 2     | Demo dashboard and analytics           | Not started           |
| 3     | Accounts, persistence, CSV/XLSX import | Not started           |
| 4     | Reports, settings, polish              | Not started           |
| 5     | Hardening, QA, deployment              | Not started           |

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
