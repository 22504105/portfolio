# Splitly — Architecture

The brief is `docs/brief.md`. This document records how it is being built and
every place where the build departs from it, with the reason. Order of
authority: brief → this document → `security.md` → `design-system.md`.

## 1. Decisions that depart from the brief, or settle what it leaves open

| Brief                                                                                              | Decision                                                          | Why                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting: Cloudflare Workers Free as a target, proven by a spike, with a free fallback to be agreed | **Vercel (Hobby)**                                                | Owner's decision, 2026-10-12, before development: no adapter, no 10 ms CPU limit, the same free host as the other portfolio projects. The proof the brief asks for was done on Vercel: see `deployment.md` |
| Three delegated subagents                                                                          | Roles carried by the lead agent, stated in every stage report     | Owner's standing instruction: subagents only when a task warrants it                                                                                                                                       |
| Supabase Free PostgreSQL                                                                           | **A separate schema, `splitly`, in an existing Supabase project** | The free tier allows two projects and both are in use. The schema keeps Splitly's tables apart; the platform's API roles are granted nothing in it                                                         |
| Supabase Auth, or a custom session                                                                 | **A custom server session**                                       | Telegram identity is verified by the server from Telegram's signature; there is nothing for Supabase Auth to add. Details in `security.md`                                                                 |
| `receipt_uploads.storage_path` optional                                                            | **Receipt photographs are not stored at all**                     | Owner's decision. A photo is read on the device and stays there; a hash is kept to notice duplicates, and the lines the user confirms                                                                      |
| PDF receipts "only if necessary"                                                                   | **Not in v1**: JPG, PNG and WebP                                  | Owner's decision                                                                                                                                                                                           |
| `guest_members` as its own table                                                                   | Folded into `group_members` (a member is a user or a named guest) | Expenses, shares and settlements then point at one kind of thing, and a guest's history stays intact when they join                                                                                        |
| shadcn/ui, Radix                                                                                   | Not installed yet                                                 | Stage 1 needs none of it. Components are added when a screen needs one (a sheet, a dialog), and only then                                                                                                  |
| Muted, danger and warning colours                                                                  | Darkened                                                          | They fall short of WCAG AA as text: see `design-system.md`                                                                                                                                                 |

## 2. Technology (exact versions are pinned in `package.json`)

Next.js 16.3.8 (App Router, Turbopack) · React 19.2.8 · TypeScript 5.9 ·
Tailwind CSS 4.3 · Lucide icons · Inter (OFL) through `next/font`, Cyrillic
included · decimal.js · Zod · Vitest · Playwright · PostgreSQL through `pg`
(from stage 2).

To come, when their stage needs them: Tesseract.js with Turkish, English and
Russian data served from the site itself (stage 3); Telegram's WebApp script
(stage 2). Nothing paid, and no external service the core depends on.

Production dependencies have no known vulnerabilities (`npm audit --omit=dev`).

## 3. Routes

| Address                                                         | What                                                                     | Stage                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------- |
| `/`                                                             | Redirects to `/en` or `/ru` by the visitor's language                    | 1                    |
| `/[locale]`                                                     | Onboarding: what Splitly is, the way into the demo                       | 1                    |
| `/[locale]/demo` and `/groups`, `/activity`, `/profile`, `/add` | The browser demo: the app on invented data kept in the visitor's browser | 1 shell, 2–4 screens |
| `/[locale]/app/…`                                               | The same screens for a person signed in through Telegram                 | 2                    |
| `/api/health`                                                   | Proof that server code runs on the host                                  | 1                    |
| `/api/…`                                                        | Sessions and data                                                        | 2                    |

The language is the first part of every address. That works inside Telegram,
where cookies set by an embedded page may not survive, and makes any screen
linkable in either language.

## 4. One application, two places to keep data

Screens do not know where their data lives. They talk to a `Store`
(`lib/store/types.ts`), given to them by a provider (`components/app`):

- **Demo** — invented data, seeded deterministically, kept in the visitor's
  browser (local storage), with a reset. It never touches the server's data.
- **Signed in** — the server's API, behind a session, backed by PostgreSQL.

Everything that calculates (splitting, balances, simplifying debts) is pure
code in `lib/`, shared by both, and by the tests. In particular
`lib/split/expense.ts` is the single check an expense must pass: the form
runs it as you type, the demo before it stores, the server before it writes.
The shares are always worked out there and never accepted from a client.

The server side is three layers: `app/api/v1/[...path]` hands every request to
`lib/server/api.ts` (parsing, session, limits, one transaction per request),
which calls `lib/server/service.ts` (the only code that decides who may do
what, and the only code that writes). The API is listed in `api.ts` itself:
`POST session`, `GET|DELETE me`, `groups`, `groups/:id`, `…/members`,
`…/invites`, `invites/preview|accept`, `…/expenses`.

## 5. Money

- **Minor units, always.** An amount is a whole number of the currency's minor
  unit (`lib/money`). How many minor units make one unit is looked up per
  currency (2 for TRY, 0 for JPY, 3 for KWD), never assumed. In the database:
  `BIGINT`. Across JSON: text. In memory: a number, checked on the way in to
  be a safe integer within a fixed limit.
- **Decimal arithmetic only at the edges**: reading what a person typed, and
  applying an exchange rate (`decimal.js`). Never floating point.
- **Nothing is guessed.** `12,505` in a currency of two decimals could be a
  thousand or a slip; it is refused and the form asks again. More decimals
  than the currency has is refused, not rounded.
- **Splitting** (`lib/money/allocate.ts`), the largest-remainder rule: every
  part gets its exact share rounded down; the minor units left over go one
  each to the parts with the largest fraction cut off; ties go in the order
  the people were listed. The parts always add up to the total, no part is
  more than one minor unit from its exact share, and the result is the same
  on every device. A refund is split as the mirror image of the purchase.
- **Shown** with the currency code, never a bare symbol, in the reader's
  number format.

## 6. Data model

```
users ── telegram_identities, user_settings
  │
groups ──< group_members (a user, or a named guest)
  │            ▲
  ├──< invites │
  ├──< receipts ──< receipt_items ──< receipt_item_allocations
  ├──< expenses ──< expense_payers, expense_splits
  ├──< settlements
  ├──< fx_rates
  └──< activity_log
```

What the database itself guarantees (`…_integrity.sql`, tested on a real
PostgreSQL in `tests/db/schema.test.ts`):

- **An expense balances**: what was paid == its total == what is owed. Checked
  when the transaction commits, so an expense is written whole or not at all.
- **History is not rewritten.** An expense's amount, currency and date cannot
  be updated. An edit writes a new expense and marks the old one `replaced`; a
  refund is its own expense with a negative total. Recorded exchange rates and
  the activity log never change.
- **No stored balances.** Balances are always calculated from active expenses
  and confirmed settlements.
- **Nobody from another group** can be a payer, a debtor or a party to a
  settlement: every such reference is to `(group, member)` together.
- **The same submission twice is one expense**: `(group, idempotency_key)` is
  unique.
- **A proposed settlement changes nothing**; only a confirmed one counts, and
  a settlement is confirmed exactly when it has a confirmation time.
- **Deleting a group** removes everything in it and nothing outside it.

## 7. Folders

```
app/[locale]/   Screens, under a language
app/api/        Server endpoints
components/     shell, brand, theme (ui/ when needed)
lib/money       Amounts, currencies, splitting
lib/i18n        English and Russian
supabase/       Migrations
tests/          Unit tests, and database tests on a real PostgreSQL
e2e/            End-to-end tests (Playwright), phone first
docs/           Brief, architecture, security, design system, deployment
```

## 8. Testing

- `npm test` — money (parsing, formatting, splitting, with 3,000 seeded random
  cases for the invariants), both languages having the same keys, the contrast
  of both palettes, and the schema's rules on a real PostgreSQL (no Docker).
- `npm run test:e2e` — Playwright against a production build, on a phone and
  on a desktop: language redirects, navigation, language switch, themes,
  no horizontal overflow, touch targets, headers, no dead controls.
- `npm run typecheck`, `npm run lint`, `npm run format:check`.
- CI: `.github/workflows/splitly.yml` at the repository root.

## 9. The receipt scanner (stage 3)

One path from paper to expense, each step its own piece of code:

| Step          | Where                      | What it does                                                                                                         |
| ------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Photo         | `lib/receipt/image.ts`     | Checks type, size and dimensions; redraws on a canvas (dropping the file's own data), turns, sharpens                |
| Reading       | `lib/receipt/ocr.ts`       | Tesseract in a worker, from files this site serves; words are put into rows by their place on the page               |
| Understanding | `lib/receipt/parse.ts`     | Rows into bought lines, discounts, service, tip, the printed total, tax already inside prices; never guesses a price |
| Naming        | `lib/receipt/glossary.ts`  | The word list; the person's own corrections first; unknown names stay as printed                                     |
| Working draft | `components/scan/draft.ts` | What the person edits; totals and the difference from the printed total                                              |
| Shares        | `lib/receipt/build.ts`     | Lines and who had them into an expense that balances; the one function the screen, the demo and the server all run   |
| Storing       | `lib/server/service.ts`    | Receipt, expense, lines and each person's part of each line in one transaction                                       |

Rules worth knowing:

- **A line's leftover unit goes to the first person listed**, as everywhere
  else. **An adjustment with nobody named** (discount, tax, service, tip,
  correction) is spread in proportion to what each person took of the bought
  lines. The expense's total is the sum of its lines, and each person owes the
  sum of their parts: the three cannot disagree, and the database checks it
  again (a line partly given out is refused at commit).
- **Tax printed as already inside the prices** (Turkish KDV, Russian НДС) is
  shown for information and not added. A receipt whose tax is on top needs a
  tax line added by hand; the mismatch with the printed total says so.
- **The photo is prepared without loss** (PNG). Re-encoding it as a JPEG
  smeared small print enough to change digits.
- **The reader's files are not in the repository.** `scripts/ocr-assets.mjs`
  copies the worker, the engine and three languages' data (about 21 MB) from
  the pinned packages into `public/ocr` before every `dev` and `build`.
- **Layout mode**: one block read row by row. The "single column" mode read a
  receipt as two columns, names and then prices.
