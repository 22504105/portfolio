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

**Decisions needed from the owner before gate B** (not taken silently):
1. Use Supabase Storage (private buckets) for teacher video and student voice, and put the
   `service_role` key into Vercel and `.env.local` (only the server reads it).
2. A migration adding tables for video exercises, recordings, submissions and reviews — applied to the
   working database only after a fresh backup, as with migration 7.
3. Quotas: proposed 25 MB and 60 s per clip, 300 MB of video per teacher, last 2 takes kept per line,
   recordings deleted 180 days after the assignment closes (or on request).

## Delivery order

- **Gate A — done 2026-10-26** (below).
- Gate B — media foundation (needs the decisions above).
- Gate C — voice acting on top of B.
- Gate D — vocabulary journal with spaced repetition, recommendations. Needs a migration (journal
  table, `saved` kinds) but no new services.
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
