# Questling

**Status:** deployed with database, Telegram sign-in, Teacher Studio and media storage; not yet
tested on physical phones inside Telegram · **Live demo:** student app
https://questling-dusky.vercel.app/en/demo, Teacher Studio
https://questling-dusky.vercel.app/en/demo/studio, Telegram https://t.me/QuestlingEnglish_bot ·
**Code:** https://github.com/22504105/portfolio/tree/main/questling

## Overview

An English-learning game for children and teenagers in a dark-fantasy setting. Students play
inside Telegram: story campaigns with clues and choices, short quests, words of the day, voice
acting, and a hero to dress up with coins earned by learning. Teachers use a browser studio to run
groups by level, build their own quests, follow progress and answer help requests. Russian and
English interface; learning content in English.

## Problem

Homework apps compete with everything else on a student's phone and usually lose. Teachers want
practice that students open on their own, but they also need control: what each group gets at its
level, where students get stuck, and the ability to write their own material without a developer.

## Solution

The game runs where students already are, in Telegram, so there is nothing to install. Learning is
wrapped in stories built as validated graphs: each choice, puzzle and piece of evidence is a node,
and the engine checks that every ending is reachable before a campaign can be published. Rewards
are cosmetic only and granted once by the server. The Teacher Studio exposes the same story engine
through a visual builder, keeps published versions fixed for students already playing, and turns
real answers into analytics by question.

## Work done

- Implementation of an approved 20-screen design (four story-player states) as a working app, with
  a screen-to-route map and visual comparison against the design.
- Server-authoritative game core: a student's record as facts, actions as pure functions shared by
  the demo and the server; answer keys only on the server.
- Telegram sign-in verification; teacher accounts through Supabase Auth; teacher isolation.
- Story engine with versioned campaigns, two original campaigns with branches and three endings.
- Teacher Studio: dashboard, groups and invitations, visual quest builder with validation,
  library with versions, analytics and help queue, daily content.
- Layered equipment: 24 items fitted to six heroes, with alpha extraction and a Blender re-cut of
  four garments.
- Learning features: word help, fair answer shuffling, word journal with spaced repetition,
  personalised practice, voice acting with teacher review, character talks, picture searches.
- Private media storage with signed links, quotas and nightly cleanup.
- Student data export and deletion, security review, 205 unit and database tests, Playwright
  end-to-end and accessibility tests, a live check against the deployed site.

## Key features

- Telegram Mini App with a browser demo; Teacher Studio for desktop and phone
- Two story campaigns (A1-A2, B1-B2) with choices, evidence and three endings
- Quick quests of eight kinds, daily quests, word and fact of the day
- Tap-to-translate word help and fair answer order
- Word journal with spaced repetition
- Voice acting: record your lines over a scene, teacher approves
- Hero wardrobe, shop and inventory (cosmetic only, no real money)
- Visual quest builder, versioned library, analytics by question

## Technology

Next.js 16 (App Router), React 19, strict TypeScript, Tailwind CSS 4, Supabase (PostgreSQL, Auth),
Telegram Mini App APIs, S3-compatible object storage (Backblaze B2), Zod, Vitest, Playwright,
Blender for asset work. Vercel hosting.

## Technical challenges

- **Fair rewards.** XP and coins are append-only ledgers with idempotency keys, so a refresh,
  replay or double tap never pays twice; the client never reports its own score.
- **Stories that cannot break.** Campaign graphs are validated for reachable endings, valid links
  and provable evidence; a student's run is bound to the version they started, and published
  versions are immutable in the database.
- **Equipment on six bodies.** The design's items were flat pictures on one character. They were
  separated into true-alpha layers, fitted to each hero with anchor data, and drawn in a defined
  order (cape behind the body, cape front over it, then neck, hat and companion).
- **Media on a free tier.** Uploads go straight from the browser to a private bucket through links
  that sign the exact file size, so storage refuses anything larger; per-teacher quotas and a
  nightly cleanup keep within free limits.
- **Children's privacy.** Minimal personal data, no public leaderboards, teacher access limited to
  their groups, and a way for a student to download or delete their data.

## Screenshots

See [`screenshots.md`](screenshots.md).

## Short summary

An English-learning game in Telegram with a Teacher Studio: story campaigns with clues and
choices, quests, word journal, voice acting and a hero to dress up; teachers build quests visually
and see errors by question. Server-checked rewards, versioned stories, private media storage.
Next.js, TypeScript, Supabase.
