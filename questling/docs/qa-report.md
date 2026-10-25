# Functional QA report (Gate 5, 2026-10-25)

Branch `questling/gate-05`. How it was checked: the rules are pure functions shared by the demo, the
teacher's preview and the server (`lib/game/ops.ts`, `lib/story/run.ts`, `lib/studio/ops.ts`), so they are
tested once as units; the server and its database are tested on a real PostgreSQL (`tests/db/*`); the
screens are walked in the demo by Playwright (`e2e/*`); the deployed site with the real bot and database
by `scripts/live-check.mjs` (31 points at Gate 4). A read-only coverage audit mapped every requirement to
code and tests; its findings were then checked by hand, and the real ones fixed (below).

**Automated results** (local, Windows, Chrome): `npm run typecheck` ✓, `npx eslint .` ✓, `npm run
format:check` ✓, `npx vitest run` **124 / 124**, `npx playwright test` **81 / 81**, `npm audit --omit=dev`
0 vulnerabilities. The live check was not re-run: Gate 5 is not deployed to production.

## By area

| Area                     | What is verified                                                                                                                                                                                                                                                                                                             | Where                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Story campaigns          | two campaigns (A1–A2, B1–B2), ≥ 3 endings each, every scene type; branches by choice and flag; clues found and used as evidence, provable on every path; attempts, grimoire, mentor help; map locks on the server; resume after reload and re-sign-in; versions kept for runs in progress; graph validation incl. **traps**  | `story-graph`, `story-run`, `story-engine`, `db/students`, `db/studio`, `e2e/gate3`, live check |
| Quick quests             | all question kinds graded on the server, attempts, hints, explanations, rewards once, daily rotation, daily bonus                                                                                                                                                                                                            | `game`, `db/students`, `e2e/gate2`                                                              |
| Teachers                 | sign-in, groups and invites (code and link), create / edit / autosave / validate / publish, versions immutable (trigger), assign a version to a group, students keep their bound version, **preview changes nothing stored**, analytics views, daily word for a group, help requests and replies, isolation between teachers | `studio-ops`, `studio-builder`, `studio-views`, `db/studio`, `e2e/gate4`, live check            |
| Economy                  | XP and coins as an append-only ledger with unique keys (no double reward), no negative balance (deferred trigger), no double buy, level and species checks, unowned equip refused, deal of the day, weekly chest, achievements (**an owned reward item is paid in coins**)                                                   | `game`, `equipment`, `db/students`                                                              |
| Daily                    | word, IPA, translation, example, quiz once per day, claim, word saved, fact saved and unsaved, **teacher's word planned after the student answered**, the day turning at Moscow midnight                                                                                                                                     | `game`, `db/studio`, `e2e/gate2`                                                                |
| Characters and equipment | six free heroes, the same hero on every screen (**home fixed**), 24 items drawn on 6 heroes, cape back/front, hat over the ears, 8-look proof                                                                                                                                                                                | `equipment`, `e2e/gate4-equipment`, sheets in `docs/visual-qa/equipment`                        |
| Localization             | RU and EN dictionaries have the same keys; every screen renders in both; axe in both                                                                                                                                                                                                                                         | `dictionaries`, `home`, `e2e/gate5`                                                             |
| Layout and safe areas    | no sideways scroll at 320/360/390/430 (student) and 1280/1440 (studio); `env(safe-area-inset-*)` on headers and bars                                                                                                                                                                                                         | `e2e/gate5`, `e2e/gate1`                                                                        |
| Accessibility            | axe WCAG 2.2 A/AA on 20 screens × 2 languages: no violations                                                                                                                                                                                                                                                                 | `e2e/gate5`                                                                                     |
| Auth and security        | Telegram signature, age and tampering; sessions and tickets; teacher auth; students kept out of the studio; teachers out of each other's data; export and deletion of a student's data                                                                                                                                       | `server`, `db/students`, `db/studio`, `docs/security.md`                                        |

## Bugs found and fixed in this pass

| #   | Bug                                                                                                                                                                                                             | Fix                                                                                                    | Test                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 1   | A teacher's word of the day planned after the student had answered the built-in quiz made the day's reward impossible: the second answer wrote a second quiz mark for the day and the database refused it (409) | one quiz mark and one quiz reward a day; the day is claimed by answering the current word              | `game`: "keeps one quiz mark and one reward a day…"    |
| 2   | The graph validator let a loop with no way out pass (a student entering it could never finish)                                                                                                                  | it now checks that an ending is reachable from every reachable state                                   | `story-graph`: "finds a loop with no way out…"         |
| 3   | A teacher saw a shared student's answers, runs and help requests on **another teacher's** campaigns, and could reply to them                                                                                    | the studio loads story work only for built-in and the teacher's own campaigns                          | `db/studio`: "a teacher sees a shared student's work…" |
| 4   | An achievement whose reward item had already been bought gave nothing                                                                                                                                           | it pays the item's price in coins                                                                      | `game`: "pays an achievement's item in coins…"         |
| 5   | The facts of the day cited made-up publications ("изд. Академии, 2024"); the brief forbids fabricated citations                                                                                                 | real, findable sources (Smithsonian, NOAA, NASA, British Library, Johns Hopkins / Science, von Frisch) | — (content)                                            |
| 6   | The home screen showed the bare hero while the profile showed them in their gear                                                                                                                                | home draws the layered hero                                                                            | visual re-run                                          |
| 7   | The shop's rarity tags were hidden under the item pictures                                                                                                                                                      | tags above the picture                                                                                 | visual re-run                                          |
| 8   | Inside Telegram, Android's back button closed the whole app                                                                                                                                                     | Telegram's BackButton follows the app's screens (home when there is no history)                        | not testable without a device (checklist 20)           |

## Outstanding bugs and limitations

Not fixed, by decision or because they need the owner:

- **Not tested on a physical Telegram client** (Android, iOS, Desktop): `docs/telegram-checklist.md`.
- **Assigned quick quests exist only in the demo**: Teacher Studio assigns campaigns, not quick quests, so
  in the real app that list is empty. Adding it is a new studio feature, not done without the owner.
- **Assignment dates**: only a due date exists and it is shown, not enforced; re-assigning keeps the first
  start date.
- **CEFR**: a group's level and a campaign's level are both shown, but assigning a B1 campaign to an A2
  group is not refused (the teacher decides).
- **Teacher email**: Supabase's built-in mailer reaches only the project team; real teachers need SMTP.
- **Pronunciation** uses the device's speech synthesis; uploaded audio is not implemented; not tested
  automatically.
- **The weekly chest** counts finished quick quests, passed or not (each can be played once a day, so it
  cannot be farmed) — a rule, noted here.
- **"Архив №…" and "День N из 30"** on the discovery screen are the entry's number and a 30-day cycle
  from the day the student joined, kept from the export; no source or programme is claimed by them.
- **Changing hero** does not re-check worn items against the new species; harmless today, since every item
  fits every hero.
- **3D hero: postponed** by the owner (2026-10-25), not a release blocker; the app uses the 2D layered
  heroes. The first pass is kept in `blender/` and `public/models/` (`docs/3d.md`), unused by the app.

## Staging

Isolated staging: **https://questling-staging.vercel.app** (Vercel project `questling-staging`, separate
from production; no database, bot or Supabase settings). It serves the whole student demo, the demo
studio and the real screens' "not connected" states; it cannot sign anyone in and cannot reach the
production database. A full staging (real sign-in with a test bot and its own database) needs the owner:
see `docs/release.md`, "Staging".
