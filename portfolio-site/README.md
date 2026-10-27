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

Not deployed. The output in `out/` is plain HTML, CSS and images and can be served by any static
host. With Vercel, a new project with this folder as its root directory would work; the deploy is
run by the owner after approval.
