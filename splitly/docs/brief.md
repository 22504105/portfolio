SPLITLY — FINAL TECHNICAL SPECIFICATION + MASTER PROMPT
Version 1.0 | Portfolio Project #04 | October 2026
Language: English for implementation instructions; UI must support Russian and English.

============================================================
A. PRODUCT VISION
============================================================
Build Splitly, a production-minded Telegram Mini App plus browser-accessible interactive demo for shared expenses, receipt scanning, multilingual item names, precise debt calculation and settlement tracking. All required tools and hosting must have a workable zero-cost path within free-tier limits. Do not introduce paid AI APIs, paid hosting, subscriptions, or paid assets.

Core user journey: create group -> upload photographed receipt -> extract item lines -> optionally translate names -> review and correct -> assign items to people -> designate payer(s) -> confirm -> calculate balances and suggested settlements. Manual expenses must work independently of OCR.

Do not claim that OCR or translation is perfect. Never create an irreversible financial entry without explicit user confirmation.

B. NON-NEGOTIABLE REQUIREMENTS
============================================================
1. Next.js App Router + TypeScript; shared codebase for Telegram and browser demo.
2. Real CRUD and persistence for authenticated Telegram users; isolated deterministic demo mode.
3. Mobile-first UI; accessible and responsive on larger screens.
4. Russian and English interface; preserve original receipt item text, display translated/edited label separately.
5. Multi-currency expense tracking with original currency and immutable recorded conversion rate; manual exchange rates supported without third-party API.
6. Accurate currency minor units, decimal conversion, explicit rounding rules and reconciled totals.
7. Group membership authorization on every data operation; no trust in client-supplied user IDs.
8. All financial writes atomic; idempotency keys prevent duplicate submission.
9. No fake buttons, static fake results presented as live data, or silent OCR assumptions.
10. Five gated delivery stages, three delegated subagent roles, documented test evidence at each gate.

C. RECOMMENDED STACK AND COMPATIBILITY GATES
============================================================
Framework: Next.js App Router, TypeScript, React (versions chosen together from current compatible stable releases; pin exact versions in lockfile).
UI: Tailwind CSS, shadcn/ui where compatible, Radix primitives, lucide-react; use CSS animations first. Avoid needless animation dependencies.
Telegram: official Telegram WebApp APIs plus maintained @tma.js SDK packages only if versions and runtime are compatible. Server-side verify signed Telegram initData using HMAC, auth_date expiration and constant-time comparison. Do not trust initDataUnsafe.
Data: Supabase Free PostgreSQL, SQL migrations, RLS; use Supabase Auth only if a verified design securely bridges Telegram identity to a short-lived application session/JWT. A custom server session is acceptable if implemented correctly and documented. Never put service-role key in browser.
Validation: Zod; React Hook Form where beneficial.
Financial arithmetic: integer minor units (BIGINT in DB, strings across JSON where needed), decimal.js for FX; never JS floats for monetary aggregation.
OCR: Tesseract.js in a browser Web Worker, with language data loaded on demand. This is best-effort and requires measured memory/performance testing on Telegram mobile webviews. Offer manual entry and corrections when OCR fails.
PDF receipt input: use a maintained browser-compatible PDF renderer only if necessary; limit pages/size. JPG/PNG/WebP first-class. Never claim universal PDF support without tests.
CSV export: native generation. PDF report: browser print-to-PDF initially, or a compatible client-side library if justified.
Charts: Recharts only if useful and tested in client components; avoid charts in critical payment flow.
Testing: Vitest for finance/parsers, React Testing Library for UI, Playwright for browser E2E; Telegram-specific manual device tests.
Hosting: Cloudflare Workers Free is a TARGET, not guaranteed. In Stage 1 perform an actual minimal deployment of the selected Next.js version with a currently supported adapter/runtime; check Worker CPU, bundle size, route support and env bindings. Do not commit to vinext/OpenNext without testing current compatibility. If target fails, document a fully free compatible fallback and request decision before major development.
No external FX, OCR, translation, notification or storage service may be required to operate core product.

D. DESIGN CONCEPT — 'CALM FINTECH'
============================================================
Brand: Splitly | Tagline: 'Split smart. Live easy.'
Visual character: warm, trustworthy, editorial, uncluttered, not a generic crypto dashboard.
Light theme palette: canvas #F8F7F3; forest #173D35; mint #B9E4C9; ink #232826; white #FFFFFF; muted #737C76; divider #E5E9E3; danger #C75B57; warning #A66B26.
Dark theme: near-black green #111A17, raised surface #1B2923, foreground #F2F5F0, muted #A5B5AA, mint accent #A7D8BA. Ensure WCAG AA contrast for body text and controls.
Typography: self-hosted/open-license font (e.g. Inter) with system fallback. Strong numeric hierarchy; tabular numerals for currency.
Layout: 8px spacing rhythm, 12–20px radii, restrained shadows, 44px minimum touch targets, safe-area padding, sticky mobile bottom navigation, clear primary CTA. Telegram theme and viewport events should not cause layout jumps.
Navigation: Home / Groups / Activity / Profile; prominent 'Add expense' action. Receipt scanner accessible from Add Expense and group page.
Screens:
- Onboarding: concise value proposition and entry to Telegram-authenticated app or safe browser demo.
- Home: overall net balance, groups, actionable settlements, recent activity.
- Groups list: name, member avatars, currency, current net position, search.
- Group detail: group balance, members, expenses, settlements, filters, add expense.
- Add expense: manual or scan receipt, payer(s), currency, date, category, description, split mode.
- Receipt capture: camera/upload, crop/rotate, processing state, OCR confidence and errors.
- Receipt review: editable original item label, translated display label, quantity, unit/line price, discount/tax/tip, total reconciliation.
- Receipt assignment: per-item chips for group members, split equally or by weight/amount, payer allocation, live balance preview.
- Balances: gross and simplified obligations with explanation and payment-confirmation actions.
- Analytics: categories, spending by person/time, currency-specific or converted values with FX explanation.
- Settings: language, theme, preferred currency, FX preferences, export, account/data deletion.
- Browser demo: obvious 'Demo data' indicator, reset button, no access to production user records.
States for every screen: loading, empty, success, recoverable error, offline/slow network; no decorative dead ends.

E. DOMAIN MODEL / DATABASE
============================================================
users: id UUID, display_name, locale, created_at.
telegram_identities: user_id, telegram_user_id UNIQUE, verified_at.
groups: id, name, base_currency, owner_id, archived_at, created_at.
group_members: group_id, user_id OR guest_member_id, role, joined_at, removed_at.
guest_members: id, display_name, claimed_by_user_id nullable.
invites: group_id, token_hash, expiry, max_uses, uses, revoked_at.
expenses: id, group_id, creator_id, description, expense_date, currency, total_minor, status, receipt_id nullable, idempotency_key, created_at, updated_at.
expense_payers: expense_id, member_id, paid_minor; payer totals must equal expense total.
expense_splits: expense_id, member_id, owed_minor; split totals must equal expense total.
receipt_uploads: id, group_id, uploader_id, storage_path optional, content_hash, mime_type, status, created_at; delete raw image after configured retention or allow immediate deletion.
receipt_items: id, receipt_id, original_label, display_label, translation_source, quantity_decimal, line_total_minor, position, confidence nullable, manual_reviewed.
receipt_item_allocations: receipt_item_id, member_id, share_minor, method.
settlements: id, group_id, from_member_id, to_member_id, currency, amount_minor, status (proposed/confirmed/cancelled), created_at, confirmed_at.
fx_rates: id, from_currency, to_currency, decimal_rate_as_text, source ('manual' or documented public feed), effective_at, created_by.
activity_log: id, group_id, actor_id, action, entity_type, entity_id, metadata_redacted, created_at.
user_settings: user_id, theme, locale, preferred_currency.

Add foreign keys, unique constraints, indexes on group/date and memberships, CHECKs for nonnegative amounts, and authorization policies. Use transactions/RPC for multi-row financial writes. Define cancellation/edit semantics: audit original, atomically replace dependent allocations, recalculate derived balances. Avoid storing balances as an independent source of truth.

F. FINANCIAL ENGINE — REQUIRED INVARIANTS
============================================================
- Every expense: sum(payer contributions) == expense.total_minor == sum(member shares).
- For receipt allocation: sum(item allocations) == each item's reconciled amount; sum(items + explicit tax/tip/discount adjustments) == receipt total.
- Allocation remainder: deterministic largest-remainder or ordered-cent assignment, stable across reloads; document the rule.
- Each member's net in one currency = total paid - total owed + incoming confirmed settlements - outgoing confirmed settlements (verify sign conventions via tests).
- A proposed settlement does not affect actual debt until confirmed.
- Simplification can produce fewer transfers using debtor/creditor matching; do not advertise globally minimum number of transfers.
- No netting between currencies without an explicit frozen conversion context. Show source and effective date of FX rate. Preserve original transaction amounts.
- For receipt split with multiple payers: each payer's contributions sum to the actual receipt total.
- Handle partial refunds with explicit negative adjustment/refund entity or linked reversal, never silently mutate historical totals.
- Enforce sensible limits and currency-specific minor-unit metadata (not all currencies have two decimals).
- Display monetary calculations with currency code and locale formatting; never rely solely on symbol.

G. SMART RECEIPT SCANNER — END-TO-END
============================================================
1. Accept camera or upload. Validate MIME, file size, image dimensions; explain permission denial. Provide crop/rotate and optional contrast enhancement locally.
2. Run OCR on-device in worker; lazy-load appropriate language packs. Begin with Turkish, English and Russian OCR; allow explicit language selection. Detecting language automatically is optional and cannot be assumed accurate.
3. Parse likely line items, quantities, amounts, subtotal, discounts, tax, service fees and grand total using heuristics; handle Turkish comma decimal separators and common receipt formats. Never fabricate missing prices.
4. Translate recognized item labels to selected display language via curated local glossary + user-editable mappings; show 'untranslated' when no reliable mapping. A full general-purpose translation engine is NOT promised offline or without a free compatible model. Preserve original text.
5. Review screen with editable rows and unmatched OCR text. Highlight low-confidence lines, duplicates, and any mismatch between parsed sum and printed total. User must resolve mismatch or explicitly add a documented adjustment before confirmation.
6. Assign each item to one or more group members; default unassigned until user confirms. Offer equal, exact amounts, percentages and shares. Assign taxes/discounts proportionally or manually with transparent rules.
7. Choose one or multiple payers. Confirm final expense and item-level allocations atomically. Prevent double submission via idempotency key.
8. Provide clear errors for blurry images, unsupported PDFs, worker failures, memory pressure, missing OCR language data, and offline operation.
9. Security/privacy: images may contain card details, names, tax IDs; do not log raw OCR text, remove EXIF where possible, redact sensitive preview data and let user delete image. Prefer local OCR and minimal retention.
10. Testing: fixture receipts in Turkish/English/Russian, blurred photos, refunds, quantity x unit price, discount, duplicate receipt, multiple payers, mismatch, different decimal separators, long receipts and mobile memory constraints.

H. MULTI-CURRENCY POLICY
============================================================
Each group has a base currency for display, but expenses retain their original currency. The user can enter a manual conversion rate; optional public feed only if no API key, no fee, reliable licensing and graceful fallback. Persist the exact rate, timestamp and source per conversion. Historical values must never drift when live rates change. Separate native-currency balances from converted summary. If rate missing, show 'conversion unavailable' rather than an invented total.

I. AUTHENTICATION AND SECURITY
============================================================
Telegram initData must be verified on the server (hash, auth_date expiry, constant-time comparison), then exchange for a secure application session. Avoid exposing Telegram bot token, service-role keys or signing secrets. Demo routes and database are isolated from real user data. Enforce per-group access on server, database policies, invite token expiry/revocation, rate limits on sensitive actions, CSRF-safe session strategy, content validation and size limits. Implement account/group deletion and basic privacy notice. Never send receipt content to an unapproved external AI provider.

J. FREE-TIER OPERATIONS
============================================================
Provide .env.example, local setup, migrations, seed data, free deployment steps and documented limits. Test with a fresh account and a zero-cost Supabase project. Store large receipt images only when needed; prefer browser processing and short retention. Keep Worker handlers lightweight and minimize cold-start dependencies. If current free-tier restrictions invalidate a feature, use a genuinely free alternative or reduce scope transparently; never silently substitute a paid service.

K. FIVE STAGES WITH GATES
============================================================
STAGE 1 — Foundation, compatibility spike and design system:
- Create Next.js App Router TS project, pin dependencies, lint/typecheck/test scripts.
- Implement visual tokens, theme, localization, responsive app shell and navigation.
- Create SQL schema/migrations and security architecture.
- PROVE a minimal Next.js API + page deploy on selected free hosting; document real command/output, not theoretical compatibility.
- Gate: local build, deployed hello route, navigation screens, no paid dependency.

STAGE 2 — Groups, manual expenses and identity:
- Telegram auth/session and browser demo isolation.
- Groups, guests, invitations, memberships, roles and manual expense CRUD.
- Equal/exact/percentage/share splitting; payer contribution support.
- Gate: two actual test users cannot read each other's private groups; all CRUD flows and DB constraints tested.

STAGE 3 — Receipt scanner and item assignment:
- Camera/upload, browser OCR worker, language selection, parsing, translation glossary, review/edit and reconciliation.
- Per-item ownership and multi-payer flow; duplicate protection.
- Gate: fixture receipts + realistic mobile test; failed OCR can always be completed manually; every persisted expense reconciles.

STAGE 4 — Balances, multi-currency, settlements, analytics:
- Deterministic debt engine, settlement proposals/confirmations, FX rates, category analytics, exports and activity history.
- Gate: unit/property tests for financial invariants, partial settlement, rounding, mixed currencies and historical rates.

STAGE 5 — Production QA, Telegram UX, performance and launch:
- Telegram webview and mobile device tests, accessibility, translations, privacy controls, security review, performance, deployment, README and screenshots.
- Gate: real Telegram launch, public browser demo, reproducible zero-cost deployment, no unresolved critical bugs.

L. THREE SUBAGENTS AND ORCHESTRATION
============================================================
Agent A — ARCHITECT/BACKEND: domain model, DB migrations, auth, APIs, monetary engine, deploy compatibility.
Agent B — FRONTEND/DESIGN: polished UI, mobile/Telegram integration, receipt flow, accessibility, i18n, loading/error states.
Agent C — QA/SECURITY: test plans, fixture data, threat modeling, authorization tests, rounding/property tests, end-to-end verification.

Lead Claude: delegate independent work, set interfaces before parallel coding, avoid simultaneous edits to same files, integrate results, run all checks, document failures honestly. Each stage ends with a concise report: completed features, files changed, commands executed, tests passed/failed, screenshots or visual checks, risks, free-tier impact and explicit acceptance gate. Never proceed if gate fails without explaining the block.

M. DEFINITION OF DONE
============================================================
- End-to-end receipt -> item assignment -> debts flow works with real OCR and manual correction.
- Both Telegram Mini App and browser demo are operational.
- Russian/English UI, light/dark themes, responsive design.
- Correct group isolation, sessions, atomic writes, idempotency and money arithmetic.
- Users can create groups, invite people, add/edit expenses, track/confirm settlements, export data.
- Currency conversions are auditable and historic amounts immutable.
- All core functions work on a free plan within documented resource limits.
- No fake functionality; documented known limitations, including OCR/translation coverage.

============================================================
MASTER PROMPT FOR CLAUDE CODE — COPY FROM HERE
============================================================
You are the lead engineering agent building Splitly. Read the ENTIRE specification above before writing code. Deliver a professional, fully working Telegram Mini App and public browser demo using only free resources. Next.js App Router and TypeScript are mandatory. Use three subagents with these roles: (A) Architect/Backend, (B) Frontend/Design, (C) QA/Security. Execute five stages sequentially with explicit quality gates. Start by inspecting the repository, reporting constraints and proposing a concrete dependency/version matrix; then implement Stage 1. Validate the selected Cloudflare deployment approach by an actual compatibility spike before committing to the full architecture. Do not assume a specific adapter works until tested. Never use paid APIs or invent successful deployments/tests. Implement the receipt scanner as genuine local OCR with user review; use an honest limited translation glossary, not pretend universal translation. Implement exact financial arithmetic, transactional persistence, secure Telegram authentication, isolated demo and comprehensive tests. Work autonomously on decisions that are low-risk and reversible; ask only when secrets, external account setup, unsupported free hosting or irreversible operations require user action. At each gate provide what was built, verification evidence, known gaps, and the next stage. Prioritize correctness, security, usability and visual polish equally. Begin with Stage 1.
============================================================
END OF DOCUMENT
