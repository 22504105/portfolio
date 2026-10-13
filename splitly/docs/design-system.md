# Splitly — Design system: "calm fintech"

Warm, trustworthy, editorial, uncluttered. Forest green and mint on a warm
paper white; one typeface; amounts large and tabular. Since 2026-10-12 the
screens follow the owner's concept board (`docs/concept.md`, in Russian, says
what the board shows, what it lacks and which stage builds what). Not a crypto
dashboard: no glow, no charts where a number will do, and one gradient only,
the deep green of the concept's balance card and browser rail.

All values live in `app/globals.css` as tokens. Components use the names.

> Since 2026-10-13 the tokens follow the Google Stitch design: emerald `#075F4A` for buttons, forest
> `#173D35` for the balance card, card radius 20 px, control radius 14 px. What was ported, what was
> not, and where the design and the product disagree is in [stitch.md](stitch.md).

## Colour

| Token                    | Light                 | Dark                  | Use                                   |
| ------------------------ | --------------------- | --------------------- | ------------------------------------- |
| `canvas`                 | `#F8F7F3`             | `#111A17`             | Page                                  |
| `surface`                | `#FFFFFF`             | `#1B2923`             | Cards, fields                         |
| `surface-2`              | `#F0F1EC`             | `#24342D`             | Hover, quiet areas                    |
| `line`                   | `#E5E9E3`             | `#2C3D35`             | Dividers                              |
| `ink`                    | `#232826`             | `#F2F5F0`             | Text                                  |
| `ink-muted`              | `#5F6862`             | `#A5B5AA`             | Secondary text                        |
| `primary` / `on-primary` | `#173D35` / `#FFFFFF` | `#A7D8BA` / `#111A17` | The main button and its text          |
| `accent` / `on-accent`   | `#B9E4C9` / `#173D35` | `#2B4A3D` / `#C9ECD6` | The current item, quiet highlights    |
| `positive`               | `#1B6B4C`             | `#8FD3AB`             | "You are owed"                        |
| `danger`                 | `#B04440`             | `#F2A29D`             | "You owe", errors                     |
| `danger-fill`            | `#B04440`             | `#A8443F`             | A destructive button, with white text |
| `warning`                | `#8A5514`             | `#E6B56F`             | Demo badge, cautions                  |

**Where the brief's colours were moved, and why** (WCAG 2.2 AA asks 4.5:1 for
text):

| Brief                         | Ratio as text | Ours      | Ratio |
| ----------------------------- | ------------- | --------- | ----- |
| muted `#737C76` on the canvas | 4.0:1         | `#5F6862` | 5.4:1 |
| danger `#C75B57` on white     | 4.1:1         | `#B04440` | 5.6:1 |
| warning `#A66B26` on white    | 4.4:1         | `#8A5514` | 6.2:1 |

Canvas, forest, mint, ink, divider, and the whole dark palette are the
brief's own. `tests/foundation.test.ts` reads both palettes from the
stylesheet and checks every text pair, so a later change cannot quietly drop
below the line.

**Text colours and fills are separate tokens.** In the dark theme text gets
lighter; a fill that carries white text must not. So `danger` is for text and
`danger-fill` for a button, and the primary button turns from forest with
white text to mint with near-black text.

Colour is never the only signal: a balance has a sign and a word, the current
place in the navigation has a filled pill and heavier text, a status has a
label.

## Type

Inter (SIL Open Font License), self-hosted by `next/font`, with Latin,
Latin Extended (Turkish) and Cyrillic. System fonts as fallback.

| Role                | Class          | Size                       |
| ------------------- | -------------- | -------------------------- |
| Onboarding headline | `type-display` | 32–52 px                   |
| Screen title        | `type-title`   | 24–30 px                   |
| Card heading        | `type-heading` | 17 px                      |
| Amount              | `type-amount`  | 28–40 px, tabular numerals |
| Lead                | `type-lead`    | 16–18 px                   |
| Body                | (default)      | 16 px                      |
| Small               | `type-small`   | 14 px                      |
| Label               | `type-label`   | 12 px, uppercase, tracked  |

Body text is 16 px: smaller, and iOS zooms the page when a field is focused.

## Space and shape

- An 8 px rhythm.
- Radii: controls 12 px, cards 16 px, sheets 20 px.
- Shadows are rare and soft: a hairline on cards, a lift on the Add button
  and on overlays.
- **Touch targets at least 44 × 44 px.** Checked by a test on the phone
  layout.

## Layout

- **Phone first.** A slim top bar (mark, demo badge, language, theme), the
  screen, and a bar fixed to the bottom: Home, Groups, the Add button raised
  in the middle, Activity, Profile.
- The bottom bar and the top bar pad for the phone's notch and home indicator
  (`env(safe-area-inset-*)`), and the page leaves room so its last line is
  never under the bar.
- **From 768 px** the navigation is a column on the left with "Add expense"
  as a full button at its top, and the content keeps a reading width.
- Heights use `dvh`, so the layout follows the visible area as Telegram and
  mobile browsers show and hide their own bars.

## Themes

Light, dark, or the same as the device; inside Telegram, "the same as the
device" means Telegram's own theme. The choice is kept in the browser and
applied before the first paint, so a dark screen never flashes white.

## Languages

English and Russian, as the first part of the address. Everything a screen
says is in `lib/i18n`; a test checks that neither language is missing a key.
Receipt items keep their original text whatever the interface language.

## States

Every screen will have: loading (a skeleton shaped like what is coming),
empty (what belongs here and the one thing to do), error (what went wrong and
a way to try again), and offline. A screen that is not built yet says so and
shows the plan; it has no controls that do nothing.

## Motion

150–200 ms colour and transform transitions. Nothing moves on its own.
`prefers-reduced-motion` turns transitions off.

## From the concept

- **`hero`** — the deep green of the balance card, the plus button and the
  wide screen's rail: `#17513F → #0C392C` (light), `#1D5544 → #123A2E` (dark).
  It stays dark in both themes and always carries white text (11:1 or better).
- **The mark** is a white S on that green, drawn in `components/brand/Logo.tsx`.
- **Faces** (`components/ui/Avatar.tsx`). A person signed in through
  Telegram is shown with their Telegram photo, loaded straight from Telegram:
  Splitly keeps the address and never the picture. With no photo, or when the
  address has stopped working, and for people added by name, and everywhere in
  the demo, the face is drawn, chosen by the person's ID so that it is always
  the same. Decoration only: the name is always written beside a face.
- **Category tiles** (`components/ui/CategoryIcon.tsx`): a soft fill and a
  darker mark of the same hue per category, the same in both themes; the
  category's name is always written beside the tile.
- **Balances carry a sign and a colour** in a group's list of people
  ("+1,462.37 TRY", "-677.13 TRY"); a screen reader hears "gets back" or
  "owes". The currency is its code, not a symbol: a group can hold several.
- **Navigation**: on a phone, Home, Groups, the plus, Activity, Profile (since the Stitch design; Analytics is reached from Home and from each group); on a
  wide screen the rail adds Receipts and calls the profile Settings.
- **The cover illustration** is a vector drawing made for Splitly
  (`public/illustrations/friends.svg`), sharp at any size; nothing is cut out
  of the concept board or scaled up. Pictures are named in
  `lib/illustrations.ts`: to use a finished illustration later, add the file
  and change that one entry.
