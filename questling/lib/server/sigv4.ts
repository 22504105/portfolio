import { createHash, createHmac } from "node:crypto";

// AWS Signature Version 4 for S3-compatible storage (Backblaze B2, Cloudflare R2, MinIO, AWS):
// presigned URLs the browser uses for one upload or one download, and signed requests the server
// makes itself. No SDK: the algorithm is small, and tests/storage.test.ts checks it against AWS's
// published example. Only the server ever holds the secret.

export type Credentials = { accessKeyId: string; secretAccessKey: string; region: string };

const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

/** RFC 3986 encoding, as SigV4 wants it: everything but A–Z a–z 0–9 - _ . ~ */
export const encode = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** A path with each segment encoded and the slashes kept (S3 does not encode twice). */
const encodePath = (path: string) => path.split("/").map(encode).join("/");

const amzDate = (now: Date) =>
  now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

function signingKey(secret: string, day: string, region: string) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), "s3"), "aws4_request");
}

function canonicalQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((k) => `${encode(k)}=${encode(params[k])}`)
    .join("&");
}

/**
 * A presigned URL: anyone holding it may do `method` on that one object until it expires. Headers
 * listed in `signed` (besides host) must be sent exactly so, e.g. the upload's Content-Type.
 */
export function presign(
  creds: Credentials,
  opts: {
    method: "GET" | "PUT" | "HEAD" | "DELETE";
    url: URL;
    expires: number;
    now?: Date;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  },
): string {
  const now = opts.now ?? new Date();
  const date = amzDate(now);
  const day = date.slice(0, 8);
  const scope = `${day}/${creds.region}/s3/aws4_request`;
  const headers: Record<string, string> = {
    host: opts.url.host,
    ...Object.fromEntries(Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v.trim()])),
  };
  const names = Object.keys(headers).sort();
  const params: Record<string, string> = {
    ...(opts.query ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${creds.accessKeyId}/${scope}`,
    "X-Amz-Date": date,
    "X-Amz-Expires": String(opts.expires),
    "X-Amz-SignedHeaders": names.join(";"),
  };
  const canonical = [
    opts.method,
    encodePath(opts.url.pathname),
    canonicalQuery(params),
    names.map((n) => `${n}:${headers[n]}\n`).join(""),
    names.join(";"),
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", date, scope, sha256(canonical)].join("\n");
  const signature = createHmac("sha256", signingKey(creds.secretAccessKey, day, creds.region))
    .update(toSign)
    .digest("hex");
  return `${opts.url.origin}${encodePath(opts.url.pathname)}?${canonicalQuery({ ...params, "X-Amz-Signature": signature })}`;
}

/**
 * Checks a presigned URL the way storage does (used by the local stand-in, scripts/fake-s3.mjs, and
 * by tests): the signature, and that it has not expired. Returns the problem, or null.
 */
export function checkPresigned(
  creds: Credentials,
  method: string,
  url: URL,
  headers: Record<string, string | undefined>,
  now = new Date(),
): string | null {
  const q = Object.fromEntries(url.searchParams.entries());
  const signature = q["X-Amz-Signature"];
  if (!signature || q["X-Amz-Algorithm"] !== "AWS4-HMAC-SHA256") return "unsigned";
  if (!q["X-Amz-Credential"]?.startsWith(`${creds.accessKeyId}/`)) return "credential";
  const date = q["X-Amz-Date"] ?? "";
  const issued = Date.parse(
    `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`,
  );
  if (!Number.isFinite(issued) || now.getTime() > issued + Number(q["X-Amz-Expires"]) * 1000) return "expired";
  const names = (q["X-Amz-SignedHeaders"] ?? "").split(";");
  const signedHeaders: Record<string, string> = {};
  for (const name of names) if (name !== "host") signedHeaders[name] = headers[name] ?? "";
  const rest = Object.fromEntries(Object.entries(q).filter(([k]) => !k.startsWith("X-Amz-")));
  const again = presign(creds, {
    method: method as "GET",
    url: new URL(`${url.origin}${decodeURIComponent(url.pathname)}`),
    expires: Number(q["X-Amz-Expires"]),
    now: new Date(issued),
    headers: signedHeaders,
    query: rest,
  });
  return new URL(again).searchParams.get("X-Amz-Signature") === signature ? null : "signature";
}
