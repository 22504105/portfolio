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

## Results (Gate 2, Next 16.4.2, Chrome, 2026-10-24)

The Russian routes are compared, since the exports are in Russian. `e2e/gate1.spec.ts` checks that
every screen, in both languages, fits 320/360/390/430-px phones without sideways scrolling.

| Screen | Export | App route | Size (ref → app) | Differing pixels | What differs |
|---|---|---|---|---|---|
| welcome | `01_welcome` | `/ru/demo/welcome` | 390×925 → same | 0.09% | — |
| home | `02_home_2` | `/ru/demo/home` | 390×844 → same | 2.79% | hero art, name, rank (A, B) |
| map | `03_story_map` | `/ru/demo/map` | 390×2094 → 2100 | 11.66% | header, nav (C); hero avatar (A); progress figures (B) |
| details | `04_quest_details` | `/ru/demo/quest/tower` | 390×1268 → same | 1.32% | header (C); progress figures (B) |
| player | `05_story_player_2` | `/ru/demo/play` | 390×902 → same | 1.68% | header (C); Gelasio for Georgia (D) |
| player, correct | `05_story_player_50_xp` | `/ru/demo/play` after a right answer | 390×1045 → same | 2.72% | as player; glosses of `_2` |
| player, wrong | `05_story_player_3` | `/ru/demo/play` after a wrong answer | 390×1304 → same | 4.94% | as player; clean library picture (E) |
| puzzle | `06_interactive_puzzle` | `/ru/demo/play` at the cipher | 390×844 → same | 1.01% | header (C); tiles of the story's sentence |
| journal | `07_evidence_journal_2` | `/ru/demo/journal` | 390×1430 → 1420 | 23.14% | the demo has found clue 1, the export shows clue 2 (B); clean pictures (E) |
| quests | `08_quick_quests` | `/ru/demo/quests` | 390×1184 → 1348 | 31.07% | the finished daily quest is listed too, at the end (B); header, nav (C) |
| discovery | `09_daily_discovery` | `/ru/demo/discovery` | 390×1144 → 1166 | 9.98% | the day's word comes from the calendar (B); header (C) |
| rewards | `10_rewards` | `/ru/demo/rewards` | 390×980 → same | 5.41% | header, nav (C); real progress figures (B) |
| profile | `11_profile_2` | `/ru/demo/profile` | 390×1435 → same | 7.76% | hero art (A); real progress figures (B); header, nav (C) |
| character | `12_character_select` | `/ru/demo/character` | 390×1119 → same | 12.57% | standalone character art (A) |
| wardrobe | `13_wardrobe_2` | `/ru/demo/wardrobe` | 390×844 → same | 14.32% | hero art (A); item pictures for emoji (G); more tabs; no "3D ВИД" (F) |
| shop | `14_arcane_shop_2` | `/ru/demo/shop` | 390×844 → same | 10.04% | hero art (A); item pictures for emoji (G); deal of the day from the rotation (B); nav (C) |
| inventory | `15_inventory` | `/ru/demo/inventory` | 390×1204 → 1468 | 46.48% | the bag holds the demo student's real items and clues (B); item pictures (G); no bonus lines (F) |

Where a page is taller, it is because it lists more of the student's own things (quests, items),
not because a block grew: every block keeps the export's size and spacing, which the side-by-side
images show row for row.

## Known deltas

- **A. Character art.** The exports draw the cat dressed in the wizard set (`7fcd196e09a2`) and cut
  the character-select portraits out of a reference sheet with labels on it. The app shows each
  hero's plain standalone base model (`stitch-assets/…base_character_model_1…6`), the same picture
  on every screen. Drawing worn items onto the figure needs alpha-separated layers: Gate 4,
  `NEEDS_ART_ASSET` until then (`docs/ASSET_AUDIT.md`). The welcome screen keeps the dressed cat:
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
- **G. Item pictures.** The exports show emoji for items; the app shows each item's own standalone
  picture from the archive.

## Behaviour beyond the exports

- After a wrong answer and "Попробовать снова", the eliminated option stays in the list struck out
  and faded (`RuledOutOption`) and is no longer a radio.
- A story node with no attempts left shows the wrong-answer view with a way back to the map; the
  dedicated "attempts used up" and grimoire screens (`05_story_player_4`, `_never_2`) are Gate 3.
- Playing a quick quest and the settings screen have no export: both are built only from parts of
  approved screens (owner's rule), listed in the components' headers.
