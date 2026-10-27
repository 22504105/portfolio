// Checks the real bucket with the app's own key and signing (lib/server/sigv4.ts), from .env.local:
// a signed upload with its content type and length (a bigger file refused), size and type read back, a byte range, a tampered and an
// expired link refused, the browser's CORS preflight from the site, deletion. Prints no secrets and
// leaves nothing behind.   npx tsx scripts/storage-check.mts
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { presign } from "../lib/server/sigv4";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const creds = { accessKeyId: env.MEDIA_S3_ACCESS_KEY_ID, secretAccessKey: env.MEDIA_S3_SECRET_ACCESS_KEY, region: env.MEDIA_S3_REGION };
const key = `voice/storage-check/${randomUUID()}.webm`;
const url = new URL(`${env.MEDIA_S3_ENDPOINT.replace(/\/+$/, "")}/${env.MEDIA_S3_BUCKET}/${key}`);
const sign = (method: "GET" | "PUT" | "HEAD" | "DELETE", expires = 60, headers?: Record<string, string>) =>
  presign(creds, { method, url, expires, headers });
const bytes = readFileSync("tests/fixtures/video/voice.webm");
// What the app signs for an upload: the type and the exact length (lib/server/storage.ts).
const upload = { "content-type": "audio/webm", "content-length": String(bytes.length) };
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) failed++;
};
try {
  const preflight = await fetch(sign("PUT", 60, { "content-type": "audio/webm" }), {
    method: "OPTIONS",
    headers: {
      Origin: "https://questling-dusky.vercel.app",
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  check(
    preflight.ok && preflight.headers.get("access-control-allow-origin") === "https://questling-dusky.vercel.app",
    "CORS: the site may upload straight to the bucket",
  );
  const foreign = await fetch(sign("PUT", 60, { "content-type": "audio/webm" }), {
    method: "OPTIONS",
    headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "PUT" },
  });
  check(!foreign.headers.get("access-control-allow-origin"), "CORS: another site may not");

  const wrongType = await fetch(sign("PUT", 60, upload), { method: "PUT", body: bytes, headers: { "content-type": "video/mp4" } });
  check(wrongType.status === 403, `an upload with another content type than signed is refused (${wrongType.status})`);
  const bigger = await fetch(sign("PUT", 60, upload), {
    method: "PUT",
    body: Buffer.concat([bytes, Buffer.alloc(100_000)]),
    headers: { "content-type": "audio/webm" },
  });
  check(bigger.status === 403, `a bigger file than signed is refused by storage (${bigger.status})`);
  const put = await fetch(sign("PUT", 60, upload), { method: "PUT", body: bytes, headers: { "content-type": "audio/webm" } });
  check(put.ok, `a signed upload goes into the private bucket (${put.status})`);

  const head = await fetch(sign("HEAD"), { method: "HEAD" });
  check(
    head.ok && Number(head.headers.get("content-length")) === bytes.length && head.headers.get("content-type") === "audio/webm",
    "size and type read back",
  );
  const range = await fetch(sign("GET"), { headers: { Range: "bytes=0-99" } });
  check(
    range.status === 206 && (await range.arrayBuffer()).byteLength === 100,
    "a byte range is served (phones need it for audio and video)",
  );
  const plain = await fetch(url, { method: "GET" });
  check(plain.status === 401 || plain.status === 403, `without a signature the file is closed (${plain.status})`);
  const tampered = sign("GET").replace(/X-Amz-Signature=([0-9a-f])/, (m, c) => `X-Amz-Signature=${c === "0" ? "1" : "0"}`);
  check((await fetch(tampered)).status === 403, "a tampered link is refused");
  const short = sign("GET", 1);
  // B2 allows a few seconds of clock difference and answers 401 for an expired link.
  await new Promise((r) => setTimeout(r, 6000));
  const late = (await fetch(short)).status;
  check(late === 401 || late === 403, `an expired link is refused (${late})`);
} finally {
  const del = await fetch(sign("DELETE"), { method: "DELETE" });
  check(del.ok || del.status === 204, `deleted (${del.status})`);
  const gone = await fetch(sign("HEAD"), { method: "HEAD" });
  check(gone.status === 404, "nothing left (the bucket keeps only the last version)");
}
if (failed) process.exitCode = 1;
