# CUT&CO — Design System

The foundation of the visual language. Tokens are defined in
`app/globals.css`; this document says what they are for.

## Direction

Urban editorial: a magazine cover, not a brochure. Black pages, warm white
type, condensed capitals set very large, one loud colour used rarely. Sharp
corners, hairline rules, no shadows, no gradients, no rounded cards. It should
feel nothing like a soft architectural landing page.

## Colour

| Token | Value | Use |
|---|---|---|
| `ink` | `#0c0c0b` | The default page background |
| `coal` | `#171715` | Raised surfaces on dark |
| `iron` | `#2a2a27` | Inputs and controls on dark |
| `bone` | `#f2eee5` | Type on dark; the light surface |
| `paper` | `#faf8f3` | Raised surfaces on light |
| `signal` | `#e5532b` | The accent: one element per screen, and focus rings |

Text and borders use the semantic colours `bg`, `fg`, `muted` and `line`, which
follow the tone of the surface. The page is dark; `data-tone="light"` on a
section flips it, and everything inside follows without further classes.

| Pair | Contrast |
|---|---|
| `fg` on dark (`bone` on `ink`) | 16.9 : 1 |
| `muted` on dark | 7.2 : 1 |
| `fg` on light (`ink` on `bone`) | 16.9 : 1 |
| `muted` on light | 6.3 : 1 |
| `signal` on `ink` | 5.2 : 1 |

`signal` on `bone` is 3.2 : 1: large display type only, never body text.

## Typography

| Role | Family | Notes |
|---|---|---|
| Display, headings | Oswald | Condensed, uppercase, weight 500 |
| Text, labels | Onest | Weights 400–600 |

Headings carry no closing full stop: a title is not a sentence. Question marks
stay. The scale was brought down a step after review (2026-10-11): at its
first size the type read as shouting.

Both carry Cyrillic, so Russian is set in the same faces as English. Russian
runs about a fifth longer and has longer words: headings use balanced wrapping
and may break inside a word rather than overflow, and no layout may depend on
a heading fitting on one line.

| Utility | Size | Use |
|---|---|---|
| `type-display` | 44–144px | One per page |
| `type-h1` | 34–68px | Page titles |
| `type-h2` | 24–38px | Section titles |
| `type-h3` | 18–22px | Item titles |
| `type-lead` | 18–22px | Introductions |
| `type-body` | 16px | Text |
| `type-small` | 14px | Notes, footer |
| `type-label` | 13px, tracked capitals | Navigation, buttons |
| `type-eyebrow` | 12px, tracked capitals | Above headings |

## Space and layout

- `gutter` (20–48px) is the page margin; `Container` applies it and caps the
  width at `page` (1440px).
- `section` (72–160px) separates sections vertically.
- `header` is 72px.
- Layouts are built on a 12-column grid from `md` up and a single column below.
- Interactive targets are at least 44px in both directions.

## Motion

Quick and flat: `fast` 150ms for hover and focus, `base` 300ms for state
changes, `slow` 600ms for entrances. Nothing floats, bounces or parallaxes.
With `prefers-reduced-motion` all transitions and animations are instant.

## Accessibility baseline

- A visible focus ring in `signal` on every interactive element.
- A skip link to the main content on every page.
- The language switcher is a pair of links with `lang`, `hreflang` and
  `aria-current`; it works without JavaScript.
- `<html lang>` follows the page language.

## Components

| Component | Use |
|---|---|
| `Button`, `ButtonLink` | `signal` for the one main action on a screen, `solid` for a main action on a light surface, `outline` for the second action |
| `ArrowLink` | "See more" at the end of a section |
| `PageHeader` | The top of every inner page: eyebrow, one large title, a line under it |
| `Photo` | A photograph from the set, cropped to its frame; an empty captioned frame until the file is supplied |
| `PriceList` | Services as ruled rows, read like a menu. Never cards |
| `OpeningHours` | The week as a ruled list |
| `BookingCallout` | The light closing section of the inner pages |
| Choice rows | In the booking wizard: a native checkbox or radio button, visually hidden, with its label as the row |

Patterns that hold across pages:

- Lists are ruled rows with hairlines, not grids of boxes.
- A page alternates dark and light sections; a light section is `data-tone="light"`.
- A visually hidden input needs a positioned parent (`relative`), or it widens the page.

## Offline page and application icons

`public/offline-en.html` and `public/offline-ru.html` are self-contained: they
cannot count on any file of the site, so they use system typefaces and repeat
the palette (ink, bone, signal) and the uppercase heading by hand. Change the
palette here too if it changes. The icons (`public/icons`, `app/apple-icon.png`)
are drawn from one shape by `scripts/make-icons.mjs`; the maskable icon keeps
the mark inside the central three fifths.
