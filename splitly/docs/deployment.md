# Splitly — Deployment

The requirements ask for proof, in stage 1, that the chosen stack actually deploys
to the chosen free host: a page and a server endpoint, with the real command
and its real output, not a claim of compatibility. This is that record.

## Host

**Vercel, Hobby plan** (free), chosen by the owner on 2026-10-12 in place of
the Cloudflare Workers target in the requirements. No adapter is involved: Next.js runs
there natively. The Cloudflare comparison the requirements describe was therefore
not run.

## The proof (2026-10-12)

Command, from the `splitly` folder:

```
npx vercel deploy --prod --yes --scope riddle6
```

Output (the lines that matter):

```
Vercel CLI 63.1.2 (Node.js 24.18.0)
Running build in Washington, D.C., USA (East) – iad1
Detected Next.js version: 16.3.8
✓ Compiled successfully in 7.7s
Build Completed in /vercel/output [31s]
  "status": "ok",
    "productionUrl": "https://splitly-self.vercel.app",
    "readyState": "READY",
```

Checked against the deployed site straight afterwards:

```
GET /api/health -> 200 {"ok":true,"service":"splitly","stage":1,"region":"iad1","time":"2026-10-12T08:55:48.779Z"}
307 /            [Accept-Language: ru-RU,ru;q=0.9]  -> /ru
307 /            [Accept-Language: en-US]           -> /en
200 /ru/demo            html lang="ru", Russian navigation, demo badge
200 /en/demo/profile
404 /en/nothing/here
Content-Security-Policy: … frame-ancestors 'self' https://web.telegram.org https://*.telegram.org …
X-Powered-By: (absent)
```

So on this host, with these exact versions: server-rendered pages, statically
generated pages for both languages, the request proxy (language redirect), a
dynamic API route, and response headers all work.

**Live: https://splitly-self.vercel.app**

## What was not proven yet

- The site opened inside Telegram: the Mini App address has to be set in
  @BotFather by the bot's owner, and then opened on a phone.
- (Proven since, 2026-10-12, with stage 2: secrets on the host and a database
  connection from it. See below.)
- The OCR worker and its language files served from the host (stage 3).

## Free-tier notes

- **Vercel Hobby** is for personal, non-commercial use, with its own limits on
  builds, requests and function time. A serverless function there is not
  bound by a 10 ms CPU budget, which is what made the Cloudflare free tier a
  risk for this project.
- **Supabase Free** allows two projects per account; Splitly shares one, in
  its own schema. A free project is paused after about a week without use.
- Limits change. Check the providers' pages; Splitly promises no uptime.

## Updating the deployment

```
cd splitly
npx vercel deploy --prod --yes --scope riddle6
```

`.vercelignore` keeps `.env*`, tests and scratch files out of the upload.
`vercel link` appends to `.gitignore` and writes a token into `.env.local`;
undo both after linking.

## Stage 2: what the host needs

**Deployed 2026-10-12** on the owner's word. The four variables are set on
Vercel (Production), and the two-person isolation check passes against the
live site: `node scripts/live-check.mjs https://splitly-self.vercel.app`,
15 of 15, test accounts removed afterwards. In a browser the live demo takes
an expense, and `/app` outside Telegram stays shut and points to the bot.
The steps, for the next time:

1. Set on the Vercel project `splitly` (Production), none of them with a
   `NEXT_PUBLIC_` name:
   - `DATABASE_URL` — the Supabase **transaction pooler** string
     (`…pooler.supabase.com:6543`), not the direct one.
   - `TELEGRAM_BOT_TOKEN` — from @BotFather. A secret.
   - `SESSION_SECRET` — at least 32 random characters. A secret.
   - `TELEGRAM_BOT_USERNAME` — the bot's @name without the @. Not a secret;
     it must be present **when the site is built**, because the pages that show
     it are prepared then.
2. `npx vercel deploy --prod --yes --scope riddle6`
3. In @BotFather: Bot Settings → Configure Mini App → set the address to
   `https://splitly-self.vercel.app/app` (the site picks the language).
4. Check: `node scripts/live-check.mjs https://splitly-self.vercel.app` runs the
   two-person isolation check against the deployment, then open the bot in
   Telegram on a phone.

Without those variables a deployment is the demo alone, and the data API
answers `503 not_configured`.

The functions run in Vercel's default region (iad1, US East) while the
database is in eu-west-1: every request crosses the Atlantic a few times.
It works; moving the functions next to the database is a stage 5 item.

The database: a Supabase project of Splitly's own. Migrations are applied with `npm run db:migrate` (journal in
`splitly_meta.migrations`); all three are applied. The schema `splitly` is not
exposed through Supabase's own API, has row security on every table and grants
nothing to `anon` or `authenticated`: only the server's own connection reads it.

## Stage 3: nothing new to configure

The scanner needs no variables and no migration (its tables were part of the
first schema). `npm run build` copies the reader's files into `public/ocr`
first; they are served as static files (the largest is about 4 MB). Not
deployed until the owner says so.

## Stage 5: where the functions run

`vercel.json` puts the functions in Dublin (`dub1`), next to the database
(Ireland). Before, they ran in the default US region and every request
crossed the Atlantic several times.

## Reproducing the deployment at no cost

1. A Supabase project (free): copy its **transaction pooler** connection
   string. `npm run db:migrate` with it in `.env.local` applies the schema.
2. A bot from @BotFather (free): its token and its @name.
3. A Vercel project (Hobby, free) with this folder as its root: set
   `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET` (32+ random
   characters) and `TELEGRAM_BOT_USERNAME`, then
   `npx vercel deploy --prod`.
4. In @BotFather: Bot Settings → Configure Mini App → the site's address
   followed by `/app`.
5. `node scripts/live-check.mjs https://<the site>` checks sign-in, isolation
   between people, receipts, payments and rates against the deployment, and
   removes what it made.

Without steps 1, 2 and 4 the site is the browser demo alone, which needs
nothing: `npm run build && npm start`.

What stays within the free tiers: no stored images (photos never leave the
device), one small schema, functions that do a handful of queries each, and
about 8 MB of reading data for the three languages served as static files.
