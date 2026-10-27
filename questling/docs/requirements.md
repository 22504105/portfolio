# Questling - Product requirements

The specification Questling was built against: the core product, then a second
set of learning features. How each point was met, and where the build departs,
is in [`architecture.md`](architecture.md), [`design-screen-map.md`](design-screen-map.md)
and [`features-audit.md`](features-audit.md).

## Product

A dark-fantasy English-learning Telegram Mini App for students and a
browser-based Teacher Studio, implemented from an approved screen design (20
screens and four story-player states, made in Google Stitch). The design is
the UI specification: layouts, artwork, typography and navigation are
reproduced as faithfully as technically possible, and every control must do
what it shows. Nothing paid is required: no paid APIs, hosted language
models, translation vendors, payment processors or commercial fonts.

## Students

- Telegram sign-in verified on the server; an isolated browser demo on
  invented data, clearly labelled.
- Six free characters; the chosen one appears on every screen. Interface in
  Russian and English; learning content in English.
- XP, level and coins as independent, server-authoritative balances with
  history. Rewards are granted once, from verified completions only.
- Quick quests: choice, matching, fill the blank, ordering, reading,
  listening, dialogue and logic puzzles, with hints, explanations and
  feedback. Answer keys stay on the server.
- Story adventures: versioned narrative graphs with narration, dialogue,
  choices, questions, puzzles, clues, rewards and endings; progress saved and
  resumed; chapters unlocked by the server. At least two original campaigns
  (A1-A2 investigation, B1-B2 mystery) with real branching and evidence.
- Daily discovery: word and fact of the day, saving words, a short quiz; no
  invented citations.
- Coins buy cosmetics only. No loot boxes, real-money payments or learning
  advantages for sale.
- Layered character equipment (outfits, headwear, accessories, companions)
  drawn on all six characters, with ownership and equipping enforced on the
  server.

## Teachers

- Email and password sign-in with a teacher role; teachers are isolated from
  each other.
- Groups with CEFR levels A1-C1, invitations, memberships, assignments with
  dates.
- Library: create, duplicate, edit, preview, assign, publish, archive and
  version quests. Published versions are immutable; students keep the version
  they started.
- Visual quest builder with node forms, connections and validation before
  publishing (start and end, reachability, valid targets, answers present).
- Analytics from real attempts: completion, errors by question, attempts.
- Daily content per group, preview as a student without touching real
  progress.

## Learning features (second specification)

1. **Word help**: tappable words and phrases with translations, set by the
   teacher, without giving away the answer; contextual hints that never solve.
2. **Fair answer order**: a fresh unbiased shuffle per attempt, kept on reload,
   graded by option id on the server.
3. **Voice acting**: teachers upload short licensed clips and time the lines;
   students record their lines, compare with the original, and send the scene
   for teacher review. No fabricated pronunciation scores. Private media
   storage behind short-lived links, with quotas and retention.
4. **Character dialogues**: teacher-authored branching conversations inside
   the story engine; no paid chatbot.
5. **Word journal**: saved words with spaced repetition and gentle review.
6. **Personalised practice** from the student's own mistakes.
7. **Story gameplay**: picture searches and story items as rewards.

Team quests and 3D characters are out of scope.

## Data and privacy

Students may be minors: minimal personal data, no public leaderboards,
teacher access limited to their own groups, export and deletion of a
student's data. Coins and XP are integer ledgers with idempotent awards.
Migrations are additive and tested before they reach the live database.

## Technology

Next.js App Router, strict TypeScript, Tailwind CSS, Supabase (PostgreSQL and
Auth), Telegram Mini App APIs, S3-compatible object storage for media, Vitest,
Playwright. Free tiers only.
