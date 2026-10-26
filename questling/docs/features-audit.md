# Features prompt: audit and delivery plan

The owner's prompt `QUESTLING_UNIFIED_FEATURES_MASTER_PROMPT.txt` (2026-10-26) asks for ten parts
delivered as gates A–F. This file is the written audit it asks for first, and the record of what each
gate changed. Out of scope by the prompt: team quests, 3D.

## What already existed (audited 2026-10-26)

| Prompt part | Already in Questling | Gap |
| --- | --- | --- |
| 1. Word help | Options carry a gloss line; clue journal has phrase glosses; a hint after a wrong answer; the grimoire | No tappable words in texts, no teacher authoring, no level-aware defaults, no hint before answering |
| 2. Fair order | Grading by option id everywhere (`lib/story/run.ts`, `lib/learning/questions.ts`), server-side keys, idempotent ledger keys | Options always in authored order, and authored content often lists the answer first; teacher puzzles started as a rotation by one of the answer |
| 3. Voice acting | Audio stack: built-in clips, device voice fallback, teacher MP3/M4A/WAV uploads (`lib/server/media.ts`, Postgres `bytea`, 2 MB / 60 s / 50 MB quota, 6 h tickets, byte ranges) | No video, no microphone recording, no submissions or review |
| 4. NPC dialogue trees | `dialogue` scenes (linear lines) and `choice` scenes with flags; conditions on clues/flags; validator for reachability | Dialogue with responses is expressible as dialogue + choice, but there is no dialogue-tree node or editor |
| 5. Vocabulary journal | `saved` table (kinds `word`, `fact`), daily word | No journal of marked words, no spaced repetition |
| 6. Clue search in images | Scenes with fixed app illustrations | No hotspots, no image uploads (scene images are an allow-list) |
| 7. Recommendations | Answers recorded with a skill; profile progress by skill; studio analytics by skill | No objective/grammar tags, no recommendations |
| 8. Narrative rewards | Clues, chapters, endings, ledger, cosmetics, chest | Rewards tied to new activity kinds come with those kinds |
| 9. Audio reuse | See part 3 | — |

## Free tier limits that shape gates B–C

- Vercel functions accept request bodies up to 4.5 MB: video cannot be uploaded through the app's API.
  Uploads must go straight from the browser to storage with a signed upload URL.
- Supabase free plan: 1 GB file storage, 5 GB egress a month, 50 MB per file, 500 MB database.
  A 30 s 480p clip at ~1 Mbit/s is ~4 MB, so about 200 clips fill storage and ~1 200 student
  viewings use the month's egress. Video must stay short and small; the prompt's 10–60 s fits.
- Videos must not go into Postgres (the prompt says so, and 500 MB would not hold them).
  Student voice lines are small (Opus ~24 kbit/s: a 6 s line ≈ 18 KB) but also belong in storage.
- Supabase Storage with private buckets needs the `service_role` key on the server to issue signed
  upload and download URLs. The app does not hold that key today (see `docs/audio.md`).

**Owner's decisions (2026-10-26)**: the three proposals approved, with **Cloudflare R2 instead of
Supabase Storage** for teacher video, student voice and teacher images; Supabase keeps the database,
auth and media metadata. Limits: video 25 MB / 60 s, 300 MB per teacher; local takes unlimited, at most
2 kept per line; recordings deleted after 180 days or earlier on request; a global storage cap with
warnings. R2's free tier (checked 2026-10-26 on developers.cloudflare.com/r2/pricing): 10 GB-month of
storage, 1 M Class A and 10 M Class B operations a month, free egress; usage above it is billed.
Cloudflare asks for a payment method before the first bucket and has no spending cap, so the app keeps
its own hard limits below the free tier (gate B).

## Delivery order

- **Gate A — done 2026-10-26** (below).
- Gate B — media foundation (needs the decisions above).
- Gate C — voice acting on top of B.
- **Gate D — done 2026-10-26** (below).
- Gate E — NPC dialogue trees, clue search in images (image upload needs B's storage), rewards.
- Gate F — QA, docs, real-device matrix.

## Gate A — core learning quality (2026-10-26)

**Fair answer order** (`lib/learning/shuffle.ts`). Fisher–Yates with a seeded generator; the seed is
the attempt: when the student joined plus what the attempt is.

| Activity | Attempt (new order) | Shuffled |
| --- | --- | --- |
| Story question / evidence | the run of a campaign version (`RunState.seed`, stored with the run) | options, evidence clues, grimoire words |
| Quick quest | that day's quest (`letter@2026-10-26`) per question | choice and multi options, fill bank, right column of a match |
| Daily quiz | that day | options |
| Word order, story puzzles | never: the sequence is the answer | tiles keep their authored mix; teacher puzzles now start in a random mix (was a rotation by one) |

The same attempt shows the same order after reloads, retries and on the server; grading is by id
(unchanged). Runs begun before shuffling have no seed and keep the authored order. The teacher can
keep the authored order per question (`shuffle: false`, a checkbox in the builder). Branching choices
are not shuffled: they are story, not answers.

**Word help** (`lib/learning/gloss.ts`, `components/student/glossed-text.tsx`). A mark is a word or
phrase of one English text of a scene, stored by UTF-16 offsets plus the words themselves, with a
Russian translation and optional English meaning, example, explanation and CEFR level. Tapping it opens
the grimoire-style bottom sheet; the text stays. Marks follow their words when the text is edited
(nearest occurrence) and are reported as lost otherwise, never moved onto other words. Overlaps are
refused by the validator and skipped by the screen.
- Levels: A1–A2 chapters show every mark; from B1, marks more than one level below the chapter are
  taken as known. The campaign can override: every mark, or none.
- Answers: a mark on the answer's words opens only once the question is solved; the validator refuses
  a mark that shares a word of substance with the right option unless it is flagged as the answer.
- Built-in campaigns carry marks written by phrase (`lib/story/glosses.ts`), so offsets cannot be typed
  wrong. No translation is ever invented: unmarked text is plain.
- Teacher Studio: "Words with translations" in the scene inspector (every scene kind, dialogue line by
  line), the campaign's word-help level, and the shuffle checkbox.
- The hint can now be opened before answering (free, no XP change); it points the way, never the answer.

Not in gate A: saving words to a journal (gate D), word help in quick quests and the daily word (their
texts have no marks yet; the component takes any text).

Tests: `tests/learning.test.ts` (16), `e2e/features-a.spec.ts` (5). Full suites: unit 148/148, e2e 101/101.

## Gate D — word journal, spaced repetition, suggestions (2026-10-26)

**Word journal** (`lib/learning/vocab.ts`, screen `/words`, linked from the profile and from every
translation sheet). A student keeps a marked word from the story (once its scene is reached; a mark on
the answer only once solved) or the word of the day (today's only). The server copies the card's
content from the content itself. The same word in the same sense is one card; another sense is another
card. Search, filters (favourites, story, word of the day, learnt), favourite, learnt, remove.

**Spaced repetition** (`lib/learning/srs.ts`): due the day after keeping; right → 1, 3, then the gap
× ease days; wrong → tomorrow, ease −0.2, nothing taken. A review asks the meaning among four (option
ids are letters, so the page cannot tell the right one; the server recomputes the list). Only due cards
can be reviewed; 2 XP per right review, at most 10 paid a day (ledger reason `review`, key per card and day).

**Suggestions** (`lib/learning/recommend.ts`, `lib/learning/objectives.ts`). Exercises are tagged with an
objective (built-in tables; teachers pick one per graded scene). An exercise counts as wrong when its
first attempt was. Over the last 5 exercises of an objective, at least 3 with 2 wrong make a suggestion,
shown with exactly those numbers and a quick quest that trains it when one is available today. Never
blocks anything; the teacher can turn suggestions off per group (`groups.recommend`). Studio analytics
shows the group's gaps as counts (students with repeated mistakes, share wrong), never names, with the
campaigns and quick quests that train each.

**Migration 8** `20261027000100_vocab_journal.sql` (table `vocab`, `groups.recommend`, ledger reason
`review`; rollback in its header). Applied to the working database 2026-10-26 after an inventory (only
test data), a backup (`E:/Backups/questling/2026-10-26T13-46-04`, verified by restore table by table) and
a dry run on the restored copy (no existing row changed). After: users 2 and ledger 31 as before, RLS
on, no grants to the API roles.

Tests: `tests/vocab.test.ts` (13), DB tests for the journal and the switch (3), `e2e/features-d.spec.ts` (5).
Full suites: unit/DB 164/164, e2e 106/106. Live check on the working database: 50 passed, 1 skipped
(that day's quests paid 55 coins, below any level-1 item, so the purchase itself was not tested).

## Gates B and C — media storage and voice acting (2026-10-26)

**Storage change (owner, 2026-10-26)**: Cloudflare R2 could not be activated (the card was not accepted),
so media go to **Backblaze B2** through its S3-compatible API. The code is provider-neutral
(`MEDIA_S3_*`), so R2 or another S3-compatible store needs only other values. Details, limits, setup and
the B2 free-tier caveats: `docs/media-storage.md`.

**Gate B — foundation**: SigV4 presigned URLs (`lib/server/sigv4.ts`), private storage access
(`lib/server/storage.ts`), checks by content (`lib/server/media-check.ts`: MP4 H.264/AAC and WebM
VP8/VP9 video; MOV, H.265, over 60 s refused; voice WebM/Opus or MP4/AAC; images by header), uploads in
three steps with quotas and a global cap (`lib/server/media-store.ts`), signed links after an access
check, daily cleanup and 180-day voice retention, a student's recordings deleted with them, operations
counted per day. Migration 9 `20261028000100_media_dubbing.sql`, applied 2026-10-26 after backup
`E:\Backups\questling\2026-10-26T18-39-51` (verified by restore) and a dry run.

Found and fixed on the way: the Permissions-Policy header forbade the microphone outright, and the
Content-Security-Policy would have blocked videos from storage, uploads to it and playback of fresh
takes (`blob:`); both now allow exactly the site and the storage origin. Studio actions were capped at
16 KB, so saving an edited copy of a built-in campaign (≈42 KB) failed with 413; the cap is now 384 KB
for studio actions (what the database keeps).

**Gate C — voice acting** (`lib/dub/model.ts`, `components/dub/*`, `components/studio/dubbing-screen.tsx`):
- Teacher Studio, new section **Voice acting** (`/studio/dubbing`): a scene = a video (own upload, with
  rights confirmed, or the built-in original clip), a non-destructive trim, characters, timed lines with
  English text, Russian translation and optional word help, modes, subtitles, XP, sends allowed. Draft
  → publish (versions frozen) → assign to groups. Review tab: the student's scene with their voice,
  line-by-line original vs take, a rubric without numbers (good / work on it), written feedback,
  approve (XP once, by ledger key) or ask to record again.
- Student (`/dub/<scene>`, listed in Quests): choose a part (when there are several) and a mode
  (listen and repeat, voice-over, role-play); per line: hear the original at 1×, 0.75×, 0.5×, record
  after a countdown (in voice-over and role-play the line plays muted while the student speaks), listen,
  delete, keep (upload). The whole scene: Original / My voice, with takes started at their lines and
  kept in step with the video; while a take plays the clip is muted (voices and music are one track —
  said on screen) and the teacher's background track plays instead when given. Send when every line
  has a kept take; status, feedback and rubric come back to the same screen. Shadowing: practice with
  or after the speaker, never sent, never graded.
- Recording (`lib/client/recorder.ts`): only after the student's button, one line at a time; format by
  feature detection; refusals explained (no permission, no microphone, busy, unsupported, interrupted
  — a page going to the background stops and drops the take).
- Demo: the built-in scene (`scripts/build-demo-clip.mts`: a pan over the app's own illustration, lines
  read by Piper, the student's part pitched) is "assigned" by the demo mentor; takes stay in the browser
  and nobody reviews them (said on screen). The demo studio has the scene and a synthetic student
  recording to review.

Not in these gates: the scene as a node inside a story campaign, and story rewards for it (gate E);
real-device checks (gate F).

Tests: `tests/storage.test.ts` (7), `tests/db/media.test.ts` (6), `e2e/features-c.spec.ts` (7, Chrome's
fake microphone), studio phone widths include the new section. Full suites: unit/DB 177/177, e2e
113/113 in three runs in a row. The old gate 1 flake was slow client navigation under a full parallel
run (over the default 5 s); assertions now wait up to 10 s (`playwright.config.ts`).
Live check on the working database with a local storage stand-in: 63 passed, 1 skipped (the day's
quests paid too few coins for a purchase); everything it stored was removed. **Not checked yet**: the
real B2 bucket (keys needed) and real phones.
