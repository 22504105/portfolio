# NOVA Residence

**A premium real-estate website that sells the place before the first visit.**

**Live demo:** https://nova-residence-five.vercel.app ·
**Code:** https://github.com/22504105/portfolio/tree/main/nova-residence

**Role:** Full-Stack Developer responsible for implementing application functionality,
integrating frontend and backend components, and testing the resulting software.

## Overview

A one-page marketing website for a fictional premium residential development in Istanbul. It
presents the building, its residences and the neighbourhood to buyers and investors and leads them
to one action: requesting a private viewing. A concept project; the development does not exist.

## Problem

Property developers need a site that sells a place before it can be visited. It has to feel
premium without the usual clichés (gold, gradients, stock templates), stay fast on a phone, and
keep the visitor moving toward a viewing request instead of getting lost in effects.

## Key features

- Hero with separate crops for landscape and portrait screens
- Residences with detail drawer and data-driven floor plans
- Editorial gallery with full-screen lightbox
- Location map with travel times
- Viewing request form with validation and confirmation states
- Section-aware fixed header, full-screen mobile menu
- Reduced-motion support, keyboard access throughout

## Design and user experience

Editorial and restrained: the photography carries the warmth while the interface stays quiet.
A light Newsreader serif for headings and Hanken Grotesk for text, with no gradients, shadows or
rounded corners. The first screen has separate image crops for landscape and portrait screens, the
mobile menu takes the full screen, the gallery works with the keyboard and with swipes, and motion
switches off for visitors who prefer reduced motion.

## How it works

A restrained editorial site where typography, spacing and photography carry the brand. Residences
open in a detail drawer with facts and a floor plan drawn from data; a gallery opens in a
full-screen lightbox; a stylised map shows travel times; every section ends close to the
"Book a Viewing" action. Motion is light and switches off for visitors who ask for reduced motion.

## What was built

- Design system: palette, type scale, spacing, motion rules (`docs/design-system.md`).
- Page sections as components, with all copy, facts and floor plans in data files.
- Interactive parts: residence drawer, gallery lightbox with keyboard and swipe, mobile menu,
  validated viewing form with submitting and success states.
- Image pipeline that processes source renders into consistent, responsive images.
- Accessibility pass (native dialogs, focus management, visible focus) and deployment to Vercel.

## Technology

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Motion. Statically prerendered; no
backend, no UI kit.

## Technical challenges

- **A wordmark that sits on the sky at every size.** The hero uses separate image frames for
  landscape and portrait screens so the title never covers the building.
- **Floor plans without image files.** Plans are drawn from data, so they stay sharp at any size
  and change with the content.
- **Accessible dialogs.** The residence drawer and lightbox use native dialogs with managed focus,
  keyboard navigation and swipe on touch screens.

## Screenshots

See [`screenshots.md`](screenshots.md).

## About this demo

A concept site for a fictional development. The viewing request form shows its validation and
confirmation states; in this showcase it does not send requests.

## Short summary

A premium real-estate landing page for a fictional Istanbul development: editorial design,
residences with floor plans, gallery and a viewing request form. Built with Next.js, TypeScript,
Tailwind CSS and Motion; fast, responsive and accessible.

## Contact

Evgeniy, Full-Stack Web Developer

- Telegram: [@Maybemol](https://t.me/Maybemol)
- Email: [evgeniyshade@gmail.com](mailto:evgeniyshade@gmail.com)
- GitHub: [github.com/22504105](https://github.com/22504105)

Pricing and timelines are discussed individually based on project requirements.
