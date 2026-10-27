# NOVA Residence — design system

The working reference for everyone building the site. `docs/requirements.md` outranks this
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
| `type-brand` | The short NOVA mark in the header and mobile navigation |
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

`type-display` is sized in container units: put it inside an `@container` element and
it fills that measure (two lines, "RESIDENCE" at about 85% of the width). For another
line length set `--display-size`, as the footer does for the one-line wordmark.

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
colour: active, selected, success and error states are shown with weight,
underline, a rule or a small solid mark, and the focus ring is `ink`.

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

The hero is the one place where type sits on a photograph without a scrim: both hero
frames keep a clear sky, and the wordmark and header are set on it in ink (the base
tone). The headline, copy and calls to action sit on the page colour below the image.
If a hero frame is replaced, it needs the same clear sky above and left of the building.
The wide frame is used on landscape viewports and the tall one on portrait; the `wide:`
variant follows the same condition, so layout that depends on the frame uses it rather
than a width breakpoint.

Dialogs (mobile navigation, residence details, lightbox) open in the browser's top
layer, outside the page's tones. `Dialog` takes a `tone` and sets it on the element;
the content inside paints its own `bg-bg`.

### Stacking

The header is the only stacked element on the page: `z-(--z-header)`. The mobile
navigation, the residence details and the lightbox are native modal dialogs, which
the browser puts in its top layer above everything, so they need no z-index;
`--z-nav` and `--z-overlay` remain for anything that cannot be a dialog. Do not
invent other levels.

The header is fixed and `--spacing-header` (4.5rem) tall in every state, its bottom
hairline included, because anchors scroll to that offset. It is transparent only at
the very top of the page, over the hero sky; from the first scroll it is a solid bar
in the base tone, also over dark sections. `HeaderShell` marks the scrolled state
with `data-scrolled`, which children read through `group-data-scrolled/header:`. The
NOVA mark is `invisible` in the top state — the hero wordmark is right below it — and
keeps its space, so nothing moves when it appears.

Scroll lock is CSS: `html:has(dialog[open])` hides the page's overflow, and
`scrollbar-gutter: stable` keeps the width of a classic scrollbar so nothing shifts.
Under a dark dialog that gutter takes `--tone-inverse-bg`, the one definition of the
inverse background. Scrolling panels inside a dialog take `overscroll-contain`.

## Layout

- `Container`: max width 90rem (`narrow`: 56rem), side gutter `clamp(1.25rem, 5vw, 5rem)`.
- `grid-editorial`: 4 columns below 48rem, 8 from 48rem, 12 from 64rem.
  Place children with `col-span-*` and `col-start-*`.
- Section spacing: `py-section-sm`, `-md`, `-lg` (via `<Section space>`).
- `bleed-left` / `bleed-right` pull an element to the viewport edge.
- Breakpoints are Tailwind's defaults. Review at 360, 390, 768, 1024, 1280, 1440.
- The 8-column grid (768–1023) gets compositions of its own, not the mobile stack
  enlarged: pairs of 5 + 3 or 4 + 4 with one of the two starting lower, and one frame
  per section running wide alone.
- The three figures of the introduction are equal thirds, which the 8-column grid
  cannot give: that row is its own three-column grid with the editorial gaps.

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
- `Reveal` renders hidden until scrolled into view; content jumped over by an
  anchor link is shown at once. Its variant follows the role of the element:

  | Variant | Use |
  |---|---|
  | `rise` (default) | The eyebrow-and-heading block of a section; the lead paragraph, `delay={STAGGER * 2}` after it; the residence cards, staggered |
  | `fade` | Content that should not move: the figures, the map |
  | `image` | The one large photograph of a section, unveiled from its bottom edge |

  Not revealed: the hero, the header and footer, the contact form, body
  paragraphs, captions, and photographs other than the three large ones. Only
  opacity, vertical movement and the vertical unveiling are used — a horizontal
  offset on a frame that bleeds to the edge would make the page scroll sideways.
- `Parallax` is for two or three large photographs at most (today: Introduction and
  the first Architecture image). Wrap a `Photo` with `h-full`; the frame takes the
  aspect ratio. It is off under `useReducedMotion()`: scroll-linked values are not
  covered by the global setting.
- Photographs that open something enlarge slightly on hover: put `group/photo` on
  the interactive element around a `Photo`.
- Overlays open at `slow` and close at `base`, both `inOut` — `Dialog` does this;
  panels that also move use its `DIALOG_TRANSITION`.
- The loaded feature set (`domAnimation`) has no drag or layout animation. Gallery
  swipe uses pointer events and a motion value; do not switch to `domMax` without
  Lead approval.
- Reduced motion is handled globally (`MotionConfig reducedMotion="user"` plus a
  CSS rule); nothing may depend on an animation having run. That CSS rule gives
  every property a near-instant transition, `visibility` included: an element that
  must take focus in the same frame it reappears is hidden with opacity and
  `inert`, not with `invisible`.

## Components

`components/ui`: `Container`, `Section`, `Button`, `TextLink`, `Photo`, `Reveal`,
`Parallax`, `Dialog`, `CloseButton`, `MotionProvider`. Sections go in
`components/sections`, header and footer in `components/layout`. Components are
server components unless they need state, effects or motion.

Client components are small leaves around server-rendered children. They never
import `data/residences.ts`, `data/gallery.ts` or `data/images.ts` — what they need
arrives as props or as rendered children — so the photography registry stays out
of the client bundle.

- `Dialog`: the one overlay primitive, a native modal `<dialog>` driven by `open`.
  The browser provides the focus trap, the inert page and the return of focus;
  `Dialog` adds the fade, keeps the element open until the exit has played
  (Escape and the Android back gesture included), starts focus on the first
  button — make that the `CloseButton` — and calls `onExited` once focus is back
  on the page. `scrim` dims the page behind a panel (`ink` at 70%) and closes on
  click.
- `CloseButton`: the close control of every overlay.
- `Section` with an `id` can take focus by script (`tabIndex={-1}`, no ring), which
  is how the mobile navigation hands the keyboard on to the section it opens.

- `Button`: `variant` `solid` | `outline`, `size` `md` (48px) | `lg` (56px); renders a
  link when given `href`, otherwise a button. Swaps fill and outline on hover.
  `disabled` and `aria-disabled` share one quiet style; use `aria-disabled` plus
  `aria-busy` on a submit button so it keeps focus while a request runs.
- `Photo`: a photograph from the registry in a frame; give the frame an aspect ratio
  or height through `className` and always pass `sizes`.
- Every section opens with a `type-eyebrow` label and a `type-h2` heading that names
  the section (`<Section labelledBy>`). Headings are never centred.
- `cn()` only joins class names. Do not pass two utilities for the same property;
  wrap the element instead (as the header does to hide its button on small screens).
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

## Interactions

- Navigation: the desktop item of the section crossing the middle of the viewport
  is marked (`aria-current="location"`, the hover underline held); sections without
  an item mark nothing. A link in the mobile navigation moves the page at once
  behind the overlay, which then fades to reveal the section.
- Residence details: a drawer over the right two-thirds from `lg`, a full-screen
  sheet below. The panels are rendered on the server (`ResidencePanel`) and handed
  to the client drawer by id. The whole card opens it; the card's button is the
  control for keyboard and assistive technology.
- Floor plans are data (`floorPlan` on each residence, in metres: exterior walls,
  partitions, glazing, doors, terraces, kitchen fittings and the rooms with their
  areas) drawn by `FloorPlan` in `currentColor` and the token colours: heavy outer
  walls, thin partitions, door leaves with their swing, a double line for glass,
  terraces as a `surface` zone, a five-metre scale bar and the interior total. The
  view is at the bottom of every plan, and the room areas add up to a figure inside
  the residence's area range.
- "Request a viewing" reaches the contact form through `ViewingRequestProvider`
  (mounted in `app/page.tsx`): the drawer closes, the form selects the residence,
  scrolls into view and puts focus in Name.
- Lightbox: full-screen, inverse tone, photographs shown whole and never wider
  than their file. Arrow keys, the two text controls and a horizontal swipe or
  drag turn the page; the gallery loops. From `md` the counter is in the top bar
  and the caption and controls in a bar at the bottom; below `md` caption, counter
  and controls sit directly under the photograph, and the group is centred on the
  screen.
- Contact form: validated on submit, then field by field as each error is
  corrected; a failed submit moves focus to the first invalid field. All messages
  and labels are in `data/contact.ts`. An error has no colour of its own: the
  message is `ink` at medium weight behind a 6px solid square, an invalid field
  takes a 2px `ink` underline, an invalid group of choices an `ink` outline, and
  one summary line above the button (`role="status"`) stays until every field is
  corrected. After a successful submit the thank-you note keeps the height of the
  form from `lg`, where the photograph stands beside it; below `lg` the column
  closes up around the note.
