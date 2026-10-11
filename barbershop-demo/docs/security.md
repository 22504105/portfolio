# CUT&CO — Security and QA review (Phase 05)

**Who did this.** The brief asks for an independent audit by a QA subagent.
This review was done by the Lead Agent, the same agent that wrote the code, in
a separate pass against the built application. It is a self-review, not an
independent one. Anything that matters commercially should still be looked at
by someone else before real customers use it.

## What was checked

| Area | How | Result |
|---|---|---|
| Dependencies | `npm audit --omit=dev` | 0 known vulnerabilities |
| Authorisation of server actions | Read every exported action in `app/actions` | Every admin action starts with the role check (11 of 11); barber and client actions take identity from the session, never from the form |
| Direct access to the database API | Anonymous and signed-in REST calls against the real Supabase project (Phase 03/04) | No protected table readable or writable, no booking function callable |
| Double booking | Database tests with ten simultaneous customers | Exactly one wins |
| Hold expiry, DST, reminders, cutoff | Database tests | Pass |
| Response headers | `.tmp/qa/pwa.mjs` on a production build | See "Headers" |
| Offline behaviour | Same script, with the server stopped | No page is ever served from a cache |
| Structure and accessibility | `.tmp/qa/a11y.mjs`: 20 pages × 2 languages × 2 sizes | Pass after two fixes |
| Booking, accounts, admin, demo end to end | Headless Chrome against the production build and the real database | Pass |

## Findings and what was done

| # | Finding | Severity | State |
|---|---|---|---|
| 1 | Email-link tokens travelled in the query string (`?token=`), so they reached server access logs and anything that records request addresses | High | **Fixed.** Tokens now travel after `#`, which is never sent to a server; the page reads the token in the browser, removes it from the address bar and sends it in the body of a POST |
| 2 | No security headers: the site could be framed (clickjacking of admin buttons), no content security policy | High | **Fixed.** See "Headers" |
| 3 | Personal data of people who never confirmed a booking was kept forever; no way to erase one person's data | Medium | **Fixed.** `purge_stale_data` runs with the scheduler; `erase_customer` exists for requests. See "Personal data" |
| 4 | The client address used for throttling was read from `X-Forwarded-For` alone, which a client can set on hosts that do not overwrite it | Medium | **Fixed.** `lib/request.ts` prefers the headers the platform sets itself; limits per email and per account do not depend on it |
| 5 | A failing page showed the framework's default error screen | Low | **Fixed.** `app/[locale]/error.tsx`: a plain message in both languages and a reference code, no details |
| 6 | `X-Powered-By` advertised the framework | Low | **Fixed** |
| 7 | The logo link in the header was a 32-pixel-high target; the full price list skipped a heading level | Low (accessibility) | **Fixed** |
| 8 | A test depended on the time of night it was run | Low (QA) | **Fixed** |

## Headers

Set for every response in `next.config.ts`:

- `Content-Security-Policy`: scripts, styles, fonts and images from the site
  only; connections to the site and to Supabase Auth; no frames
  (`frame-ancestors 'none'`); forms post to the site only; no plugins.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin` (and `no-referrer` on the
  pages that receive an email link), `Permissions-Policy` with camera,
  microphone, location, payment and USB off, `Strict-Transport-Security`.

**Known limit.** `script-src` allows inline scripts, because Next.js starts
each page with them. Removing that needs a nonce per request, which would make
every page render on demand. The site renders no user-written HTML anywhere
(no `dangerouslySetInnerHTML`), which is the real defence here.

## Personal data

What is stored about a customer: name, email, phone, an optional note, and
their bookings. Nothing else; no payment card data ever (payments are recorded
as "cash" or "card at the counter" with an amount).

- **Kept:** confirmed, completed, cancelled and missed bookings, as the shop's
  records.
- **Removed automatically after 30 days** (`purge_stale_data`, called by the
  scheduler): holds that were never confirmed, customer records left with no
  booking and no account, expired link tokens, sent email jobs. Throttling
  counters go after a day.
- **Erasure on request:** `select public.erase_customer('person@example.com');`
  in the Supabase SQL editor. It removes the customer and every booking, with
  its history, tokens, queued emails and payments. It changes past analytics;
  that is why it is a deliberate act and not a button. The sign-in account, if
  any, is deleted separately under Authentication → Users.
- Neither function can be called through the public API.

## Residual risks, not fixed

| Risk | Why it stays | What would close it |
|---|---|---|
| The audit is a self-review | No subagent was run in this session | An independent review |
| Inline scripts allowed by the policy | See "Known limit" | Nonces and on-demand rendering |
| The database certificate is not verified unless `DATABASE_CA_CERT` is set | Works out of the box on Supabase's pooler | Set the variable in production |
| Emails Supabase sends itself (sign-up, password reset) were never exercised | Needs the redirect URL set in the dashboard and a real inbox | Do it once by hand before launch |
| Real delivery through Resend was never exercised | No Resend account configured | Configure and send one of each email. Turn **click tracking off** in Resend: a tracking redirect would see nothing secret, but must pass the `#` part through |
| Throttling by address is only as good as the host's headers | Fine on Vercel | Nothing on Vercel |
| Not tested on real phones, Safari or Firefox | Only Chrome was available | Manual pass |
| The signed-in admin workspace was checked on desktop in English only | The read-only demo, which shares its pages, was checked in both languages and sizes | Manual pass |
| Reminders need a scheduler that runs every few minutes | Vercel's free plan runs cron once a day | Supabase `pg_cron` or an external scheduler |
