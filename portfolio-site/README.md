# Portfolio site

A one-site portfolio of Evgeniy, Full-Stack Web Developer: a short introduction, the five projects
of this repository with screenshots, a case-study page for each, services, and contact buttons
(Telegram and email). English at `/en/`, Russian at `/ru/`; the root page picks the browser's
language. Responsive from 360 px phones to wide desktops, with light and dark colour schemes.

It is a separate application: it does not import code from the five projects and does not change
them.

## Where the content comes from

| What | Source |
|---|---|
| Case-study text | `../showcase/<project>/case-study.{en,ru}.md`, copied into `content/` by `npm run sync` |
| Screenshots | each project's `docs/screenshots/`, resized to WebP in `public/shots/` by `npm run sync` |
| Project facts (status, stack, links, tests, limitations) | `lib/projects.ts` |
| Interface text and contact details | `lib/i18n.ts` |

`content/` and `public/shots/` are committed, so the site builds on its own. After a case study or
a screenshot changes, run `npm run sync` and commit the result.

Only verified material is used: all screenshots come from the projects' demos with invented data;
every project is labelled as a concept project; there are no testimonials, client names or invented
metrics. Pricing is not shown; the contact block says that pricing and timelines are discussed
individually based on project requirements.

## Stack

Next.js 16 (App Router, static export), React 19, TypeScript, Tailwind CSS 4, marked (Markdown of
the case studies at build time), sharp (screenshot processing, development only). Fonts: Inter and
Manrope through `next/font` (self-hosted at build time).

## Local build and preview

Requires Node 20.9 or newer.

```bash
cd portfolio-site
npm install
npm run build      # static site in out/
npm run preview    # serves out/ at http://localhost:3400/
```

For editing with hot reload: `npm run dev` (http://localhost:3400/en/).

## Checks

```bash
npm run lint
npm run typecheck
npm run build
npm run check:links   # every internal page and image, every external link (needs network)
```

## Deployment

Live at https://portfolio-site-nu-brown.vercel.app (first deployed 2026-10-27). The output in `out/`
is plain HTML, CSS and images and can be served by any static host. It runs as a separate Vercel
project on the free Hobby plan, deployed with the CLI from this folder (the same way as the five
projects).

| Setting | Value |
|---|---|
| Project | `portfolio-site` in the existing Vercel team; no other project is touched |
| Root directory | `portfolio-site` (the CLI is run from it, so only this folder is uploaded) |
| Framework preset | Next.js (`vercel.json`) |
| Install / build command | `npm ci` / `npm run build` (`vercel.json`) |
| Output | static export; Vercel serves it as static files, no server functions |
| Node.js | 24.x, the Vercel default (Next.js 16 needs 20.9 or newer) |
| Environment variables | none |
| Git connection | none (disconnected on 2026-10-27): pushes and merges deploy nothing; releases are made with the CLI |
| Headers | `nosniff`, referrer policy, no framing, no camera/microphone/location (`vercel.json`) |

Deploy an update (run by the owner):

```bash
cd portfolio-site
npx vercel deploy --prod --yes --scope riddle6
```

The link to the project is stored in `.vercel/`, which is not committed. Hobby is meant for personal, non-commercial use; a personal portfolio fits it,
but check Vercel's current terms.
