# Media storage (Backblaze B2)

Large media — teachers' videos, background sound and images, students' voice recordings — live in a
**private** bucket of S3-compatible storage. The owner chose Backblaze B2 (2026-10-26) after Cloudflare R2
could not be activated with the available card. Supabase keeps the database, auth and the media
metadata (`questling.media_objects`, migration 9); the bytes never enter PostgreSQL. The teachers'
older audio recordings (`media_assets`, migration 7) stay where they are.

## How it works

- `lib/server/sigv4.ts` signs S3 requests (AWS Signature V4, checked against AWS's published example).
- Upload, three steps: `POST /api/v1/media/upload` (the server checks who, what, quotas, records a pending
  object and returns a PUT URL valid 10 minutes for that one key and content type) → the browser PUTs the
  file to the bucket → `POST /api/v1/media/complete` (the server reads the object back, checks what it
  really is — `lib/server/media-check.ts` — keeps it, or deletes it and says why).
- Download: `POST /api/v1/media/link` returns a GET URL valid 15 minutes, only after checking that the
  asker may see it (owner; a student whose group was given a published scene using it; the teacher of
  a submission's exercise for its takes).
- Daily cleanup: `GET /api/v1/cron/media-cleanup` with `Authorization: Bearer CRON_SECRET` (Vercel Cron,
  `vercel.json`, 03:30 UTC) removes uploads never completed within an hour and voice recordings past
  180 days. Deleting a student removes their recordings from the bucket first.

| Kind       | Who     | Formats (checked by content)                                         | Size / length | Own quota                    |
| ---------- | ------- | -------------------------------------------------------------------- | ------------- | ---------------------------- |
| video      | teacher | MP4 H.264 (+AAC), WebM VP8/VP9 (+Opus/Vorbis); MOV and H.265 refused | 25 MB, 60 s   | 300 MB                       |
| background | teacher | M4A (AAC), WebM (Opus), MP3                                          | 5 MB, 60 s    | 50 MB                        |
| image      | teacher | PNG, JPEG, WebP, up to 4096 px                                       | 2 MB          | 50 MB                        |
| voice      | student | WebM/Opus (Chrome, Android), MP4/AAC (Safari, iOS)                   | 2 MB, 30 s    | 50 MB; two takes kept a line |

The whole bucket has a cap (`MEDIA_GLOBAL_CAP_BYTES`, default 8 GiB) checked before every upload, warning
levels (`MEDIA_WARN_AT`, default 70 % and 90 %) shown in Teacher Studio, and a daily ceiling of signed
download links (`MEDIA_DAILY_DOWNLOADS`, default 2000). Operations are counted per day in
`questling.media_ops` (a signed link counts once though a browser may make several range requests).

## Backblaze B2 free tier (checked 2026-10-26)

- The first 10 GB of storage is free; downloads are free up to 3× the average stored per month.
- Several sources (including Backblaze's own blog) say an account can be opened without a card and
  that a free account is **capped** at its free limits (uploads blocked) rather than billed. Not
  confirmed in Backblaze's current billing documentation; check **Caps & Alerts** in the account and
  set every cap to $0.
- Deleting through the S3 API only **hides** a file (B2 keeps versions): set the bucket's lifecycle to
  "Keep only the last version of the file", or hidden files keep using the free 10 GB.

## Setting it up (owner)

1. Create an account at backblaze.com → **B2 Cloud Storage**. Choose the **EU Central** region at sign-up
   (closest to the Supabase project in eu-west-1). Verify the email.
2. **Caps & Alerts**: set storage, download and transaction caps to **$0**, alerts on.
3. **Buckets → Create a Bucket**: a unique name (e.g. `questling-media-<something>`), **Files in Bucket:
   Private**, Default Encryption: Enable, Object Lock: Disable. Write down the bucket's **Endpoint**
   (e.g. `s3.eu-central-003.backblazeb2.com`).
4. On the bucket: **Lifecycle Settings → Keep only the last version of the file**.
5. **Application Keys → Add a New Application Key**: name `questling-media`, **Allow access to Bucket(s):
   only this bucket**, **Type of Access: Read and Write**, no prefix, no expiry. Copy `keyID` and
   `applicationKey` (shown once).
6. Put into `questling/.env.local` (never into chat or git):
   ```
   MEDIA_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
   MEDIA_S3_REGION=eu-central-003
   MEDIA_S3_BUCKET=<bucket name>
   MEDIA_S3_ACCESS_KEY_ID=<keyID>
   MEDIA_S3_SECRET_ACCESS_KEY=<applicationKey>
   CRON_SECRET=<32 random characters>
   ```
7. **CORS** (the browser uploads straight to the bucket). The web console's simple CORS options only
   allow downloads; uploads need a custom rule, set with Backblaze's command-line tool:
   ```
   ! pip install b2
   ! b2 account authorize          (type the MASTER key id and key when asked; nothing is shown)
   ```
   then Claude runs (or you do):
   ```
   b2 bucket update --cors-rules "[{\"corsRuleName\":\"questling\",\"allowedOrigins\":[\"https://questling-dusky.vercel.app\",\"https://questling-staging.vercel.app\",\"http://localhost:3100\",\"http://localhost:3300\"],\"allowedOperations\":[\"s3_put\",\"s3_get\",\"s3_head\"],\"allowedHeaders\":[\"content-type\",\"range\"],\"exposeHeaders\":[\"ETag\",\"Content-Length\",\"Content-Range\"],\"maxAgeSeconds\":3600}]" <bucket name> allPrivate
   ```
8. Vercel (production, only with the owner's word): the same six variables; then a redeploy (the
   page's Content-Security-Policy names the storage origin at build time).

## Checking

- Automated: `tests/storage.test.ts` (signatures, expiry, content checks), `tests/db/media.test.ts`
  (uploads, quotas, access, takes, review, XP, cleanup, deletion) — both against a stand-in
  (`scripts/fake-s3.ts`) that verifies signatures like B2.
- Locally against the stand-in: `npx tsx scripts/fake-s3.ts` and the `MEDIA_S3_*` values from
  `scripts/fake-s3.ts` (endpoint `http://localhost:54330`, bucket `questling-media`).
- On the working database: `npx tsx scripts/live-check.mjs <site>` — with storage configured it uploads a
  video and a take, checks links and refusals, approves, and removes everything it stored.
- Against the real bucket: `npx tsx scripts/storage-check.mts` (signed upload with its type and exact length —
  a bigger file is refused by B2 itself —, size read back,
  byte range, unsigned/tampered/expired links refused, CORS from the site only, deletion).
- **Not yet done**: real phones.

## Connected (2026-10-27)

- Bucket `-questling-media-ev26` (the leading hyphen is part of its name), EU Central
  (`https://s3.eu-central-003.backblazeb2.com`, region `eu-central-003`), private. CORS rule
  `questling` (PUT/GET/HEAD from the production site, the staging site and localhost 3100/3300) and the
  lifecycle "keep only the last version" were set through the B2 API with the master key.
- The app uses the key `questling-app`: this bucket only; listBuckets, listFiles, readFiles, writeFiles,
  deleteFiles. It is in `.env.local` (not in Vercel yet: that is part of the deployment, by the owner's word).
- Checked: `scripts/storage-check.mts` 12/12 (with the signed length since gate F); the live check on the working database with the real
  bucket 67/67, nothing visible left (deletes leave "hide" markers that the lifecycle removes a day later,
  so the bucket may briefly hold a little more than `media_objects` counts).
- B2 answers 401 (not 403) for an expired link, after a few seconds of allowed clock difference.
- To tidy (owner): remove `B2_MASTER_KEY_ID`/`B2_MASTER_KEY` from `.env.local` (only the setup needed them),
  and delete the earlier key `questling-media` in Application Keys — it is not limited to the bucket and
  can change bucket settings; the app does not use it.
