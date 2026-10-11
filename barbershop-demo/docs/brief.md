CUT&CO — MASTER DEVELOPMENT BRIEF & FIVE-PHASE WORKFLOW
====================================================

HOW TO USE
1. Give this entire document to Claude Code as the project specification.
2. Ask Claude to inspect the repository and execute PHASE 01 ONLY.
3. Review each phase before explicitly authorizing the next one.
4. Never treat this file as permission to execute all five phases at once.

MASTER DEVELOPMENT BRIEF
========================

ROLE AND PRODUCT
You are the Lead Agent, technical architect, and creative director for CUT&CO, a production-oriented concept portfolio project: a full-stack responsive barbershop website, booking web application, staff/admin workspace, and installable PWA. The fictional business is in London, UK. UI languages are English and Russian (EN/RU); default English; currency USD ($) for all transactions and reporting; business timezone Europe/London. Label the project clearly as a concept, not a real operating business. Aim for a credible, polished system that a small barbershop could adapt for actual use, while making the demo safe for public visitors.

CORE USER EXPERIENCES
1. Public site: Home, Services, Barbers, Gallery, About, Contact, Book Appointment. Editorial, confident visual design: charcoal/black, warm white, refined typography, compelling imagery, no generic AI card grids. Accessible, mobile-first and fast.
2. Booking: select one or more services, select a specific qualified barber or Any Available, pick a date and start time, enter name/email/phone, submit, verify email, receive confirmation. Guest booking is supported; an account is optional.
3. Client: secure email links to confirm, view, cancel or reschedule appointments; optional registered account with upcoming appointments, history and profile. Guest management links must not disclose booking details to unauthorized users.
4. Barber: authenticated view of own calendar and upcoming clients; mark visits Completed/No-show; manage breaks and time off within admin-defined constraints. Cannot change base weekly schedule, pricing, roles, or other barbers' appointments.
5. Admin: authenticated full calendar, manual bookings, clients, services, barber profiles, service eligibility, base working hours, holidays, time off, appointment states, paid-on-site marking, reports and analytics.
6. Public demo admin: clearly labeled demo with synthetic data and limited permissions. Separate demo database/environment is preferred; no live production credentials, real personal information, real email dispatches, or destructive access. Read-only demo is acceptable; if write interactions are enabled, isolate sessions and implement reset.

BOOKING POLICY — APPROVED
- Guests can book without creating accounts; email verification is mandatory.
- Hold pending slot for 15 minutes. Expired holds must stop blocking availability even if cleanup job is delayed.
- Confirmation after expiry must fail safely and ask customer to rebook.
- Services: multiple consecutive services per appointment, all delivered by one qualified barber. Total duration = sum of service durations; snapshot service names, prices and durations in the booking so later catalog edits do not rewrite history.
- Any Available: only eligible barbers who can deliver every selected service. Select from truly available candidates, with deterministic low-utilization tie-breaking. Persist the selected barber.
- Booking horizon: up to 30 days ahead, measured in local business dates.
- Slot start interval: 30 minutes. Service durations need NOT be multiples of 30 minutes; a 65-minute service blocks the entire continuous 65-minute interval.
- Earliest start: at least 2 hours from current time.
- Client cancellation and rescheduling: allowed until 12 hours before start. Apply the same policy to both to prevent bypass. Reschedule must atomically secure the new slot before releasing the old slot, preserving audit history.
- Payment: in person only. Admin records Paid status and amount; do not claim all Completed bookings were paid. No payment gateway in v1.
- Email: verification/confirmation and reminders 24 hours and 2 hours before start. Suppress reminders for cancelled/expired appointments, and make dispatch idempotent. Email delivery failures must be observable and retryable without duplicate bookings.
- Timezone: Europe/London with DST-safe conversion. Persist instants as timestamptz and use local business dates/times for schedule generation.

LOCALIZATION & CURRENCY — APPROVED, MANDATORY FROM PHASE 01
- Full bilingual product: English (en) and Russian (ru), with an accessible visible EN/RU language switcher on public pages, booking wizard, guest management, client account, barber workspace, admin dashboard, and demo admin.
- English is the default locale. Preserve locale across navigation, redirects, email verification links, and booking-management links; remember user preference via account setting or cookie as appropriate.
- Translate ALL user-facing content: navigation, marketing copy, service names/descriptions, forms, validation errors, loading/empty states, calendar labels, status names, admin analytics, consent/privacy text, emails, confirmations, and both reminder templates. No mixed-language UI or hardcoded strings scattered in components.
- Use a typed translation catalog and a compatible i18n routing/library approach; localize date/time and number formatting, but always use the shop's Europe/London timezone for appointments.
- Currency is USD only. Show the $ symbol and use proper locale-sensitive currency formatting for en and ru while preserving USD denomination. Store all monetary values as integer US cents; never store monetary totals as floating-point values.
- The London fictional location and Europe/London timezone remain unchanged despite USD pricing. Do not introduce GBP prices, exchange rates, or currency conversion.
- Localize outgoing email subject, body, links and booking details using the booking's saved locale; fall back to English if preference is absent.
- Seed realistic bilingual service catalog content and test EN/RU flows, including language persistence and both email variants.

BOOKING STATE MODEL
Pending (unverified) -> Confirmed or Expired.
Confirmed -> Completed, Cancelled or No-show.
Admin actions must obey an explicit state-transition policy. Maintain booking_events/audit trail. Cancellation and reschedule of confirmed bookings are distinct operations; reschedule retains history. Payment state is independent from booking status. Never silently resurrect expired reservations.

DATABASE — PROPOSED ENTITIES
- profiles: authenticated users and role mapping (client, barber, admin)
- barbers: public staff profiles and link to staff accounts
- services: active catalog, price in integer minor units (US cents), duration in minutes
- barber_services: service eligibility per barber
- working_hours: regular weekly schedule with local-time ranges
- time_off: exceptions, breaks, holidays and admin approvals/ownership
- bookings: barber, guest/customer reference, UTC start/end, status, hold expiry, confirmation timestamp, payment state, total price snapshot
- booking_services: ordered line items with name/price/duration snapshots
- booking_events: append-only lifecycle/audit history
- booking_tokens: hashed single-use/expiring email verification and management tokens
- notification_jobs: type, due time, status, attempts, idempotency key, delivery metadata
- shop_settings: timezone, address, policies, contact details
- optional payment_records for explicit paid-at-counter bookkeeping
The Lead Agent must refine normalization and constraints before migrations. Avoid duplicating sensitive personal data. Create seed data and migrations. Enforce authorization in server logic AND database RLS as appropriate.

CRITICAL CONCURRENCY DESIGN
Do not rely on 'check availability then insert' alone. Use a PostgreSQL-safe atomic booking operation, transaction/advisory lock or equivalent concurrency-safe mechanism with explicit overlap guarantees for the same barber. Handle both active pending holds and confirmed bookings; pending holds with hold_expires_at <= database current time must not block new bookings. Since a static partial exclusion constraint cannot depend on now(), choose a coherent design (e.g. transaction-scoped barber locking and authoritative overlap query under lock, plus durable constraints where applicable). Cover concurrent create/confirm/reschedule requests with integration tests. Document guarantees and failure handling.

EMAIL SECURITY
Use a transactional email provider such as Resend (or a justified equivalent), with server-only API keys. Generate cryptographically secure random tokens, store only hashes, limit TTL and consumption, prevent token replay and enumeration, throttle creation/resends, use generic user-facing responses where appropriate. Do not put raw access tokens in analytics or application logs. Use signed/short-lived management sessions or fresh email authentication to authorize sensitive changes. Include development mail sink or sandbox strategy.

AUTH & AUTHORIZATION
Supabase Auth for registered client/staff login; guest bookings use separate email-verification flow. RLS and server-side role checks for every sensitive read/write. Never trust client-supplied role, price, duration, barber eligibility or appointment status. Admin and barber accounts should be provisioned securely. Restrict access to financial and customer details by role. Define and test permission matrix.

ADMIN ANALYTICS
Date filters Today, 7 Days, 30 Days, Custom. Metrics: bookings by status, confirmed/completed counts, cancellations, no-shows, paid revenue, top services, barber performance and utilization. Revenue is based on recorded payments for completed visits, not all reservations. Utilization = booked service minutes / available working minutes for a clearly defined period and status set; exclude approved time off and state the methodology. Never pass fictional seeded metrics off as real live business figures.

UX & UI
Premium urban editorial aesthetic, visually distinct from a soft architectural real estate landing page. Thoughtful responsive layouts, clear booking stepper, transparent total price/duration, loading/empty/error/success states, meaningful validation, keyboard navigation, accessible dialogs, visible focus, reduced-motion support. Build mobile-first. PWA should be installable, with sensible caching, but must not pretend booking works offline. Provide complete, natural English and Russian copy, no lorem ipsum, no dead links, no fake functional buttons.

TECH STACK
Next.js App Router, TypeScript, Tailwind CSS, Framer Motion or current compatible Motion package, Supabase PostgreSQL and Auth, server actions/API handlers, transactional email provider, scheduled jobs/cron, Vercel deployment. Choose minimal appropriate libraries, schema validation and testing tools. Pin compatible dependencies and justify architecture. Keep secrets server-side. Use environment templates, migration and seed instructions. Avoid unnecessary paid services; disclose any service requirements.

SUGGESTED ROUTES
/, /services, /barbers, /gallery, /about, /contact, /book,
/booking/confirm, /booking/manage, /account,
/barber, /barber/calendar,
/admin, /admin/calendar, /admin/bookings, /admin/services,
/admin/barbers, /admin/clients, /admin/analytics, /admin/settings,
/demo/admin (isolated demo experience).
Refine route names when needed, but keep clear access boundaries.

SECURITY AND QUALITY
Implement server validation, rate limiting, input normalization, email privacy, secure session/cookie handling, CSRF protections where relevant, audit events, robust error boundaries, logging without secrets, RLS, backup/recovery guidance and personal-data deletion/retention policy. Test timezone transitions, service durations, time-off overlaps, two users racing for the same slot, hold expiration, late confirmation, email retries, cancellation boundary, rescheduling conflicts, role bypass attempts, and payment reporting. Add appropriate unit/integration/E2E tests. Never claim tests ran unless they actually did.

DEFINITION OF DONE
- Public website is polished, mobile-first, complete, and fully localized into English and Russian with a working language switcher.
- All pricing, booking snapshots, payment records, and admin revenue reporting consistently use USD integer cents and show $.
- Booking uses real database persistence and concurrency-safe availability.
- Email verification and reminders function with testable delivery pipeline.
- Guest management links work securely; optional client account works.
- Barber and admin permissions and workflows work.
- Analytics are calculated from persisted records.
- Public demo is safe and isolated.
- PWA is installable and correctly handles offline limitations.
- Automated tests cover critical booking/security paths.
- Lint, type checks and production build pass.
- README, migrations, seed data, environment template and deployment guide are complete.
- Project is clearly identified as a concept portfolio project.

MULTI-AGENT WORKFLOW
====================
You are Lead Agent and must create/configure three specialized subagents if your environment supports subagents. If not, explicitly explain the limitation and emulate these three review roles sequentially; do not falsely claim they were spawned.

SUBAGENT 1 — FRONTEND / UI SPECIALIST
Owns public site, booking UI, account/barber/admin UI, accessibility, responsiveness, motion and PWA presentation. Follow shared design system and backend contracts. No unilateral DB schema changes.

SUBAGENT 2 — BACKEND / DATABASE SPECIALIST
Owns schema, migrations, seed, booking concurrency, time calculations, auth, RLS, APIs, email jobs, analytics queries and service-layer tests. No unilateral redesign of UI.

SUBAGENT 3 — QA / SECURITY REVIEWER
Independent reviewer: tests, threat modeling, permission matrix, race conditions, booking edge cases, mobile usability, accessibility, performance and deployment readiness. Report CRITICAL/HIGH/MEDIUM/LOW findings, reproduction steps and recommended fixes. Do not praise by default. Prefer independent review over writing the same files as implementation agents.

LEAD AGENT RESPONSIBILITIES
Define architecture, design system, API contracts, shared types, milestones, and integration boundaries. Delegate non-overlapping files/tasks; prevent simultaneous edits to shared files. Inspect changes, resolve conflicts, run checks and decide acceptance. Subagents must report changed files, tests run, unresolved issues. Do not auto-push to main or deploy live without explicit user instruction. Do not create more agents unless necessary. Maintain a single coherent product direction.

WORKING RULES
1. Read all of this specification and inspect repository before coding.
2. First present a concise plan, schema/booking concurrency strategy, key security risks and role responsibilities.
3. Request approval of the Phase 01 plan before implementing major changes.
4. Implement ONLY the explicitly authorized phase. Stop and report when finished.
5. Keep decisions documented; do not silently change approved booking policies.
6. Every phase ends with files changed, test/build results, known limitations and next-step recommendation.
7. Never invent verification results, completed functionality, screenshots or successful email delivery.

PHASE 01 — ARCHITECTURE & FOUNDATION
====================================
Inspect repo. Propose bilingual EN/RU information architecture, visual direction, technical architecture, role/permission matrix, USD-in-cents data model, concurrency strategy and localized mail/scheduler strategy. Configure Next.js, TypeScript, Tailwind, Supabase local/dev setup, environment template, base UI tokens, app layouts, migrations, initial RLS policies, seed data and testing framework. Implement only minimal scaffold and foundation. Review security of booking strategy before further work. Run lint/typecheck/build where possible. STOP after Phase 01; do not build entire site.

PHASE 02 — PUBLIC WEBSITE & BOOKING UI
======================================
Implement responsive Home, Services, Barbers, Gallery, About, Contact and multi-step booking interface. Show selected services, total duration and price, specific barber/Any Available, dates/times, guest contact, confirmation pending and success/error states. Integrate with documented service interfaces or temporary clearly labeled mock adapters, but do not claim booking is operational until Phase 03. Make UI polished and accessible on mobile and desktop. Test navigation, keyboard, layout and state transitions. STOP after Phase 02. Request manual visual approval.

PHASE 03 — BOOKING ENGINE, EMAIL & ACCOUNTS
===========================================
Implement and connect fully localized EN/RU real database-backed booking availability, atomic pending holds, 15-minute expiry, email verification, confirmation, guest management, cancellation/reschedule with 12-hour rule, 30-day horizon, 30-minute slot starts, 2-hour minimum lead, multiple services and Any Available assignment. Implement staff/client auth, barber schedule and time-off functionality. Add 24-hour and 2-hour reminder queue with idempotent delivery, retries and cancellation suppression. Include unit/integration/concurrency tests and role authorization checks. STOP after Phase 03 and report actual tests.

PHASE 04 — ADMIN PANEL, ANALYTICS & PUBLIC DEMO
===============================================
Implement protected admin dashboard/calendar, manual bookings, service/barber/schedule/client management, booking status changes, paid-at-counter records and real computed analytics. Add safe isolated public demo with synthetic data and limited permissions; no real email sends or access to production data. Review barber/client permission boundaries and analytics methodology. Test role restrictions, demo isolation and admin flows. STOP after Phase 04.

PHASE 05 — FINAL QA, SECURITY & DEPLOYMENT
=========================================
Perform independent QA/security audit, fix critical/high findings, test booking races and expiry, DST, reminders, authorization, responsive layouts, PWA installability and offline boundaries. Run lint, typecheck, tests and production build. Review performance, accessibility and code quality. Write README with concept disclaimer, features, architecture, setup, env vars, migrations, seeds, tests, email configuration, demo safety and Vercel/Supabase deployment steps. Prepare portfolio screenshots and case study outline. Do not deploy/push without approval. Report actual status and remaining limitations. STOP.

FINAL REMINDER
=============
Read the full document, create three subagents where supported, propose Phase 01 plan, and wait for approval before major implementation. Do NOT execute Phases 02–05 until explicitly requested.
