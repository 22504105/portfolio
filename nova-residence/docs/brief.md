NOVA RESIDENCE — COMPLETE CLAUDE WORKFLOW
=========================================
Portfolio Concept Project
Recommended usage order:
1. MASTER PROMPT
2. MULTI-AGENT WORKFLOW
3. PHASE 01 — SETUP & DESIGN SYSTEM
4. PHASE 02 — MAIN LAYOUT
5. PHASE 03 — INTERACTIONS & MOTION
6. PHASE 04 — RESPONSIVE & VISUAL POLISH
7. PHASE 05 — FINAL QA & DEPLOYMENT

IMPORTANT:
Do not send all five phase prompts at once.
Complete and review each phase before moving to the next one.


============================================================
PART 1 — MASTER PROMPT
============================================================

# NOVA Residence — Master Development Brief

You are a senior frontend engineer, UI/UX designer, and creative web developer working on a portfolio-quality commercial concept.

We are building **NOVA Residence**, a fictional premium residential development in Istanbul, Türkiye.

This is a **concept portfolio project**, not a real client project.

The final result should look and feel like a website created by a professional digital agency for a premium real-estate developer.

The website must NOT look like:
- a generic Tailwind template
- an AI-generated website
- a beginner portfolio project
- a component-library demo
- a typical corporate real-estate template

The goal is to create a polished, visually distinctive and production-quality experience that can be shown to potential freelance clients.

---

# 1. PRODUCT

Brand:

**NOVA Residence**

Location:

**Istanbul, Türkiye**

Category:

Premium residential real estate.

Target audience:

- affluent home buyers
- international property buyers
- investors
- professionals looking for premium housing in Istanbul

Primary business goal:

Generate requests for private property viewings.

Primary CTA:

**Book a Private Viewing**

Secondary CTA:

**Explore Residences**

Main brand message:

**A new perspective on Istanbul living.**

Supporting message:

**Contemporary residences designed around space, light and the city.**

---

# 2. DESIGN DIRECTION

The website should communicate:

- architecture
- exclusivity
- space
- calm
- sophistication
- modern Istanbul
- premium living

Use a restrained editorial design inspired by premium architecture, luxury hospitality and high-end real-estate websites.

Avoid stereotypical luxury design.

Do NOT overuse:

- gold
- gradients
- glassmorphism
- excessive shadows
- rounded cards everywhere
- glowing elements
- giant pill buttons
- unnecessary icons
- excessive animations

The website should feel expensive because of:

- typography
- spacing
- photography
- composition
- hierarchy
- motion
- attention to detail

—not because of decorative effects.

---

# 3. VISUAL SYSTEM

Create a coherent visual system before implementing individual sections.

## Typography

Use an elegant combination of:

- expressive editorial/display typography for major headlines
- clean modern sans-serif typography for interface and body text

Typography should be one of the main visual elements of the website.

Headlines can be very large on desktop.

Use responsive typography with `clamp()` where appropriate.

Maintain excellent readability on mobile.

## Colors

Use a restrained neutral palette.

Suggested direction:

- warm off-white
- charcoal / near-black
- muted stone
- subtle warm gray

A small accent color may be introduced if it improves the identity.

Do not make the website visually noisy.

## Spacing

Use generous whitespace.

Sections should have room to breathe.

Do not put every element inside containers or cards.

Use asymmetry and editorial layouts where appropriate.

---

# 4. PAGE STRUCTURE

Build the landing page using the following sections.

## HEADER

Desktop navigation:

NOVA

Residences
Architecture
Location
Gallery
Contact

CTA:

**Book a Viewing**

The header should initially integrate naturally with the hero.

When scrolling, it may transition into a more readable compact state.

Mobile:

Use a hamburger menu opening a polished fullscreen or large navigation overlay.

---

# 5. HERO

The hero should occupy approximately the full initial viewport.

Use a large architectural image as the main visual.

Content:

**NOVA
RESIDENCE**

Headline:

**A new perspective on Istanbul living.**

Supporting copy:

**Contemporary residences designed around space, light and the city.**

Primary interaction:

**Explore Residences**

Secondary CTA:

**Book a Private Viewing**

The hero should immediately communicate premium architecture.

Do not overcrowd it.

Use subtle entrance animation.

---

# 6. INTRODUCTION

Headline:

**Designed for the way you want to live.**

Add a short editorial description explaining the philosophy of NOVA Residence.

Show three important project facts:

**124**
Residences

**2027**
Completion

**24/7**
Concierge

These numbers should be visually prominent.

Use subtle reveal/count animations if appropriate.

---

# 7. RESIDENCES

Create three residence categories.

### 1 Bedroom

75–92 m²

From $320,000

### 2 Bedroom

110–145 m²

From $480,000

### 3 Bedroom

165–210 m²

From $720,000

Each residence should have:

- image
- bedroom count
- size range
- starting price
- View Residence interaction

Clicking **View Residence** should open a polished modal, drawer or detail experience.

Show:

- residence image
- floor plan placeholder/image
- bedrooms
- bathrooms
- area
- starting price
- short description
- CTA to request viewing

Residence information should come from structured data rather than being duplicated directly inside components.

---

# 8. ARCHITECTURE

Headline:

**Architecture shaped by light.**

Use a strong architectural image composition.

Explain the architectural philosophy using concise copy.

Possible themes:

- floor-to-ceiling windows
- private terraces
- natural materials
- daylight
- city views
- indoor/outdoor connection

The section should feel editorial rather than like a list of features.

Subtle parallax or image movement may be used.

Performance must remain good.

---

# 9. AMENITIES

Amenities:

- Private Pool
- Fitness & Wellness
- 24/7 Concierge
- Private Parking
- Residents Lounge
- Landscaped Gardens

Do NOT simply create six identical icon cards.

Use photography, typography and varied layout composition.

The section should visually contribute to the story of living at NOVA.

---

# 10. LOCATION

Headline:

**Istanbul at your doorstep.**

Position the fictional development around the Beşiktaş area.

Show approximate travel times:

Bosphorus — 5 min
Nişantaşı — 8 min
Taksim — 10 min
Galataport — 12 min
Istanbul Airport — 35 min

Create a visually elegant map experience.

A real Google Maps API integration is NOT required.

A stylized static or custom map representation is acceptable and may be preferable for the design.

---

# 11. GALLERY

Create an editorial image gallery.

Images should include:

- Exterior
- Living Room
- Bedroom
- Terrace
- Pool
- Lobby

Avoid a basic equal-sized grid.

Use varied image sizes and composition.

Clicking an image should open a fullscreen gallery/lightbox.

Support:

- next image
- previous image
- close
- keyboard interaction where appropriate

---

# 12. CONTACT / LEAD GENERATION

Headline:

**Experience NOVA privately.**

Supporting text:

**Schedule a private presentation with our sales team.**

Fields:

Name

Email

Phone

Residence interest:

- 1 Bedroom
- 2 Bedroom
- 3 Bedroom

Preferred contact method:

- WhatsApp
- Phone
- Email

CTA:

**Request Private Viewing**

Requirements:

- client-side validation
- accessible labels
- useful error messages
- loading/submitting state
- success state

After successful submission display:

**Thank you.**

**Our team will contact you shortly.**

No production backend or email integration is required for the portfolio version.

Simulate submission appropriately.

---

# 13. FOOTER

Include:

NOVA Residence

Residences
Architecture
Location
Gallery
Contact

Instagram
LinkedIn

Istanbul, Türkiye

© 2026 NOVA Residence

**Concept project**

The concept-project disclosure must remain visible.

---

# 14. RESPONSIVE DESIGN

Responsive design is a core requirement, not an afterthought.

Support:

- large desktop
- laptop
- tablet
- mobile

Pay particular attention to approximately:

390 × 844 mobile screens.

On mobile:

- maintain strong typography
- simplify layouts intelligently
- preserve whitespace
- make controls touch-friendly
- avoid horizontal overflow
- ensure gallery and residence interactions work naturally
- use a proper mobile navigation experience

Do not simply stack every desktop component vertically without considering mobile composition.

---

# 15. MOTION

Use motion carefully.

Appropriate examples:

- subtle fade/reveal
- slight vertical translation
- image scale on hover
- navigation transitions
- modal transitions
- gallery transitions
- subtle image parallax
- staggered text reveals

Animations should reinforce the premium feeling.

They should generally be slow, controlled and subtle.

Avoid:

- bouncing
- excessive spring animations
- constant movement
- dramatic rotations
- unnecessary scroll hijacking

Respect `prefers-reduced-motion`.

---

# 16. TECHNOLOGY

Use:

- Next.js
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide icons where icons are actually necessary

Deployment target:

**Vercel**

Repository:

**nova-residence**

Keep dependencies minimal.

Do not install large libraries for functionality that can easily be implemented locally.

---

# 17. ARCHITECTURE

Use clean reusable components.

Suggested structure:

app/

components/
- layout
- navigation
- hero
- residences
- architecture
- amenities
- location
- gallery
- contact
- ui

data/
- residences
- amenities
- gallery

public/
- images

Do not follow this structure blindly if a cleaner architecture becomes appropriate.

Avoid giant components.

Avoid unnecessary abstraction.

Components should be reusable where reuse actually makes sense.

---

# 18. CODE QUALITY

Write production-quality TypeScript.

Requirements:

- clear naming
- clean component boundaries
- minimal duplication
- no unnecessary complexity
- semantic HTML
- accessible controls
- proper image handling
- responsive images
- reasonable performance
- no obvious console errors
- no TypeScript errors
- no broken links
- no unused experimental code

Do not leave large amounts of placeholder code.

---

# 19. ACCESSIBILITY

Use:

- semantic HTML
- keyboard-accessible interactions
- visible focus states
- meaningful alt text
- accessible form labels
- adequate contrast
- accessible modal/gallery behavior

Accessibility should not compromise the visual design.

---

# 20. PERFORMANCE

Optimize for good real-world performance.

Use Next.js image optimization where appropriate.

Avoid unnecessarily large images.

Lazy-load below-the-fold media where appropriate.

Avoid excessive client-side JavaScript.

Do not make every component a client component unless required.

---

# 21. IMAGES

Photography is extremely important for this project.

Do NOT populate the final website with random unrelated stock images.

The visual assets should eventually represent one coherent fictional property.

We will provide/generate final NOVA Residence imagery separately.

During development, use clearly organized placeholders where final assets are unavailable.

Centralize image paths/data so replacing images later is easy.

Do not design layouts that depend on one very specific placeholder image unless necessary.

---

# 22. UX DETAILS

Pay attention to details such as:

- hover states
- active states
- focus states
- disabled states
- loading states
- error states
- successful form submission
- modal closing behavior
- Escape key behavior
- body scroll locking when overlays are open
- smooth anchor navigation
- mobile menu behavior

The site should feel finished.

---

# 23. CONTENT

Do not use Lorem Ipsum.

Write concise realistic English copy appropriate for a premium residential property.

Avoid exaggerated marketing language.

Do not repeatedly use words such as:

"luxury", "exclusive", "revolutionary", "ultimate", "unparalleled".

Prefer restrained architectural language.

---

# 24. PORTFOLIO PURPOSE

Remember that this website has two audiences.

The fictional website's audience is property buyers.

But the actual project will also be evaluated by potential clients looking at the developer's portfolio.

Therefore the project should demonstrate:

- strong visual design
- responsive frontend development
- UI/UX thinking
- animation
- component architecture
- forms
- interactive elements
- attention to detail

Do not add functionality merely to demonstrate technical complexity.

Everything should make sense for the product.

---

# 25. DEFINITION OF DONE

The project is complete only when:

- the full landing page is implemented
- desktop design is polished
- mobile design is polished
- navigation works
- residence interactions work
- gallery works
- form validation works
- success state works
- animations work
- keyboard interactions work
- there is no horizontal overflow
- there are no obvious console errors
- TypeScript/build completes successfully
- the project can be deployed to Vercel
- README explains the project
- Concept Project disclosure is visible

---

# 26. IMPORTANT WORKING INSTRUCTIONS

Do NOT immediately generate the entire application.

Do NOT rush directly into coding.

First:

1. Inspect the existing repository if one exists.
2. Understand the requirements in this brief.
3. Propose the information architecture.
4. Propose the visual direction.
5. Define the design system.
6. Define the component architecture.
7. Identify interactive/client components.
8. Identify required image assets.
9. Identify potential implementation risks.
10. Create a concise implementation plan.

Before writing implementation code, present this plan for review.

When implementation begins, work incrementally.

After each major phase:

- review your own implementation
- check responsive behavior
- check for visual inconsistencies
- check accessibility
- check TypeScript/build errors
- remove unnecessary code

Do not declare the project finished simply because all sections exist.

The standard is:

**Would a professional digital studio be comfortable showing this project to a potential client?**

If not, continue polishing.


============================================================
PART 2 — MULTI-AGENT WORKFLOW
============================================================

# MULTI-AGENT WORKFLOW

For this project, you are the **Lead Agent / Technical & Creative Director**.

You are responsible for the final quality, consistency, architecture and delivery of the NOVA Residence project.

You must create and coordinate **3 specialized subagents**.

The subagents are assistants to you. They do not independently control the project.

You remain responsible for reviewing, integrating and approving their work.

---

# SUBAGENT 1 — UI / FRONTEND SPECIALIST

Role:

Senior Frontend Developer + UI Implementation Specialist.

Primary responsibilities:

- implement page sections
- translate the design system into actual UI
- build responsive layouts
- maintain typography hierarchy
- implement grids and editorial compositions
- create reusable components
- ensure high-quality mobile layouts
- maintain consistent spacing
- implement visual states
- work with Next.js, TypeScript and Tailwind

This agent should pay particular attention to avoiding:

- generic Tailwind layouts
- repetitive card grids
- excessive rounded containers
- visually identical sections
- template-looking UI
- obvious AI-generated design patterns

The UI agent should follow the established design system rather than inventing an independent visual language.

The agent must not independently change the overall design direction without approval from the Lead Agent.

---

# SUBAGENT 2 — INTERACTION / MOTION SPECIALIST

Role:

Senior Interaction Designer + Frontend Interaction Engineer.

Primary responsibilities:

- Framer Motion
- navigation behavior
- mobile navigation
- residence modal/drawer
- gallery/lightbox
- hover states
- focus states
- scroll-based interactions
- transitions
- form states
- keyboard interactions
- body scroll locking
- reduced-motion behavior

The goal is not to maximize animation.

The goal is to make the website feel polished, deliberate and premium.

This agent must avoid:

- excessive animation
- unnecessary spring effects
- bouncing
- scroll hijacking
- animation that delays navigation
- motion that harms readability
- animation added simply because it is technically possible

Every interaction should have a clear UX purpose.

---

# SUBAGENT 3 — QA / DESIGN REVIEWER

Role:

Senior UI/UX Reviewer + Frontend QA Engineer.

This agent should primarily act as an independent reviewer.

Its purpose is to identify problems that the implementation agents may overlook.

Primary responsibilities:

- visual consistency review
- responsive review
- mobile UX review
- accessibility review
- interaction review
- TypeScript/build review
- performance review
- code-quality review
- detection of unfinished states
- detection of template-like or AI-generated design patterns

This agent should be deliberately critical.

Do not ask it to praise the implementation.

Ask it to find weaknesses.

It should look specifically for:

- inconsistent spacing
- weak typography hierarchy
- awkward line breaks
- generic layouts
- repetitive sections
- excessive cards
- excessive rounded corners
- inconsistent image treatment
- poor image crops
- mobile layouts that simply stack desktop content
- inaccessible interactions
- broken keyboard navigation
- horizontal overflow
- unnecessary dependencies
- unnecessary client components
- duplicated code
- runtime errors
- build warnings
- unfinished placeholders

The QA agent should report findings to the Lead Agent.

It should not perform large redesigns independently unless explicitly instructed.

---

# LEAD AGENT RESPONSIBILITIES

You are responsible for coordinating all three subagents.

You must maintain a coherent overall vision.

Before delegating work:

1. Understand the task yourself.
2. Decide which agent is best suited for it.
3. Give that agent clear scope.
4. Identify files or areas it is allowed to modify.
5. Prevent unnecessary overlap with other agents.

After receiving work from a subagent:

1. Review the changes yourself.
2. Verify they match the Master Development Brief.
3. Check that they match the established design system.
4. Resolve inconsistencies.
5. Run appropriate checks.
6. Only then integrate or continue.

Do not assume subagent output is correct.

You are responsible for the final result.

---

# PARALLEL WORK RULES

Parallelize work only when tasks are genuinely independent.

Good examples:

UI Agent:
builds a visual section.

Interaction Agent:
researches/plans the interaction behavior for a different completed component.

QA Agent:
reviews an already completed section.

Bad example:

Three agents simultaneously editing the same page component.

Avoid multiple agents modifying the same file at the same time.

If two tasks affect the same component or shared styles, perform them sequentially.

Protect:

- global styles
- design tokens
- shared UI primitives
- layout architecture

from uncontrolled simultaneous changes.

The Lead Agent should coordinate changes to these shared systems.

---

# SOURCE OF TRUTH

The following priority order must always be respected:

1. Master Development Brief
2. Established design system
3. Current phase instructions
4. Lead Agent architectural decisions
5. Subagent recommendations

A subagent recommendation must never silently override the Master Brief.

---

# PHASE WORKFLOW

Use the subagents differently depending on the current development phase.

## PHASE 01 — Setup & Design System

Lead Agent:
owns architecture and final decisions.

UI Agent:
may research and propose typography, layout primitives and component organization.

Interaction Agent:
reviews whether the proposed architecture will support future interactions cleanly.

QA Agent:
reviews the setup for unnecessary complexity, weak structure and potential future issues.

The Lead Agent makes the final decision.

---

## PHASE 02 — Main Layout

UI Agent:
does the majority of implementation work.

Interaction Agent:
reviews components for future interaction requirements and may prepare interaction architecture where useful.

QA Agent:
reviews completed sections for visual quality and responsive issues.

Lead Agent:
maintains consistency between sections and integrates the final page.

Do not allow each section to develop an independent visual style.

---

## PHASE 03 — Interactions & Motion

Interaction Agent:
becomes the primary implementation specialist.

UI Agent:
supports visual integration and ensures interactions remain consistent with the design.

QA Agent:
tests keyboard behavior, mobile behavior, modal/gallery UX and accessibility.

Lead Agent:
reviews and integrates everything.

---

## PHASE 04 — Responsive & Polish

The QA Agent becomes especially important.

Before making major polish changes:

Ask the QA Agent to perform a complete critical audit.

The audit should identify:

- visual problems
- responsive problems
- mobile problems
- UX problems
- accessibility problems
- template-like design
- AI-generated visual patterns

Then:

Lead Agent prioritizes the findings.

UI Agent fixes visual/responsive problems.

Interaction Agent fixes interaction/motion problems.

QA Agent performs another review after fixes.

---

## PHASE 05 — Final QA & Deployment

QA Agent:
performs the final technical and UX audit.

UI Agent:
handles remaining visual fixes.

Interaction Agent:
handles remaining interaction issues.

Lead Agent:

- reviews the entire project
- runs final checks
- verifies build
- verifies TypeScript
- verifies lint
- reviews README
- prepares deployment
- confirms the project meets the Definition of Done

---

# COMMUNICATION BETWEEN AGENTS

Subagents should return concise actionable reports.

Avoid long theoretical explanations.

For implementation tasks, report:

- what was changed
- which files were changed
- important decisions
- remaining issues

For review tasks, report findings using severity:

CRITICAL
HIGH
MEDIUM
LOW

Example:

HIGH — Mobile hero heading overflows at 390px.

MEDIUM — Residence cards repeat the same visual pattern used in Amenities.

LOW — Footer spacing could be more consistent.

The Lead Agent decides what should actually be fixed.

---

# DESIGN REVIEW PRINCIPLE

The QA Agent should repeatedly ask:

**Does this look intentionally designed, or does it look generated?**

If something looks generated, identify exactly why.

Examples:

- predictable alternating sections
- repeated three-column cards
- excessive use of rounded rectangles
- generic gradient backgrounds
- unnecessary badges
- excessive icon usage
- identical reveal animations
- artificial marketing copy
- inconsistent visual hierarchy

The goal is not to remove all patterns.

The goal is to make the website feel deliberately art-directed.

---

# AUTONOMY

You may delegate tasks to the three subagents without asking for permission every time.

However:

Do NOT make major changes to the product requirements.

Do NOT remove major sections from the Master Brief.

Do NOT change the technology stack.

Do NOT introduce a backend.

Do NOT introduce paid services.

Do NOT add unnecessary features.

Do NOT replace the overall visual direction.

If a major deviation appears necessary, explain it before implementing it.

---

# IMPORTANT

Do not create additional subagents unless there is a genuinely exceptional technical reason.

The intended structure is:

**Lead Agent**
↓
**UI / Frontend Agent**
**Interaction / Motion Agent**
**QA / Design Reviewer**

Four agents total including you.

The objective is not maximum parallelism.

The objective is:

**higher quality through specialization while maintaining one coherent creative direction.**

You, the Lead Agent, are always responsible for the final result.


============================================================
PART 3 — PHASE 01: SETUP & DESIGN SYSTEM
============================================================

Continue working on the NOVA Residence project based on the Master Development Brief.

## PHASE 01 — PROJECT SETUP & DESIGN SYSTEM

Your goal in this phase is to establish a clean technical and visual foundation for the project.

Do NOT build the complete website yet.

### 1. Project setup

Inspect the current repository and configure the project using:

- Next.js
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide Icons only where necessary

Keep dependencies minimal.

Organize the project so future sections can be implemented cleanly.

### 2. Global foundation

Create:

- global styles
- typography system
- color variables/tokens
- spacing conventions
- container/grid rules
- responsive breakpoints
- reusable animation principles
- button/link styles
- focus states

Use CSS variables where appropriate.

### 3. Typography

Choose and implement the typography pairing.

We need:

- an expressive editorial/display font for large headings
- a clean modern sans-serif for body text and interface elements

Use reliable web fonts that work well with Next.js.

Explain why you selected them.

### 4. Design tokens

Define the main visual tokens for:

- background
- primary text
- secondary text
- borders
- surfaces
- accent if needed

Keep the palette restrained and architectural.

### 5. Base UI

Implement only genuinely reusable primitives required by the project, such as:

- Container
- Section wrapper if useful
- Button
- Text link
- basic motion/reveal utility if appropriate

Do not create an unnecessary internal UI library.

### 6. Data structure

Prepare structured data for:

- residences
- amenities
- gallery items
- navigation

Do not hardcode repeated content throughout components.

### 7. Asset organization

Prepare the `/public/images` structure for future NOVA assets.

Use clearly named placeholders if necessary.

Do not search for or introduce random unrelated stock photography.

### 8. Quality check

Before finishing this phase:

- run TypeScript checks
- run the production build
- check for obvious warnings
- remove unused code
- verify the project starts correctly

### OUTPUT

At the end, provide:

1. A short summary of what you implemented.
2. The chosen typography and visual system.
3. The resulting project structure.
4. Any decisions that will affect later phases.
5. Any issues that need my attention.

STOP after Phase 01.

Do not start building all landing-page sections.


============================================================
PART 4 — PHASE 02: CORE PAGE & VISUAL LAYOUT
============================================================

Continue the NOVA Residence project.

Phase 01 established the technical foundation and design system.

## PHASE 02 — CORE PAGE & VISUAL LAYOUT

Your goal is now to build the complete visual structure of the NOVA Residence landing page.

Focus primarily on composition, typography, hierarchy, imagery placement and responsive layout.

Do NOT spend excessive time on complex interactions yet. Those will be handled in Phase 03.

Implement:

### 1. Header

Build the desktop header with:

- NOVA brand
- Residences
- Architecture
- Location
- Gallery
- Contact
- Book a Viewing CTA

Build the mobile navigation trigger and basic menu structure.

### 2. Hero

Create the full hero experience.

Include:

NOVA RESIDENCE

"A new perspective on Istanbul living."

"Contemporary residences designed around space, light and the city."

Explore Residences

Book a Private Viewing

The hero must establish the visual identity immediately.

### 3. Introduction

Implement:

"Designed for the way you want to live."

Include realistic editorial copy and project statistics:

124 Residences
2027 Completion
24/7 Concierge

### 4. Residences

Build the visual residence-selection section using the structured data created previously.

Include:

1 Bedroom
2 Bedroom
3 Bedroom

Show:

- image
- size
- price
- View Residence action

For now, prepare the interaction hooks but do not over-engineer the residence detail experience.

### 5. Architecture

Implement:

"Architecture shaped by light."

Use a strong editorial composition with imagery and restrained copy.

Avoid a generic image-left/text-right layout if a more interesting composition works.

### 6. Amenities

Implement all six amenities.

Do NOT use six identical icon cards.

Create a visually varied editorial composition.

### 7. Location

Implement:

"Istanbul at your doorstep."

Include:

Bosphorus — 5 min
Nişantaşı — 8 min
Taksim — 10 min
Galataport — 12 min
Istanbul Airport — 35 min

Create the visual foundation for the stylized map.

### 8. Gallery

Create the editorial gallery layout.

Use varied image dimensions and composition.

Prepare it for the fullscreen interaction that will be implemented later.

### 9. Contact

Build the complete visual form.

Include all required fields and options.

Do not implement unnecessary backend functionality.

### 10. Footer

Build the complete footer including:

"Concept project"

### RESPONSIVE WORK

Do not postpone responsive design.

While building every section, verify it at:

- large desktop
- laptop
- tablet
- approximately 390px mobile

The mobile version should be intentionally designed, not merely stacked.

### VISUAL REVIEW

After implementing the page:

Review the entire website from top to bottom.

Specifically look for:

- repetitive layouts
- generic AI-looking sections
- excessive cards
- weak typography
- inconsistent spacing
- sections that feel disconnected
- poor mobile composition

Improve them before finishing.

### OUTPUT

At the end:

1. Summarize the implemented sections.
2. Explain important visual decisions.
3. Mention any placeholders that still need final assets.
4. Report build/type-check status.

STOP after Phase 02.

Do not begin the advanced interaction phase.


============================================================
PART 5 — PHASE 03: INTERACTIONS, MOTION & FUNCTIONAL UX
============================================================

Continue the NOVA Residence project.

The visual page structure is now complete.

## PHASE 03 — INTERACTIONS, MOTION & FUNCTIONAL UX

Your goal is to make the website feel like a finished premium digital experience.

Do not redesign successful sections without a clear reason.

Focus on interaction quality.

### 1. Navigation

Implement:

- smooth anchor navigation
- scrolling header state
- active/hover states
- mobile navigation overlay
- correct menu closing behavior
- body scroll locking when mobile navigation is open

### 2. Residence Details

Implement the View Residence experience.

Use a polished modal, drawer or equivalent detail interface consistent with the visual system.

Show:

- residence imagery
- floor plan
- bedrooms
- bathrooms
- area
- starting price
- description
- viewing CTA

Requirements:

- open/close animation
- Escape closes it
- backdrop interaction where appropriate
- body scroll lock
- keyboard accessibility
- appropriate focus management

### 3. Gallery

Implement the fullscreen gallery/lightbox.

Support:

- open image
- next
- previous
- close
- keyboard arrows
- Escape
- image counter if appropriate
- smooth transitions

Do not make the gallery feel like a generic plugin.

### 4. Contact Form

Implement client-side behavior.

Validate:

- name
- email
- phone
- residence interest
- preferred contact method

Provide:

- useful validation messages
- disabled/submitting state
- simulated request delay
- success state

After success display:

"Thank you."

"Our team will contact you shortly."

No real backend is required.

### 5. Motion System

Implement restrained motion throughout the page.

Possible effects:

- section reveals
- text reveals
- image reveals
- subtle parallax
- image hover scaling
- menu transitions
- modal transitions
- gallery transitions

Do not animate everything.

Avoid repetitive identical reveal animations.

Motion should follow the hierarchy of the page.

### 6. Reduced Motion

Respect:

`prefers-reduced-motion`

The website must remain fully usable without motion.

### 7. Interaction Review

Test:

- mouse
- keyboard
- touch-friendly behavior
- modal behavior
- gallery behavior
- navigation
- form
- mobile menu

Fix interaction conflicts before finishing.

### OUTPUT

At the end:

1. Summarize implemented interactions.
2. Explain the motion approach.
3. Report any UX/accessibility decisions.
4. Report build/type-check status.

STOP after Phase 03.


============================================================
PART 6 — PHASE 04: RESPONSIVE & VISUAL POLISH
============================================================

Continue the NOVA Residence project.

The website structure and interactions are implemented.

## PHASE 04 — RESPONSIVE REVIEW & VISUAL POLISH

Do not add major new features.

Your job is now to critically review and refine the existing website.

Approach this phase as a senior designer/developer reviewing work before a client presentation.

### 1. Responsive Audit

Review the complete site at multiple viewport widths.

At minimum inspect behavior around:

- 1440px
- 1280px
- 1024px
- 768px
- 430px
- 390px
- 360px

Do not optimize only for these exact values. They are review checkpoints.

Fix:

- horizontal overflow
- awkward text wrapping
- oversized headings
- undersized controls
- broken grids
- bad image crops
- excessive whitespace
- insufficient whitespace
- navigation issues
- modal sizing
- gallery sizing
- form usability

### 2. Mobile Composition

Review mobile independently from desktop.

Ask for every section:

"Does this look intentionally designed for mobile?"

If not, redesign the mobile composition.

Do not merely stack desktop columns.

### 3. Typography Audit

Review:

- heading hierarchy
- line lengths
- line height
- font sizes
- letter spacing
- contrast
- responsive scaling

Fix anything that feels inconsistent.

### 4. Spacing Audit

Review the rhythm between:

- sections
- headings
- copy
- images
- controls
- cards
- footer elements

Create a consistent visual rhythm without making every section identical.

### 5. Image Treatment

Review:

- aspect ratios
- cropping
- object positioning
- loading behavior
- responsive behavior
- visual consistency

Ensure placeholders can later be replaced cleanly with final NOVA assets.

### 6. Premium Feel Audit

Look specifically for anything that makes the project feel:

- generic
- templated
- AI-generated
- cheap
- over-designed
- inconsistent

Correct those areas.

Pay special attention to:

- repeated card patterns
- unnecessary borders
- excessive rounded corners
- generic button styles
- excessive icons
- unnecessary decorative elements

### 7. Motion Polish

Review timing and easing.

Remove animations that do not improve the experience.

Ensure animations remain smooth and restrained.

### 8. Cross-Section Consistency

The website should feel like one designed product rather than separate generated sections.

Review transitions between sections and improve continuity.

### OUTPUT

At the end:

1. Explain the major issues you found.
2. Explain what you changed.
3. Report responsive review results.
4. Report build/type-check status.

STOP after Phase 04.

Do not add new product features.


============================================================
PART 7 — PHASE 05: FINAL QA, README & DEPLOYMENT
============================================================

Continue the NOVA Residence project.

This is the final engineering and presentation review.

## PHASE 05 — FINAL QA, PERFORMANCE, README & DEPLOYMENT PREPARATION

Do not introduce unnecessary new features.

Your goal is to make the project ready for:

- GitHub
- Vercel
- portfolio presentation
- potential client review

### 1. Functional QA

Test all important functionality.

Verify:

- navigation
- anchor links
- mobile menu
- residence details
- residence CTA
- gallery
- previous/next controls
- keyboard controls
- Escape behavior
- contact form
- validation
- submission state
- success state
- footer links

Fix anything broken.

### 2. Code Review

Review the complete codebase.

Look for:

- duplicated code
- giant components
- unused components
- unused imports
- dead code
- unnecessary dependencies
- unnecessary client components
- weak TypeScript typing
- hardcoded repeated data
- inconsistent naming

Refactor only where it meaningfully improves maintainability.

Do not over-engineer.

### 3. Accessibility Review

Verify:

- semantic landmarks
- heading hierarchy
- labels
- alt text
- keyboard navigation
- focus states
- modal focus behavior
- contrast
- reduced-motion support

Fix meaningful accessibility problems.

### 4. Performance Review

Review:

- image optimization
- image sizes
- lazy loading
- client-side JavaScript
- fonts
- animation performance
- unnecessary re-renders

Optimize where meaningful.

Do not sacrifice visual quality unnecessarily.

### 5. Metadata

Prepare appropriate:

- page title
- meta description
- Open Graph metadata
- favicon structure if assets exist

Make it clear where appropriate that NOVA Residence is a concept project.

### 6. Error Review

Run:

- lint
- TypeScript checks
- production build

Resolve errors and meaningful warnings.

Check browser console for obvious runtime errors.

### 7. README

Create a professional GitHub README.

Include:

# NOVA Residence

Short description:

A concept website for a fictional premium residential development in Istanbul.

Clearly state:

**This is a concept portfolio project and is not affiliated with a real property development.**

Include sections for:

- Overview
- Features
- Technology
- Screenshots
- Running locally
- Deployment
- Project structure if useful
- Concept disclaimer

Prepare a clear place for:

**Live Demo**

Do not write an excessively long README.

### 8. Deployment Preparation

Ensure the project is ready for Vercel deployment.

Check:

- environment requirements
- build command
- image configuration
- routes
- asset paths

There should be no unnecessary secrets or environment variables for the demo.

### 9. Final Portfolio Review

Finally, inspect the project from the perspective of a potential freelance client.

Ask:

- Is the first impression strong?
- Does the project feel commercially believable?
- Is mobile quality comparable to desktop?
- Are interactions polished?
- Are there unfinished placeholders?
- Is anything obviously AI-generated or tutorial-like?
- Would screenshots from this project look strong inside a portfolio?

Fix reasonable issues you identify.

### FINAL OUTPUT

Provide:

1. Final project status.
2. Build/lint/type-check results.
3. Any remaining limitations.
4. Instructions for deploying to Vercel.
5. Recommended screenshots to capture for the portfolio.
6. Suggested GitHub repository description.

Do not claim something was tested if it was not actually tested.


============================================================
END OF DOCUMENT
============================================================

WORKFLOW REMINDER:

Master Prompt
→ Multi-Agent Workflow
→ Phase 01
→ Review
→ Phase 02
→ Manual visual review
→ Phase 03
→ Review
→ Phase 04
→ Review
→ Phase 05
→ GitHub
→ Vercel
→ Portfolio case study

Recommended team:
- Lead Agent
- UI / Frontend Subagent
- Interaction / Motion Subagent
- QA / Design Reviewer Subagent
