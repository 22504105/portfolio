# NOVA Residence

A concept website for a fictional premium residential development in Istanbul.

**This is a concept portfolio project and is not affiliated with a real property development.**

## Status

In development. The design system and project foundation are in place; the landing
page is built in the next phase.

## Technology

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Motion

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
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run images -- <folder>` | Rebuild `public/images` from the raw renders |

## Structure

```
app/          Layout, global styles and tokens, fonts, page
components/   ui/ — shared primitives
data/         All copy, facts and the image registry
lib/          Small helpers and motion constants
public/images Photography, grouped by section
docs/         Design system
```

The design system is described in [`docs/design-system.md`](docs/design-system.md).
