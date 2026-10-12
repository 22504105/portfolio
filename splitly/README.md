# Splitly

Shared expenses for a group: who paid, who owes, and how to settle with the
fewest transfers. A Telegram Mini App with a browser demo, in English and
Russian. Portfolio project #04, built on free tiers only.

**Live (stage 1): https://splitly-self.vercel.app**

**Splitly is a portfolio project. Demo data is invented.**

## Status

**Stage 4 of 5 — debts, currencies, analytics.** In place: Telegram sign-in
verified by the server, groups, people, invitations, roles, expenses typed in
by hand or read from a receipt on the device, and now: who should pay whom
(simplified, or as it happened), settling up with payments that count once
the person paid confirms them, exchange rates recorded by the group's own
people, analytics by category, person and day, an activity list, and a
spreadsheet export. The browser demo runs the same screens and rules on
invented data kept in the visitor's browser.

Not built yet: launch work (stage 5): Telegram's own controls, the invitation
QR code, accessibility and performance passes, an independent look at security.

| Stage | Scope                                        | State                 |
| ----- | -------------------------------------------- | --------------------- |
| 1     | Foundation, design system, deployment proof  | Done, awaiting review |
| 2     | Groups, manual expenses, Telegram identity   | Done, awaiting review |
| 3     | Receipt scanner and item assignment          | Done, awaiting review |
| 4     | Balances, currencies, settlements, analytics | Done, awaiting review |
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

The screens follow the owner's design concept: `docs/concept.md` (in Russian)
lists what the concept shows, what it leaves out, and which stage builds what.

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

## Known limits (stages 1–4)

- Built and checked by one agent; the brief's three subagent roles were not
  delegated.
- Hosted on Vercel by the owner's decision; the brief's Cloudflare Workers
  comparison was not run.
- **Not opened inside Telegram yet.** Sign-in was checked end to end with
  sign-in data signed by the real bot's token (`scripts/live-check.mjs`, against the
  real database), but nobody has opened the Mini App in a Telegram client: that
  needs the Mini App address set in @BotFather (the stage is deployed, and
  the same check passes against the live site).
- **Reading a receipt is best-effort.** It was tested on receipts drawn for
  the purpose (clean print, straight on). A real photo of thermal paper, at an
  angle, in poor light, will read worse; that is what the review screen and
  the way on by hand are for. Not tried on a real phone's camera yet.
- The scanner turns and sharpens a photo but does not crop it. A line is
  shared equally among the people chosen for it; unequal shares of one line
  (amounts, percentages) are not offered in the scanner, only in a
  hand-entered expense.
- Names are shown as the receipt prints them. Translating is a choice the
  person makes on the review screen (remembered on the device); it uses a
  word list of about 120 everyday things and leaves the rest as printed.
- Product codes and barcodes printed beside or above a name are left out.
  Where print shows through from the back of the paper a name can still come
  out as rubbish; its price is kept and the line is marked for a look.
- A photo is read twice (as it is, and with the paper's tone evened out) and
  the two readings are combined: about three seconds instead of one and a
  half on a desktop, longer on a phone.
- There is no list of past receipts as such: a receipt is its expense, and
  its lines are shown under that expense in the group.
- **The scanner reads real receipts poorly** (the owner's verdict after trying
  it): prices are found, names often are not. It is usable only with the
  review screen. To be revisited.
- Debts are never converted: each stays in the currency of its expense, and
  is settled in that currency. Rates are typed in by hand; nothing fetches
  one. They are used only to show totals in the group's own currency.
- "Simplified" transfers are few and stable, not proven to be the fewest
  possible.
- The activity list is read from the expenses and payments themselves. It
  does not show renames, role changes or who cancelled what.
- The export is CSV only; there is no PDF report.
- The demo has no invitations: there are no other accounts in it to invite.
- A person's Telegram photo is loaded from Telegram by address; when the
  address stops working their face is drawn until they next open the app.
- A person who deletes their account stays in shared groups as "Former member"
  (in English, whatever the viewer's language): the name is data.
- Checked in Chrome on an emulated phone and a desktop; not on real devices.

## Third-party software

All MIT unless noted: Next.js, React, Tailwind CSS, Lucide (ISC), decimal.js,
Zod, clsx, tailwind-merge, Inter typeface (SIL OFL). No paid services, assets
or licences.
