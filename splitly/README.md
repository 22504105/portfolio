# Splitly

Shared expenses for a group: who paid, who owes, and how to settle with the
fewest transfers. A Telegram Mini App with a browser demo, in English and
Russian. Portfolio project #04, built on free tiers only.

**Live (stage 1): https://splitly-self.vercel.app**

**Splitly is a portfolio project. Demo data is invented.**

## Status

**Stage 3 of 5 — the receipt scanner.** In place: Telegram sign-in verified by
the server, groups, people, invitations, roles, expenses typed in by hand, and
now receipts: a photo is read on the device (Turkish, English or Russian),
its lines are checked and corrected by the person, translated from a word
list where the list knows the word, given out line by line, and stored as one
expense that balances to the last unit. The browser demo runs the same
screens and the same rules on invented data kept in the visitor's browser.

Not built yet: settling up, exchange rates, analytics and the activity feed
(stage 4); launch (stage 5). Screens that are not written say so and show the
plan; nothing on them pretends to work.

| Stage | Scope                                        | State                 |
| ----- | -------------------------------------------- | --------------------- |
| 1     | Foundation, design system, deployment proof  | Done, awaiting review |
| 2     | Groups, manual expenses, Telegram identity   | Done, awaiting review |
| 3     | Receipt scanner and item assignment          | Done, awaiting review |
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

## Known limits (stages 1–3)

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
- Balances are shown per currency and per person. Who should pay whom, and
  converting between currencies, are stage 4.
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
