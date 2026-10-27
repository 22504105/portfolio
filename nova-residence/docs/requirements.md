# NOVA Residence - Product requirements

The specification the site was built against. The visual rules that grew out
of it are in [`design-system.md`](design-system.md).

## Product

A single-page website for a fictional premium residential development in
Istanbul, Türkiye. It is a concept project, not a real client or property, and
says so on the page.

- **Audience**: affluent and international home buyers, investors,
  professionals looking for premium housing in Istanbul.
- **Business goal**: requests for private viewings.
- **Primary action**: Book a Private Viewing. **Secondary**: Explore
  Residences.
- **Message**: "A new perspective on Istanbul living. Contemporary residences
  designed around space, light and the city."

## Design direction

Restrained and editorial, in the spirit of architecture studios, hospitality
and high-end property sites. The site should feel expensive through
typography, spacing, photography, composition, hierarchy and motion, not
through decoration: no gold, heavy gradients, glassmorphism, glowing elements,
oversized pill buttons or cards everywhere. It must not read as a template or
a component-library demo.

- Typography is a main visual element: an editorial display face for
  headlines, a clean sans-serif for interface and body text, fluid sizes.
- A neutral palette: warm off-white, charcoal, muted stone, warm grey.
- Generous whitespace, asymmetric editorial layouts.

## Sections

Header with navigation (Residences, Architecture, Location, Gallery, Contact)
and a "Book a Viewing" action, compact on scroll, full-screen menu on phones;
hero; introduction; residences with details and floor plans; architecture;
amenities; location with travel times; gallery with a lightbox; viewing
request form; footer.

## Interaction and quality

- Motion that is restrained and switches off with `prefers-reduced-motion`.
- Keyboard accessible: native dialogs, managed focus, visible focus states.
- Fully responsive, designed for phones as well as desktops.
- The contact form validates and shows submitting and success states; it
  sends nothing (concept site).

## Technology

Next.js (App Router), TypeScript, Tailwind CSS, Motion. No UI kit, no
backend; the page is statically prerendered and hosted on Vercel.
