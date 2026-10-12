# Splitly

Shared expenses for a group: who paid, who owes, and how to settle with the
fewest transfers. A Telegram Mini App with a browser demo, in English and
Russian. Portfolio project #04, built on free tiers only.

**Live (stage 1): https://splitly-self.vercel.app**

**Splitly is a portfolio project. Demo data is invented.**

## Status

**Stage 1 of 5 — foundation.** In place: the design system in two themes, both
languages, the app shell and navigation (phone first), the money library
(minor units, parsing, formatting, exact splitting), the database schema with
its money rules enforced and tested on a real PostgreSQL, the security
architecture, tests, CI, and a real deployment.

Not built yet: groups, people, expenses and Telegram sign-in (stage 2); the
receipt scanner (stage 3); balances, settlements, currencies and analytics
(stage 4); launch (stage 5). Screens that are not written say so and show the
plan; nothing on them pretends to work.

| Stage | Scope                                        | State                 |
| ----- | -------------------------------------------- | --------------------- |
| 1     | Foundation, design system, deployment proof  | Done, awaiting review |
| 2     | Groups, manual expenses, Telegram identity   | Not started           |
| 3     | Receipt scanner and item assignment          | Not started           |
| 4     | Balances, currencies, settlements, analytics | Not started           |
| 5     | Telegram QA, accessibility, security, launch | Not started           |

## Running locally

Requires Node.js 22.12 or newer. No environment variables are needed.

```bash
npm install
npm run dev
```

Open http://localhost:3000. You are sent to `/en` or `/ru` by your browser's
language; the demo is at `/en/demo`.

## Scripts

| Command                           | Purpose                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                     | Development server                                                     |
| `npm run build` / `npm run start` | Production build and server                                            |
| `npm run typecheck`               | TypeScript                                                             |
| `npm run lint`                    | ESLint                                                                 |
| `npm run format` / `format:check` | Prettier                                                               |
| `npm test`                        | Unit tests, and database tests on a real PostgreSQL (no Docker needed) |
| `npm run test:e2e`                | End-to-end tests (Playwright; builds first, uses the installed Chrome) |

## Documents

- [`docs/brief.md`](docs/brief.md) — the specification.
- [`docs/architecture.md`](docs/architecture.md) — decisions, where the build
  departs from the brief, money rules, data model.
- [`docs/security.md`](docs/security.md) — identity, sessions, authorisation,
  the demo's isolation, receipts.
- [`docs/design-system.md`](docs/design-system.md) — colour, type, layout,
  contrast.
- [`docs/deployment.md`](docs/deployment.md) — the deployment proof, with the
  real command and output.

## Known limits (stage 1)

- Built and checked by one agent; the brief's three subagent roles were not
  delegated.
- Hosted on Vercel by the owner's decision; the brief's Cloudflare Workers
  comparison was not run.
- Not opened inside Telegram yet: that needs a bot, which comes with stage 2.
- Checked in Chrome on an emulated phone and a desktop; not on real devices.

## Third-party software

All MIT unless noted: Next.js, React, Tailwind CSS, Lucide (ISC), decimal.js,
Zod, clsx, tailwind-merge, Inter typeface (SIL OFL). No paid services, assets
or licences.
