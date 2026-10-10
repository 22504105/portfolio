# CUT&CO — Design System

The foundation of the visual language. Tokens are defined in
`app/globals.css`; this document says what they are for. Components arrive in
Phase 02 and will be added here as they are built.

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
| Display, headings | Oswald | Condensed, uppercase, weights 500–600 |
| Text, labels | Onest | Weights 400–600 |

Both carry Cyrillic, so Russian is set in the same faces as English. Russian
runs about a fifth longer and has longer words: headings use balanced wrapping
and may break inside a word rather than overflow, and no layout may depend on
a heading fitting on one line.

| Utility | Size | Use |
|---|---|---|
| `type-display` | 52–200px | One per page |
| `type-h1` | 40–88px | Page titles |
| `type-h2` | 28–48px | Section titles |
| `type-h3` | 20–26px | Item titles |
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
