import "server-only";
import { createHash } from "node:crypto";
import { parseBuffer } from "music-metadata";
import { serverEnv, type Db } from "./db";
import { issueTicket, readTicket, SESSION_SECONDS } from "./session";

// Teachers' recordings (listening scenes, dialogues, the word of the day): checked by their content,
// stored on the server, served only to whom they are for.
//
// Storage: a table of the questling schema (migration 7), in the same Supabase project, with row level
// security on and no grants: only this server reads it. A Supabase Storage bucket would need the
// project's service-role key, which the server does not hold (it talks to PostgreSQL directly,
// docs/architecture.md §11); the functions below are the only place that would change. Limits keep it
// well inside the free plan's 500 MB.

export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_MS = 60_000;
const MIN_AUDIO_MS = 300;
/** How much a teacher may keep in all. */
export const TEACHER_AUDIO_QUOTA = 50 * 1024 * 1024;

export type AudioMime = "audio/mpeg" | "audio/mp4" | "audio/wav";
export type AudioCheck =
  { ok: true; mime: AudioMime; durationMs: number } | { ok: false; reason: "type" | "too_large" | "too_long" | "too_short" | "unreadable" };

const ascii = (bytes: Uint8Array, from: number, length: number) => String.fromCharCode(...bytes.subarray(from, from + length));

/** The format the bytes claim by their own signature (not by a file name). */
function sniff(bytes: Uint8Array): AudioMime | null {
  if (bytes.length < 12) return null;
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") return "audio/wav";
  if (ascii(bytes, 4, 4) === "ftyp" && /^(M4A |M4B |isom|iso2|mp41|mp42|dash)$/.test(ascii(bytes, 8, 4))) return "audio/mp4";
  if (ascii(bytes, 0, 3) === "ID3") return "audio/mpeg";
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  return null;
}

/** Checks a recording: its signature, that it decodes as that format, its length and size. */
export async function validateAudio(bytes: Uint8Array): Promise<AudioCheck> {
  const mime = sniff(bytes);
  if (!mime) return { ok: false, reason: "type" };
  if (bytes.length > MAX_AUDIO_BYTES) return { ok: false, reason: "too_large" };
  let seconds: number | undefined;
  try {
    const { format } = await parseBuffer(bytes, { mimeType: mime, size: bytes.length }, { duration: true, skipCovers: true });
    const codec = (format.codec ?? "").toLowerCase();
    const fits =
      mime === "audio/wav"
        ? format.container?.toUpperCase().includes("WAVE") && /pcm|adpcm|ieee/.test(codec)
        : mime === "audio/mp4"
          ? /aac|alac|mp4a/.test(codec) && !format.hasVideo
          : /mpeg|mp3|layer/.test(codec) || format.container === "MPEG";
    if (!fits || !format.numberOfChannels) return { ok: false, reason: "unreadable" };
    seconds = format.duration;
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (!seconds || !Number.isFinite(seconds)) return { ok: false, reason: "unreadable" };
  const durationMs = Math.round(seconds * 1000);
  if (durationMs > MAX_AUDIO_MS) return { ok: false, reason: "too_long" };
  if (durationMs < MIN_AUDIO_MS) return { ok: false, reason: "too_short" };
  return { ok: true, mime, durationMs };
}

export type MediaAsset = { id: string; name: string; mime: AudioMime; size: number; durationMs: number; createdAt: string };

/** A teacher's recordings, newest first, without their bytes. */
export async function teacherMedia(db: Db, teacherId: string): Promise<MediaAsset[]> {
  const rows = await db.query<{ id: string; name: string; mime: AudioMime; size: number; duration_ms: number; created_at: Date }>(
    "select id, name, mime, size, duration_ms, created_at from questling.media_assets where teacher_id = $1 order by created_at desc",
    [teacherId],
  );
  return rows.rows.map((r) => ({
    id: r.id,
    name: r.name,
    mime: r.mime,
    size: r.size,
    durationMs: r.duration_ms,
    createdAt: r.created_at.toISOString(),
  }));
}

type Refusal = Extract<AudioCheck, { ok: false }>["reason"];
export type SaveResult = { ok: true; asset: MediaAsset } | { ok: false; reason: Refusal | "quota" | "not_teacher" };

/** Stores a checked recording for a teacher, within their quota. */
export async function saveAudio(db: Db, teacherId: string, name: string, bytes: Uint8Array): Promise<SaveResult> {
  const teacher = await db.query("select 1 from questling.teachers where user_id = $1 for update", [teacherId]);
  if (teacher.rowCount === 0) return { ok: false, reason: "not_teacher" };
  const check = await validateAudio(bytes);
  if (!check.ok) return check;
  const used = await db.query<{ total: number }>(
    "select coalesce(sum(size), 0)::int as total from questling.media_assets where teacher_id = $1",
    [teacherId],
  );
  if (used.rows[0].total + bytes.length > TEACHER_AUDIO_QUOTA) return { ok: false, reason: "quota" };
  const clean =
    name
      .replace(/[^\p{L}\p{N} ._()-]/gu, "")
      .trim()
      .slice(0, 120) || "recording";
  const row = await db.query<{ id: string; created_at: Date }>(
    `insert into questling.media_assets (teacher_id, kind, mime, bytes, size, duration_ms, sha256, name)
     values ($1, 'audio', $2, $3, $4, $5, $6, $7) returning id, created_at`,
    [teacherId, check.mime, Buffer.from(bytes), bytes.length, check.durationMs, createHash("sha256").update(bytes).digest("hex"), clean],
  );
  return {
    ok: true,
    asset: {
      id: row.rows[0].id,
      name: clean,
      mime: check.mime,
      size: bytes.length,
      durationMs: check.durationMs,
      createdAt: row.rows[0].created_at.toISOString(),
    },
  };
}

/** Where a recording is used: published versions keep it (students may be playing them), drafts and daily entries name it. */
async function usesOf(db: Db, teacherId: string, id: string): Promise<{ published: number; draft: number; daily: number }> {
  const needle = `%"${id}"%`;
  const versions = await db.query<{ status: string; n: number }>(
    `select v.status, count(*)::int as n from questling.quest_versions v join questling.quests q on q.id = v.quest_id
      where q.teacher_id = $1 and v.graph::text like $2 group by v.status`,
    [teacherId, needle],
  );
  const daily = await db.query<{ n: number }>(
    "select count(*)::int as n from questling.daily_entries where teacher_id = $1 and content::text like $2",
    [teacherId, needle],
  );
  const of = (status: string) => versions.rows.find((r) => r.status === status)?.n ?? 0;
  return { published: of("published"), draft: of("draft"), daily: daily.rows[0].n };
}

/** Removes a teacher's recording, unless something still uses it. */
export async function deleteAudio(db: Db, teacherId: string, id: string): Promise<"deleted" | "not_found" | "in_use"> {
  const own = await db.query("select 1 from questling.media_assets where id = $1 and teacher_id = $2", [id, teacherId]);
  if (own.rowCount === 0) return "not_found";
  const uses = await usesOf(db, teacherId, id);
  if (uses.published + uses.draft + uses.daily > 0) return "in_use";
  await db.query("delete from questling.media_assets where id = $1 and teacher_id = $2", [id, teacherId]);
  return "deleted";
}

/** A recording's bytes, to serve. Whoever asks has already been checked (a ticket for this id). */
export async function loadAudio(db: Db, id: string): Promise<{ mime: AudioMime; bytes: Buffer } | null> {
  const row = await db.query<{ mime: AudioMime; bytes: Buffer }>("select mime, bytes from questling.media_assets where id = $1", [id]);
  return row.rows[0] ?? null;
}

/** The recordings a graph or a daily entry refers to (scene.audio, word.audio). */
export function audioIdsIn(value: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object")
      for (const [key, inner] of Object.entries(v)) {
        if (key === "audio" && typeof inner === "string") found.add(inner);
        else walk(inner);
      }
  };
  walk(value);
  return [...found];
}

// ——— Links: <audio> sends no headers, so a recording's address carries a ticket for that viewer and id ———

const purpose = (id: string) => `media:${id}`;

/** The address a viewer plays a recording from, good for as long as a session. */
export function mediaUrl(viewerId: string, id: string): string {
  return `/api/v1/media/${id}?ticket=${issueTicket(viewerId, purpose(id), serverEnv().sessionSecret, undefined, SESSION_SECONDS)}`;
}

/** Whether a ticket opens this recording. */
export const ticketOpens = (ticket: string | null, id: string) => !!ticket && !!readTicket(ticket, purpose(id), serverEnv().sessionSecret);

/**
 * Links to the recordings a student may hear: those named by the teacher campaign versions in their world
 * (assigned to their groups, or bound to their runs) and by their groups' words of the day, and only when
 * the recording belongs to the teacher whose campaign or entry names it.
 */
export async function studentMediaUrls(
  db: Db,
  userId: string,
  sources: { teacherOf: string; value: unknown }[],
): Promise<Record<string, string>> {
  const wanted = sources.flatMap((s) => audioIdsIn(s.value).map((id) => ({ id, teacher: s.teacherOf })));
  if (!wanted.length) return {};
  const rows = await db.query<{ id: string; teacher_id: string }>(
    "select id, teacher_id from questling.media_assets where id = any($1::uuid[])",
    [[...new Set(wanted.map((w) => w.id))].filter((id) => /^[0-9a-f-]{36}$/.test(id))],
  );
  const urls: Record<string, string> = {};
  for (const row of rows.rows)
    if (wanted.some((w) => w.id === row.id && w.teacher === row.teacher_id)) urls[row.id] = mediaUrl(userId, row.id);
  return urls;
}
