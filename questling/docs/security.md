# Security review (Gate 5)

A review by the lead developer of the code as it stands on `questling/gate-05` (2026-10-25). It is a
self-review, not an independent audit or a penetration test; what was not examined is listed at the end.

## What is protected, and from whom

| Asset                                                        | Threat                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| A student's identity (Telegram account)                      | Someone signing in as another student                               |
| A student's progress, XP, coins, items                       | A student granting themselves rewards; farming; buying without coin |
| Teachers' groups, rosters, campaigns, answers, analytics     | A teacher or student reading or changing another teacher's things   |
| Answer keys (built-in campaigns, teachers' campaigns, daily) | A student reading answers before answering                          |
| Students' personal data (minors)                             | Over-collection, exposure, no way to leave                          |
| The database                                                 | Direct access through Supabase's public API                         |

## Controls, and where they are tested

**Student sign-in** — `lib/server/telegram.ts`. Telegram's `initData` is checked on the server: HMAC-SHA256
with the bot token over every field, compared in constant time; `auth_date` at most an hour old and at most
a minute in the future; the user id must be a positive safe integer. `initDataUnsafe` is never read.
Profile photo URLs are accepted only from Telegram's hosts (and are not shown anywhere). A group invite
code arrives only inside the signed data (`start_param`). Tests: `tests/server.test.ts` (tampering with or
adding any field, another bot's token, age and skew, malformed input), `tests/db/students.test.ts` (API).

**Sessions** — `lib/server/session.ts`. A signed note `{user, expiry}` (HMAC-SHA256, `SESSION_SECRET`),
six hours, carried in the `Authorization` header from `sessionStorage`, never a cookie (Telegram Web runs
the app in a frame, and a header cannot be sent by another site). Mutating requests with an `Origin` of
another host are refused (403) as a second lock. Download tickets (`issueTicket`, five minutes, one
purpose, a separate key) are for Telegram's downloader, which sends no headers; a ticket is never accepted
as a session and a session never as a ticket (tested).

**Teacher sign-in** — `lib/server/teacher-auth.ts`. Supabase Auth's REST API from the server: the password
goes from the form to our server to Supabase and nowhere else; only a confirmed account gets a studio
session. Every studio route loads the teacher's own row (`studioState`/`studioAct` lock
`questling.teachers` by the session's user) and refuses anyone else with `not_teacher` (403). Password
reset answers the same whether or not the address exists.

**Authorization and data isolation** — every route works on the session's user only; studio actions are
validated by a zod schema and then by the studio rules (`lib/studio/ops.ts`) on that teacher's facts.
Cross-tenant tests: `tests/db/studio.test.ts` (a teacher sees and changes only their own groups and
students; a mentor's reply reaches only the student who asked; a student outside a group cannot play a
teacher's campaign by its id; a student is kept out of the studio) and the live check
(`scripts/live-check.mjs`, 31 points on the deployed site at Gate 4).

**Game integrity** — all XP and coins are rows of an append-only ledger (`ledger_is_append_only` trigger),
each with a key unique per student and currency, so a reward is granted once (`23505` → 409); a deferred
constraint trigger refuses a negative coin balance at commit; actions run under a row lock on the
student, one at a time. Answers are graded on the server; answer keys (`lib/content/*-keys.ts`, teachers'
keys in the database) never reach the client. The demo runs the same rules in the browser and never
touches the server. Tests: `tests/game.test.ts`, `tests/story-*.test.ts`, `tests/db/students.test.ts`.

**Teacher content** — campaign graphs are validated (`lib/story/validate.ts`: start/end, reachability, no
dead ends, valid targets, answers present, loop protection) before publishing; a published version is
immutable (trigger), students keep their bound version. Story text is rendered as text, never as HTML.

**Database exposure** — the `questling` schema has row level security on with no policies and all
privileges revoked from Supabase's `anon` and `authenticated` roles (migrations 1, 3, 4): the public REST
API reads nothing. Only the server connects, through the pooler, with `DATABASE_URL`.

**Abuse limits** — per-address limits on sign-in (30/10 min), teacher sign-up (5/h), sign-in (20/10 min),
recovery (5/h); per-user limits on actions (600/h), studio actions (900/h), joins (20/h), export (10/h),
deletion (5/h). Counted on a separate connection before the request's transaction. Bodies over 16 KB and
non-JSON bodies are refused.

**Recordings** — teachers' uploads are checked by content (signature and decoding, not the name),
limited in size, length and per-teacher quota, stored in a table only the server reads, and served
through per-viewer, per-recording signed links: a student gets links only to recordings in what is
assigned to them (`docs/audio.md`). Tests: `tests/media.test.ts`, `tests/db/studio.test.ts`.

**Dependencies** — `npm audit --omit=dev` on 2026-10-25 found music-metadata 11.12.1 (used on teachers'
uploads) open to denial of service by crafted files (an MP4 loop, unbounded ID3v2 and APEv2 allocation,
among others); upgraded to 11.16.1, 0 vulnerabilities since.

**Headers** — `next.config.ts`: CSP (`default-src 'self'`, scripts from self and `telegram.org`,
`frame-ancestors` only self and Telegram's web clients, `object-src 'none'`, `form-action 'self'`),
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS; no `X-Powered-By`.
`X-Frame-Options` is deliberately absent: it cannot allow only Telegram and would break Telegram Web.

**Privacy (students are often minors)** — stored: the Telegram id and username, the interface language,
the chosen hero and name, and learning records. No photo, no phone, no first or last name, no public
leaderboard; a teacher sees only their own groups. **Added in Gate 5:** the settings screen's "My data":
download everything stored (`GET /api/v1/export`, every student table, through a ticket link inside
Telegram) and delete everything (`POST /api/v1/account/delete` with `{"confirm":"delete"}`; the schema's
cascades remove progress, ledger, items, runs, memberships and replies; the audit log keeps its rows with
the actor cleared). A teacher's account is not deletable this way (it would take their groups with it).
Tests: `tests/db/students.test.ts` (own rows only, ticket, plain confirmation, other origin, no session,
other students untouched), `e2e/gate5.spec.ts` (the demo's download and deletion).

## Findings of this review

| #   | Finding                                                                                     | Status                                                                        |
| --- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | No way for a student to get or delete their data (brief §7)                                 | Fixed: export and deletion, with tests                                        |
| 2   | `.env.example` lacked the teacher sign-in variables                                         | Fixed                                                                         |
| 3   | A teacher session can also call the student routes (it is a `users` row)                    | Accepted: it acts as a student of its own, sees no one else                   |
| 4   | Sessions cannot be revoked before they expire (6 h)                                         | Accepted: after deletion the token opens nothing (404)                        |
| 5   | Off Vercel, the rate-limit address comes from `X-Forwarded-For`, which is forgeable         | Accepted: on Vercel `x-vercel-forwarded-for` is read first                    |
| 6   | CSP allows `'unsafe-inline'` scripts (Next.js's inline bootstrap)                           | Accepted: no user content is ever rendered as HTML                            |
| 7   | Supabase's built-in mailer sends only to the project team's addresses                       | Closed 2026-10-27: "Confirm email" off (owner's word); reset emails need SMTP |
| 8   | A teacher saw a shared student's work on another teacher's campaigns, and could reply to it | Fixed (Gate 5): only built-in and own campaigns' work is loaded; DB test      |
| 9   | A signed upload link accepted a file of any size (up to 5 GB) until the server's check      | Fixed (features gate F): the length is signed; B2 refuses another size        |
| 10  | Teacher sign-up needs no proof of the address (confirmation off)                            | Accepted by the owner: teachers are isolated from each other; demo-scale      |

## Media and the features gates (A–F, 2026-10-26/27)

- **Storage** (Backblaze B2, `docs/media-storage.md`): a private bucket; the app's key reaches only that
  bucket and only files (no bucket settings); the browser gets signed links for one object — upload with
  its exact type and length for 10 minutes, download for 15 minutes — only after the server checks who
  asks (`lib/server/media-store.ts`, `visible()`). No public links; student recordings are seen only by the
  student and the teacher of that scene. Tests: `tests/storage.test.ts`, `tests/db/media.test.ts`,
  `scripts/storage-check.mts` on the real bucket (12 points), `scripts/live-check.mjs` (67).
- **What an upload is** is decided by reading it back (`lib/server/media-check.ts`), not by its name or the
  browser's type: MOV, H.265, audio posing as video, SVG and junk are refused and deleted.
- **Teacher text** (lines, subtitles, dialogue, tags, titles) is plain text everywhere: no
  `dangerouslySetInnerHTML` in the app; ids and media references are checked by pattern (`dubSchema`, story
  schema), so a link, a path or a script cannot be a video. `e2e/features-f.spec.ts` types markup into
  the studio and checks nothing runs.
- **Microphone**: asked only after the student's button; `Permissions-Policy: microphone=(self)`; CSP allows
  media only from the site, `blob:` (fresh takes) and the storage origin.
- **Retention**: voice takes deleted after 180 days, at most two kept per line, everything of a student
  deleted with their data; uploads never completed are removed after an hour (daily cron, `CRON_SECRET`).
- **Secrets** stay on the server and in `.env.local`/Vercel. During the B2 and email setup the owner put a
  master B2 key and a Supabase access token into `.env.local`; neither is used by the app, and both
  should be removed and revoked (`docs/features-report.md`, "What the owner should do").

## Not examined

- No independent review and no penetration test. `npm audit --omit=dev`: 0 vulnerabilities (without
  `--omit=dev`, 5 "high" in linter-only dev dependencies, not shipped — same as Splitly).
- Not tested on a physical Telegram client (Android, iOS, desktop): see `docs/telegram-checklist.md`.
- Supabase project settings beyond those listed in `CLAUDE.md` (backups, network restrictions) were not
  reviewed; the free plan has no point-in-time recovery.
