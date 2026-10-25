# Questling

A dark-fantasy English-learning **Telegram Mini App** for students, and a browser **Teacher Studio**, built
from an approved Google Stitch design (20 screens, four story-player states) into a working app: real
sign-in, a server-authoritative game record, versioned story campaigns with branches and evidence, a
coin shop and layered hero equipment, teachers' groups, a visual quest builder and analytics.

- Staging (demo only, isolated): https://questling-staging.vercel.app
- Production: https://questling-dusky.vercel.app — student app inside Telegram (@QuestlingEnglish_bot),
  `/ru/demo` (the whole student app in the browser, labelled "Демо"), `/ru/studio` (Teacher Studio) and
  `/ru/demo/studio` (its demo).
- Languages: Russian and English interface (`/ru/…`, `/en/…`); the learning content is English.

## What works

**Students** (Telegram, or the demo): onboarding and six free heroes; home with daily quests and the word
of the day; a story map with locked chapters; two original campaigns (A1–A2 investigation, B1–B2 mystery)
as versioned graphs with choices, puzzles, evidence, three endings each and resume; quick quests
(choice, matching, fill the blank, ordering, reading, listening by speech synthesis, dialogue, ciphers);
daily discovery with saving and a quiz; XP and coins as an append-only ledger, granted once; rewards;
profile; wardrobe, shop and inventory with all 24 items drawn on all six heroes in layers; groups by an
invite code or link; mentor replies; settings with language, and the student's own data to download or
delete.

**Teachers** (email and password, Supabase Auth): dashboard, groups with CEFR levels and invites, a visual
quest builder with validation, versions that stay fixed for students already playing, a library with
publish, assign and archive, analytics with question-level errors, the group's word of the day, and
preview-as-student.

## Run it

Requires Node 22+.

```bash
npm install
npm run dev            # http://localhost:3000/ru/demo
```

With no settings the site is the demo: `/ru/app` says the server is not connected. For the real app copy
`.env.example` to `.env.local` and fill in:

| Variable                            | What                                                         |
| ----------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`                      | Supabase PostgreSQL, transaction pooler (secret)             |
| `TELEGRAM_BOT_TOKEN`                | the bot whose Mini App this is (secret; checks sign-in data) |
| `SESSION_SECRET`                    | 32+ random characters (secret; signs sessions)               |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase Auth for teachers (public values)                   |

Then `npm run db:migrate` applies `supabase/migrations/*.sql` (each once, in order).

## Check it

```bash
npm run typecheck && npx eslint . && npm run format:check
npx vitest run         # unit, rules and a real PostgreSQL (embedded-postgres, in .tmp/)
npx playwright test    # builds and serves on port 3300: every screen, flows, axe, widths
node scripts/live-check.mjs [https://…]   # against a real database and bot; cleans up after itself
```

## Deploy

Vercel (project `questling`, region `dub1`), by the owner: `npx vercel deploy --prod --yes --scope riddle6`
from this folder; settings with `node scripts/vercel-env.mjs`. Release order, staging and rollback:
[`docs/release.md`](docs/release.md).

## Documents

| File                                                       | About                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)             | stack, identity, the student record, campaigns, the studio     |
| [`docs/design-screen-map.md`](docs/design-screen-map.md)   | every Stitch screen and state → route, owner's decisions       |
| [`docs/visual-qa/README.md`](docs/visual-qa/README.md)     | screenshot comparison and every known visual difference        |
| [`docs/ASSET_AUDIT.md`](docs/ASSET_AUDIT.md)               | images, equipment layers, what was made in Blender             |
| [`docs/qa-report.md`](docs/qa-report.md)                   | the functional QA report, bugs fixed and left                  |
| [`docs/audio.md`](docs/audio.md)                           | recordings, playback order, teachers' uploads, what was tested |
| [`docs/security.md`](docs/security.md)                     | the security review and its findings                           |
| [`docs/telegram-checklist.md`](docs/telegram-checklist.md) | the manual check on phones (not done yet)                      |
| [`docs/release.md`](docs/release.md)                       | release, staging, rollback, known limitations                  |
| [`docs/3d.md`](docs/3d.md)                                 | the first-pass 3D cat in Blender and its GLB files             |

## Limitations

Not yet tested on a physical Telegram client; teacher email needs the owner's SMTP for real teachers;
audio: built-in recordings and teachers' uploads, the device's voice as a fallback. The full list:
[`docs/release.md`](docs/release.md#known-limitations-the-whole-product).
