# Design screen map

Every approved Stitch folder and the route or state that implements it. Source:
`design-source/questling-v2/` (unpacked `Questling_Updated_Stitch_Pack_v2.zip`).

Status columns: **Impl** — `—` not started, `shell` route exists with placeholder, `ui` faithful UI on
demo data, `live` wired to real services. **Visual QA** — `—` not compared, `diff` compared with open
deltas (see `docs/visual-qa/README.md`), `ok` accepted.

## Student app (mobile, 390×844 baseline)

| Source folder | Route / component | Purpose (checked against screen.png) | Impl | Visual QA | Gate |
|---|---|---|---|---|---|
| `01_welcome` | `/` (first run) → `app/(student)/welcome` | Onboarding: logo, three feature rows, "Начать путешествие" | — | — | 2 |
| `02_home_2` | `/home` | Hero panel (character, level, streak, coins, XP), featured story card, daily quests, word of the day, bottom nav | ui | diff 0.00% | 1 |
| `03_story_map` | `/map` | Vertical quest path with locked/complete locations | — | — | 3 |
| `04_quest_details` | `/quests/[questId]` | Quest intro, learning goals, rewards, start/resume | — | — | 2 |
| `05_story_player_2` | `/play/[runId]` — `StoryPlayer` | Question node: clue parchment, three options, one selected, "Проверить ответ" | ui | diff 1.68% | 1 |
| `06_interactive_puzzle` | `StoryPlayer` puzzle node (`PuzzleNode`) | Word-order cipher: slots + word bank, hint, check | — | — | 3 |
| `07_evidence_journal_2` | `/journal` | Collected clues list, clue detail, progress | — | — | 3 |
| `08_quick_quests` | `/quests` | Daily/assigned short activities with progress and rewards | — | — | 2 |
| `09_daily_discovery` | `/discovery` | Word of the day (IPA, translation, example), fact, mini quiz | — | — | 2 |
| `10_rewards` | `/rewards` | Chests, achievements with progress, economy feedback | — | — | 2 |
| `11_profile_2` | `/profile` | Character preview, level, stats, quick links | ui (demo) | diff 1.90% | 1 (demo), 2 |
| — (no screen) | `/settings` | Interface language (ru/en), linked Telegram account. Built only from parts of approved screens; reached from the profile row "Настройки и Telegram ID" | ui (demo) | — | 1 (demo), 2 |
| `12_character_select` | `/onboarding/character` | Six free starting characters, confirm | — | — | 2 |
| `13_wardrobe_2` | `/wardrobe` | Full-body preview, slot tabs, item grid, equip/save | — | — | 4 |
| `14_arcane_shop_2` | `/shop` | Featured item with preview, categories, catalogue, buy | — | — | 4 |
| `15_inventory` | `/inventory` | Owned items/companions with filters, equip | — | — | 4 |

## Story player states (`02_STORY_STATES/`)

One runtime engine (`lib/story/engine.ts`), one component (`StoryPlayer`). The folders are states of a
`question` node, identified from screen.png and code.html, not from the file names:

| Source folder | Engine state | What the screen shows | Impl | Visual QA |
|---|---|---|---|---|
| `05_story_player_2` (approved) | `answering` (option selected, not yet checked) | Stepper 2/5 active, selected option glows gold, CTA "Проверить ответ", reward chip +50 XP | ui | diff 1.68% |
| `05_story_player_50_xp` | `correct` → reward granted | Correct option in green with "ВЕРНО!" and explanation, wrong ones struck out, "Тайна разгадана +50 XP", "Улика внесена в Журнал", CTA "К следующей улике" | ui | diff 2.15% |
| `05_story_player_3` | `incorrect` (attempt 1 of 2 used, retry allowed) | Red step, "Попытка 1 из 2", wrong option with explanation, "Подсказка архивариуса", CTA "Попробовать снова" | ui | diff 4.94% |
| `05_story_player_4` | `exhausted` (all attempts used, quest paused) | "Попытки исчерпаны (2 из 2)", "Пауза квеста", help paths: ask the teacher, grimoire; back to library | — | — |
| `05_story_player_never_2` | `grimoire` sheet over `exhausted` | Bottom sheet "Гримуар знаний": grammar rule, deduction, a mini quiz; on success "+1 попытка восстановлена", CTA "Применить знание и разгадать" | — | — |

Transitions: `answering → (check) → correct | incorrect`; `incorrect → (retry) → answering`;
`incorrect` on the last attempt → `exhausted`; `exhausted → grimoire → (mini quiz passed) → answering`
with one attempt restored; `correct → (next) → next node`. Grading and the attempt counter live on the
server (Gate 3); the client only renders the state it is given.

## Teacher Studio (desktop, 1440×900 baseline)

| Source folder | Route | Purpose | Impl | Visual QA | Gate |
|---|---|---|---|---|---|
| `16_teacher_dashboard` | `/studio` | Overview: groups, activity, attention list, recent results | — | — | 4 |
| `17_group_management` | `/studio/groups/[groupId]` | Group card, CEFR level, students table, invite QR, assignments | — | — | 4 |
| `18_quest_builder` | `/studio/quests/[questId]/edit` | Node palette, graph canvas, node property panel, validation, publish | — | — | 4 |
| `19_story_library` | `/studio/library` | Campaign/quest cards, versions, publication status, filters | — | — | 4 |
| `20_teacher_analytics` | `/studio/analytics` | Results per student, answer review, question-level error heatmap | — | — | 4 |

## Experiments (`03_EXPERIMENTS/`) — not routes

`animated_svg`, `shader`, `three.js`, `01_welcome_animated_mystic_fog`,
`07_evidence_journal_3d_artifact_interactive`, `10_rewards_animated_arcane_seal`,
`12_character_select_arcane_circle`. Optional; considered only after Gate 5 core work, behind
`prefers-reduced-motion`, and only with measured Telegram WebView performance.
`12_character_select_arcane_circle/screen.png` is byte-identical to the approved `12_character_select`
screenshot.

## Conflicts found in the sources

Resolved by the precedence in the brief (screen.png → code.html → DESIGN.md). Owner decisions needed
where marked.

1. **Header titles copied between screens.** The header reads "Quest Details" on the story player and
   all four states, "Puzzle Chamber" on Daily Discovery and Inventory, "Profile" on Rewards, "Games
   Quests" on Quick Quests. These are Stitch leftovers. *Kept as approved for now; owner to confirm
   whether to use the real screen names.*
2. **Fonts differ from DESIGN.md.** DESIGN.md says EB Garamond + Inter. Home uses Cinzel + Cormorant
   Garamond; Character Select uses Cormorant Garamond; Wardrobe uses Cinzel + EB Garamond + MedievalSharp;
   Shop uses Cinzel + EB Garamond + Plus Jakarta Sans. Each screen keeps the fonts its screenshot was
   rendered with. Cinzel has no Cyrillic glyphs, so its Cyrillic text ("ГЛАВА II", "Ур. 7") falls back
   to a serif in the reference too — matched in visual QA.
3. **Undefined classes in the export.** Example: the story player title uses `font-headline-lg-mobile`,
   which the screen's Tailwind config does not define, so it renders as Inter 14px body text. The
   screenshot shows exactly that, so it is reproduced.
4. **Palette variants.** Profile redefines `secondary` (#8D75C9) and `background` (#101016); Home and
   Character Select define `gold-light`/`gold-dark` differently. Handled with per-screen token scopes.
5. **Images with UI baked in.** Hero images of `05_story_player_3` and `_4` contain a rendered "ОШИБКА"
   dialog and a book page; several Teacher Studio images contain screenshots of other UI. See
   `ASSET_AUDIT.md`. The states reuse the clean library illustration of `05_story_player_2`. *Owner to
   confirm.*
6. **Bottom navigation differs per screen.** Home: Главная / Сюжет / Квесты / Профиль with outline
   icons of its own. Quick Quests, Rewards, Profile: the same four labels with Material Symbols
   (castle, menu_book, sports_esports, shield_person). Story Map: the third tab is "Игры" and the icons
   are shield/map/sports_esports/person. The remaining student screens have no `<nav>` element in the
   export. Each route renders the nav of its own screenshot; unifying them needs an owner decision.

## Owner's decisions (2026-10-24, "ок по всем")

- **Conflict 1, header titles:** each screen is named after itself, in the interface language:
  `09_daily_discovery` and `15_inventory` stop saying "Puzzle Chamber", `10_rewards` stops saying
  "Profile", `08_quick_quests` stops saying "Games Quests", the story player and its states say
  "Задание" / "Quest" instead of "Quest Details".
- **Conflict 6, bottom navigation:** one bar on every main screen, Home's (Главная / Сюжет / Квесты /
  Профиль with Home's icons). Screens in the middle of an activity (welcome, quest details, story
  player, puzzle, journal, daily discovery, character select, wardrobe, inventory) keep having none.
  The story map's "Игры" tab and the shop's "Лавка" tab go; the shop is reached from the profile.
- **Conflict 5, images with UI baked in:** none of them ships. The error state keeps the clean library
  picture; the others get clean illustrations from the archives or newly generated ones without text.
- **No new design.** Only what the approved screens show is used. A screen that has no export
  (settings) is put together from pieces of approved screens, nothing else.
- **Two interface languages, Russian and English.** The language is the first part of the address
  (`/ru/…`, `/en/…`); the switch is on the settings screen. Story content (clues, answers) stays English.
