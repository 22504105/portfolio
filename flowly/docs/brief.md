FLOWLY — FINAL TECHNICAL SPECIFICATION & MASTER PROMPT
Portfolio Project #03 | Version 2.0 — Next.js + design system + compatibility audit | 11 October 2026
Language of product: English-first, with Russian localization support
BUDGET RULE: $0 required for development, local use and portfolio demo.

======================================================================
PART A. PRODUCT BRIEF / FINAL ТЗ
======================================================================

1. PRODUCT
Flowly is a polished, responsive business intelligence SaaS web application for small businesses, founders, operators and marketers. Users can explore a fully functional seeded demo without registration, or sign up and import their own CSV/XLSX sales data to generate meaningful dashboards, customer views, transaction lists and exports.

Tagline: Business intelligence, made simple.
Design goal: credible, distinctive, production-grade SaaS, not a generic admin template. Reference direction: editorial typography, charcoal navigation, warm off-white surfaces, restrained violet/indigo accent, high information density without clutter, refined charts, accessible contrast, precise spacing. Build an original visual identity. No paid imagery, icon libraries or proprietary fonts. Prefer system or openly licensed fonts and Lucide icons.

2. SUCCESS CRITERIA
- A visitor can enter a demo workspace instantly without registering.
- Demo figures remain deterministic and internally consistent across every page.
- An authenticated user can import a valid CSV or XLSX file, preview and map fields, resolve validation errors, confirm the import, and see accurate metrics.
- Changing date range, filters or workspace consistently changes all relevant calculations.
- User can inspect customers and transactions and export data as CSV and a printable PDF report.
- A new account sees an understandable onboarding/empty state.
- No broken buttons, placeholder links, fake API calls or decorative-only controls.
- The deployed demo works within free-tier constraints and is usable on desktop, tablet and mobile.
- No real payment processing, paid analytics services or third-party commercial APIs.

3. AUDIENCES / PERMISSIONS
A. Anonymous visitor: access demo workspace, browse charts and demo transactions, interact with filters, download demo report. Demo must be read-only and never mutate shared data.
B. Registered user: private workspace, manage own imports, view own analytics, edit workspace settings, export own data, delete own imports and account data.
C. No multi-tenant team invitations, billing, subscription management, or enterprise SSO in v1. Do not show nonfunctional plan/team controls.

4. INFORMATION ARCHITECTURE
Public: landing page (/), demo entry (/demo), sign in (/login), sign up (/signup), reset password (/reset-password), privacy page.
Authenticated: /app/overview, /app/analytics, /app/customers, /app/transactions, /app/imports, /app/reports, /app/settings.
Shared: clear navigation, search scoped to current data, date-range picker, workspace indicator, loading/skeleton/empty/error states, accessible dialogs and toasts.

5. DEMO DATA
Create a deterministic, coherent fictional business dataset, e.g. 12–18 months, 3,000–8,000 orders, 500–1,500 customers, 20–50 products, 4–6 marketing channels. Use a fixed seed. Include seasonality, repeat customers, refunded/cancelled orders, differing products/channels, realistic order sizes. Do not use real personal data; synthetic names/emails only. Every chart, table and KPI must derive from this same canonical dataset. Include clear DEMO label. Avoid precomputed contradictory hardcoded totals. The demo must remain fast and not require Supabase credentials or a backend to function.

6. CANONICAL DATA MODEL
Workspace: id, owner_user_id, name, currency_code, timezone, created_at, updated_at.
ImportBatch: id, workspace_id, filename, file_type, row_count, accepted_count, rejected_count, status, imported_at, mapping_json, warnings_json.
Customer: id, workspace_id, external_customer_id (nullable), name (nullable), email (nullable), first_order_at, created_at. Customer identities should be deterministic per workspace; missing identities must not fabricate unique customers from every row without disclosure.
Transaction/Order: id, workspace_id, import_batch_id, external_order_id, order_date (UTC), customer_id (nullable), product_name (nullable), category (nullable), channel (nullable), quantity (integer >0), unit_price (decimal >=0), gross_amount (decimal >=0), discount_amount (decimal >=0), net_amount (decimal), currency_code, status (completed/refunded/cancelled/pending), created_at.
Workspace settings and optional import field mappings should be persisted. Choose a sensible normalized schema; explain whether source rows represent line items vs complete orders. Use unique constraints to prevent duplicate imported external order IDs or define explicit duplicate policies. Never silently double-count an order with multiple line items.

7. METRIC DEFINITIONS (MUST DOCUMENT AND TEST)
- Net revenue: sum of net_amount from completed sales, minus explicit refunded amounts according to a clearly documented refund representation. Exclude cancelled and pending transactions.
- Orders: count distinct completed external_order_id/order IDs (not raw line items).
- Average order value (AOV): net revenue / completed order count; display N/A when denominator is zero.
- Customers: count distinct identifiable customers with completed orders in selected range; explicitly handle anonymous rows.
- Repeat customer rate: customers with >=2 completed orders / customers with >=1 completed order, within stated analysis period.
- Conversion rate: ONLY if visit/session data exists. Otherwise do not invent conversion; show 'Unavailable — traffic data not provided'. Optional demo traffic dataset can support demo-only conversion with documented numerator and denominator.
- Period comparison: compare with immediately preceding period of identical duration and same filters; clearly indicate absolute and percentage delta; avoid divide-by-zero errors.
- Revenue by channel/category/product, transaction count by status, cohort/repeat activity as supported by imported fields.
- Dates: use workspace timezone for grouping and date boundaries; store timestamps in UTC.
- Money: use decimal/numeric values (not floating point for persisted amounts); correctly format currencies. Reject or explicitly handle mixed currencies; do not sum incompatible currencies.

8. IMPORT STUDIO (CRITICAL FEATURE)
Supported: .csv, .xlsx; optional .xls only if secure library support is verified. Do not require Google Sheets or any paid connector.
Flow: select file or drag/drop -> enforce file size and row limits -> parse -> detect headers, delimiter, encoding when feasible -> preview first 20 rows -> choose data interpretation (order per row / order line per row) -> map required fields -> validate and show actionable row-level issues -> choose duplicate handling (skip/replace where safe) -> confirm -> atomic or chunked import with clear progress -> success summary -> dashboard refresh.
Required: order identifier OR generated stable row-based identifier with clear limitations; order date; amount (or quantity and unit price); status default only when explicitly chosen. Optional: customer ID, customer name/email, product, category, channel, quantity, currency.
Allow a downloadable sample CSV and a downloadable XLSX template. Show field definitions and sample mapping.
Validation: MIME/extension checks plus content validation, max 5 MB per file and max 10,000 rows in v1 (configurable and enforced client and server where applicable), spreadsheet formula injection defense on exports, CSV formula injection defense, malformed dates, negative/invalid money, missing columns, duplicates, inconsistent currencies, unexpected statuses, excessively long cells, empty files. Treat spreadsheets as untrusted; never execute macros or formulas. Sanitize displayed cells; no raw HTML injection. No uploading the original spreadsheet to public object storage by default. Parse in-browser, then send validated normalized records in bounded chunks. Implement safe rollback/partial-import semantics with clear feedback. Ensure imports cannot affect another user's workspace.
Use an actively maintained, appropriately licensed free/open-source parsing library (e.g. Papa Parse for CSV; evaluate ExcelJS or another suitable XLSX reader, licensing, bundle size and browser support before selection). No license fees.

9. PAGES AND FEATURES
Landing: original hero, product preview, concise feature narrative, how it works, demo CTA, sign-up CTA, FAQ, footer; no invented customer logos or testimonials.
Overview: 4–6 meaningful KPI cards, revenue trend, channel breakdown, top products, recent transactions, period comparison, data provenance badge.
Analytics: date range presets/custom range, filters by status/channel/category/product, time granularity, chart tooltips, legends, breakdown tables, downloadable filtered data; chart interactions genuinely affect state.
Customers: searchable/sortable/paginated table, details drawer/page with order history, total spend, last purchase, repeat status. Do not pretend unknown customer identities are known.
Transactions: paginated searchable table, filters, sortable columns, status chips, order detail drawer, CSV export.
Imports: upload wizard, sample download, previous import batches, validation logs, delete batch with confirmation and correct aggregate recomputation.
Reports: date/segment filters, printable professional report view, PDF via browser print or open-source client-side PDF solution, CSV export, no server PDF billing.
Settings: workspace name, currency/timezone (with explicit handling when changes cannot convert existing amounts), profile, security/account links, deletion controls.
Auth: email/password or magic link via Supabase Auth Free, protected routes, safe session handling, email verification behavior explained, password reset. No custom password storage.

10. VERIFIED FREE STACK / INFRASTRUCTURE (OCTOBER 2026)
CORE: Next.js 16 App Router, React, TypeScript, Tailwind CSS, shadcn/ui (copyable open-source components), Radix primitives as installed by shadcn, Lucide icons. No Vite SPA or React Router. Next.js may use Vite internally ONLY via Cloudflare vinext adapter; this does not replace Next.js application architecture.
DATA UI: Recharts (client-only chart components), TanStack Table for table logic, date-fns for date formatting, React Hook Form + Zod for forms. Prefer native fetch and server components where appropriate; add TanStack Query ONLY if cache invalidation/polling/client fetching justify it. Avoid needless state-management dependencies. Use CSS transitions; add Motion only if justified.
CSV: Papa Parse (browser). XLSX read: prefer read-excel-file (browser, simple worksheets), after validating maintenance/license and actual sample imports. XLSX sample/template: write-excel-file or a checked-in static template; do NOT install ExcelJS just for a small sample. Test formula cells, dates, multiple sheets, oversized ZIP archives, memory use and unsupported workbook features. Never run workbook macros. Do not rely on paid SheetJS Pro.
FINANCIAL PRECISION: PostgreSQL numeric for persisted currency values; use decimal-safe arithmetic for normalization and calculations (decimal.js or equivalent MIT-compatible library) rather than JS floats; agree on rounding and minor-unit policy.
BACKEND: Supabase Free Postgres + Auth + RLS, @supabase/supabase-js and @supabase/ssr for Next.js auth sessions where compatible. Auth cookie handling must be verified for deployed runtime. No service-role key in browser. No Supabase needed for public demo.
HOSTING: Cloudflare Workers Free for Next.js full-stack, NOT Cloudflare Pages SPA. Cloudflare currently recommends vinext for new projects but vinext is beta; compare with @opennextjs/cloudflare using an EARLY deployment spike in Phase 1. Choose the adapter that demonstrably passes App Router, auth callbacks, route handlers, SSR, deep links and deployment under current Workers Free quotas. Do not mix adapters or assume Node APIs work. Keep costly parsing in browser and database queries bounded. Free Workers CPU limit is 10 ms/request and request allowance is 100,000/day (check live limits). Static assets should avoid Worker execution where possible. If neither adapter meets the free-plan requirement, do not claim production deploy; document blocker and offer a genuinely free static demo fallback separately, while keeping the Next.js codebase.
LOCAL DEVELOPMENT: next dev, next build, local Supabase optional; public demo must function without environment variables. For private cloud features use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, as applicable. Never expose secret/service-role keys.
TESTING: Vitest, React Testing Library, Playwright, ESLint, TypeScript, Prettier, GitHub Actions Free within quotas. Use Wrangler preview to catch runtime differences. No required credit card or paid tier; verify account sign-up constraints before deployment.
FREE-TIER CAVEATS: Supabase Free currently lists 500 MB database/project, two free projects, 50,000 monthly active users; inactive projects may pause. Cloudflare limits can change. Implement bounded dataset/page sizes and informative errors; no unlimited capacity or uptime claims.
REFERENCE DOCUMENTATION (review again during implementation):
https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
https://developers.cloudflare.com/workers/platform/limits/
https://supabase.com/docs/guides/platform/billing-on-supabase
https://github.com/exceljs/exceljs

10A. DETAILED DESIGN CONCEPT — REQUIRED IMPLEMENTATION SPECIFICATION
BRAND POSITIONING: Flowly should feel like a thoughtful, trustworthy premium analytics tool for independent operators, not a generic neon fintech dashboard. Editorial clarity, quiet confidence, data-first layout. Brand wordmark is typographic "flowly." with a small custom abstract flow mark made in CSS/SVG; no copied logos or trademarks. Product language English first, Russian localization architecture ready; use consistent currency/date formatting.
VISUAL THEME: Light theme is PRIMARY; dark charcoal navigation contrasts warm near-white content. Optional dark mode only if all core requirements are complete; never sacrifice usability for it. No glassmorphism, giant gradients, exaggerated shadows or irrelevant 3D decoration.
DESIGN TOKENS (starting values; adjust only with documented contrast review):
- Canvas #F7F7F4 (warm off-white), surface #FFFFFF, secondary surface #F1F2EF.
- Sidebar #171A20, sidebar elevated #222630, sidebar text #E9EAF0.
- Main text #20242D, muted text #737A86, borders #E5E7E4.
- Primary accent #6959D9 (muted violet); hover #5747C2; tint #F0EEFF.
- Positive #15846B, negative #C24F5A, warning #A66A20; never communicate status only by color.
- Charts: violet, teal, ochre, slate blue, muted coral; distinguish series with line styles/labels and accessible legends.
- Border radius: cards 14px, inputs 10px, badges 999px; border 1px; shadows subtle and sparse.
TYPOGRAPHY: Use system sans or freely licensed Geist/Inter (verify source/license); 14px default UI body, 12px metadata, 28–34px page headings, 16–18px card titles, 30–38px KPI figures; tabular numerals for amounts. Strong hierarchy, never low-contrast tiny chart labels.
LAYOUT: Desktop left fixed sidebar 244px, main content max width 1440px, 28–36px content padding; topbar 68–76px. Twelve-column dashboard grid, 20–24px card gaps, generous vertical rhythm. Tablet collapsible sidebar. Mobile 360px+ drawer nav, one-column KPI cards, horizontally scrollable or alternate card-view tables, visible date filter; preserve usability, not desktop screenshots squeezed down.
APP SHELL: Sidebar top logo, Overview / Analytics / Customers / Transactions / Imports / Reports, bottom Settings + account; active state as low-contrast violet accent with slim indicator. Topbar has breadcrumb, date range, workspace chip, profile dropdown. Demo mode always shows a visible non-intrusive "Demo workspace" badge and "Try your data" CTA. Keyboard accessible navigation and focus indicators.
LANDING PAGE: Large clear hero left with tagline "Understand your business. Move with confidence." plus concise value proposition and two CTAs (Explore live demo / Create workspace); right side an ACTUAL app preview from product UI, not fake marketing screenshot. Three feature explanations, import workflow visual, honest privacy/free-demo section, FAQ and footer. Avoid fake testimonials or partner logos.
OVERVIEW: Top heading and contextual subtitle; 4 KPI cards (Net revenue, Completed orders, AOV, Identified customers) with period deltas and tiny contextual sparkline if useful; dominant 8-column revenue area/line chart, 4-column channels breakdown; lower row top products and recent transactions. Show unavailable metrics explicitly. Charts have meaningful axes, units and empty states.
ANALYTICS: Full-width date controls and filter chips; one main trend chart with daily/weekly/monthly granularity; secondary breakdown bars/donut only when legible; detail breakdown table under charts; filter state encoded in URL where practical. No chart interactions that silently fail.
CUSTOMERS: Table with name/ID, orders, lifetime spend, last order and segment; search and filters; detail drawer shows real history and identifiable-data caveats. TRANSACTIONS: high-density legible table with status, amount, date, channel and expandable details; export only currently filtered rows.
IMPORT STUDIO: Polished 4-step progress indicator (Upload → Map → Validate → Confirm), large drag/drop zone, sample download, column-mapping dropdowns with live example values, visible error count and downloadable error CSV, summary before persistence. Design success state with import counts and CTA to Overview.
REPORTS: Clean editorial printable A4 report with title, selected range, KPI summary, chart and methodology footnotes; print CSS with no navigation, no clipped charts. SETTINGS: restrained forms with clear save state, irreversible delete confirmation and timezone/currency disclaimers.
INTERACTIONS: 150–220ms transitions, subtle hover, no distracting motion; skeletons shaped like real content; descriptive error states and retry actions. Respect prefers-reduced-motion. Tooltip keyboard/focus alternatives. Do not animate large tables.
DESIGN QA: At each phase capture 1440px desktop, 768px tablet, 390px mobile screenshots; review alignment, overflow, typography, color contrast, chart legibility, loading/empty states. Aim for a recognizably designed product, not shadcn defaults with a purple button. Maintain design tokens centrally and reuse components.

11. SECURITY / PRIVACY
Supabase RLS on EVERY user-owned table; policies restrict by auth.uid() and workspace ownership. Test cross-account isolation explicitly. Validate all import inputs, enforce row/file limits, avoid SQL injection, XSS, spreadsheet injection and unsafe redirects. Use least privilege. Protect auth callbacks. Rate-limit where platform supports it; otherwise document free-tier limitations. Do not expose PII in public demo. Delete imported data on user request; confirm cascading behavior. No analytics cookies/tracking by default. Add a truthful privacy page and data-handling notes; no false compliance certifications.

12. ACCESSIBILITY / QUALITY
WCAG 2.2 AA intent: keyboard navigation, semantic markup, visible focus, meaningful chart summaries, sufficient contrast, reduced-motion preference, responsive tables, labels and errors. Mobile: responsive usable UI, not simply a shrunken desktop. Support 360px to widescreen. Prefer performance budget: fast initial load, code splitting, memoized aggregation, virtualization/pagination for large tables, avoid parsing on main thread for large files if needed. Support current Chromium, Firefox, Safari.

13. OUT OF SCOPE V1
Real bank/Stripe/Google Ads/Meta integrations; live syncing; AI paid features; team invitations; subscription billing; mobile native app; real-time collaborative editing; public file hosting; unbounded uploads; guaranteed high-availability SLA. Do not build mock versions that appear functional.

14. ACCEPTANCE CHECKLIST
[ ] Anonymous demo accessible with no account, no backend dependency
[ ] Demo is deterministic and coherent across all pages
[ ] Sign-up/login/logout/reset flow functional with configured Supabase
[ ] RLS prevents user A from reading/updating user B data
[ ] CSV import and XLSX import tested end to end
[ ] Mapping, validation, duplicate handling, error display work
[ ] Date, currency and amount handling are correct
[ ] Metrics tested against known fixture calculations
[ ] Import deletion updates dashboard correctly
[ ] All filters affect KPIs, charts and tables consistently
[ ] Customer and transaction details are accurate
[ ] CSV and PDF/print exports reflect filters and escape formulas
[ ] All navigation, forms, dialogs, buttons work
[ ] Empty/loading/error/permission states covered
[ ] Desktop/tablet/mobile accessible and responsive
[ ] Build, typecheck, lint, unit and e2e tests pass
[ ] Deployed Next.js on Cloudflare Workers Free loads SSR routes, auth callbacks and deep links
[ ] README includes setup, architecture, demo credentials policy, data dictionary, limitations and free-tier caveats
[ ] No paid dependencies, no exposed secrets, no copyrighted stock assets

======================================================================
PART B. MASTER PROMPT FOR CLAUDE CODE
======================================================================

You are the lead engineer orchestrating three specialized subagents to build FLOWLY, a premium, fully functional SaaS business analytics portfolio project. The complete product specification is in PART A of this document and is the authoritative source of truth. Read it fully before writing code.

NON-NEGOTIABLES:
0. NEXT.JS APP ROUTER IS MANDATORY. No Vite SPA, React Router or Cloudflare Pages SPA deployment. Follow Sections 10 and 10A for technical and design decisions.
1. Zero-cost stack and deployment. Do not use paid services, paid APIs, premium templates, paid design assets, or features requiring a subscription/credit card. Check license and free-tier compatibility of every major dependency.
2. Production-minded implementation: no placeholder buttons, fake endpoints, mock business actions, contradictory chart numbers, or hardcoded KPIs. Seeded demo is legitimate, but all values must derive from one canonical dataset.
3. Both modes are required: public seeded demo and authenticated CSV/XLSX import with persistent private analytics.
4. Strong data isolation, tested RLS, input validation, accurate metrics and safe exports.
5. Build an original, polished SaaS experience with excellent typography, spacing, chart readability, responsive layouts and accessibility.
6. Work in FIVE gated phases below. Do not silently skip tasks. Each phase must conclude with a brief report: changed files, decisions, tests, risks, next steps. Fix blocking failures before advancing.
7. Use exactly THREE subagents with clear ownership; orchestrator coordinates and resolves integration conflicts. If the environment does not support native subagents, simulate these roles as distinct workstreams and report honestly; never claim unavailable agents were launched.
8. Never require paid resources to run the public demo. Make .env.example and local setup straightforward.
9. Do not claim deployed success without an actual verified deployment. If credentials or cloud access are missing, finish locally, document exact steps and mark deployment as pending.
10. Do not modify unrelated files or overwrite user work. Check repository state first.

SUBAGENT A — ARCHITECT / BACKEND / DATA
Owns: data model, SQL migrations, RLS, auth integration, import pipeline, data normalization, deterministic demo fixtures, KPI calculation library, data query contracts, performance.
Deliverables: schema, policies, fixtures, pure metric functions, tested import processing, data services, security notes.

SUBAGENT B — FRONTEND / PRODUCT DESIGN
Owns: design system, responsive shell, landing, overview, analytics, customers, transactions, imports UI, reports, settings, accessible components, UX microinteractions.
Deliverables: visually coherent complete pages, keyboard-friendly interactions, empty/loading/error states, mobile UX, real data bindings.

SUBAGENT C — QA / SECURITY / DEVOPS
Owns: test strategy, unit/integration/e2e coverage, accessibility checks, threat model, cross-user isolation verification, build/lint/typecheck, performance checks, GitHub Actions and Cloudflare Workers deployment documentation.
Deliverables: automated tests, defect log, release checklist, deployment and free-tier verification.

COORDINATION CONTRACT
- Establish shared TypeScript types, schemas, API/query contracts and route map before parallel implementation.
- Avoid agents editing the same file concurrently. Assign file ownership and integration windows.
- Use small reviewable commits or clear checkpoints. Do not commit secrets.
- Architect signs off data/metrics contracts; frontend signs off UX flows; QA signs off acceptance gates.
- At the end of each phase, report any unimplemented requirements explicitly.

PHASE 1 — FOUNDATION & ARCHITECTURE
Goal: reliable skeleton and shared contracts.
Tasks:
- Inspect repo and project state; scaffold Next.js 16 App Router TypeScript Tailwind if needed.
- Define app architecture, routes, folder conventions, design tokens, state/query strategy.
- Build responsive app shell and landing page foundation according to Section 10A design tokens and page blueprints.
- Design canonical schema, SQL migrations, RLS policies and seed generator.
- Document metric formulas, line-item vs order semantics, timezone/currency rules.
- Establish Vitest, Playwright, lint, typecheck, CI baseline and .env.example. Run early Workers Free deployment/adapter compatibility spike before committing to server-only features.
- Make demo run locally with no Supabase env vars.
Gate: npm install, typecheck, lint, unit tests, Next.js dev server and basic navigation succeed; adapter build/preview spike verified or blocker explicitly documented; architecture/security plan documented.

PHASE 2 — DEMO DASHBOARD & ANALYTICS
Goal: complete visually excellent deterministic demo.
Tasks:
- Generate seeded fictional dataset and shared metric engine.
- Build overview, analytics, customer, transaction pages and detail drawers.
- Implement real date range, filters, sorting, pagination, drilldowns, chart legends and tooltips.
- Add meaningful responsive behavior and accessible chart summaries. Visually review at 1440/768/390px against Section 10A.
- Validate KPI invariants with fixture tests and cross-page consistency.
Gate: anonymous visitor can explore all demo pages, filters and exports of demo data; no dead controls; visual QA desktop/mobile; tests pass.

PHASE 3 — AUTH, PERSISTENCE & CSV/XLSX IMPORT
Goal: real private user workflows.
Tasks:
- Integrate Supabase Auth and private workspace creation.
- Apply and test migrations and RLS, including cross-user denial tests.
- Build import wizard: upload, parse, preview, map, validate, error reporting, duplicate policy, chunked/atomic persistence, progress and deletion.
- Provide downloadable CSV and XLSX samples/templates.
- Use normalized imported data for every analytics page; handle missing optional fields honestly.
- Enforce limits, currency consistency, date/time rules, input safety and import error recovery.
Gate: new user can sign up, upload valid CSV/XLSX, see correct numbers, delete an import, log out/in and recover same data; invalid files fail safely; user isolation verified.

PHASE 4 — REPORTS, SETTINGS & PRODUCT POLISH
Goal: complete end-to-end experience.
Tasks:
- Build reports with filtered CSV and printable PDF export.
- Implement workspace/profile/settings with safe persistence and clear constraints.
- Complete landing copy, onboarding, import instructions, privacy and empty states.
- Refine design consistency, animations, keyboard access, loading/error behavior and responsive tables.
- Test all interactions and edge cases; remove unused placeholders.
Gate: feature-complete against PART A, no misleading UI, export results verified against known fixtures, accessibility issues addressed.

PHASE 5 — HARDENING, QA & FREE DEPLOYMENT
Goal: portfolio-ready release.
Tasks:
- Run typecheck, lint, unit/integration/e2e, production build and security review.
- Verify spreadsheet/CSV injection defenses, input bounds, RLS, account isolation, secrets handling and delete behavior.
- Audit performance, bundle sizes, mobile usability, browser compatibility and accessibility.
- Run Cloudflare Workers vinext vs OpenNext compatibility spike and deploy the verified Next.js adapter if access exists, otherwise provide exact manual deployment instructions and mark pending.
- Confirm no paid services are required, and document current free-tier limits/risks.
- Produce README with screenshots guidance, feature matrix, architecture diagram (Mermaid), demo entry instructions, env setup, SQL setup, test commands, data dictionary and limitations.
Gate: all acceptance checks either pass with evidence or are transparently marked pending; no fabricated completion claims.

REQUIRED FINAL RESPONSE FROM CLAUDE CODE
1. Implemented feature summary and file/module map.
2. Five phase reports and gate results.
3. Exact commands to install, run, test and build.
4. Supabase setup and SQL/RLS steps.
5. Cloudflare Workers Next.js deployment steps or verified deployed URL.
6. Free-tier/third-party licensing notes.
7. Known limitations, unresolved blockers and suggested future improvements.

FIRST ACTION
Read this specification, inspect the repository, propose a concise architecture and execution plan, allocate files to the three subagents, then begin PHASE 1. Ask the user only for essential missing credentials/access when actually needed; keep demo development independent of them. Proceed autonomously through feasible phases while preserving gates and reporting honestly.

END OF DOCUMENT
