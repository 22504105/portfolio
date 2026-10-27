# Flowly - Product requirements

The specification Flowly was built against. Decisions that settle or depart
from a point here are listed in [`architecture.md`](architecture.md), section 1.

## Product

A responsive business intelligence web application for small businesses,
founders, operators and marketers. Visitors explore a complete seeded demo
without registering; registered users import their own CSV or XLSX sales data
and get dashboards, customer views, transaction lists and exports. Everything
runs on free tiers: no payments, paid analytics or commercial APIs.

Interface language: English, with every string kept in one dictionary so a
Russian translation can be added.

## Users

- **Anonymous visitor**: the demo workspace, charts, transactions, filters and
  the demo report. The demo is read-only and never changes shared data.
- **Registered user**: a private workspace; manages their own imports, sees
  their own analytics, edits workspace settings, exports and deletes their own
  data and account.
- Out of scope: team invitations, billing, subscriptions, SSO. No controls for
  them are shown.

## Pages

- Public: landing page, demo, sign in, sign up, password reset, privacy page.
- Workspace: overview, analytics, customers, transactions, imports, reports,
  settings.

## Demo data

A deterministic fictional business generated from a fixed seed: 12-18 months,
thousands of orders, hundreds of customers, tens of products, several
channels, with seasonality, repeat customers, refunds and cancellations. Every
chart, table and figure derives from that one dataset. The demo needs no
backend or credentials.

## Metric definitions (documented and tested)

- **Net revenue**: completed sales net of discounts, minus refunds; cancelled
  and pending orders excluded.
- **Orders**: distinct completed orders, not line items.
- **Average order value**: net revenue / completed orders; "N/A" at zero.
- **Customers**: distinct identifiable customers with completed orders;
  anonymous orders are never counted as people.
- **Repeat rate**: customers with two or more completed orders / customers
  with at least one.
- **Conversion rate**: only with traffic data; otherwise not shown.
- **Period comparison**: against the preceding period of the same length with
  the same filters.
- Days are grouped in the workspace's time zone; instants are stored in UTC.
- Money uses decimal arithmetic and `numeric` storage; currencies are never
  mixed in a sum.

Full definitions: [`metrics.md`](metrics.md).

## Import studio

CSV and XLSX. Select or drop a file, enforce size (5 MB) and row (10,000)
limits, parse in the browser, preview, choose whether a row is an order or an
order line, map fields, see row-level problems, choose duplicate handling,
confirm, import in bounded chunks with all-or-nothing semantics, refresh.
Sample CSV and XLSX template provided. Spreadsheets are untrusted: no macros or
formulas are run, cells are sanitised on display, exports neutralise formula
injection, the original file is never uploaded.

## Security and privacy

Row level security on every user-owned table, tested for cross-account
isolation. Validated inputs, protection against SQL injection, XSS,
spreadsheet injection and unsafe redirects. No service-role key in the
browser. Data deleted on request. No tracking cookies. A truthful privacy page.

## Quality

WCAG 2.2 AA intent: keyboard navigation, semantic markup, visible focus, chart
summaries, contrast, reduced motion, responsive tables. 360 px to widescreen.
Current Chromium, Firefox and Safari.

## Technology

Next.js 16 App Router, React, TypeScript, Tailwind CSS, shadcn/ui components,
Lucide icons, Recharts, Papa Parse, read-excel-file, decimal.js, Zod,
Supabase (PostgreSQL, Auth, row level security), Vitest, Playwright.

## Out of scope for v1

Bank, payment or advertising integrations, live syncing, paid AI features,
team features, billing, native apps, real-time collaboration, public file
hosting, unbounded uploads, uptime guarantees.
