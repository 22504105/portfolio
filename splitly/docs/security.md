# Splitly — Security architecture

Written in stage 1, before any code that handles identity or money, so that
the later stages are built to it. It is a design; each stage's report says
what of it has been built and tested. The threat-model review of the finished
application comes in stage 5.

## What has to be protected

- **Who owes whom.** A wrong or forged entry costs someone real money.
- **Group privacy.** Who is in a group, what they bought, what they owe.
- **Receipts.** A photographed receipt can show a card's last digits, a name,
  a tax number, an address.

## Identity: Telegram, verified by the server

1. Inside Telegram, the Mini App receives `initData`: a signed string that
   says which Telegram user opened it and when.
2. The browser sends that string, as it is, to `POST /api/session`. It never
   sends a user ID of its own, and `initDataUnsafe` is never used for anything.
3. The server verifies it (stage 2):
   - computes HMAC-SHA256 over the data-check string with the key derived from
     the bot token, as Telegram specifies;
   - compares it with the given hash **in constant time**;
   - refuses data whose `auth_date` is older than a short window (minutes, not
     days), so a captured string cannot be replayed later;
   - only then reads the user's ID from the verified payload.
4. The server finds or creates the person and issues **its own session**.

The bot token and the session secret live in server environment variables
only. Neither has, or may ever get, a `NEXT_PUBLIC_` name.

## Sessions

- A session is a signed token (HMAC-SHA256, the server's own secret) holding
  the user's ID and an expiry, a few hours long, renewed by opening the app
  again (which carries fresh `initData`).
- It is sent in an **`Authorization` header**, not a cookie, and kept by the
  page for the life of the tab (in memory and in `sessionStorage`, so that a
  reload inside Telegram does not need sign-in data that has aged past its
  hour). Two reasons for the header: on Telegram Web the Mini App is a frame of
  another site, where cookies are often blocked; and a request can only carry
  the header if the page's own script put it there, so another site cannot
  make a signed-in browser act on its behalf (no CSRF by construction).
- State-changing endpoints accept JSON only and check the `Origin`.

## Authorisation: membership, checked on the server, every time

- Every operation names a group. Before anything is read or written, the
  server looks up **the session's user in that group's members** in the
  database. No client-supplied user ID, member ID or role is ever trusted.
- A member who has left (`removed_at`) has no access, immediately.
- Roles: the owner and admins manage the group, its members and invitations;
  every member can add expenses and propose or confirm settlements they are
  party to.
- The matrix, as built in stage 2 (`lib/server/service.ts`, the one place that
  decides) and tested route by route (`tests/db/api.test.ts`):

  | Action                                        | Member   | Manager         | Owner        |
  | --------------------------------------------- | -------- | --------------- | ------------ |
  | See the group, add an expense                 | yes      | yes             | yes          |
  | Change or cancel an expense                   | own only | any             | any          |
  | Add a person by name, invite, rename, archive | no       | yes             | yes          |
  | Remove a person                               | no       | members, guests | all but self |
  | Make someone a manager, delete the group      | no       | no              | yes          |
  | Leave the group                               | yes      | yes             | no           |

- A group someone is not in answers exactly as a group that does not exist
  (404, the same body), on every route: there is nothing to learn by probing.
- **The stage 2 gate, passed 2026-10-12**: two people signed in with data
  signed by the real bot's token, against the real database; each denied the
  other's private group on every route that names a group; neither able to put
  the other's member into an expense. 15 of 15 checks (`scripts/live-check.mjs`), the
  test accounts removed afterwards. The same is tested on every run against an
  embedded PostgreSQL.

## The database

- The application reaches PostgreSQL through **one server-side connection**.
  Its connection string is a server secret.
- Splitly's tables are in their own schema. The hosting platform's public API
  roles (`anon`, `authenticated`) are **granted nothing** in it and row level
  security is enabled on every table: the public API key that other
  applications in the same database may use cannot read or write a row of
  Splitly's. Tested in `tests/db/schema.test.ts`.
- **Money rules are constraints**, not conventions: an unbalanced expense
  cannot be committed, history cannot be edited in place, a member of another
  group cannot be referenced (see `architecture.md`, section 6).
- **Financial writes are one transaction** each, and carry an idempotency key
  chosen by the client once per submission: a double tap or a retry on a slow
  network is the same expense, not a second one.
- All SQL is parameterised.

## The demo

- The browser demo reads and writes **the visitor's own browser storage** and
  nothing else. It has no session, calls no data endpoint, and cannot reach a
  real user's records because it never talks to the server about data at all.
- It says "Demo data" on every screen and can be reset.

## Receipts

- A photograph is **read on the device** (Tesseract.js in a worker, with
  language data served by this site). It is not uploaded and not stored.
- What reaches the server is what the user confirmed: line labels, amounts,
  who takes what; and a hash of the image, to notice the same receipt twice.
- Nothing from a receipt goes to any external service. There is no AI
  provider in the application.
- The text a scanner reads is untrusted input: shown as text, never as
  markup; lengths are limited; amounts are parsed by the same strict rules as
  typed ones. Raw scanner output is never logged.
- Files are checked by type and by size before they are opened; EXIF is
  dropped by redrawing the image on a canvas before reading it.

## Invitations

- An invitation link carries a random token. The database stores only its
  hash, with an expiry, a use count and a revocation time.
- Joining requires a session (a Telegram identity); the link alone admits
  nobody.

## Limits

- Counters in the database (`rate_limits`, keyed by hashes) limit how often a
  session can be requested, an invitation tried, and expenses submitted.
  Vercel's free plan has no limiter of its own.
- Sizes are bounded everywhere: names, descriptions, lines per receipt,
  members per group, amounts.

## Headers

Set on every response (`next.config.ts`): a content security policy limited
to the site itself; **only Telegram's web clients may frame the site**
(`frame-ancestors`); no content-type sniffing; a strict referrer policy; the
camera allowed for this site only; HSTS. Inline scripts stay allowed because
Next.js starts pages with them.

## Privacy

- Stored about a person: a display name, a Telegram user ID, a language, and
  the address of their Telegram profile photo if Telegram sent one. No phone
  number, no contact list, no location, and no photo: the picture stays on
  Telegram's servers and is loaded from there by the browsers of the people in
  that person's groups, without a referrer.
- The photo address is read only from verified sign-in data, kept only if it
  is `https` on Telegram's own hosts (anything else is treated as no photo),
  replaced or cleared at every sign-in, and shown only to members of the
  person's groups. The content policy lets pages load images from the site
  itself and those hosts, nowhere else.
- Deleting an account (Profile) and deleting a group (its owner) are built and
  tested. An account's groups that are theirs alone go with it; in shared
  groups their member row stays, detached from the person and renamed "Former
  member", so nobody else's balances change. Ownership passes to a manager,
  or failing that the longest-standing member.
- No analytics, no tracking, no advertising.

## Known limits of this design

- A session token kept by the page (memory and `sessionStorage`) can be read
  by a script running in the page: the content security policy and the absence of third-party scripts
  (other than Telegram's own) are the defence.
- Anyone who obtains the bot token can forge sign-ins. It is a server secret
  and must be rotated in @BotFather if it leaks.
- The review in stage 5 will be a self-review by the agent that wrote the
  code unless the owner asks for an independent one.

## What stage 2 added, and how it is checked

- **Sign-in** (`lib/server/telegram.ts`): the HMAC of every field Telegram
  sent, compared in constant time; `auth_date` no older than an hour and not
  from the future; the user read only after the signature holds. Every way of
  being wrong gets one answer (401). Tested with forged, altered, stale and
  malformed data.
- **Rate limits** are counted in the database on a connection of their own,
  before the request's transaction opens: a refused attempt is still counted
  (the first version counted inside the transaction and lost the count with
  the rollback; a test caught it). Sign-in: 30 per address per 10 minutes.
  Writes and invitation attempts: per person.
- **Idempotency**: every expense submission carries a key made once per
  filled-in form; the same key again returns the expense already stored.
- **The API never echoes a database message or a stack trace**: unknown
  failures answer `server_error` and log the route without its identifiers or
  body.
- **Telegram's script** (`https://telegram.org/js/telegram-web-app.js`) is the
  only outside script the policy allows, and it is loaded only when Telegram
  opened the page, never for a visitor who arrived any other way.
- **The demo cannot reach real data**: it has no session and makes no call to
  `/api/v1` at all (a browser test listens for one).
- Not done: an independent review. This stage was written and reviewed by the
  same agent.

## What stage 3 added, and how it is checked

- **The photo never leaves the device.** It is read in a worker in the page,
  by an engine and language data served from this site (`/ocr/…`); the content
  policy allows connections to this site only, and a browser test fails if
  any request during a scan goes anywhere else or to the data API before the
  person confirms. What is sent on confirmation: the lines as the person left
  them, and the photo's SHA-256, to notice the same receipt twice.
- **No photo is stored anywhere**, and nothing read from one is logged: the
  activity log holds the total and the number of lines. The file's own data
  (place, time, device) is dropped when the photo is redrawn.
- **`'wasm-unsafe-eval'`** was added to the script policy: it lets the engine
  (WebAssembly from this site) be compiled, and allows no other kind of eval.
- **Shares are never taken from a client**: the server runs the same function
  as the screen on the lines and who had them, in one transaction with the
  expense; a receipt that is not ready is refused whole. Someone outside the
  group cannot add a receipt to it, or tell that it exists.
- **Duplicates**: the same photo in the same group, while its expense still
  counts, is refused unless the person says they mean it.
- **Limits**: 200 lines a receipt, 200 characters a name, 128 KB a request,
  15 MB and 12,000 pixels a photo (checked in the browser, where it is read).
- Checked by: `tests/receipt.test.ts` (parsing in three languages, the word
  list, 500 generated receipts that must balance), `tests/db/api.test.ts`
  ("receipts", on a real PostgreSQL), `e2e/scan.spec.ts` (the real recogniser
  in a real browser), and `scripts/live-check.mjs` against the real database.

## What stage 4 added, and how it is checked

- **Payments** follow the same door as everything else: the session's user
  must be a current member of the group, and both people in a payment must be
  current members of that same group. From outside, a group's payments and
  rates answer exactly like a group that does not exist.
- **Who may confirm or cancel** is decided on the server by the same function
  the screen uses to choose which buttons to show (`lib/balances/settle.ts`);
  hiding a button is never the protection.
- **A recorded rate cannot be altered**, by the application or by a direct
  update: the database refuses it.
- **The export is made in the browser** from what the person can already see.
  A cell that a spreadsheet would run as a formula is written as plain text.
- Checked by `tests/debts.test.ts` (2,300 generated cases that must settle to
  zero, mixed currencies, historical rates, rounding), the "settling up" and
  "exchange rates" parts of `tests/db/api.test.ts`, `e2e/money.spec.ts`, and
  `scripts/live-check.mjs` against the real database.
