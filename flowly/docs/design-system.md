# Flowly — Design system

Direction: a thoughtful analytics tool for independent operators. Editorial
type, a charcoal sidebar against warm near-white content, one restrained
violet. Data first; no glass, no big gradients, no decoration that is not
information. Light theme only.

All values live in `app/globals.css` as tokens. Components use the names.

## Colour

| Token                                              | Value                                                                                    | Use                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------ |
| `canvas`                                           | `#F7F7F4`                                                                                | Page background          |
| `surface`                                          | `#FFFFFF`                                                                                | Cards, inputs            |
| `surface-2`                                        | `#F1F2EF`                                                                                | Secondary surface, hover |
| `line`                                             | `#E5E7E4`                                                                                | Borders                  |
| `ink`                                              | `#20242D`                                                                                | Text                     |
| `ink-muted`                                        | `#646B77`                                                                                | Secondary text           |
| `brand` / `brand-hover` / `brand-tint`             | `#6959D9` / `#5747C2` / `#F0EEFF`                                                        | Accent                   |
| `positive` / `negative` / `warning`                | `#15846B` / `#C24F5A` / `#9A6119`                                                        | Meaning                  |
| `nav` / `nav-raised` / `nav-ink` / `nav-ink-muted` | `#171A20` / `#222630` / `#E9EAF0` / `#A3A8B5`                                            | Sidebar                  |
| `series-1…5`                                       | violet `#6959D9`, teal `#1F8A8A`, ochre `#B8862B`, slate blue `#5B7BA6`, coral `#D0766A` | Charts                   |

**Contrast review** (WCAG 2.2 AA, 4.5:1 for text):

| Pair                                   | Ratio         |                                                                     |
| -------------------------------------- | ------------- | ------------------------------------------------------------------- |
| `ink` on `canvas`                      | 14.5:1        |                                                                     |
| `ink-muted` on `canvas` / on `surface` | 5.0:1 / 5.4:1 | The brief's `#737A86` gives 4.0:1 on the canvas, so it was darkened |
| white on `brand`                       | 5.2:1         |                                                                     |
| `brand-hover` on `brand-tint`          | 6.0:1         |                                                                     |
| `positive` on `surface`                | 4.6:1         | Used on cards, not on the canvas                                    |
| `negative` on `surface`                | 4.6:1         |                                                                     |
| `warning` on `surface`                 | 5.1:1         | The brief's `#A66A20` gives 4.46:1, just under; darkened            |
| `nav-ink-muted` on `nav`               | 7.3:1         |                                                                     |

Colour is never the only signal: a change has an arrow and a sign, a status
has a word, the active page has a bar and heavier text, chart series will
differ by line style and label as well as hue.

## Type

Geist (SIL Open Font License), self-hosted by `next/font`. Tabular numerals
for every amount.

| Role                      | Class          | Size                      |
| ------------------------- | -------------- | ------------------------- |
| Landing headline          | `type-display` | 36–60 px                  |
| Section heading (landing) | `type-section` | 24–36 px                  |
| Page title                | `type-page`    | 28–34 px                  |
| KPI figure                | `type-figure`  | 30–36 px                  |
| Card title                | `type-card`    | 16–17 px                  |
| Body                      | (default)      | 14 px                     |
| Metadata                  | `type-meta`    | 12 px                     |
| Eyebrow                   | `type-label`   | 12 px, uppercase, tracked |

## Shape and space

- Radius: cards 14 px, inputs and buttons 10 px, badges full.
- Borders 1 px `line`. Shadows are rare: a hairline on cards (`shadow-card`),
  a soft lift on the landing preview and overlays (`shadow-raised`).
- Sidebar 244 px; a 68 px rail of icons from 768 px; a drawer below that.
- Top bar 72 px. Content up to 1440 px wide, padding 20 / 28 / 36 px.
- Card gaps 20–24 px.
- Touch targets at least 40 px high; 44 px for navigation.

## Shell

- **Sidebar** (dark): logo, Overview / Analytics / Customers / Transactions /
  Imports / Reports, and Settings apart at the bottom. Active item: raised
  background, white text, a slim violet bar.
- **Top bar**: where you are, the period, and in the demo a "Demo workspace"
  badge with a "Try your data" button. Below 1024 px the period and the badge
  move to a row of their own so they are always in view.
- **Skip link** first in the tab order; one focus ring everywhere.

## Motion

150–220 ms colour and transform transitions. Nothing moves on its own.
`prefers-reduced-motion` turns transitions off.

## Components

`components/ui` holds shadcn/ui components, copied in and restyled through the
tokens. `LinkButton` is a link that looks like a button (for going somewhere);
`Button` is for actions. `KpiCards` is the one implementation of the headline
figures, used by the overview and by the landing preview.
