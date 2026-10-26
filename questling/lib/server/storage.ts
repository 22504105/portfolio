import "server-only";
import { presign, type Credentials } from "./sigv4";
import type { Db } from "./db";

// Private object storage for large media (teacher videos and images, students' voice recordings),
// through the S3-compatible API of whichever provider the deployment names: Backblaze B2 by
// default (owner's decision, 2026-10-26), anything S3-compatible works. The bucket is private; the
// browser only ever gets a URL signed for one object, one method and a few minutes, issued after the
// server has checked who is asking (lib/server/media-store.ts). Credentials stay on the server.
// Metadata, ownership and quotas live in PostgreSQL (migration 9); the bytes never do.

export type StorageConfig = Credentials & { endpoint: string; bucket: string };

export function storageConfig(): StorageConfig | null {
  const endpoint = (process.env.MEDIA_S3_ENDPOINT ?? "").replace(/\/+$/, "");
  const bucket = process.env.MEDIA_S3_BUCKET ?? "";
  const accessKeyId = process.env.MEDIA_S3_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.MEDIA_S3_SECRET_ACCESS_KEY ?? "";
  const region = process.env.MEDIA_S3_REGION ?? "";
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !region) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, region };
}

export const storageConfigured = () => storageConfig() !== null;

function required(): StorageConfig {
  const config = storageConfig();
  if (!config) throw new Error("media storage is not configured");
  return config;
}

/** Path-style address of an object (every S3-compatible provider accepts it). */
const objectUrl = (config: StorageConfig, key: string) => new URL(`${config.endpoint}/${config.bucket}/${key}`);

/** How long the browser's signed links live. */
export const UPLOAD_SECONDS = 10 * 60;
export const DOWNLOAD_SECONDS = 15 * 60;

/** A URL the browser PUTs one object to, with exactly this Content-Type. */
export function uploadUrl(key: string, contentType: string, seconds = UPLOAD_SECONDS): string {
  const config = required();
  return presign(config, { method: "PUT", url: objectUrl(config, key), expires: seconds, headers: { "content-type": contentType } });
}

/** A URL the browser reads one object from (video, audio and image elements, ranges included). */
export function downloadUrl(key: string, seconds = DOWNLOAD_SECONDS): string {
  const config = required();
  return presign(config, { method: "GET", url: objectUrl(config, key), expires: seconds });
}

async function signedFetch(method: "GET" | "HEAD" | "DELETE", key: string, init: RequestInit = {}) {
  const config = required();
  return fetch(presign(config, { method, url: objectUrl(config, key), expires: 60 }), { ...init, method, cache: "no-store" });
}

/** What storage holds under a key: its size and type, or null when nothing is there. */
export async function headObject(key: string): Promise<{ size: number; contentType: string } | null> {
  const response = await signedFetch("HEAD", key);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`storage HEAD ${response.status}`);
  return { size: Number(response.headers.get("content-length") ?? "0"), contentType: response.headers.get("content-type") ?? "" };
}

/** The object's bytes, refused past `max` (the server reads uploads back to check what they really are). */
export async function readObject(key: string, max: number): Promise<Uint8Array | null> {
  const response = await signedFetch("GET", key);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`storage GET ${response.status}`);
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > max) {
    await response.body?.cancel();
    throw new Error("object larger than allowed");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > max) throw new Error("object larger than allowed");
  return bytes;
}

export async function deleteObject(key: string): Promise<void> {
  const response = await signedFetch("DELETE", key);
  // Deleting what is not there is fine: the goal is that it is gone.
  if (!response.ok && response.status !== 404) throw new Error(`storage DELETE ${response.status}`);
}

export type StorageOp = "upload" | "download" | "read" | "delete";

/**
 * Counts operations per day, for the usage page and the daily guard: providers bill (or, on a free
 * account, block) by operations as well as bytes. A signed download link counts once, though the
 * browser may make several range requests with it: an estimate, documented as such.
 */
export async function countOp(db: Db, op: StorageOp, n = 1): Promise<void> {
  await db.query(
    `insert into questling.media_ops (day, op, count) values (current_date, $1, $2)
     on conflict (day, op) do update set count = questling.media_ops.count + excluded.count`,
    [op, n],
  );
}
