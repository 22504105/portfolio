import "server-only";
import { randomUUID } from "node:crypto";
import { roleLines, TAKES_KEPT, type DubContent, type DubMode } from "@/lib/dub/model";
import type { Db } from "./db";
import {
  BACKGROUND_MAX_BYTES,
  checkBackground,
  checkImage,
  checkVideo,
  checkVoice,
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  VOICE_MAX_BYTES,
  type Checked,
} from "./media-check";
import {
  countOp,
  deleteObject,
  DOWNLOAD_SECONDS,
  downloadUrl,
  headObject,
  readObject,
  storageConfigured,
  UPLOAD_SECONDS,
  uploadUrl,
} from "./storage";

// Large media in object storage (lib/server/storage.ts), as the app sees it: who may upload what,
// how much, and who may see it. Every upload is two steps: the server records a pending object and
// hands the browser a signed PUT; the browser uploads; the server reads the object back, checks what
// it really is (lib/server/media-check.ts) and keeps it, or deletes it with the reason. Every read
// is a signed GET issued after the same kind of check, valid for minutes.

export type MediaKind = "video" | "voice" | "image" | "background";

export const LIMITS = {
  teacherVideoBytes: 300 * 1024 * 1024,
  teacherImageBytes: 50 * 1024 * 1024,
  teacherBackgroundBytes: 50 * 1024 * 1024,
  studentVoiceBytes: 50 * 1024 * 1024,
  pendingPerOwner: 5,
  /** A pending upload not completed within this is abandoned and cleaned up. */
  pendingMs: 60 * 60 * 1000,
  voiceKeepDays: 180,
} as const;

/** The whole bucket's budget, below the provider's free 10 GB, and when to warn; both configurable. */
export function globalLimits() {
  const cap = Number(process.env.MEDIA_GLOBAL_CAP_BYTES ?? 8 * 1024 ** 3);
  const warn = (process.env.MEDIA_WARN_AT ?? "0.7,0.9")
    .split(",")
    .map(Number)
    .filter((n) => n > 0 && n < 1)
    .sort();
  const dailyDownloads = Number(process.env.MEDIA_DAILY_DOWNLOADS ?? 2000);
  return { cap: Number.isFinite(cap) && cap > 0 ? cap : 8 * 1024 ** 3, warn, dailyDownloads };
}

export class MediaError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

const EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const ACCEPTS: Record<MediaKind, string[]> = {
  video: ["video/mp4", "video/webm"],
  voice: ["audio/webm", "audio/mp4"],
  image: ["image/png", "image/jpeg", "image/webp"],
  background: ["audio/mp4", "audio/webm", "audio/mpeg"],
};
const MAX_BYTES: Record<MediaKind, number> = {
  video: VIDEO_MAX_BYTES,
  voice: VOICE_MAX_BYTES,
  image: IMAGE_MAX_BYTES,
  background: BACKGROUND_MAX_BYTES,
};

export type Actor = { userId: string; teacher: boolean };

export async function actorOf(db: Db, userId: string): Promise<Actor> {
  const t = await db.query("select 1 from questling.teachers where user_id = $1", [userId]);
  return { userId, teacher: (t.rowCount ?? 0) > 0 };
}

async function totalBytes(db: Db, where: string, params: unknown[]): Promise<number> {
  const r = await db.query<{ n: string }>(`select coalesce(sum(size), 0)::bigint as n from questling.media_objects where ${where}`, params);
  return Number(r.rows[0].n);
}

/** Bytes stored across the whole bucket (pending uploads count: they may complete). */
export const globalBytes = (db: Db) => totalBytes(db, "true", []);

type VoiceContext = { exercise: string; line: string };

/** The student's open submission a voice take belongs to, and the line, if they may record it now. */
async function voiceTarget(db: Db, userId: string, ctx: VoiceContext) {
  const r = await db.query<{ submission: string; status: string; role: string; mode: DubMode; content: DubContent }>(
    `select s.id as submission, s.status, s.role, s.mode, v.content
       from questling.dub_submissions s
       join questling.dub_exercises e on e.id = s.exercise_id
       join questling.dub_versions v on v.exercise_id = s.exercise_id and v.version = s.version
      where s.user_id = $1 and e.slug = $2
        and exists (select 1 from questling.dub_assignments a join questling.group_members m on m.group_id = a.group_id
                     where a.exercise_id = s.exercise_id and a.version = s.version and m.user_id = $1)`,
    [userId, ctx.exercise],
  );
  const row = r.rows[0];
  if (!row || (row.status !== "recording" && row.status !== "retry")) return null;
  if (!roleLines(row.content, row.role, row.mode).some((l) => l.id === ctx.line)) return null;
  return { submission: row.submission };
}

/** Step 1: a pending object and a signed PUT for it. */
export async function requestUpload(
  db: Db,
  actor: Actor,
  input: { kind?: unknown; mime?: unknown; size?: unknown; rights?: unknown; exercise?: unknown; line?: unknown },
) {
  if (!storageConfigured()) throw new MediaError("storage_not_configured", 503);
  const kind = input.kind as MediaKind;
  if (!(kind in ACCEPTS)) throw new MediaError("invalid", 422);
  const mime = typeof input.mime === "string" ? input.mime.split(";")[0].trim().toLowerCase() : "";
  if (!ACCEPTS[kind].includes(mime)) throw new MediaError("type", 422);
  const size = Number(input.size);
  if (!Number.isInteger(size) || size < 1) throw new MediaError("invalid", 422);
  if (size > MAX_BYTES[kind]) throw new MediaError("too_large", 413);

  if (kind === "voice") {
    if (actor.teacher) throw new MediaError("forbidden", 403);
    const ctx = { exercise: String(input.exercise ?? ""), line: String(input.line ?? "") };
    if (!(await voiceTarget(db, actor.userId, ctx))) throw new MediaError("not_available", 409);
    if ((await totalBytes(db, "user_id = $1", [actor.userId])) + size > LIMITS.studentVoiceBytes) throw new MediaError("quota", 409);
  } else {
    if (!actor.teacher) throw new MediaError("forbidden", 403);
    // Teachers confirm the rights to what they upload (their own, or licensed for this use).
    if (input.rights !== true) throw new MediaError("rights", 422);
    const own = kind === "video" ? LIMITS.teacherVideoBytes : kind === "image" ? LIMITS.teacherImageBytes : LIMITS.teacherBackgroundBytes;
    if ((await totalBytes(db, "teacher_id = $1 and kind = $2", [actor.userId, kind])) + size > own) throw new MediaError("quota", 409);
  }
  const owner = kind === "voice" ? "user_id" : "teacher_id";
  const pending = await db.query<{ n: number }>(
    `select count(*)::int as n from questling.media_objects where ${owner} = $1 and status = 'pending'`,
    [actor.userId],
  );
  if (pending.rows[0].n >= LIMITS.pendingPerOwner) throw new MediaError("too_many_pending", 429);
  const { cap } = globalLimits();
  if ((await globalBytes(db)) + size > cap) throw new MediaError("storage_full", 507);

  const id = randomUUID();
  const key = `${kind}/${actor.userId}/${id}.${EXT[mime]}`;
  await db.query(
    `insert into questling.media_objects (id, ${owner}, kind, storage_key, mime, size, rights_confirmed) values ($1, $2, $3, $4, $5, $6, $7)`,
    [id, actor.userId, kind, key, mime, size, kind !== "voice"],
  );
  await countOp(db, "upload");
  return { id, url: uploadUrl(key, mime, size), contentType: mime, expiresIn: UPLOAD_SECONDS };
}

const CHECKS: Record<MediaKind, (bytes: Uint8Array) => Promise<Checked> | Checked> = {
  video: checkVideo,
  voice: checkVoice,
  image: checkImage,
  background: checkBackground,
};

type Row = {
  id: string;
  kind: MediaKind;
  storage_key: string;
  mime: string;
  size: string;
  status: string;
  user_id: string | null;
  teacher_id: string | null;
};

async function forget(db: Db, row: Pick<Row, "id" | "storage_key">) {
  await deleteObject(row.storage_key);
  await countOp(db, "delete");
  await db.query("delete from questling.media_objects where id = $1", [row.id]);
}

/**
 * A refusal after something was already deleted: returned, not thrown, so that the transaction
 * commits and the database agrees with storage (a throw would roll the row back, the object gone).
 */
const refused = (code: string, status: number) => ({ ok: false as const, error: new MediaError(code, status) });

/** Step 2: read the upload back, keep it if it is what it should be, else delete it and say why. */
export async function completeUpload(db: Db, actor: Actor, input: { id?: unknown; exercise?: unknown; line?: unknown }) {
  const id = typeof input.id === "string" && /^[0-9a-f-]{36}$/.test(input.id) ? input.id : null;
  if (!id) throw new MediaError("invalid", 422);
  const r = await db.query<Row>("select * from questling.media_objects where id = $1 for update", [id]);
  const row = r.rows[0];
  if (!row || (row.user_id ?? row.teacher_id) !== actor.userId) throw new MediaError("not_found", 404);
  if (row.status === "ready") throw new MediaError("already_done", 409);

  const head = await headObject(row.storage_key);
  if (!head) throw new MediaError("not_uploaded", 409);
  const max = MAX_BYTES[row.kind];
  if (head.size > max) {
    await forget(db, row);
    return refused("too_large", 413);
  }
  const bytes = await readObject(row.storage_key, max);
  await countOp(db, "read");
  const checked = bytes ? await CHECKS[row.kind](bytes) : ({ ok: false, reason: "damaged" } as const);
  if (!checked.ok) {
    await forget(db, row);
    return refused(checked.reason, 422);
  }
  // A voice take joins the student's submission; older takes of the line beyond the newest two go.
  let submission: string | null = null;
  if (row.kind === "voice") {
    const target = await voiceTarget(db, actor.userId, { exercise: String(input.exercise ?? ""), line: String(input.line ?? "") });
    if (!target) {
      await forget(db, row);
      return refused("not_available", 409);
    }
    submission = target.submission;
  }
  await db.query(
    `update questling.media_objects set status = 'ready', ready_at = now(), mime = $2, size = $3, duration_ms = $4, width = $5, height = $6,
       delete_after = case when kind = 'voice' then now() + make_interval(days => $7) else null end
     where id = $1`,
    [id, checked.mime, bytes!.length, checked.durationMs, checked.width ?? null, checked.height ?? null, LIMITS.voiceKeepDays],
  );
  if (submission) {
    await db.query("insert into questling.dub_takes (submission_id, line_id, media_id) values ($1, $2, $3)", [
      submission,
      String(input.line),
      id,
    ]);
    const old = await db.query<{ id: string; storage_key: string }>(
      `select o.id, o.storage_key from questling.dub_takes t join questling.media_objects o on o.id = t.media_id
        where t.submission_id = $1 and t.line_id = $2 order by t.created_at desc, t.id offset $3`,
      [submission, String(input.line), TAKES_KEPT],
    );
    for (const take of old.rows) await forget(db, take);
  }
  return {
    ok: true as const,
    media: {
      id,
      kind: row.kind,
      mime: checked.mime,
      size: bytes!.length,
      durationMs: checked.durationMs,
      width: checked.width,
      height: checked.height,
    },
  };
}

/** Whether `actor` may see object `id`, and its key. */
async function visible(db: Db, actor: Actor, id: string): Promise<Row | null> {
  const r = await db.query<Row>("select * from questling.media_objects where id = $1 and status = 'ready'", [id]);
  const row = r.rows[0];
  if (!row) return null;
  if ((row.user_id ?? row.teacher_id) === actor.userId) return row;
  if (row.kind === "voice") {
    // A teacher hears the takes of a submission to their own exercise by a student in their group.
    if (!actor.teacher) return null;
    const ok = await db.query(
      `select 1 from questling.dub_takes t
         join questling.dub_submissions s on s.id = t.submission_id
         join questling.dub_exercises e on e.id = s.exercise_id and e.teacher_id = $2
         join questling.dub_assignments a on a.exercise_id = s.exercise_id
         join questling.group_members m on m.group_id = a.group_id and m.user_id = s.user_id
        where t.media_id = $1 limit 1`,
      [id, actor.userId],
    );
    return ok.rowCount ? row : null;
  }
  // A teacher's picture for a story search, to a student whose group was given a published campaign using it.
  if (row.kind === "image") {
    const pictured = await db.query(
      `select 1 from questling.assignments a
         join questling.group_members m on m.group_id = a.group_id and m.user_id = $2
         join questling.quests q on q.slug = a.campaign
         join questling.quest_versions v on v.quest_id = q.id and v.status = 'published' and (a.version is null or v.version = a.version)
        where jsonb_path_exists(v.graph, '$.chapters[*].scenes[*] ? (@.kind == "search" && @.picture == $id)', jsonb_build_object('id', $1::text))
        limit 1`,
      [id, actor.userId],
    );
    return pictured.rowCount ? row : null;
  }
  // A teacher's scene media, to a student whose group was given a published version using it.
  const ok = await db.query(
    `select 1 from questling.dub_assignments a
       join questling.group_members m on m.group_id = a.group_id and m.user_id = $2
       join questling.dub_versions v on v.exercise_id = a.exercise_id and v.version = a.version and v.status = 'published'
      where v.content->>'video' = $1 or v.content->>'background' = $1 limit 1`,
    [id, actor.userId],
  );
  return ok.rowCount ? row : null;
}

/** A signed GET for an object the actor may see. */
export async function mediaLink(db: Db, actor: Actor, input: { id?: unknown }) {
  const id = typeof input.id === "string" && /^[0-9a-f-]{36}$/.test(input.id) ? input.id : null;
  if (!id) throw new MediaError("invalid", 422);
  const row = await visible(db, actor, id);
  if (!row) throw new MediaError("not_found", 404);
  const today = await db.query<{ n: number }>(
    "select coalesce(sum(count), 0)::int as n from questling.media_ops where day = current_date and op = 'download'",
  );
  if (today.rows[0].n >= globalLimits().dailyDownloads) throw new MediaError("daily_limit", 429);
  await countOp(db, "download");
  return { url: downloadUrl(row.storage_key), mime: row.mime, expiresIn: DOWNLOAD_SECONDS };
}

/** A teacher removes their own object, unless a published scene uses it. */
export async function removeMedia(db: Db, actor: Actor, input: { id?: unknown }) {
  const id = typeof input.id === "string" && /^[0-9a-f-]{36}$/.test(input.id) ? input.id : null;
  if (!id || !actor.teacher) throw new MediaError("invalid", 422);
  const r = await db.query<Row>("select * from questling.media_objects where id = $1 and teacher_id = $2 for update", [id, actor.userId]);
  if (!r.rows[0]) throw new MediaError("not_found", 404);
  const used = await db.query(
    `select 1 from questling.dub_versions v join questling.dub_exercises e on e.id = v.exercise_id
      where e.teacher_id = $2 and v.status = 'published' and (v.content->>'video' = $1 or v.content->>'background' = $1) limit 1`,
    [id, actor.userId],
  );
  if (used.rowCount) throw new MediaError("in_use", 409);
  await forget(db, r.rows[0]);
  return { status: "deleted" };
}

/** A teacher's own use, the bucket's, and today's operations, with the warning level reached. */
export async function usage(db: Db, actor: Actor) {
  const { cap, warn, dailyDownloads } = globalLimits();
  const all = await globalBytes(db);
  const own = await db.query<{ kind: MediaKind; n: string; count: number }>(
    "select kind, coalesce(sum(size), 0)::bigint as n, count(*)::int as count from questling.media_objects where teacher_id = $1 group by kind",
    [actor.userId],
  );
  const ops = await db.query<{ op: string; count: number }>("select op, count from questling.media_ops where day = current_date");
  const ratio = all / cap;
  return {
    configured: storageConfigured(),
    own: Object.fromEntries(own.rows.map((r) => [r.kind, { bytes: Number(r.n), count: r.count }])),
    limits: { video: LIMITS.teacherVideoBytes, image: LIMITS.teacherImageBytes, background: LIMITS.teacherBackgroundBytes },
    global: { bytes: all, cap, ratio, warning: warn.filter((w) => ratio >= w).at(-1) ?? null },
    today: { ...Object.fromEntries(ops.rows.map((r) => [r.op, r.count])), downloadLimit: dailyDownloads },
  };
}

/**
 * Housekeeping (daily, from the cron route): abandoned uploads, voice recordings past their keeping
 * time. Returns what was removed. Safe to run twice.
 */
export async function cleanup(db: Db, now = new Date()) {
  const stale = await db.query<{ id: string; storage_key: string }>(
    "select id, storage_key from questling.media_objects where status = 'pending' and created_at < $1 limit 200",
    [new Date(now.getTime() - LIMITS.pendingMs)],
  );
  const expired = await db.query<{ id: string; storage_key: string }>(
    "select id, storage_key from questling.media_objects where delete_after is not null and delete_after < $1 limit 500",
    [now],
  );
  for (const row of [...stale.rows, ...expired.rows]) await forget(db, row);
  return { abandoned: stale.rowCount ?? 0, expired: expired.rowCount ?? 0 };
}

/** Everything a deleted student stored: their recordings go from the bucket before their rows go. */
export async function forgetStudentMedia(db: Db, userId: string) {
  const own = await db.query<{ id: string; storage_key: string }>(
    "select id, storage_key from questling.media_objects where user_id = $1",
    [userId],
  );
  for (const row of own.rows) await forget(db, row);
  return own.rowCount ?? 0;
}
