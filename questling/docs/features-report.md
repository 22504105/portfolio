# Features prompt: final report (gates A–F, 2026-10-27)

The final report that `QUESTLING_UNIFIED_FEATURES_MASTER_PROMPT.txt` asks for. Details of each gate:
`docs/features-audit.md`. Nothing here is merged into `main` or deployed to production: both wait for the
owner's word.

## 1. What existed and what changed

| Gate             | Branch (all pushed)                                          | What changed                                                                                                                                                                                                                                               | Migration                             |
| ---------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Studio on phones | `questling/studio-mobile` (deployed by the owner 2026-10-26) | Teacher Studio usable at 360–430 px                                                                                                                                                                                                                        | —                                     |
| A                | `questling/features-a`                                       | word help in every task (`lib/learning/gloss.ts`), seeded answer order (`lib/learning/shuffle.ts`), hint before answering, word marking in the builder                                                                                                     | —                                     |
| D                | `questling/features-d`                                       | word journal, spaced repetition (`lib/learning/srs.ts`, `vocab.ts`), suggestions from mistakes, objectives (`lib/learning/recommend.ts`, `objectives.ts`), teacher insights                                                                                | 8 `20261027000100_vocab_journal.sql`  |
| B, C             | `questling/features-bc`                                      | private S3-compatible storage (`lib/server/sigv4.ts`, `storage.ts`, `media-check.ts`, `media-store.ts`), voice-acting scenes in the studio and for students (`lib/dub/*`, `components/dub/*`, `components/studio/dubbing-screen.tsx`), review with XP once | 9 `20261028000100_media_dubbing.sql`  |
| E                | `questling/features-e`                                       | talks and picture searches in the story, voice acting as a story scene, story items as rewards (`lib/story/*`, `components/student/story-extra.tsx`, `components/studio/story-forms.tsx`), campaign v2                                                     | 10 `20261029000100_story_rewards.sql` |
| F                | `questling/features-e`                                       | tests for the prompt's list, three fixes (below), B2 connected, teacher email, docs                                                                                                                                                                        | —                                     |

Already there before the prompt and reused: grading by option id, server-side answer keys, the XP ledger
with idempotent keys, the audio stack (built-in recordings, device voice, teachers' MP3/M4A/WAV uploads,
`docs/audio.md`), dialogue and choice scenes with flags, the validator. Migrations 8–10 are applied to the
working database, each after an inventory, a `pg_dump` backup verified by restoring it, and a dry run.

Gate F fixes: the **upload length is now signed** (a signed link accepted any size before; storage refuses
another size now — checked on the real bucket); a failed take is **explained in words**, not a code; quest
builder controls that had **no accessible name** (from gate 4) are named.

## 2. Screens and the approved Stitch design

The Stitch export has no screens for these features. Following the owner's rule "only the design that
exists", every new screen is built from approved parts — the story player's frame and parchment quotes
(Gelasio for Georgia), cards, buttons, chips, the bottom bar on main screens, the studio's panels and
forms, the same tokens and icons — and adds no new visual elements. New student screens: word help sheet,
My words (`/words`), voice-acting scene (`/dub/<scene>`, listed in Quests), talk and picture search inside
the story player. New studio screens: Voice acting (`/studio/dubbing`: editor, assign, review) and the
builder's talk / search / voice-acting forms. Screenshots for review (390 and 1440):
`MSYS_NO_PATHCONV=1 node scripts/shoot.mjs docs/visual-qa/features 390 /ru/demo/words /ru/demo/dub/d-demo-archive`
(and `1440 /ru/demo/studio/dubbing`) against `npx next start -p 3100`; PNGs are not in git.

## 3. Storage, quotas, codecs, retention

Backblaze B2 (owner's choice after Cloudflare R2 refused the card), private bucket `-questling-media-ev26`
in eu-central-003, reached through the S3 API with a key limited to that bucket and to files. Bytes never
enter PostgreSQL; Supabase keeps metadata (`questling.media_objects`). Uploads go straight from the browser
with a signed PUT (10 min, exact type and length); the server then reads the file back and checks it.

| Kind       | Who     | Accepted (by content)                                           | Limit       | Own quota                      |
| ---------- | ------- | --------------------------------------------------------------- | ----------- | ------------------------------ |
| video      | teacher | MP4 H.264(+AAC), WebM VP8/VP9(+Opus/Vorbis); MOV, H.265 refused | 25 MB, 60 s | 300 MB                         |
| background | teacher | M4A, WebM/Opus, MP3                                             | 5 MB, 60 s  | 50 MB                          |
| image      | teacher | PNG, JPEG, WebP ≤ 4096 px; SVG refused                          | 2 MB        | 50 MB                          |
| voice      | student | WebM/Opus, MP4/AAC                                              | 2 MB, 30 s  | 50 MB, two takes kept per line |

Whole bucket: cap 8 GiB (below the free 10 GB) with warnings at 70 % and 90 %, 2 000 signed downloads a day.
Retention: voice takes 180 days, unfinished uploads one hour, everything of a student with their data;
the bucket keeps only the last version of a file. Free-tier caveats: `docs/media-storage.md`.

## 4. Tests and results

Automated, local (2026-10-27, branch `questling/features-e`):

| Command                                                                    | Result      |
| -------------------------------------------------------------------------- | ----------- |
| `npm run typecheck`, `npx eslint .`, `npx prettier --check .`              | clean       |
| `npx vitest run` (unit + PostgreSQL)                                       | 205 / 205 (22 files) |
| `npx playwright test` (Chrome, phone and desktop sizes, fake microphone)   | 129 / 129, twice in a row  |
| `npx tsx scripts/storage-check.mts` (the real B2 bucket)                   | 12 / 12     |
| `npx tsx scripts/live-check.mjs` (working database + real B2, local build) | 67 / 67, everything it made removed |

The map of the prompt's required tests to files: `docs/features-audit.md`, "Gate F".

**Physical devices: none tested.** Android Chrome, Android Telegram, iOS Safari, iOS Telegram, old
browsers, slow networks, calls during a take, real codecs (above all iPhone MP4/AAC recordings) — all
**untested**. Chrome's fake microphone is not a phone.

## 5. Limitations, security caveats, open bugs

- No real-device testing (above). Recording on iOS inside Telegram is the biggest unknown.
- Teacher sign-up needs no proof of the email address (confirmation off, owner's decision); password-reset
  emails do not send until a working SMTP is set (Gmail and Mail.ru refused the passwords given).
- B2 free tier: confirmed in the account that caps can be set to $0; whether B2 ever bills without a card
  is not confirmed in its documentation. The app's own cap stays below 10 GB.
- Voices and music are one track in a teacher's video: during the student's take the whole clip is muted,
  and only a separate background track (if the teacher gives one) keeps the music.
- Pitch is kept at 0.75×/0.5× only where the browser supports it.
- No pronunciation scoring, no AI review: the teacher's rubric has no numbers (by the prompt).
- Sessions cannot be revoked before they expire (6 h); CSP allows inline scripts (Next.js) — both
  accepted earlier (`docs/security.md`).
- No independent security review or penetration test; this one is the developer's own.

## 6. Settings the owner provides (no secrets in chat or git)

In `questling/.env.local` (done) and in Vercel Production (not yet; `node scripts/vercel-env.mjs` sends
them): `MEDIA_S3_ENDPOINT`, `MEDIA_S3_REGION`, `MEDIA_S3_BUCKET`, `MEDIA_S3_ACCESS_KEY_ID`,
`MEDIA_S3_SECRET_ACCESS_KEY`, `CRON_SECRET`. Optional: `MEDIA_GLOBAL_CAP_BYTES`, `MEDIA_WARN_AT`,
`MEDIA_DAILY_DOWNLOADS`.

**What the owner should do** regardless of the release:

- remove `B2_MASTER_KEY_ID`, `B2_MASTER_KEY` and `SUPABASE_ACCESS_TOKEN` from `.env.local`, and revoke the
  Supabase token (supabase.com/dashboard/account/tokens);
- delete the B2 key `questling-media` (not limited to the bucket; the app uses `questling-app`);
- delete the app password that was pasted into the chat, wherever it was created.

## 7. Manual checklist and release

Manual matrix: `docs/telegram-checklist.md`, "Features gates A–F". Staged rollout (staging with phones →
settings → production → checks → one group first) and rollback: `docs/release.md`, "Features gates A–F".

## 8. Recommendation

Merge `questling/features-e` into `main` and deploy it to **staging** first, so the voice-acting screens can
be tried on a real iPhone and Android phone in the browser (demo, no data). If recording works there, set
the storage settings in Vercel and deploy to production, then run the live check and the Telegram rows of
the checklist, with voice acting assigned to one test group for the first week. Both steps need the
owner's word.
