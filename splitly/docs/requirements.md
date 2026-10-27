# Splitly - Product requirements

The specification Splitly was built against. Decisions that settle or depart
from a point here are listed in [`architecture.md`](architecture.md), section 1.

## Product

A Telegram Mini App, plus a public browser demo, for sharing expenses in a
group: create a group, add an expense by hand or from a photographed receipt,
assign items to people, see who owes whom and settle up. Russian and English
interface. No external OCR, translation, exchange-rate, notification or
storage service may be required for the core product.

Core journey: create a group -> photograph a receipt -> extract item lines ->
optionally translate names -> review and correct -> assign items to people ->
confirm the expense -> see balances -> settle.

OCR and translation are best-effort and never presented as perfect. No
financial entry is created without the user's explicit confirmation.

## Non-negotiable rules

1. One codebase for Telegram and the browser demo.
2. Real persistence for Telegram users; an isolated, deterministic demo.
3. Mobile first; accessible and usable on larger screens.
4. The original receipt text is kept; a translated or edited label is shown
   separately.
5. Expenses keep their original currency; a conversion rate, once recorded,
   never changes. Manual rates work without any API.
6. Correct minor units per currency, decimal conversion, explicit rounding,
   reconciled totals.
7. Group membership checked on every operation; client-supplied user ids are
   never trusted.
8. Financial writes are atomic; idempotency keys prevent double submission.
9. No fake buttons, no static results presented as live, no silent OCR guesses.

## Screens

Onboarding, home, groups, group detail, add expense, receipt capture, receipt
review, item assignment, balances, analytics, settings, and the browser demo
with a visible "Demo data" label and a reset.

## Financial invariants

- Every expense: payers' contributions = total = members' shares.
- Receipt allocations add up to each item, and items plus adjustments add up
  to the receipt total.
- Remainders are distributed by a deterministic largest-remainder rule.
- A member's net = paid - owed, adjusted by confirmed settlements.
- Proposed settlements do not change debts until confirmed.
- Simplified transfers are fewer, not advertised as the global minimum.
- No netting between currencies without a frozen conversion.
- History is never silently changed; edits create a replacement.
- Amounts are always shown with their currency code.

## Receipt scanner

Camera or upload with validation; rotation and contrast enhancement on the
device; OCR in the browser (Tesseract.js) for Turkish, English and Russian;
heuristic parsing of items, quantities, totals and discounts, with comma
decimals; never invented prices; translation through a local glossary only;
a review screen that flags low confidence and mismatched totals; per-item
assignment; atomic confirmation. Photos may contain sensitive data: OCR text
is not logged and images are not retained.

## Security

Telegram sign-in data is verified on the server (HMAC, expiry, constant-time
comparison); the unsigned copy is never trusted. Sessions are short-lived and
signed. No service-role key in the browser.

## Technology

Next.js App Router, TypeScript, Tailwind CSS, Lucide, Zod, decimal.js,
Tesseract.js, Supabase PostgreSQL, Vitest, Playwright. Versions pinned exactly.
