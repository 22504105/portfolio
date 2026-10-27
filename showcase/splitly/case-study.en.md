# Splitly

**Status:** completed, deployed; full phone checklist in Telegram not yet run ·
**Live demo:** https://splitly-self.vercel.app (browser demo: https://splitly-self.vercel.app/en/demo;
in Telegram: https://t.me/Splitlly_bot) ·
**Code:** https://github.com/22504105/portfolio/tree/main/splitly

## Overview

A Telegram Mini App for sharing expenses in a group: trips, flats, dinners. It records who paid
and who took part, splits fairly to the cent, shows who owes whom and turns the debts into a short
list of transfers. A receipt can be photographed and split line by line. English and Russian; a
browser demo runs the same screens on invented data.

## Problem

Groups keep score in chats and spreadsheets, where mixed currencies, unequal shares and rounding
quickly produce totals nobody trusts. Splitting a long restaurant receipt by hand is tedious, and
asking friends to install yet another app is a barrier.

## Solution

Splitly opens inside Telegram with one tap; sign-in is the user's Telegram identity, verified on
the server. Each expense keeps its own currency and is never converted for debts; the number of
decimals comes from the currency itself. One function checks every expense, on the form, in the
demo and on the server, and the database itself refuses any expense whose payments and shares do
not add up. A receipt photo is read on the device, never uploaded: the user reviews the lines,
assigns them to people, and only the confirmed lines reach the server.

## Work done

- Requirements analysis, money rules and data model (`docs/architecture.md`).
- Telegram sign-in verification, signed sessions, group membership checks on every request.
- PostgreSQL schema with integrity triggers; expenses replaced, never edited in place.
- Expense form with equal, exact-amount and percentage splits, several payers, refunds.
- On-device receipt scanner: image preparation, OCR, parsing, review, item assignment.
- Balances, settlements, exchange rates (manual or fetched from the ECB table on request),
  analytics, activity feed, overview of all debts.
- PDF, XLSX and CSV reports; JSON copy of all data; downloads that work inside Telegram.
- Full redesign to an approved screen design, light and dark themes, wide layout.
- 269 unit and database tests, end-to-end tests on phone and desktop with axe accessibility checks,
  a live check against the real database.

## Key features

- Telegram sign-in, no passwords; browser demo with reset
- Groups with invitations by link or QR code, roles, guests without accounts
- Flexible splits, several payers, refunds, full history
- Receipt scanner: photo to lines to people, on the device
- Per-currency balances, simplified transfers, recorded payments
- Exchange rates for display totals only, never for debts
- Analytics, activity with unread marks, reminders ready to share
- Reports in PDF, XLSX and CSV

## Technology

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Zod, decimal.js, Tesseract.js,
pdf-lib, PostgreSQL (Supabase), Telegram Mini App APIs, Vitest, Playwright, GitHub Actions. Vercel
hosting.

## Technical challenges

- **Money correctness.** Integer minor units with per-currency decimals (JPY 0, KWD 3), one
  largest-remainder rule for every split, and a deferred database trigger that rejects any expense
  where paid, total and shares differ.
- **Telegram's constraints.** Inside Telegram Web the app runs in a frame where cookies are
  unreliable, so the session travels in a header and the language in the address. A page inside
  Telegram cannot save a file it makes, so reports are built on the server and handed to
  Telegram's downloader through a five-minute signed link.
- **Reading receipts on a phone.** The photo is prepared without lossy compression, read twice
  (as is and with the paper's tone evened out) and the readings merged by amounts; skew is
  corrected from word positions. Prices are found reliably; item names on real thermal receipts
  remain weak, which the review screen makes visible instead of hiding.
- **Privacy.** Photos never leave the device; only confirmed lines and a hash are sent.

## Screenshots

See [`screenshots.md`](screenshots.md).

## Short summary

A Telegram Mini App for splitting group expenses: flexible splits in any currency, a receipt
scanner that runs on the phone, balances and simplified transfers, reports in PDF, XLSX and CSV.
Money rules enforced in code and in the database, 269 automated tests. Next.js, TypeScript,
PostgreSQL.
