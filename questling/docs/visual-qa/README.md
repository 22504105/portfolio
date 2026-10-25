# Visual QA

Each screen is compared against its Stitch export, not against a memory of it. `npm run visual`
(`scripts/visual-compare.mjs`) opens the export's own `code.html` and the app route in the same Chrome
at 390×844, captures the full page, and writes four images per screen:

- `reference.png` — the export, its lh3 images served from `design-source/remote-assets`;
- `app.png` — the app route, with the demo badge hidden;
- `diff.png` — differing pixels in red;
- `side-by-side.png` — reference, app and diff next to each other.

The script needs a running production build (`npm run build && npx next start -p 3100`; `--base` points
it elsewhere). Every app shot starts from a fresh demo student (a new browser context, so a new
`localStorage`). The images are regenerated, not hand-edited, and are not committed.

## Results (Gate 5 re-run, all 24 screens and states, 2026-10-25)

Run again on `questling/gate-05` after Gate 4's layered heroes and Gate 5's contrast changes; every
side-by-side was looked at by eye. The tables of Gates 3 and 4 below keep their explanations (A–O);
here only what moved.

| Screen                                                                                                           | Gate 3/4                       | Now                   | Why                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| welcome, details, player, player-correct, player-incorrect, puzzle, player-exhausted, player-grimoire, character | —                              | same ±0.1%            | unchanged                                                                                                                                               |
| home                                                                                                             | 2.79%                          | 4.53%                 | the hero card now draws the student's hero in their gear, as on the export and as on the profile (it showed the bare base picture: **fixed in Gate 5**) |
| map                                                                                                              | 11.66%                         | 11.74%                | locked chapters fade their medallion, not their words (contrast)                                                                                        |
| journal                                                                                                          | 34.63%                         | 34.99%                | locked clues fade their lock tile, not their words (contrast)                                                                                           |
| quests, discovery, rewards                                                                                       | 31.07 / 9.98 / 5.41%           | 31.22 / 10.01 / 5.18% | real figures of the day (B)                                                                                                                             |
| profile                                                                                                          | 7.76%                          | 13.27%                | the hero is the layered figure (Gate 4), larger in its frame than the export's picture (A)                                                              |
| wardrobe                                                                                                         | 14.32%                         | 17.09%                | as profile; equipment slots drawn on the figure (A, G)                                                                                                  |
| shop                                                                                                             | 10.04%                         | 11.37%                | as profile; the rarity tag above the item picture (it was hidden under it: **fixed in Gate 5**)                                                         |
| inventory                                                                                                        | 46.48%                         | 46.13%                | the bag holds the demo student's real items (B, G)                                                                                                      |
| studio dashboard, groups, library, analytics                                                                     | 18.21 / 17.28 / 15.84 / 21.74% | same                  | unchanged                                                                                                                                               |
| studio builder                                                                                                   | 18.78%                         | 19.58%                | the demo draft's graph (B)                                                                                                                              |

Material differences left, each a documented decision: the hero art (layered heroes instead of the
export's single picture, A), real data instead of the export's sample figures (B), header and navigation
by the owner's decisions (C), and the studio's honest replacements for features the exports only drew
(J–O). No screen has a block missing, moved or restyled.

## Results (Gate 3, Next 16.4.2, Chrome, 2026-10-24)

The Russian routes are compared, since the exports are in Russian. `e2e/gate1.spec.ts` checks that
every screen, in both languages, fits 320/360/390/430-px phones without sideways scrolling.

| Screen                   | Export                    | App route                                  | Size (ref → app)               | Differing pixels | What differs                                                                                     |
| ------------------------ | ------------------------- | ------------------------------------------ | ------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------ |
| welcome                  | `01_welcome`              | `/ru/demo/welcome`                         | 390×925 → same                 | 0.09%            | —                                                                                                |
| home                     | `02_home_2`               | `/ru/demo/home`                            | 390×844 → same                 | 2.79%            | hero art, name, rank (A, B)                                                                      |
| map                      | `03_story_map`            | `/ru/demo/map`                             | 390×2094 → 2100                | 11.66%           | header, nav (C); hero avatar (A); progress figures (B)                                           |
| details                  | `04_quest_details`        | `/ru/demo/quest/tower`                     | 390×1268 → same                | 1.32%            | header (C); progress figures (B)                                                                 |
| player                   | `05_story_player_2`       | `/ru/demo/play`                            | 390×902 → same                 | 1.68%            | header (C); Gelasio for Georgia (D)                                                              |
| player, correct          | `05_story_player_50_xp`   | `/ru/demo/play` after a right answer       | 390×1045 → same                | 2.72%            | as player; glosses of `_2`                                                                       |
| player, wrong            | `05_story_player_3`       | `/ru/demo/play` after a wrong answer       | 390×1304 → same                | 4.94%            | as player; clean library picture (E)                                                             |
| puzzle                   | `06_interactive_puzzle`   | `/ru/demo/play` at the cipher              | 390×844 → same                 | 0.76%            | header (C); tiles of the story's sentence                                                        |
| player, no attempts left | `05_story_player_4`       | `/ru/demo/play` after two wrong answers    | 390×1484 → 1417                | 21.05%           | header (C); clean library picture (E); honest mentor card and button (H)                         |
| player, grimoire         | `05_story_player_never_2` | the same, grimoire open, right word chosen | 390×844 → same (one screenful) | 16.98%           | the riddle card shows its quote (I); the paused screen behind the sheet                          |
| journal                  | `07_evidence_journal_2`   | `/ru/demo/journal`                         | 390×1430 → 1660                | 34.63%           | the case is the whole campaign: 8 clues listed, 2 found (B); clean pictures (E)                  |
| quests                   | `08_quick_quests`         | `/ru/demo/quests`                          | 390×1184 → 1348                | 31.07%           | the finished daily quest is listed too, at the end (B); header, nav (C)                          |
| discovery                | `09_daily_discovery`      | `/ru/demo/discovery`                       | 390×1144 → 1166                | 9.98%            | the day's word comes from the calendar (B); header (C)                                           |
| rewards                  | `10_rewards`              | `/ru/demo/rewards`                         | 390×980 → same                 | 5.41%            | header, nav (C); real progress figures (B)                                                       |
| profile                  | `11_profile_2`            | `/ru/demo/profile`                         | 390×1435 → same                | 7.76%            | hero art (A); real progress figures (B); header, nav (C)                                         |
| character                | `12_character_select`     | `/ru/demo/character`                       | 390×1119 → same                | 12.57%           | standalone character art (A)                                                                     |
| wardrobe                 | `13_wardrobe_2`           | `/ru/demo/wardrobe`                        | 390×844 → same                 | 14.32%           | hero art (A); item pictures for emoji (G); more tabs; no "3D ВИД" (F)                            |
| shop                     | `14_arcane_shop_2`        | `/ru/demo/shop`                            | 390×844 → same                 | 10.04%           | hero art (A); item pictures for emoji (G); deal of the day from the rotation (B); nav (C)        |
| inventory                | `15_inventory`            | `/ru/demo/inventory`                       | 390×1204 → 1468                | 46.48%           | the bag holds the demo student's real items and clues (B); item pictures (G); no bonus lines (F) |

Where a page is taller, it is because it lists more of the student's own things (quests, items),
not because a block grew: every block keeps the export's size and spacing, which the side-by-side
images show row for row.

## Results (Gate 4, Teacher Studio, 1440×900, 2026-10-25)

The studio screens are desktop ones: `npm run visual -- studio-dashboard studio-groups studio-builder
studio-library studio-analytics` shoots both sides at 1440×900 (`--width` overrides). The app side is
the demo studio (`/ru/demo/studio`), whose classes are simulated through the real rules
(`lib/studio/demo.ts`). At 1280 the screens were checked by eye for overflow; below 1536 px the builder
shows two of its toolbar buttons as icons with tooltips.

| Screen    | Export                 | App route                                      | Size (ref → app) | Differing pixels | What differs                                                                      |
| --------- | ---------------------- | ---------------------------------------------- | ---------------- | ---------------- | --------------------------------------------------------------------------------- |
| dashboard | `16_teacher_dashboard` | `/ru/demo/studio`                              | 1440×1250 → 1310 | 18.21%           | real figures and names (B); help requests, not essays (J); Telegram card (K)      |
| groups    | `17_group_management`  | `/ru/demo/studio/groups`                       | 1440×1401 → 1295 | 17.28%           | real roster and assignments (B); a real QR code and invite link                   |
| builder   | `18_quest_builder`     | `/ru/demo/studio/builder?quest=…` (one screen) | 1440×900 → same  | 18.78%           | the teacher's real draft graph (B); validator messages (L); no reward node (M)    |
| library   | `19_story_library`     | `/ru/demo/studio/library`                      | 1440×1310 → 1308 | 15.84%           | real campaigns and versions (B); runs per version, no diff or CDN ping (N)        |
| analytics | `20_teacher_analytics` | `/ru/demo/studio/analytics`                    | 1440×1523 → 1458 | 21.74%           | help queue from the run, no AI pre-check (J); real skills, heatmap (B); a tab (O) |

Equipment on the heroes is checked on its own sheets (`equipment/`, `docs/ASSET_AUDIT.md`).

## Known deltas

- **A. Character art.** The exports draw the cat dressed in the wizard set (`7fcd196e09a2`) and cut
  the character-select portraits out of a reference sheet with labels on it. The app draws each
  hero from its standalone base model (`stitch-assets/…base_character_model_1…6`) with the worn items
  as layers cut offline (Gate 4, `docs/ASSET_AUDIT.md` "Equipment layers"); the five items whose art
  cannot be fitted are named under the figure, not faked. The welcome screen keeps the dressed cat:
  there it is the academy's guide, not the student's hero.
- **B. Real data instead of the export's sample values.** Every number is worked out from the
  student's record (`lib/game/stats.ts`). The demo student's history is played through the real
  rules (`lib/demo/seed.ts`) and topped up to the screens' balances (level 7, 340 / 500 XP, 850
  coins, 6-day streak); the rest (clues found, week's quests, today's quests and word) follows from
  the calendar and the rules, so it differs from the export and from day to day. The hero's name is
  the chosen character's (the exports call the cat three different names).
- **C. Owner's decisions of 2026-10-24.** Headers name their own screen in the interface language;
  every main screen has Home's bottom bar.
- **D. Fonts.** Georgia (what the exports' fallbacks render as) is replaced by Gelasio, its free
  metric twin.
- **E. Pictures with interface painted in** (`ASSET_AUDIT.md`) are not used; the clean illustration
  of the same place is.
- **F. The brief over the export.** No learning advantage from cosmetics (no "+15% опыта", "Бонус
  сета", "+10 Концентрация"), no claim of a 3D model. (The weekly chest's random prize stays as the
  export has it: the owner's decision of 2026-10-24.)
- **H. Honest help (Gate 3).** The export's mentor card promises a notification in Teacher Studio
  and a reply in Telegram, with the mentor "В сети". Teacher Studio is Gate 4, so the card says the
  request is kept and the mentor will see it there, shows the student's group (or "Группа не
  подключена") instead of an online status, and the toast says "Свиток сохранён!", not "доставлен".
  The way back leads to the story map ("Вернуться к карте"), the hub of the stories; there is no
  separate story library screen. The card is titled "Спросить наставника": the mentor's name in the
  accusative is not known for every group. Since Gate 4 the card says the group's mentor sees the
  request in Teacher Studio and their reply shows on the card; without a group it says how to join.
- **I. The grimoire's riddle card.** In the export the scrolling column squashes the riddle card to
  its heading; the app keeps every card at its height, so the riddle's quote shows, with the rule's
  key word marked as the export marks «never».
- **G. Item pictures.** The exports show emoji for items; the app shows each item's own standalone
  picture from the archive.
- **J. Teacher Studio reviews what exists (Gate 4).** The exports review free-text essays and audio
  "checked by AI" and offer "+50 XP" in a batch. Questling has no essays, recordings or AI: the review
  queue is the students' help requests — the scene they are stuck at, the answers they gave there
  (from their run), the right one, and figures counted from their answers ("Посчитано по ответам
  ученика, без ИИ"). The mentor's reply goes to the student, who reads it on the paused scene and in
  the settings.
- **K. Honest status cards.** No made-up webhook, CDN or "100% OK" figures; the Telegram card shows the
  bot and how students join. The export's "AI auto-balance" recommendation is replaced by the weakest
  skill, as counted.
- **L. The validator's messages** are the publishing check's own (technical English, e.g.
  "question-2 leads to unknown scene x"); their count, the "Перейти" link and the red nodes are in the
  interface language.
- **M. No reward node.** Rewards belong to graded scenes, chapters and endings in the story graph;
  the palette's "Награда" says where to set them instead of adding a node that would do nothing.
- **N. The release log counts runs on each version** instead of the export's "16 сессий стабильно";
  "Diff изменений" and the "Telegram CDN ping" are left out.
- **O. An added tab.** "Слово и факт дня" (the brief's daily content editor) has no export; it is the
  analytics screen's tab, built from its own cards, fields and gold button.

## Gate 5: contrast (WCAG 2.2 AA, axe, 2026-10-25)

`e2e/gate5.spec.ts` runs axe on every student screen (390 px) and studio screen (1440 px) in both
languages. It found low-contrast text, almost all of it from the exports' own dimming. Changed, as little
as passes 4.5:1, so the screens look the same at a glance:

| Screen           | Export                                            | Now                                                                         |
| ---------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Journal          | locked clue rows faded whole (35–65 %)            | the lock tile keeps the fade; the row's words at 80 %                       |
| Map              | locked chapter nodes faded whole (65–85 %)        | the medallion keeps the fade; the label card at 90 %, boss card more opaque |
| Map              | parchment note heading gold on parchment (1.56:1) | the palette's dark gold `on-tertiary-fixed-variant` (5.49:1)                |
| Journal          | "Изучено" badge green on green (4.39:1)           | a lighter green, `#6FC4A8`                                                  |
| Profile, shop    | violet badge text on violet (3.0–3.9:1)           | lighter violets `#A18DDB`, `#B3A3E6`                                        |
| Hero select      | the selected hero's violet caption (4.46:1)       | `#9D87D6`                                                                   |
| Quest details    | the seal's legend at 75 %                         | 90 %                                                                        |
| Inventory        | locked items at 75 %, captions in `outline`       | 85 %, captions in `text-muted`                                              |
| Discovery        | the bookmark icon at 70 %                         | 85 %                                                                        |
| Studio library   | tab counts at 60 %                                | 80 %                                                                        |
| Studio dashboard | `aria-label` on a plain `span` (not allowed)      | `role="img"`                                                                |

Icons (glyphs of the Material Symbols ligature font, `aria-hidden`) are excluded from the check: axe
reads a ligature as text. The same suite checks that no student screen scrolls sideways at 320, 360, 390
and 430 px and no studio screen at 1280 and 1440 px: none does.

## Behaviour beyond the exports

- After a wrong answer and "Попробовать снова", the eliminated option stays in the list struck out
  and faded (`RuledOutOption`) and is no longer a radio.
- A scene with no attempts left (a question, a piece of evidence or a cipher) pauses on
  `05_story_player_4`; the grimoire (`_never_2`) asks its one-word quiz, and the right word wins back
  exactly one attempt (checked by the rules, kept in the run). A wrong word costs nothing.
- Narration, dialogue, a choice, a chapter's end and the campaign's ending have no export: they are
  built only from the approved player's parts (heading, scene picture, parchment, option cards,
  reward card, gold button), listed in `components/student/story-scenes.tsx`.
- Evidence uses the question screens, its options being the clues the student found, each with its
  own picture, as in the journal.
- Playing a quick quest and the settings screen have no export: both are built only from parts of
  approved screens (owner's rule), listed in the components' headers.
