# NOVA Residence — design system

The working reference for everyone building the site. `docs/brief.md` outranks this
file; this file outranks personal preference. Tokens live in `app/globals.css`.

## Principles

- The photography is the warmest thing on the page. The interface around it is
  near-neutral, quiet and flat.
- The site feels expensive through type, spacing and composition — never through
  decoration. No gradients, shadows, rounded corners, glass, glow or gold.
- Radius is 0 and there are no shadows: both scales are removed from Tailwind.

## Typography

| Family | Role | Loaded as |
|---|---|---|
| Newsreader (variable, optical size) | Display and headings | `font-display` |
| Hanken Grotesk (variable) | Body and interface | `font-sans` (default) |

Newsreader at light weight and large optical size gives a thin, disciplined serif
that cools the warm imagery; Hanken Grotesk is neutral without being the default
choice. No italics are loaded — do not use italic for emphasis.

Set type with the role utilities, not with Tailwind's `text-*` sizes:

| Utility | Use |
|---|---|
| `type-display` | The NOVA RESIDENCE wordmark only (uppercase) |
| `type-h1` | One per page: the hero headline |
| `type-h2` | Section headlines |
| `type-h3` | Item titles (a residence, an amenity) |
| `type-stat` | Large figures: 124, 2027, 24/7 |
| `type-lead` | Opening paragraph of a section |
| `type-body` | Running text (the page default) |
| `type-small` | Captions, meta, form help |
| `type-eyebrow` | Uppercase section labels |
| `type-label` | Buttons, links, navigation (uppercase) |

Newsreader is for `type-h3` and larger. Everything smaller is Hanken Grotesk.

Turkish names: `text-transform: uppercase` turns "Beşiktaş" into "BEŞIKTAŞ" unless
the element has `lang="tr"`. Data marks such names with `lang: "tr"`; pass it on.

## Colour

| Token | Value | Use |
|---|---|---|
| `bg` | `#f3f1ec` | Page background |
| `surface` | `#e7e4dc` | Alternate band, image placeholder |
| `ink` | `#1a1c1a` | Primary text (15.2:1 on bg) |
| `ink-secondary` | `#484b46` | Supporting text (7.9:1) |
| `ink-muted` | `#62655e` | Labels, captions (5.3:1) |
| `line` | `#d3cfc5` | Decorative hairlines |
| `line-strong` | `#7f827a` | Field and control borders (3.5:1) |

The palette is closed — Tailwind's default colours are removed. There is no accent
colour: active, selected and success states are shown with weight, underline, a
rule or an icon, and the focus ring is `ink`.

### Tones

A tone re-points the tokens for everything inside it, so components have no light
and dark variants. `text-ink` is always the readable colour of the current surface.

| `data-tone` | Where | Effect |
|---|---|---|
| `base` | Default; also restores the light palette inside a dark ancestor | Light page |
| `surface` | Alternate band | Background becomes `surface` |
| `inverse` | Dark sections | Dark background, light text |
| `image` | Content laid over a photograph | Light text at full strength |

`<Section tone="…">` sets the first three. Place photographs on `bg` or `inverse`,
not on `surface`.

Over a photograph set `data-tone="image"` on the wrapper, which sets no background
of its own. Light skies in the photography do not carry light text: each such
composition needs a scrim behind the text (`bg-bg/60` or stronger, or a gradient
sized to the text area) and must be checked to reach 4.5:1 against the actual image.

Anything rendered in a portal (dialog, lightbox, mobile navigation) sits outside the
page's tones: its root element must set its own `data-tone` and `bg-bg text-ink`.

### Stacking

Three levels exist above page content: `z-(--z-header)`, `z-(--z-nav)` for the
mobile navigation and `z-(--z-overlay)` for dialogs and the lightbox. Do not invent
others. The header is `--spacing-header` (4.5rem) tall or less in every state,
because anchors scroll to that offset.

## Layout

- `Container`: max width 90rem (`narrow`: 56rem), side gutter `clamp(1.25rem, 5vw, 5rem)`.
- `grid-editorial`: 4 columns below 48rem, 8 from 48rem, 12 from 64rem.
  Place children with `col-span-*` and `col-start-*`.
- Section spacing: `py-section-sm`, `-md`, `-lg` (via `<Section space>`).
- `bleed-left` / `bleed-right` pull an element to the viewport edge.
- Breakpoints are Tailwind's defaults. Review at 360, 390, 768, 1024, 1280, 1440.

Asymmetry comes from the grid: text blocks of four or five columns with an offset
start, images in unequal pairs (7/5, 8/4), one image per section running to the
edge. On mobile alternate full-bleed frames with narrower ones rather than stacking
everything at full width.

## Motion

Slow, controlled, sparse. Constants in `lib/motion.ts` mirror the CSS variables.

| | Value | Use |
|---|---|---|
| `ease-quiet` / `EASE.out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Entrances, hovers |
| `ease-quiet-in-out` / `EASE.inOut` | `cubic-bezier(0.65, 0, 0.35, 1)` | Overlays, gallery |
| `--duration-fast` / `DURATION.fast` | 200ms | Colour and underline changes |
| `--duration-base` / `DURATION.base` | 500ms | Hovers, small transitions |
| `--duration-slow` / `DURATION.slow` | 900ms | Reveals, overlays |

- The library is Motion (the current name of Framer Motion). Animated elements use
  the light component: `import * as m from "motion/react-m"`. The full `motion`
  component is disabled by `MotionProvider` and throws.
- `Reveal` is the only shared motion primitive. It renders hidden until scrolled
  into view, so never wrap the hero image or headline in it.
- The loaded feature set (`domAnimation`) has no drag or layout animation. Gallery
  swipe uses pointer events; do not switch to `domMax` without Lead approval.
- Parallax must be switched off with `useReducedMotion()`: scroll-linked values
  are not covered by the global setting.
- Reduced motion is handled globally (`MotionConfig reducedMotion="user"` plus a
  CSS rule); nothing may depend on an animation having run.

## Components

`components/ui`: `Container`, `Section`, `Button`, `TextLink`, `Reveal`,
`MotionProvider`. Sections go in `components/sections`, header and footer in
`components/layout`. Components are server components unless they need state,
effects or motion.

- `Button`: `variant` `solid` | `outline`, `size` `md` (48px) | `lg` (56px); renders a
  link when given `href`, otherwise a button. Swaps fill and outline on hover.
  `disabled` and `aria-disabled` share one quiet style; use `aria-disabled` plus
  `aria-busy` on a submit button so it keeps focus while a request runs.
- `TextLink`: underlined label; `arrow` for calls to action. Renders a link when
  given `href`, otherwise a button — use that for actions such as opening a dialog.

## Content and images

- All copy and facts come from `data/`. Components do not repeat content.
- Every photograph is registered in `data/images.ts` with its alt text and an
  `object-position`. Sections take images from the registry, so a file replaced
  under `public/images` updates the whole site.
- Raw renders stay outside the repository; `npm run images -- <folder>` regenerates
  `public/images` with one shared colour grade.
- `next/image`: always give `sizes` and use `placeholder="blur"`. `priority` is
  deprecated in Next.js 16. The hero has separate desktop and mobile frames, so it
  is built with `getImageProps()` and `<picture>` with `fetchPriority="high"` —
  not with `preload`, which would load both frames.
- Source renders are about 1,100–1,800px wide. Only the two hero frames are
  upscaled for full-bleed use; keep other photographs to roughly two-thirds of the
  viewport width on desktop, or they will look soft.

## Decided for later phases

- Floor plans are drawn as SVG in Phase 03 and added to the residence data then.
- The residence dialog passes the chosen residence to the contact form.
