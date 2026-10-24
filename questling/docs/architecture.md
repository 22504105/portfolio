# Questling — architecture (Gate 1 proposal)

Status: Gate 2. Parts marked *decided* are in the code; the rest is the plan for Gates 3–5.

## 1. Stack and versions (*decided*)

Same versions as Splitly, which already builds and runs on Vercel from this repo (checked 2026-10-23):

| Package | Version | Why |
|---|---|---|
| next | 16.3.8 | App Router, Route Handlers, `next/font` self-hosting |
| react / react-dom | 19.2.8 | required by Next 16 |
| typescript | 5.9.3, `strict` | |
| tailwindcss + @tailwindcss/postcss | 4.3.3 | built in, no CDN; tokens as CSS variables |
| pg | 8.23.1 | server talks to PostgreSQL directly (same approach as CUT&CO and Splitly) |
| zod | 4.6.6 | request and content schema validation (story graphs, quiz definitions) |
| vitest | 5.0.3 (+ @types/node 22) | unit and domain tests |
| @playwright/test | 1.64.0 | E2E and visual QA screenshots |
| embedded-postgres | 18.4.0-beta.17 | real PostgreSQL for tests and local dev without Docker |
| sharp | 0.35.5 | asset audit and offline image processing |

Node ≥ 22.12 (machine has 24.18). No paid dependency anywhere. Graph editor (`@xyflow/react`) is
decided in Gate 4 after the builder screen is ported, not before.

## 2. Layout

```
questling/
  app/
    (student)/        mobile routes, rendered in a 390-px frame (max 420 px, centred on desktop)
    (studio)/studio/  Teacher Studio, desktop
    api/              Route Handlers: every privileged operation
  components/
    ui/               primitives ported from the Stitch markup (buttons, cards, chips, nav)
    student/, studio/ screen-level components
  lib/
    design/           token scopes, font setup
    story/            story graph types, engine (pure functions), validation
    server/           db, sessions, Telegram verification, services — `server-only`
    demo/             isolated demo data (labelled, never mixed with real records)
  supabase/migrations numbered SQL, applied by scripts/migrate.mjs
  design-source/      unpacked Stitch archives (local only, not in git)
  docs/               this file, screen map, asset audit, visual QA
```

## 3. Design system reconstruction (*decided*)

- Tailwind v4 `@theme` holds the union of the Stitch configs (`scripts/extract-tokens.mjs` shows one
  shared Gothic Arcana set for 16 screens). Class names are kept as in the export, so markup ports almost
  1:1 and the diff against the reference stays small.
- Screens whose config differs get a token scope: a `data-scope` attribute that redefines the CSS
  variables (`profile`: `secondary`, `background`; `home` and `select`: `gold-*`; `shop`: `font-sans`).
  Colours that depend on scope are declared in `@theme inline` so Tailwind reads the variable at use,
  not once on `:root` (lesson from CUT&CO).
- Fonts are self-hosted through `next/font/google` at build time (no request to Google from the
  client): Inter, EB Garamond, Cormorant Garamond, Cinzel, plus MedievalSharp and Plus Jakarta Sans for
  the two screens that use them. Material Symbols Outlined is served from the site as a subset.
- Visual QA renders the original `code.html` (images pointed at the local copies) and the route at the
  same viewport in the same Chromium, and diffs the two; screenshots go to `docs/visual-qa/`.

## 4. Identity and access

**Students — Telegram.** The Mini App sends `initData`; the server verifies the HMAC with the bot token,
rejects anything older than 1 hour or from the future, then issues its own short session token (signed,
6 h, sent in the `Authorization` header, not a cookie — Telegram Web runs the app in a third-party
frame). `initDataUnsafe` is never used for identity. Code and tests can be carried over from Splitly
(`lib/server/telegram.ts`, `session.ts`).

**Teachers — browser.** Supabase Auth (email + password, as in CUT&CO), only for identity. A row in
`teachers` grants the role; every Studio handler checks the role *and* ownership of the group or quest
it touches. No admin key in the client.

**Demo.** `/demo` runs the student app on an in-memory demo store with a visible "Демо" label. No fake
Telegram login, no writes to the database.

**Tenant isolation.** All access goes through server handlers that filter by the caller's id; the
database role used by the app has no rights outside the `questling` schema. RLS is enabled on every
table with no policies for `anon`/`authenticated` (the Supabase client is never used for data), so a
leaked anon key reads nothing.

## 5. Student record (*decided*, Gate 2)

One rule engine for the demo and the server. A student's record is a set of plain **facts**
(`lib/game/facts.ts`): ledger entries (XP and coins), graded answers, completions (a quest on a day, a
story clue, a chapter, an achievement, a weekly chest, the day's claim), saved words and facts, owned
and worn items, the chosen hero. Balances, level, streak, today's quests, story progress and
achievement progress are never stored; they are worked out from the facts (`lib/game/stats.ts`).

Every action is a pure function (`lib/game/ops.ts`): facts + input → **effects** (new facts) or a
refusal. Achievements whose goal is reached are added in the same step.

- **Demo** (`/demo`): `DemoProvider` runs the actions in the browser and keeps the facts in
  `localStorage`. The made-up history is played through the same actions (`lib/demo/seed.ts`).
- **Signed-in student** (`/app`): `LiveProvider` gets a session from Telegram's signed sign-in data
  and sends actions to `POST /api/v1/actions`. The server (`lib/server/service.ts`) locks the
  student's row, loads the facts, runs the same action, stores the effects in the same transaction
  (`lib/server/store.ts`) and answers with the new facts. Answer keys (`lib/content/*-keys.ts`) are
  imported by the server and the demo only, never by a signed-in student's page.

Schema `questling` (`supabase/migrations/20261024000100_students.sql`): `users`, `auth_identities`,
`ledger` (unique key per student and currency, append-only, coins never below zero at commit),
`answers`, `completions`, `saved`, `inventory`, `equipped` (only owned items), `rate_limits`. Row level
security on, no grants to Supabase's API roles. Tested on a real PostgreSQL (`tests/db`).

Content (quests, words and facts, items, achievements, the campaign) is code in `lib/content`, in
both interface languages, until Teacher Studio stores teacher-authored content (Gate 4).

The academy's calendar is Moscow time for everyone (`lib/game/time.ts`): daily quests, the word of
the day, streaks and the weekly chest turn over at midnight there.

## 6. Data model still to come (Gates 3–4)

All tables in schema `questling`. Ids are UUIDs; money-like values are integers.

| Area | Tables |
|---|---|
| People | `users` (one per person; ui_language, character_id), `auth_identities` (provider `telegram` / `supabase`, subject, unique), `teachers` (user_id) |
| Groups | `groups` (teacher_id, name, cefr_level A1–C1, archived_at), `group_members` (group_id, user_id, role student, joined_at), `group_invites` (code hash, expires_at, max_uses) |
| Content | `quests` (owner teacher, kind story/quick, title), `quest_versions` (quest_id, number, status draft/published/archived, graph jsonb validated by zod, published_at; published rows immutable — trigger), `quest_nodes` / `quest_edges` materialised from the published graph for analytics, `clues` |
| Assignment | `assignments` (group_id, quest_version_id, starts_at, due_at) |
| Play | `story_runs` (user, quest_version, current_node, flags jsonb, status; unique per user+version+mode), `attempts` (run, node, answer jsonb, correct, attempt_no), `run_evidence` (run, clue) |
| Daily | `daily_entries` (date, kind word/fact, cefr, group_id nullable, content jsonb, source), `vocabulary_saves` |
| Economy | `xp_ledger`, `coin_ledger` (user, amount, reason, idempotency_key **unique**), balances are sums (cached in `users` and checked by a constraint trigger) |
| Cosmetics | `items` (slot, species, rarity, price_coins, layers jsonb, anchors jsonb), `inventory` (user, item, unique), `equipped` (user, slot, item; unique per slot) |
| Achievements | `achievements`, `user_achievements` (unique) |
| Media, audit | `media_assets` (owner, mime, size, storage path), `audit_log` |

Integrity rules carried into SQL, not left to the client:
- Rewards: one ledger row per `(user, reason, source id)` via the unique idempotency key; replays and
  refreshes insert nothing.
- Purchases: one transaction locks the user row, checks balance ≥ price, ownership absent, species
  allowed, then writes `coin_ledger` and `inventory`. Balance can never go negative (check constraint).
- Equip: only owned items, slot and species must match, conflicts from item metadata.
- Story: the server holds answer keys; the client gets nodes without them. A run stays bound to the
  version it started on.

## 7. Hosting and free-tier limits

- **App:** Vercel Hobby (free, non-commercial — fits a portfolio). Same route as Splitly and CUT&CO:
  subfolder project, CLI deploy. *Deploy only with owner approval.*
- **Database:** PostgreSQL on Supabase Free: project `Questling` (`xqkhmbvstcjvfttkdvxg`, eu-west-1),
  created 2026-10-24 on the owner's word; the other projects are paused. Limits: 500 MB database,
  5 GB egress, idle projects paused after a week. Migrations applied 2026-10-24 on the owner's
  go-ahead (`npm run db:migrate`, journal in `questling_meta.migrations`).
- **Bot:** @QuestlingEnglish_bot. The Mini App opens `https://<deployment>/ru/app`.
- **Live check:** `node scripts/live-check.mjs [base URL]` signs in the way Telegram does, plays a few
  actions against the real database and deletes its test student (13 checks).
- **Local and tests:** embedded PostgreSQL in `.tmp/` (no Docker on this machine).
- **Staging proof (Gate 1 deliverable):** a production `next build` and `next start` run locally and
  are smoke-tested by Playwright. A real Vercel preview deploy waits for the owner's approval.

## 8. Telegram specifics

- Script `https://telegram.org/js/telegram-web-app.js` only when opened inside Telegram.
- Safe areas: `env(safe-area-inset-*)` plus Telegram's `contentSafeAreaInset` CSS variables; the bottom
  nav adds both.
- Back button: Telegram `BackButton` mirrors the in-app back arrow.
- CSP `frame-ancestors` allows only Telegram web clients (copied from Splitly).
