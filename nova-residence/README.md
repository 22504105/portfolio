# NOVA Residence

A concept website for a fictional premium residential development in Istanbul.

**This is a concept portfolio project and is not affiliated with a real property development.**

**Live demo:** https://nova-residence-five.vercel.app

## Overview

A single-page site for an imagined residential project on the hillside above
Beşiktaş. The goal was the kind of site a studio would build for a property
developer: restrained editorial design carried by typography, spacing and
photography rather than decoration, with a clear path to one action — requesting
a private viewing.

All photography was generated for the project and shows one consistent, fictional building.

## Features

- Hero with the wordmark set directly on the photograph's sky, with separate
  frames for landscape and portrait screens
- Residences with a detail drawer: photograph, facts, description and a floor
  plan drawn from data
- Editorial gallery with a full-screen lightbox: keyboard, swipe and a counter
- Stylised location map with travel times
- Viewing request form with validation, a submitting state and a success
  state (the request is simulated — nothing is sent)
- Fixed header with the current section marked, and a full-screen mobile menu
- Scroll reveals and light parallax that switch off with `prefers-reduced-motion`
- Keyboard-accessible throughout: native dialogs, managed focus, visible focus states

## Technology

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Motion

No UI kit, icon library or backend. The page is statically prerendered.

## Screenshots

![Hero: the wordmark set on the sky above the building](docs/screenshots/hero.jpg)

![Residence details drawer with photograph and facts](docs/screenshots/residence-details.jpg)

![Editorial gallery on the dark tone](docs/screenshots/gallery.jpg)

![Viewing request form](docs/screenshots/contact.jpg)

<p>
  <img src="docs/screenshots/mobile-hero.jpg" alt="Hero on a phone" width="300">
  <img src="docs/screenshots/mobile-residences.jpg" alt="Residences on a phone" width="300">
</p>

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run images -- <folder>` | Rebuild `public/images` from the raw renders |

## Deployment

The site deploys to Vercel with the default Next.js settings and needs no
environment variables. When it lives in a subfolder of a repository, set the
project's Root Directory to that folder.

## Structure

```
app/          Layout, global styles and tokens, fonts, page
components/   layout/ — header, navigation, footer
              sections/ — one file per page section, plus their dialogs
              ui/ — shared primitives
data/         All copy, facts, floor plans and the image registry
lib/          Small helpers and motion constants
public/images Photography, grouped by section
docs/         Design system, screenshots
```

The design system is described in [`docs/design-system.md`](docs/design-system.md).

## Concept disclaimer

NOVA Residence does not exist. The name, prices, figures and imagery are
invented for this portfolio piece, and any resemblance to a real development is
coincidental. The contact form does not collect or send data.
