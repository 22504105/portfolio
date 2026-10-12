# Splitly — Deployment

The brief asks for proof, in stage 1, that the chosen stack actually deploys
to the chosen free host: a page and a server endpoint, with the real command
and its real output, not a claim of compatibility. This is that record.

## Host

**Vercel, Hobby plan** (free), chosen by the owner on 2026-10-12 in place of
the brief's Cloudflare Workers target. No adapter is involved: Next.js runs
there natively. The Cloudflare comparison the brief describes was therefore
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

- Environment variables and secrets on the host (none exist until stage 2).
- A database connection from the host (stage 2).
- The site opened inside Telegram (stage 2: needs a bot).
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
