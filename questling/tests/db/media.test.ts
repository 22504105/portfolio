import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEMO_ARCHIVE_LINES, starterDub, type DubContent } from "@/lib/dub/model";
import { resetPool } from "@/lib/server/db";
import { actorOf, cleanup, completeUpload, mediaLink, removeMedia, requestUpload, usage } from "@/lib/server/media-store";
import { act, deleteStudent, join, signInWithTelegram } from "@/lib/server/service";
import { loadFacts } from "@/lib/server/store";
import { signInTeacher, studioAct, studioState } from "@/lib/server/studio-service";
import type { StudioAction } from "@/lib/studio/ops";
import { FAKE_CREDENTIALS, startFakeS3 } from "../../scripts/fake-s3";
import { TOKEN } from "../telegram-fixture";
import { startTestDatabase, type TestDatabase } from "./harness";

// Gates B and C on a real PostgreSQL and a storage stand-in that checks signatures like Backblaze B2:
// uploads checked by content, quotas, who may see what, takes kept two a line, submission, review and
// XP once, cleanup and deletion. (Real B2 is checked by scripts/storage-check.mjs once keys exist.)

let pg: TestDatabase;
let s3: Server;
const dir = path.resolve(".tmp/test-media-db");
const fixture = (name: string) => new Uint8Array(readFileSync(path.join("tests/fixtures/video", name)));
const stored = () => (existsSync(dir) ? readdirSync(dir).filter((f) => !f.endsWith(".type")).length : 0);

beforeAll(async () => {
  pg = await startTestDatabase();
  rmSync(dir, { recursive: true, force: true });
  s3 = await startFakeS3({ port: 54392, dir, bucket: "media" });
  Object.assign(process.env, {
    DATABASE_URL: pg.url,
    TELEGRAM_BOT_TOKEN: TOKEN,
    SESSION_SECRET: "test-only-session-secret-of-at-least-32-characters",
    MEDIA_S3_ENDPOINT: "http://localhost:54392",
    MEDIA_S3_REGION: FAKE_CREDENTIALS.region,
    MEDIA_S3_BUCKET: "media",
    MEDIA_S3_ACCESS_KEY_ID: FAKE_CREDENTIALS.accessKeyId,
    MEDIA_S3_SECRET_ACCESS_KEY: FAKE_CREDENTIALS.secretAccessKey,
  });
  await resetPool();
}, 120_000);

afterAll(async () => {
  await resetPool();
  s3?.close();
  await pg?.stop();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await pg.db.query("truncate questling.users, questling.rate_limits, questling.media_ops cascade");
  delete process.env.MEDIA_GLOBAL_CAP_BYTES;
});

async function tx<T>(run: (db: TestDatabase["db"]) => Promise<T>): Promise<T> {
  await pg.db.query("begin");
  try {
    const result = await run(pg.db);
    await pg.db.query("commit");
    return result;
  } catch (error) {
    await pg.db.query("rollback");
    throw error;
  }
}

const newTeacher = (n: number) =>
  tx((db) =>
    signInTeacher(db, {
      id: `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, "0")}`,
      email: `t${n}@example.com`,
      confirmed: true,
      displayName: `T${n}`,
    }),
  );
const studio = (teacherId: string, action: StudioAction) => tx((db) => studioAct(db, teacherId, { action }));
const idOf = (r: Awaited<ReturnType<typeof studio>>) => (r.outcome.kind === "ok" ? r.outcome.id! : "");
async function newStudent(n: number) {
  const userId = await tx((db) =>
    signInWithTelegram(db, { id: 7000 + n, firstName: "S", lastName: null, username: `s${n}`, languageCode: "ru", photoUrl: null }),
  );
  await tx((db) => act(db, userId, { action: { type: "chooseCharacter", characterId: "owl" } }));
  return userId;
}

/** Both steps of an upload, as the browser and the server do them. */
async function upload(userId: string, kind: string, mime: string, bytes: Uint8Array, extra: Record<string, unknown> = {}) {
  const ticket = await tx(async (db) =>
    requestUpload(db, await actorOf(db, userId), { kind, mime, size: bytes.length, rights: true, ...extra }),
  );
  const put = await fetch(ticket.url, { method: "PUT", body: Buffer.from(bytes), headers: { "content-type": ticket.contentType } });
  expect(put.status).toBe(200);
  const done = await tx(async (db) => completeUpload(db, await actorOf(db, userId), { id: ticket.id, ...extra }));
  if (!done.ok) throw done.error;
  return done.media;
}
const codeOf = (p: Promise<unknown>) => p.then(() => null).catch((e: { code?: string }) => e.code ?? String(e));

/** A teacher with a group, a published scene on their own video, assigned; and a student in the group. */
async function setUp(n = 1) {
  const teacher = await newTeacher(n);
  const groupId = idOf(await studio(teacher, { type: "createGroup", name: `Группа ${n}`, cefr: "A2" }));
  const code = (await tx((db) => studioState(db, teacher))).groups[0].inviteCode;
  const video = await upload(teacher, "video", "video/mp4", fixture("ok.mp4"));
  const exerciseId = idOf(await studio(teacher, { type: "createDub", title: "Archive scene", cefr: "A2" }));
  const content: DubContent = {
    ...starterDub("Archive scene", "A2"),
    video: video.id,
    trim: { start: 0, end: 3000 },
    lines: [
      { ...DEMO_ARCHIVE_LINES[0], start: 0, end: 1400 },
      { ...DEMO_ARCHIVE_LINES[1], start: 1500, end: 2900 },
    ],
  };
  await studio(teacher, { type: "saveDub", exerciseId, content });
  await studio(teacher, { type: "publishDub", exerciseId });
  await studio(teacher, { type: "assignDub", groupId, exerciseId });
  const slug = (await tx((db) => studioState(db, teacher))).dubs![0].slug;
  const student = await newStudent(n);
  await tx((db) => join(db, student, code));
  return { teacher, groupId, video, exerciseId, slug, student };
}

describe("uploads", () => {
  it("keep a real video after reading it back, and refuse what is not what it claims, deleting it", async () => {
    const teacher = await newTeacher(1);
    const video = await upload(teacher, "video", "video/mp4", fixture("ok.mp4"));
    expect(video).toMatchObject({ kind: "video", mime: "video/mp4", width: undefined });
    expect(video.durationMs).toBeGreaterThan(2900);
    const before = stored();
    await expect(upload(teacher, "video", "video/mp4", fixture("clip.mov"))).rejects.toMatchObject({ code: "type" });
    await expect(upload(teacher, "video", "video/mp4", fixture("hevc.mp4"))).rejects.toMatchObject({ code: "codec" });
    await expect(upload(teacher, "video", "video/mp4", fixture("long.mp4"))).rejects.toMatchObject({ code: "duration" });
    expect(stored()).toBe(before);
    const rows = await pg.db.query("select count(*)::int as n from questling.media_objects");
    expect(rows.rows[0].n).toBe(1);
  });

  it("refuse an upload never sent, a student uploading video, missing rights, and a type not allowed", async () => {
    const teacher = await newTeacher(2);
    const ticket = await tx(async (db) =>
      requestUpload(db, await actorOf(db, teacher), { kind: "video", mime: "video/mp4", size: 1000, rights: true }),
    );
    expect(await codeOf(tx(async (db) => completeUpload(db, await actorOf(db, teacher), { id: ticket.id })))).toBe("not_uploaded");
    const student = await newStudent(2);
    expect(
      await codeOf(
        tx(async (db) => requestUpload(db, await actorOf(db, student), { kind: "video", mime: "video/mp4", size: 10, rights: true })),
      ),
    ).toBe("forbidden");
    expect(
      await codeOf(tx(async (db) => requestUpload(db, await actorOf(db, teacher), { kind: "video", mime: "video/mp4", size: 10 }))),
    ).toBe("rights");
    expect(
      await codeOf(
        tx(async (db) => requestUpload(db, await actorOf(db, teacher), { kind: "video", mime: "video/quicktime", size: 10, rights: true })),
      ),
    ).toBe("type");
    expect(
      await codeOf(
        tx(async (db) =>
          requestUpload(db, await actorOf(db, teacher), { kind: "video", mime: "video/mp4", size: 30 * 1024 * 1024, rights: true }),
        ),
      ),
    ).toBe("too_large");
  });

  it("hold the teacher's 300 MB and the bucket's cap", async () => {
    const teacher = await newTeacher(3);
    const own = await tx(async (db) =>
      requestUpload(db, await actorOf(db, teacher), { kind: "video", mime: "video/mp4", size: 25 * 1024 * 1024, rights: true }),
    );
    await pg.db.query("update questling.media_objects set size = $2 where id = $1", [own.id, 25 * 1024 * 1024]);
    for (let i = 0; i < 11; i++)
      await pg.db.query(
        "insert into questling.media_objects (id, teacher_id, kind, storage_key, mime, size, status) values (gen_random_uuid(), $1::uuid, 'video', 'video/' || $1::text || '/' || gen_random_uuid() || '.mp4', 'video/mp4', $2, 'ready')",
        [teacher, 25 * 1024 * 1024],
      );
    expect(
      await codeOf(
        tx(async (db) =>
          requestUpload(db, await actorOf(db, teacher), { kind: "video", mime: "video/mp4", size: 1024 * 1024, rights: true }),
        ),
      ),
    ).toBe("quota");
    process.env.MEDIA_GLOBAL_CAP_BYTES = String(301 * 1024 * 1024);
    expect(
      await codeOf(
        tx(async (db) =>
          requestUpload(db, await actorOf(db, teacher), { kind: "image", mime: "image/png", size: 2 * 1024 * 1024, rights: true }),
        ),
      ),
    ).toBe("storage_full");
    const seen = await tx(async (db) => usage(db, await actorOf(db, teacher)));
    expect(seen.global.warning).toBe(0.9);
    expect(seen.own.video.bytes).toBe(300 * 1024 * 1024);
  });
});

describe("a scene from upload to approval", () => {
  it("shows the video only to the assigned group and its teacher", async () => {
    const { teacher, video, student } = await setUp(4);
    const link = await tx(async (db) => mediaLink(db, await actorOf(db, student), { id: video.id }));
    expect((await fetch(link.url, { headers: { range: "bytes=0-99" } })).status).toBe(206);
    expect((await tx(async (db) => mediaLink(db, await actorOf(db, teacher), { id: video.id }))).url).toContain(video.id);
    const outsider = await newStudent(99);
    expect(await codeOf(tx(async (db) => mediaLink(db, await actorOf(db, outsider), { id: video.id })))).toBe("not_found");
    const otherTeacher = await newTeacher(98);
    expect(await codeOf(tx(async (db) => mediaLink(db, await actorOf(db, otherTeacher), { id: video.id })))).toBe("not_found");
    // In use by a published scene: cannot be removed.
    expect(await codeOf(tx(async (db) => removeMedia(db, await actorOf(db, teacher), { id: video.id })))).toBe("in_use");
  });

  it("records takes (two kept a line), submits, is sent back, resubmits, is approved, and pays XP once", async () => {
    const { teacher, slug, student } = await setUp(5);
    await tx((db) => act(db, student, { action: { type: "startDub", exercise: slug, role: "student", mode: "voiceover" } }));
    // Only the role's line may be recorded.
    expect(await codeOf(upload(student, "voice", "audio/webm", fixture("voice.webm"), { exercise: slug, line: "l1" }))).toBe(
      "not_available",
    );
    expect(await codeOf(tx((db) => act(db, student, { action: { type: "submitDub", exercise: slug } })))).toBe("not_ready");
    const takes: { id: string }[] = [];
    for (let i = 0; i < 3; i++)
      takes.push(await upload(student, "voice", "audio/webm", fixture("voice.webm"), { exercise: slug, line: "l2" }));
    const kept = (await loadFacts(pg.db, student))!.dubs![0].takes.map((t) => t.mediaId);
    expect(kept.sort()).toEqual([takes[1].id, takes[2].id].sort());
    const first = await pg.db.query("select count(*)::int as n from questling.media_objects where id = $1", [takes[0].id]);
    expect(first.rows[0].n).toBe(0);

    await tx((db) => act(db, student, { action: { type: "submitDub", exercise: slug } }));
    // The teacher hears the takes; another teacher does not.
    expect((await tx(async (db) => mediaLink(db, await actorOf(db, teacher), { id: takes[2].id }))).url).toBeTruthy();
    const stranger = await newTeacher(97);
    expect(await codeOf(tx(async (db) => mediaLink(db, await actorOf(db, stranger), { id: takes[2].id })))).toBe("not_found");

    const submission = (await tx((db) => studioState(db, teacher))).dubSubmissions![0];
    expect(submission).toMatchObject({ status: "submitted", attempts: 1, role: "student" });
    await studio(teacher, {
      type: "reviewDub",
      submissionId: submission.id,
      decision: "retry",
      feedback: "Slower, please.",
      rubric: { pacing: "work" },
    });
    expect((await loadFacts(pg.db, student))!.dubs![0]).toMatchObject({
      status: "retry",
      feedback: "Slower, please.",
      rubric: { pacing: "work" },
    });
    await upload(student, "voice", "audio/mp4", fixture("voice.m4a"), { exercise: slug, line: "l2" });
    await tx((db) => act(db, student, { action: { type: "submitDub", exercise: slug } }));
    await studio(teacher, {
      type: "reviewDub",
      submissionId: submission.id,
      decision: "approve",
      rubric: { pacing: "good", stress: "good" },
    });
    const ledger = await pg.db.query("select amount, key from questling.ledger where user_id = $1 and reason = 'dub'", [student]);
    expect(ledger.rows).toEqual([{ amount: 40, key: `dub:${slug}@1` }]);
    expect(await codeOf(studio(teacher, { type: "reviewDub", submissionId: submission.id, decision: "approve" }))).toBe("not_submitted");
    // Approved: nothing more can be recorded for it.
    expect(await codeOf(upload(student, "voice", "audio/webm", fixture("voice.webm"), { exercise: slug, line: "l2" }))).toBe(
      "not_available",
    );
  });

  it("cleans abandoned uploads and recordings past their keeping time; a deleted student's recordings leave storage", async () => {
    const { slug, student } = await setUp(6);
    await tx((db) => act(db, student, { action: { type: "startDub", exercise: slug, role: "student", mode: "roleplay" } }));
    const take = await upload(student, "voice", "audio/webm", fixture("voice.webm"), { exercise: slug, line: "l2" });
    const pending = await tx(async (db) =>
      requestUpload(db, await actorOf(db, student), { kind: "voice", mime: "audio/webm", size: 100, exercise: slug, line: "l2" }),
    );
    await pg.db.query("update questling.media_objects set created_at = now() - interval '2 hours' where id = $1", [pending.id]);
    expect(await tx((db) => cleanup(db))).toEqual({ abandoned: 1, expired: 0 });
    await pg.db.query("update questling.media_objects set delete_after = now() - interval '1 day' where id = $1", [take.id]);
    expect(await tx((db) => cleanup(db))).toEqual({ abandoned: 0, expired: 1 });

    const again = await upload(student, "voice", "audio/webm", fixture("voice.webm"), { exercise: slug, line: "l2" });
    const before = stored();
    await tx((db) => deleteStudent(db, student));
    expect(stored()).toBe(before - 1);
    const left = await pg.db.query("select count(*)::int as n from questling.media_objects where id = $1", [again.id]);
    expect(left.rows[0].n).toBe(0);
  });
});
