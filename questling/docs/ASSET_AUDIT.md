# Asset audit

Audited 2026-10-23 with `scripts/audit-images.mjs` (size, alpha channel, share of transparent
pixels, flat background check) and contact sheets (`scripts/contact-sheet.mjs`). Raw files are not in
git (see `.gitignore`); they live in `design-source/` on the owner's machine:

- `questling-v2/` — `Questling_Updated_Stitch_Pack_v2.zip` (screens, states, experiments, references).
- `stitch-assets/` — `stitch_questling_telegram_learning_app (1).zip` (standalone character, outfit,
  equipment and companion images).
- `remote-assets/` — images the screen HTML loads from `lh3.googleusercontent.com`, downloaded at
  original size (`=s0`) by `npm run assets:fetch`; `index.json` maps each URL to its file and screens.

**License.** All images were generated in Google Stitch for the owner. No third-party stock. Legal
status: owner's generated content, usable in the portfolio project; no separate license document in
the package. Fonts: EB Garamond, Cormorant Garamond, Cinzel, Inter, MedievalSharp, Plus Jakarta Sans
(SIL OFL 1.1) and Material Symbols (Apache 2.0) — all free to ship, self-hosted.

## Headline findings

1. **No image in either archive has real transparency.** Every PNG is RGB, or RGBA with 0% transparent
   pixels. The "clean standalone" assets sit on a flat dark studio background (#0d0e12…#1a1b20,
   corners uniform). They are usable as artwork but not as equip layers until the background is
   removed offline into true alpha. Runtime chroma key is ruled out by the brief.
2. **The "missing ghost" is not missing.** `stitch-assets` contains a ghost companion
   (`companion_pet_6`, with a lantern) and a ghost base (`base_character_model_7`). The README's note
   applies to the `06_LATEST_SCREENSHOTS` only.
3. **29 of 30 remote images exist nowhere in the archives.** Only `a3cd602120bc.png` equals
   `04_VISUAL_REFERENCES/02_approved_cute_characters.png/screen.png`. The Stitch links are temporary,
   so the local copies are now the source of truth.
4. **Ten remote images have UI or text baked into the picture** (see table). They cannot be shipped as
   illustrations without looking like a screenshot inside a screen.
5. **Four Teacher Studio portraits are photographic/realistic people**, off the approved chibi and
   painted style. Teacher Studio will use the painted portraits or initials instead.
6. **No outfit is split into back/front layers.** The ceremonial cape (`outfit_3`) is one flat image
   seen from the front; the cat test (cape_back behind the body, cape_front above it) needs a split or
   a redraw. Gate 4 result: split offline and shipped as a documented compromise; 19 of 24 items are
   drawn on all six heroes, 4 are `NEEDS_ART_ASSET` (the sprite, the fifth, was remodelled in Blender on 2026-10-25) (see "Equipment layers").

## Standalone assets (`stitch-assets/`)

Identified by eye from the contact sheet. All: no alpha, flat dark background, front view.
The individual character renders and the outfits are 896×1200; the base models and the rest 1024×1024.

| Source folder suffix               | Content                                                                                                                                            | Intended slot                                                    | Ship as equip layer?             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------- |
| `base_character_model_…_1`         | Boy, curly hair, plain tunic                                                                                                                       | base: boy                                                        | after alpha extraction           |
| `base_character_model_…_2`         | Girl, black hair, plain tunic                                                                                                                      | base: girl                                                       | after alpha extraction           |
| `base_character_model_…_3`         | Orange fox, plain tunic                                                                                                                            | base: fox                                                        | after alpha extraction           |
| `base_character_model_…_4`         | Gray cat, plain tunic                                                                                                                              | base: cat (vertical slice)                                       | after alpha extraction           |
| `base_character_model_…_5`         | Owl, plain tunic                                                                                                                                   | base: owl                                                        | after alpha extraction           |
| `base_character_model_…_6`         | Green forest creature with horns                                                                                                                   | base: forest creature                                            | after alpha extraction           |
| `base_character_model_…_7`         | Ghost                                                                                                                                              | not one of the six species; spare                                | —                                |
| `individual_character_asset_…_1…6` | Same six species in another order (1 boy, 2 cat with a black hat and glasses, 3 girl, 4 fox, 5 owl, 6 forest creature), slightly different renders | previews                                                         | as pictures, not bases           |
| `companion_pet_…_1` / `_7`         | Raven (black / violet tint)                                                                                                                        | companion: raven                                                 | after alpha extraction           |
| `companion_pet_…_2` / `_8`         | Moon cat (black / blue)                                                                                                                            | companion: moon cat — dark fur on dark background, hardest matte | after careful extraction         |
| `companion_pet_…_3` / `_10`        | Glowing sprite                                                                                                                                     | companion: spirit                                                | glow halo needs soft alpha       |
| `companion_pet_…_4` / `_11`        | Fox cub                                                                                                                                            | companion: fox cub                                               | after alpha extraction           |
| `companion_pet_…_5` / `_9`         | Owl                                                                                                                                                | companion: owl                                                   | after alpha extraction           |
| `companion_pet_…_6`                | Ghost with lantern                                                                                                                                 | companion: ghost                                                 | after alpha extraction           |
| `game_equipment_…_1`               | Green hood                                                                                                                                         | headwear                                                         | needs fitting per species        |
| `game_equipment_…_2`               | Purple witch hat with star                                                                                                                         | headwear (vertical slice)                                        | needs fitting per species        |
| `game_equipment_…_3`               | Round glasses                                                                                                                                      | face                                                             | needs fitting per species        |
| `game_equipment_…_4`               | Leather satchel                                                                                                                                    | bag/back                                                         | needs fitting                    |
| `game_equipment_…_5`               | Gold star amulet                                                                                                                                   | neck (vertical slice)                                            | needs fitting                    |
| `game_equipment_…_6`               | Spellbook                                                                                                                                          | handheld                                                         | needs fitting                    |
| `game_equipment_…_7`               | Wand                                                                                                                                               | handheld                                                         | needs fitting                    |
| `game_equipment_…_8`               | Red bow                                                                                                                                            | neck/headwear                                                    | needs fitting                    |
| `game_equipment_…_9`               | Lantern                                                                                                                                            | handheld                                                         | needs fitting                    |
| `game_equipment_…_10`              | Crystal staff                                                                                                                                      | handheld                                                         | needs fitting                    |
| `game_equipment_…_11`              | Gold crown                                                                                                                                         | headwear                                                         | needs fitting                    |
| `game_equipment_…_12`              | Moon pendant                                                                                                                                       | neck                                                             | needs fitting                    |
| `wearable_outfit_…_1`              | Violet robe                                                                                                                                        | base outfit                                                      | fitting; species anatomy differs |
| `wearable_outfit_…_2`              | Green cape with bag                                                                                                                                | outerwear                                                        | needs back/front split           |
| `wearable_outfit_…_3`              | Ceremonial cape, red/black/gold                                                                                                                    | outerwear (vertical slice)                                       | **needs back/front split**       |
| `wearable_outfit_…_4`              | Violet tunic                                                                                                                                       | base outfit                                                      | fitting                          |
| `wearable_outfit_…_5`              | Brown coat                                                                                                                                         | outerwear                                                        | fitting                          |
| `wearable_outfit_…_moon`           | Midnight hooded cloak with moon                                                                                                                    | outerwear                                                        | needs back/front split           |

Counts against `07_IMPLEMENTATION/manifest.json`: base characters 6 of 6 (+ ghost spare), outfits 6 of
6, accessories 12 of 12, companions 6 of 6 kinds (11 images). Content is complete; **layer readiness
is 0 of 30** until alpha extraction and fitting are done and verified.

## Remote images used by screens (`remote-assets/`)

All JPEG except one PNG; none with alpha. "Ship" = can be shown as an illustration as is.

| File               | Size      | Content                                                            | Used by                                           | Ship                                                                                         |
| ------------------ | --------- | ------------------------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `7fcd196e09a2.jpg` | 1024×1024 | Chibi gray cat wizard (hat, cape, staff) on dark background        | welcome, home, profile, wardrobe, shop, inventory | yes (card art; not an equip layer)                                                           |
| `316ce7a1a59b.jpg` | 1376×768  | Moonlit gothic castle                                              | welcome, home, quest details                      | yes                                                                                          |
| `92d312fab547.jpg` | 1024×1024 | Parchment scroll with violet wax seal                              | home, quick quests                                | yes                                                                                          |
| `a290d89b186d.jpg` | 1024×1024 | Rune spellbook                                                     | home, quick quests, shop, states 4 and never      | yes                                                                                          |
| `52bfe43014ee.jpg` | 1024×1024 | Violet crystal on rune casket                                      | quick quests, state never                         | yes                                                                                          |
| `443694f1801e.jpg` | 1408×768  | Library desk with candle and sealed letter                         | story player, state 50 XP                         | yes                                                                                          |
| `4b34593af1d6.jpg` | 1376×768  | Grand library hall                                                 | daily discovery                                   | yes                                                                                          |
| `d34d9e5f738a.jpg` | 1408×768  | Treasure chest                                                     | interactive puzzle                                | yes                                                                                          |
| `f31dae9d1f10.jpg` | 1408×768  | Glowing treasure chest                                             | rewards                                           | yes                                                                                          |
| `9730a0f4d74f.jpg` | 1024×1024 | Plain gray cat                                                     | story map                                         | yes                                                                                          |
| `c78f31153e30.jpg` | 1024×1024 | Plain gray cat (same picture, different bytes)                     | character select                                  | yes                                                                                          |
| `a3cd602120bc.png` | 1536×1024 | Character reference sheet "Маленькие герои" with labels            | character select                                  | **no** — a reference board with text                                                         |
| `3c813b951c2c.jpg` | 1408×768  | Enchanted forest                                                   | story library                                     | yes — Gate 3 `forest.webp` (chapter III)                                                     |
| `7da39dcc0e1f.jpg` | 1408×768  | Fox mage in a library                                              | group management                                  | yes, cropped: a window title bar and frame are painted round it — Gate 3 `archive-mage.webp` |
| `b8c20053a68a.jpg` | 1408×768  | Forest creature with staff                                         | group management                                  | yes — Gate 3 `forest-spirit.webp`                                                            |
| `ff0ba56375bf.jpg` | 1024×1024 | Cat wizard portrait in a circle                                    | group management                                  | yes                                                                                          |
| `b78b17cb856d.jpg` | 1408×768  | Library with an "ОШИБКА" dialog painted in                         | story state 3                                     | **no** — UI baked in                                                                         |
| `8230a717bfa9.jpg` | 1408×768  | Library with a "Проклятие Чёрного Леса" page and button painted in | story state 4                                     | **no** — UI baked in                                                                         |
| `002ff321e18d.jpg` | 1408×768  | "07 Evidence Journal" UI around a desk                             | evidence journal                                  | **no** — UI baked in                                                                         |
| `9585267193e0.jpg` | 1408×768  | "07 Evidence Journal — Новая улика" envelope screen                | evidence journal, 3D experiment                   | **no** — UI baked in                                                                         |
| `d6b4976d6129.jpg` | 1376×768  | "19 Story Library" UI with castle                                  | story library                                     | **no** — UI baked in                                                                         |
| `dbca6857d6a8.jpg` | 1408×768  | Castle in a storm, "The Academy of Arcane Arts" lettering          | story library                                     | crop only, lettering in the image                                                            |
| `0a6dbaca2110.jpg` | 1024×1024 | Teacher portrait in a frame with "ELARA VANCROFT" text panel       | teacher dashboard                                 | **no** — text baked in                                                                       |
| `2d11217df3fd.jpg` | 1408×768  | Hooded girl portrait inside UI chrome                              | group management                                  | **no** — UI baked in                                                                         |
| `3ea1bccff5f8.jpg` | 1408×768  | "Group" UI screenshot with a boy wizard                            | group management                                  | **no** — UI baked in                                                                         |
| `7cc8cc19de77.jpg` | 1408×768  | "GROUP MANAGEMENT" UI with an elf girl                             | group management                                  | **no** — UI baked in                                                                         |
| `af4a04c786de.jpg` | 1408×768  | "GROUP MANAGEMENT" UI with an owl                                  | group management                                  | **no** — UI baked in                                                                         |
| `547d13c42bae.jpg` | 1024×1024 | Realistic boy writing, circle on white                             | teacher dashboard                                 | **no** — off-style, white corners                                                            |
| `9366a3ebb5a6.jpg` | 1408×768  | Realistic young man portrait                                       | teacher dashboard                                 | **no** — off-style                                                                           |
| `84189b0d0435.jpg` | 768×1376  | Photograph-like girl with a tablet                                 | teacher dashboard                                 | **no** — off-style                                                                           |

Where a screen shows an image marked **no**, the route uses the nearest clean asset of the set (for
example the clean library illustration for the story states) and the difference is recorded in that
screen's visual QA notes.

## Other folders

- `01_APPROVED_SCREENS/*/screen.png`, `02_STORY_STATES/*/screen.png` — references for visual QA only.
  Widths 298–1600 px at height 1600: full-page captures scaled down, so comparisons are done against
  the original `code.html` rendered at 390 px (see `docs/visual-qa/README.md`).
- `04_VISUAL_REFERENCES/` — 9 reference images (1024–1536 px, no alpha). Mood and identity reference.
- `06_LATEST_SCREENSHOTS/` — 10 Stitch workspace screenshots (RGBA but fully opaque, with Stitch UI
  chrome). Identity reference only; never cropped into sprites.

## Equipment layers (Gate 4)

The owner chose offline extraction (2026-10-25): the originals in `design-source/` are only read;
processed files go elsewhere; layers are transparent WebP; nothing is keyed at runtime; whatever cannot
be extracted or fitted is `NEEDS_ART_ASSET`, not replaced by something else.

**Pipeline** (all local, free: `sharp` only).

1. `scripts/extract-layers.mjs` cuts each source's studio background into true alpha and writes a
   master to `art/layers/` (not in git; rebuilt from `design-source/`). Background is what a flood from
   the border reaches in small colour steps; the background colour is estimated locally and un-mixed
   from the rim, so there is no dark halo; specks under 0.5% of the figure are dropped. Per source:
   `step`/`limit` (how far the flood may go), `holes` (seeds inside enclosed background), `soft` +
   `luma` (a brightness matte for glows), `glass` (tinted lenses kept at 30% opacity, so the eyes show).
2. `scripts/build-layers.mjs` splits a master into back and front parts where the item wraps the
   hero, crops them, and writes `public/images/layers/*.webp` and `lib/content/layers.json`; then it
   derives the other heroes' fits from the cat's (below) and writes every QA sheet in
   `docs/visual-qa/equipment/`.
3. `lib/content/rig.json` places each layer on a 1024×1280 rig: one fit (x, y, scale) per item and
   hero. `lib/content/figure.ts` draws the stack in the app, back to front: outerwear back, back-slot
   back, neck back, headwear back, **body**, outfit, outerwear front, back-slot front, neck front, face,
   headwear front, held item, companion.

**Splits.** Witch hat: the dark inside under the brim goes behind the head. Ceremonial cape: collar and
red lining behind the body. Star amulet and moon pendant: the cord above the bail behind the collar.
Forest hood: its dark inside behind the head, so the face shows through it. Star crown: the far side of
the band, above the front band's scalloped edge, behind the head. Satchel: the strap's upper end
behind the shoulders. Green cape: the inside of its collar ring. Everything else (glasses, bow, held
items, companions) is one front layer.

**Six heroes.** All six bases share the same chibi body (tunic, belt, boots) and differ in the head.
The cat's 19 fits were placed and checked by eye; the other heroes' are derived from them through
anchors measured on each base (`rig.json` "anchors": eyes, head top and width, neck, shoulders, paws,
feet): headwear moves with the head, glasses with the eyes, held things with the paw, companions with
the feet line, the rest with the neck. `rig.json` "tweaks" correct single cases seen on the sheets: hats
and crowns sink into the boy's and girl's hair, the owl's hat is 14% smaller so it stays on the canvas,
the forest hero's hat sits lower between the horns. Every hero stands on the same feet line.

**Checked by eye** (`docs/visual-qa/equipment/`, regenerated by `node scripts/build-layers.mjs`):
the cat's 8 looks of the first slice (`cat-eight-looks.png`, `cat-full-on-checker.png` on a light
checkerboard for halos), every item on every hero (`<hero>-every-item.png`), six looks that combine
every slot on every hero (`<hero>-combinations.png`). `tests/equipment.test.ts` checks the draw order,
that every item but the ones below is drawn on every hero, and that no layer leaves the rig.

Known residual: a 1–2 px dark rim can show on light backgrounds; the app's backgrounds are dark.

### Blender

The glow sprite is modelled after the Stitch companion in Blender (`blender/sprite.blend`, in git) and
rendered with true alpha to `blender/sprite.png`: body, face, antennae, wings with veins, a halo plane
whose alpha falls off radially, sparks. `extract-layers.mjs` takes the render as it is (`rendered: true`),
only measuring it. To change it: open the .blend, edit, render (F12) over `blender/sprite.png`, then
`node scripts/extract-layers.mjs sprite` and `node scripts/build-layers.mjs`.

### NEEDS_ART_ASSET

| Item                                        | Why it cannot be fitted                                                                                                                                                                                                                                         | What needs to be drawn                                                                                                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `violet-robe`, `violet-tunic`, `brown-coat` | Drawn for human proportions: neck to hem ≈ 1.8–2.4× the shoulders; the chibi torso is ≈ 0.8× its shoulders. Fitted by the shoulders, they cover the legs and run off the canvas; fitted by the length, they are half the hero's width (`cat-garments-fit.png`). | The garment on the chibi body: shoulders as wide as the base's (≈ 300 px on a 1024 master), hem at the base's tunic hem, sleeves on its short arms; front view; transparent background; a separate back part (lining, collar) where it wraps. |
| `midnight-cloak`                            | Drawn with the hood up and empty; the hood is a third of the heroes' head width, so it hangs at the chest (`cat-garments-fit.png`).                                                                                                                             | The cloak with the hood down on the shoulders (or a hood sized for the chibi head, split into back and front), body cut to the chibi proportions as above.                                                                                    |
| `ceremonial-cape` (fit)                     | Shipped, as a compromise: its long, narrow shape cannot both cover the chibi shoulders and end at the feet; the mantle sits narrower than the tunic's shoulders (`cat-cape-scales.png`).                                                                        | Optional: a cape drawn for the chibi body, mantle as wide as the shoulders.                                                                                                                                                                   |

Worn items that are not drawn are listed under the wardrobe's figure ("Пока не нарисованы на фигуре"),
never faked.

## Used by the app (Gate 2)

`scripts/import-images.mjs` is the full list, with the source of each file. Characters: the six base
models (`characters/*.webp`). Items: all 12 accessories, 6 outfits and 6 companions (`items/*.webp`),
as card pictures only. Screen illustrations: the clean remote images marked "yes" above. Nothing with
interface or lettering painted in is shipped.
