# Release, staging and rollback

## Where things run

- **Site**: Vercel project `questling` (team `riddle6`), region `dub1` (`vercel.json`), production
  https://questling-dusky.vercel.app. Not connected to GitHub: a push does not deploy.
- **Database**: Supabase project `xqkhmbvstcjvfttkdvxg` (eu-west-1), schema `questling`, reached through the
  transaction pooler. Free plan: 500 MB database, no point-in-time recovery, the project pauses after a week
  without traffic.
- **Bot**: @QuestlingEnglish_bot; menu button → `/ru/app`; Main Mini App on (invite links with `startapp`).
- **Settings** (Vercel, Production): `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET`, `SUPABASE_URL`,
  `SUPABASE_ANON_KEY` — set from `.env.local` by `node scripts/vercel-env.mjs`, never printed.

Deploying is the owner's decision (the repository's rules): nothing here is run without their word.

## Releasing a gate

1. On the gate's branch: `npm run typecheck`, `npx eslint .`, `npm run format:check`, `npx vitest run`,
   `npx playwright test` — all green.
2. **Migrations first, if the gate has any** (Gate 5 has none): take a copy of the data
   (`pg_dump "$DATABASE_URL" --schema=questling --data-only > backup-<date>.sql`, kept outside git), then
   `npm run db:migrate`. Migrations only add; each is written to work with the code before and after it.
3. **Staging**: the separate Vercel project `questling-staging` (below). Deploy the branch there first.
4. **Production**: `npx vercel deploy --prod --yes --scope riddle6` from `questling/` (the owner runs it
   with `!` in Claude Code: the auto mode does not deploy by itself).
5. **Check the deployed site**: `node scripts/live-check.mjs https://questling-dusky.vercel.app` — signs a
   made-up student in with the real bot token, plays, checks the studio with a throwaway teacher, downloads
   and deletes the student's data, and removes everything it made (34 points from Gate 5).
6. Run the manual list in `docs/telegram-checklist.md` on at least one phone.

## Staging

- **Now (2026-10-25)**: https://questling-staging.vercel.app — Vercel project `questling-staging`
  (`prj_p9hVJ4FA2ZHHhflITc5UGdiSZlsZ`), its own settings (none yet), not connected to GitHub. It shows
  the demo, the demo studio and the "not connected" screens; it cannot sign in and cannot reach the
  production database. Deploy from `questling/` (this folder is linked to production, so name the
  project explicitly, or `--prod` goes to the production site):

  ```bash
  VERCEL_ORG_ID=team_TCMWVpqI5RzzK6WqMqwMV15H VERCEL_PROJECT_ID=prj_p9hVJ4FA2ZHHhflITc5UGdiSZlsZ     npx vercel deploy --prod --yes --scope riddle6
  ```

- **For real sign-in on staging the owner decides**: (1) a database — a second Supabase project; the free
  plan allows two active projects and two are active now (Questling, Barbershop Project), so one has to be
  paused or the plan changed; (2) a test bot from @BotFather with its Mini App URL set to the staging site;
  (3) the five settings for the `questling-staging` project; then `npm run db:migrate` against the
  staging database and `node scripts/live-check.mjs https://questling-staging.vercel.app` with a
  `.env.local` holding the staging values. Production data is never copied to staging.

## Rollback

- **Site**: Vercel keeps every deployment. `npx vercel rollback --scope riddle6` (or Dashboard →
  Deployments → the previous one → "Promote to Production") puts the previous build back in seconds.
  The code of a deployment is its git commit; nothing else needs restoring.
- **Database**: there is no automatic down-migration. Every migration so far only adds (tables, columns,
  functions, triggers); the previous code ignores what it does not know, so rolling the site back does not
  need the database rolled back. If a migration itself must be undone, write the reverse SQL for that one
  file (drop what it created), run it in a transaction, and restore data from the `pg_dump` copy if any was
  lost. Migration 6 (`quest_versions_deletable_with_quest`) replaces a function: its reverse is the
  function body from migration 4.
- **Bot**: the menu button and Main Mini App point at the production address and need no change on a
  rollback.

## Gate 5 on production

Gate 5 adds no migration. Its server changes are three routes (`GET /api/v1/export`,
`POST /api/v1/export/ticket`, `POST /api/v1/account/delete`) and the settings screen's "My data". Until
it is deployed, `scripts/live-check.mjs` against the live site fails its three Gate 5 points (the routes
are missing there) and passes the rest.

## Known limitations (the whole product)

- Not tested on a physical Telegram client (`docs/telegram-checklist.md`).
- Teacher email: Supabase's built-in mailer reaches only the project team's addresses; real teachers need
  the owner's SMTP or confirmation switched off.
- Audio: pronunciation uses the device's speech synthesis; teacher-uploaded audio is not implemented.
- Equipment art: all 24 items are drawn on the six heroes; the ceremonial cape is a documented
  compromise, and four garments are Blender re-cuts of the Stitch art (`docs/ASSET_AUDIT.md`).
- The 3D hero is **postponed** (owner, 2026-10-25), not a release blocker: the app uses the 2D layered
  heroes; the first pass (`docs/3d.md`) is not wired in.
- Assigned quick quests exist only in the demo; assignment due dates are shown, not enforced; a group's
  CEFR level does not restrict what is assigned to it (`docs/qa-report.md`).
- Contrast: a few dimmed "locked" texts and violet labels were lightened for WCAG AA (Gate 5), a small
  documented difference from the Stitch screens (`docs/visual-qa/README.md`).
- Free-tier limits: Supabase pauses an idle project; Vercel Hobby limits function time and bandwidth.
