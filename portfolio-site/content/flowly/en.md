# Flowly

**Sales analytics for small shops: from an order export to clear, consistent numbers.**

**Live demo:** https://flowly-nine-ochre.vercel.app/demo (product site:
https://flowly-nine-ochre.vercel.app) ·
**Code:** https://github.com/22504105/portfolio/tree/main/flowly

**Role:** Full-Stack Developer responsible for implementing application functionality,
integrating frontend and backend components, and testing the resulting software.

## Overview

A business intelligence web app for small online shops and independent operators. Visitors explore
a complete demo workspace without signing up; registered users import their own orders from a CSV
or Excel file and get revenue, customers, trends, transactions and a printable report. A concept
project; the sample shop is invented.

## Problem

Small sellers have their sales history in an export from their shop platform but no analyst and no
budget for BI tools. Spreadsheets give totals that disagree from tab to tab, and it is easy to
count a refunded order as revenue or an anonymous order as a customer.

## Key features

- Instant demo workspace, no backend needed
- Seven preset periods or any range, compared with the previous period
- Filters by status, channel, category and product, shared across pages
- Overview KPIs, revenue trend, channel breakdown, top products
- Customers with order history; anonymous orders never counted as people
- Searchable, sortable transaction list with order details
- CSV/XLSX import with column matching and row-level problems
- Printable report (PDF through the browser) and CSV exports protected from formula injection
- Accounts with a private workspace; delete data or the whole account

## Design and user experience

A calm analytics tool: editorial type, a charcoal sidebar against warm near-white content and one
restrained violet accent. Data comes first, with no decorative effects. Light and dark themes with
contrast checked by tests, cards on small screens and full tables on wide ones, and a report laid
out as an A4 sheet so it prints exactly as it looks.

## How it works

Every figure is computed by one set of pure functions over one dataset, so no two pages can
disagree. Metrics have written definitions (net revenue, orders, average order value, repeat rate)
and are tested against a week worked out by hand. The import wizard reads the file in the browser,
lets the user match columns, shows every row that will be left out and why, and sends only
confirmed orders to the database, in chunks, all or nothing. Period, filters, sorting and the open
detail panel live in the address, so any view can be shared.

## What was built

- Requirements analysis, metric definitions and data model (`docs/metrics.md`,
  `docs/architecture.md`).
- Deterministic demo dataset generator (5,559 orders) used by the demo and the tests.
- Metric engine as pure functions; overview, analytics, customers, transactions, reports.
- CSV and XLSX import wizard with mapping, validation, duplicate handling and rollback.
- Supabase schema with row level security; import through a database function.
- Settings, data and account deletion, light and dark themes, printable A4 report.
- 194 unit and database tests, end-to-end tests in Chrome, Firefox and WebKit, accessibility sweep;
  43-step check against the live deployment.

## Technology

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui components on Base UI,
Recharts, Papa Parse, read-excel-file, decimal.js, Zod, Supabase (PostgreSQL, Auth, row level
security), Vitest, Playwright, GitHub Actions. Vercel hosting.

## Technical challenges

- **Consistent numbers.** One engine, two data sources (seeded demo or the user's database), so
  the pages cannot tell which they show and cannot disagree. Tests check that chart buckets,
  breakdown rows and customers' spend all add up to the same net revenue.
- **Untrusted spreadsheets.** Files are parsed in the browser with limits on size and rows, no
  formulas or macros are run, cells are sanitised, exports neutralise formula injection, and the
  database re-checks every order.
- **Money and time.** Decimal arithmetic and `numeric` storage, never floats; days grouped in the
  workspace's time zone, with daylight saving covered by tests.
- **Isolation.** Row level security on every table; tests on a real PostgreSQL prove one account
  cannot read, change or delete another's data through any table or function.

## Screenshots

See [`screenshots.md`](screenshots.md).

## About this demo

The demo workspace uses an invented shop and needs no account. Account sign-up and saved
workspaces are not enabled in this showcase.

## Short summary

A BI dashboard for small shops: import orders from CSV or Excel and get revenue, customers, trends
and a printable report, or try the full demo without signing up. Consistent metrics from one
tested engine, safe spreadsheet import, row level security. Next.js, TypeScript, Supabase.

## Contact

Evgeniy, Full-Stack Web Developer

- Telegram: [@Maybemol](https://t.me/Maybemol)
- Email: [evgeniyshade@gmail.com](mailto:evgeniyshade@gmail.com)
- GitHub: [github.com/22504105](https://github.com/22504105)

Pricing and timelines are discussed individually based on project requirements.
