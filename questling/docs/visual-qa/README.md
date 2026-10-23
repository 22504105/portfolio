# Visual QA

Each screen is compared against its Stitch export, not against a memory of it. `npm run visual`
(`scripts/visual-compare.mjs`) opens the export's own `code.html` and the app route in the same Chrome
at 390×844, captures the full page, and writes four images per screen:

- `reference.png` — the export, its lh3 images served from `design-source/remote-assets`;
- `app.png` — the app route, with the demo badge hidden;
- `diff.png` — differing pixels in red;
- `side-by-side.png` — reference, app and diff next to each other.

The script needs a running production build (`npm run build && npx next start -p 3100`; `--base` points
it elsewhere). The images are regenerated, not hand-edited.

## Results (Gate 1, Next 16.4.2, Chrome, 2026-10-23)

| Screen | Export | App route | Size | Differing pixels |
|---|---|---|---|---|
| `home` | `01_APPROVED_SCREENS/02_home_2` | `/demo/home` | 390×844 | 0.00% |
| `player` | `01_APPROVED_SCREENS/05_story_player_2` | `/demo/play`, option selected | 390×902 | 1.36% |
| `player-correct` | `02_STORY_STATES/05_story_player_50_xp` | `/demo/play`, after a correct check | 390×1045 | 1.89% |
| `player-incorrect` | `02_STORY_STATES/05_story_player_3` | `/demo/play`, after a wrong check | 390×1304 | 4.72% |

Page heights match the exports exactly on every screen, so no block is missing, added or resized.

## Known deltas

All remaining differences are accounted for; none is a layout difference.

- **Parchment quote and explanations — Gelasio instead of Georgia.** The approved screenshots render
  these in Georgia, which is not free to serve. Gelasio is its metric-compatible free twin: same advance
  widths and line breaks, slightly different glyph shapes. This is most of the `player*` delta.
- **Icon antialiasing.** The app serves a subset of the same Material Symbols font the export loads
  from Google; edges of a few glyphs differ by a pixel of antialiasing.
- **`player-incorrect` — scene image.** The export's library picture has the word "ОШИБКА" painted into
  it (UI baked into the art, `docs/ASSET_AUDIT.md`). The app uses the clean `shadow-library` image and
  draws the error state in HTML. This is the largest single block of the 4.72%.
- **`player-correct` / `player-incorrect` — option glosses.** The state exports' Russian glosses under the
  options differ from the approved `05_story_player_2`; the app uses the approved screen's glosses in all
  states, so one option reads the same on every screen.

## Behaviour beyond the exports

- After a wrong answer and "Попробовать снова", the eliminated option stays in the list struck out and
  faded (`RuledOutOption`, the same look the correct-state export gives the losing options) and is no
  longer a radio. The exports do not show this state; without it the option looked choosable while the
  engine refused it. Covered by `e2e/gate1.spec.ts`.
