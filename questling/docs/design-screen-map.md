# Design screen map

Every approved Stitch folder and the route or state that implements it. Source:
`design-source/questling-v2/` (unpacked `Questling_Updated_Stitch_Pack_v2.zip`).

Status columns: **Impl** — `—` not started, `shell` route exists with placeholder, `ui` faithful UI on
demo data, `live` wired to real services. **Visual QA** — `—` not compared, `diff` compared with open
deltas (see `docs/visual-qa/README.md`), `ok` accepted.

## Student app (mobile, 390×844 baseline)

Every screen exists twice, on the same component: under `/{ru,en}/demo/…` (the demo student, kept in
the browser) and under `/{ru,en}/app/…` (the signed-in Telegram student, kept on the server). Status
`live` means the screen's actions go through the server for a signed-in student; "story" screens are
`live` for Gate 2's clue-by-clue progress and get versioned story runs in Gate 3.

| Source folder | Route | Purpose (checked against screen.png) | Impl | Visual QA | Gate |
|---|---|---|---|---|---|
| `01_welcome` | `/welcome` (and `/app` itself) | Onboarding: logo, three feature rows, sound and language, "Начать путешествие" | live | 0.09% | 2 |
| `02_home_2` | `/home` | Hero panel (character, level, streak, coins, XP), current chapter, today's quests, word of the day, bottom nav | live | 2.79% | 1–2 |
| `03_story_map` | `/map` | Campaign path: done / current (hero) / locked / not yet written chapters; map and list views | live | 11.66% | 2 (UI), 3 |
| `04_quest_details` | `/quest/[chapter]` | Chapter intro, progress (opens the journal), goals, words read aloud, diary entry, rewards | live | 1.32% | 2 (UI), 3 |
| `05_story_player_2` | `/play` — `StoryPlayer` | Question node of the chapter being played; graded by the store | live | 1.68% | 1–2 |
| `06_interactive_puzzle` | `/play` — `PuzzleScreen` | Word-order cipher: attempts, slots + tiles, free hint, feedback, reset | live | 1.01% | 2 (UI), 3 |
| `07_evidence_journal_2` | `/journal` | Clues found in the chapter, the newest open, deduction, clue files | live | 23.14% | 2 (UI), 3 |
| `08_quick_quests` | `/quests`, `/quests/[quest]` | Today's three quests and the mentor's, filters, progress, day's bonus, countdown; playing a quest | live | 31.07% | 2 |
| `09_daily_discovery` | `/discovery` | Day's word (IPA, read aloud, example), quiz, fact (save, other language), claim | live | 9.98% | 2 |
| `10_rewards` | `/rewards` | Balances, level, weekly chest (random cloak or glasses), four achievements with real progress | live | 5.41% | 2 |
| `11_profile_2` | `/profile` | Hero (pencil = change hero), level, rank, worn items, learning progress, quick links | live | 7.76% | 2 |
| — (no screen) | `/settings` | Interface language, linked Telegram account. Built only from parts of approved screens | live | — | 1–2 |
| `12_character_select` | `/character` | Six free starting characters; first choice hands out the starting kit | live | 12.57% | 2 |
| `13_wardrobe_2` | `/wardrobe` | Base figure, slot markers, worn chips, slot tabs, owned/locked items, take all off, save look | live (no layers) | 14.32% | 2, art in 4 |
| `14_arcane_shop_2` | `/shop` | Fitting-room list, categories, deal of the day, catalogue, buying | live (no layers) | 10.04% | 2, art in 4 |
| `15_inventory` | `/inventory` | Worn items (take off), bag of items and found clues, filters, put on | live | 46.48% | 2 |
| — (no screen) | `/quests/[quest]` | Playing a quick quest: built from the player's option rows, the puzzle's tiles and banners | live | — | 2 |

Visual QA figures: share of differing pixels against the export at 390×844; what makes up each one
is in `docs/visual-qa/README.md`.

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
server; the client only renders the state it is given. Gate 2 renders `exhausted` with the
wrong-answer view and a way back to the map; its own screens arrive in Gate 3.

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

## Conflicts found in Gate 2 (resolved by the brief, which overrides decorative sample content)

7. **Cosmetics with learning bonuses.** The shop ("Повышает получение опыта +15%") and inventory
   ("+10 Концентрация", "+25% Опыт чтения", "Бонус сета: +5% Маны") promise advantages; the brief and
   the screens' own footers say cosmetics give none. Implemented without any bonus; the lines show
   the item's description, the set badge counts filled slots.
8. **A random chest prize.** "Случайный предмет: Редкий плащ или очки" is a loot box, which the brief
   forbids. **Owner's decision 2026-10-24: keep it as the export has it** ("оставь лутбокс пусть ниче
   не называет заранее"). The weekly chest gives a random cloak or glasses not owned yet
   (`CHEST_ITEMS`, drawn on the server from a cryptographic source), then coins once all are owned.
   It is earned by learning only and costs nothing: no coins, no real money.
9. **"3D ВИД".** There is no 3D model, and the brief forbids claiming one: the badge is left out.
10. **Portraits cut from a labelled reference sheet** (character select) and a dressed cat used as
    the hero everywhere. The six standalone base models are used instead, the same on every screen.
    Worn items appear on the figure only once alpha layers exist (Gate 4, `NEEDS_ART_ASSET`).
11. **Emoji as item pictures** (wardrobe, shop). Each item's own standalone picture is used.
12. **Inconsistent sample data across screens** (the cat is "Мяулин Чародей", "Барсик-Архивариус" and
    "Мяу-маг"; level 7 and 12; rank "Ученик Мага", "Странник", "Искатель тайн"). One student record
    feeds every screen: the chosen character's name, the level from XP, the rank from the level.
13. **"Вместимость 8 / 20".** There is no bag limit to show; the badge counts the collection
    (owned of all items).
14. **Controls with no target screen.** The bell opens the rewards screen; "Моя группа" shows the
    group but opens nothing until Teacher Studio (Gate 4); the coin balances open the shop.
