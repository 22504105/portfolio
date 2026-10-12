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
- It is sent in an **`Authorization` header**, not a cookie, and kept in
  memory by the page. Two reasons: on Telegram Web the Mini App is a frame of
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
  party to. The exact matrix is fixed with the stage 2 code and tested.
- The stage 2 gate: two real sessions, each denied the other's private group,
  for every endpoint.

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

- Stored about a person: a display name, a Telegram user ID, a language.
  No phone number, no contact list, no location.
- Deleting an account and deleting a group are built in stage 2 and stage 5,
  and remove what they say they remove.
- No analytics, no tracking, no advertising.

## Known limits of this design

- A session token in the page's memory can be read by a script running in the
  page: the content security policy and the absence of third-party scripts
  (other than Telegram's own) are the defence.
- Anyone who obtains the bot token can forge sign-ins. It is a server secret
  and must be rotated in @BotFather if it leaks.
- The review in stage 5 will be a self-review by the agent that wrote the
  code unless the owner asks for an independent one.
