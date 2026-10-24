import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Facts } from "@/lib/game/facts";
import { runOf } from "@/lib/game/stats";
import { handle } from "@/lib/server/api";
import { resetPool } from "@/lib/server/db";
import { act, join, signInWithTelegram, state } from "@/lib/server/service";
import { signInTeacher, studioAct, studioState } from "@/lib/server/studio-service";
import { loadStudio, persistStudio } from "@/lib/server/studio-store";
import type { StudioAction } from "@/lib/studio/ops";
import { TOKEN } from "../telegram-fixture";
import { codeOf, startTestDatabase, type TestDatabase } from "./harness";

// Teacher Studio on a real PostgreSQL: teachers see and change only their own; students join by code
// and play what they were assigned; a published version never changes under a student's run.

let pg: TestDatabase;

beforeAll(async () => {
  pg = await startTestDatabase();
  process.env.DATABASE_URL = pg.url;
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  process.env.SESSION_SECRET = "test-only-session-secret-of-at-least-32-characters";
  process.env.SUPABASE_URL = "https://auth.test.example";
  process.env.SUPABASE_ANON_KEY = "test-publishable-key";
  await resetPool();
}, 120_000);

afterAll(async () => {
  await resetPool();
  await pg?.stop();
});

beforeEach(async () => {
  await pg.db.query("truncate questling.users, questling.rate_limits, questling.audit_log cascade");
});

afterEach(() => vi.unstubAllGlobals());

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

const teacherAccount = (n: number) => ({
  id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`,
  email: `teacher${n}@example.com`,
  confirmed: true,
  displayName: `Учитель ${n}`,
});
const newTeacher = (n: number) => tx((db) => signInTeacher(db, teacherAccount(n)));
const studio = (teacherId: string, action: StudioAction) => tx((db) => studioAct(db, teacherId, { action }));
const idOf = (result: Awaited<ReturnType<typeof studio>>) => (result.outcome.kind === "ok" ? result.outcome.id! : "");

async function newStudent(n: number): Promise<string> {
  const userId = await tx((db) =>
    signInWithTelegram(db, { id: 9000 + n, firstName: "S", lastName: null, username: `pupil${n}`, languageCode: "ru", photoUrl: null }),
  );
  await tx((db) => act(db, userId, { action: { type: "chooseCharacter", characterId: "fox" } }));
  return userId;
}

describe("teachers", () => {
  it("are found again by their Supabase account, and keep their name", async () => {
    const first = await newTeacher(1);
    expect(await newTeacher(1)).toBe(first);
    const facts = await tx((db) => studioState(db, first));
    expect(facts.teacher).toEqual({ userId: first, displayName: "Учитель 1", email: "teacher1@example.com" });
  });

  it("see and change only their own groups and students", async () => {
    const alice = await newTeacher(1);
    const bob = await newTeacher(2);
    const groupId = idOf(await studio(alice, { type: "createGroup", name: "Детективы A2", cefr: "A2" }));
    const code = (await tx((db) => studioState(db, alice))).groups[0].inviteCode;
    const student = await newStudent(1);
    await tx((db) => join(db, student, code.toLowerCase()));

    const aliceView = await tx((db) => studioState(db, alice));
    expect(aliceView.members.map((m) => m.userId)).toEqual([student]);
    const bobView = await tx((db) => studioState(db, bob));
    expect(bobView.groups).toEqual([]);
    expect(bobView.members).toEqual([]);

    // Bob cannot reach Alice's group by its id, through the rules...
    await expect(studio(bob, { type: "updateGroup", groupId, name: "Захвачено" })).rejects.toMatchObject({ code: "not_found" });
    await expect(studio(bob, { type: "removeMember", groupId, userId: student })).rejects.toMatchObject({ code: "not_found" });
    await expect(studio(bob, { type: "replyHelp", userId: student, ref: "forgotten-academy/tower-2", body: "x" })).rejects.toMatchObject({
      code: "not_found",
    });
    // ...nor by a forged effect: every write is scoped to the acting teacher.
    await tx((db) =>
      persistStudio(
        db,
        bob,
        [
          { type: "group.update", groupId, name: "Захвачено" },
          { type: "member.remove", groupId, userId: student },
        ],
        new Date(),
      ),
    );
    const still = await tx((db) => loadStudio(db, alice));
    expect(still?.groups[0].name).toBe("Детективы A2");
    expect(still?.members).toHaveLength(1);
    await expect(
      tx((db) =>
        persistStudio(
          db,
          bob,
          [{ type: "version.saveDraft", questId: groupId, version: 1, graph: {} as never, keys: {}, note: null }],
          new Date(),
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("a renewed invite code stops the old one; an archived group takes nobody", async () => {
    const alice = await newTeacher(1);
    const groupId = idOf(await studio(alice, { type: "createGroup", name: "Новички A1", cefr: "A1" }));
    const old = (await tx((db) => studioState(db, alice))).groups[0].inviteCode;
    await studio(alice, { type: "renewInvite", groupId });
    const student = await newStudent(2);
    await expect(tx((db) => join(db, student, old))).rejects.toMatchObject({ code: "not_found" });
    const renewed = (await tx((db) => studioState(db, alice))).groups[0].inviteCode;
    await studio(alice, { type: "archiveGroup", groupId, archived: true });
    await expect(tx((db) => join(db, student, renewed))).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("assignments and versions", () => {
  it("a student plays the assigned version of a teacher's campaign, and keeps it when a new one is published", async () => {
    const alice = await newTeacher(1);
    const groupId = idOf(await studio(alice, { type: "createGroup", name: "Детективы A2", cefr: "A2" }));
    const questId = idOf(await studio(alice, { type: "createQuest", title: "Тайна часов", cefr: "A2" }));
    await studio(alice, { type: "publish", questId });
    const facts = await tx((db) => studioState(db, alice));
    const slug = facts.quests[0].slug;
    await studio(alice, { type: "assign", groupId, campaign: slug });

    const student = await newStudent(3);
    await tx((db) => join(db, student, facts.groups[0].inviteCode));
    const seen = await tx((db) => state(db, student));
    expect(seen.account.group).toEqual({ name: "Детективы A2", mentor: "Учитель 1" });
    expect(seen.facts.world?.campaigns.map((c) => [c.id, c.version])).toEqual([[slug, 1]]);
    // The page never gets a teacher's answer keys.
    expect(JSON.stringify(seen.facts)).not.toMatch(/"correct"/);

    const move = (m: object) => tx((db) => act(db, student, { action: { type: "story", campaign: slug, move: m } }));
    await move({ type: "advance", scene: "start" });
    const answered = await move({ type: "answer", scene: "question-1", answer: "table" });
    expect(answered.outcome).toMatchObject({ kind: "story", answer: { correct: true } });

    // Version 2: edited and published, the assignment moved to it. The student's run stays on version 1.
    const v1 = (await tx((db) => studioState(db, alice))).quests[0].versions[0];
    const edited = structuredClone(v1.graph);
    edited.chapters[0].scenes[2] = { ...edited.chapters[0].scenes[2], text: "A changed ending." } as never;
    await studio(alice, { type: "saveDraft", questId, graph: edited, keys: v1.keys });
    await studio(alice, { type: "publish", questId });
    await studio(alice, { type: "assign", groupId, campaign: slug, version: 2 });
    const after: Facts = (await tx((db) => state(db, student))).facts;
    expect(runOf(after, slug)?.version).toBe(1);
    expect(after.world?.campaigns.map((c) => c.version).sort()).toEqual([1, 2]);
    const ended = await tx((db) =>
      act(db, student, { action: { type: "story", campaign: slug, move: { type: "advance", scene: "ending" } } }),
    ).catch((error) => error);
    // The run is at the ending already (the question led there): nothing more to play, and v1 is what it ended in.
    expect(ended).toMatchObject({ code: "not_available" });
    expect(runOf(after, slug)?.ending).toBe("ending");

    // The database itself refuses to change a published version.
    expect(
      await codeOf(() => pg.db.query("update questling.quest_versions set note = 'x' where quest_id = $1 and version = 1", [questId])),
    ).toBe("55000");
    expect(await codeOf(() => pg.db.query("delete from questling.quest_versions where quest_id = $1 and version = 1", [questId]))).toBe(
      "55000",
    );
  });

  it("a student not in a group sees no teacher's campaign, and cannot play one by its id", async () => {
    const alice = await newTeacher(1);
    const questId = idOf(await studio(alice, { type: "createQuest", title: "Секрет", cefr: "A1" }));
    await studio(alice, { type: "publish", questId });
    const slug = (await tx((db) => studioState(db, alice))).quests[0].slug;
    const student = await newStudent(4);
    expect((await tx((db) => state(db, student))).facts.world?.campaigns).toEqual([]);
    await expect(
      tx((db) => act(db, student, { action: { type: "story", campaign: slug, move: { type: "advance", scene: "start" } } })),
    ).rejects.toMatchObject({
      code: "not_available",
    });
  });
});

describe("the studio API", () => {
  const origin = "http://localhost:3000";
  const request = (method: string, path: string, init: { body?: unknown; token?: string } = {}) =>
    new Request(`${origin}/api/v1/${path}`, {
      method,
      headers: {
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  const route = (path: string) => path.split("/");

  /** A stand-in for Supabase Auth: one confirmed and one unconfirmed account. */
  function fakeAuth() {
    const fetcher = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const respond = (status: number, data: unknown) =>
        new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
      if (String(url).includes("grant_type=password")) {
        if (body.email === "elena@example.com" && body.password === "correct horse")
          return respond(200, {
            access_token: "x",
            user: {
              id: "bbbbbbbb-0000-4000-8000-000000000001",
              email: "elena@example.com",
              email_confirmed_at: "2026-10-25T00:00:00Z",
              user_metadata: { display_name: "Елена" },
            },
          });
        if (body.email === "new@example.com") return respond(400, { error_code: "email_not_confirmed" });
        return respond(400, { error_code: "invalid_credentials" });
      }
      if (String(url).includes("/signup"))
        return respond(200, { id: "cccccccc-0000-4000-8000-000000000001", email: body.email, identities: [{}] });
      return respond(404, {});
    });
    vi.stubGlobal("fetch", fetcher);
    return fetcher;
  }

  it("signs a teacher in with email and password, and keeps students out of the studio", async () => {
    const fetcher = fakeAuth();
    const wrong = await handle(
      request("POST", "studio/signin", { body: { email: "elena@example.com", password: "nope nope" } }),
      route("studio/signin"),
    );
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).error).toBe("invalid_credentials");
    const unconfirmed = await handle(
      request("POST", "studio/signin", { body: { email: "new@example.com", password: "whatever1" } }),
      route("studio/signin"),
    );
    expect((await unconfirmed.json()).error).toBe("email_not_confirmed");

    const good = await handle(
      request("POST", "studio/signin", { body: { email: "Elena@Example.com", password: "correct horse" } }),
      route("studio/signin"),
    );
    expect(good.status).toBe(200);
    const data = await good.json();
    expect(data.facts.teacher).toMatchObject({ displayName: "Елена", email: "elena@example.com" });
    // The password went to Supabase Auth only.
    expect(fetcher.mock.calls.every(([url]) => String(url).startsWith("https://auth.test.example/auth/v1/"))).toBe(true);

    const created = await handle(
      request("POST", "studio/actions", { token: data.token, body: { action: { type: "createGroup", name: "Искатели B1", cefr: "B1" } } }),
      route("studio/actions"),
    );
    expect(created.status).toBe(200);

    // A student's session is not a teacher's.
    const student = await newStudent(5);
    const { issueSession } = await import("@/lib/server/session");
    const studentToken = issueSession(student, process.env.SESSION_SECRET!).token;
    const refused = await handle(request("GET", "studio/state", { token: studentToken }), route("studio/state"));
    expect(refused.status).toBe(403);
    expect((await handle(request("GET", "studio/state"), route("studio/state"))).status).toBe(401);
  });

  it("registers a teacher with a confirmation email, and refuses a weak password before asking Supabase", async () => {
    const fetcher = fakeAuth();
    const weak = await handle(
      request("POST", "studio/signup", { body: { email: "a@example.com", password: "short", name: "Анна" } }),
      route("studio/signup"),
    );
    expect(weak.status).toBe(422);
    expect(fetcher).not.toHaveBeenCalled();
    const ok = await handle(
      request("POST", "studio/signup", { body: { email: "a@example.com", password: "long enough 1", name: "Анна" } }),
      route("studio/signup"),
    );
    expect(await ok.json()).toEqual({ status: "confirm_email" });
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain("redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fru%2Fstudio%2Flogin");
    expect(JSON.parse(String(init?.body))).toMatchObject({ email: "a@example.com", data: { display_name: "Анна" } });
  });

  it("shows why a campaign cannot be published", async () => {
    const alice = await newTeacher(1);
    const questId = idOf(await studio(alice, { type: "createQuest", title: "Сломанный", cefr: "A1" }));
    const draft = (await tx((db) => studioState(db, alice))).quests[0].versions[0];
    const broken = structuredClone(draft.graph);
    broken.chapters[0].scenes[0].next = "missing";
    await studio(alice, { type: "saveDraft", questId, graph: broken, keys: draft.keys });
    const { issueSession } = await import("@/lib/server/session");
    const token = issueSession(alice, process.env.SESSION_SECRET!).token;
    const response = await handle(
      request("POST", "studio/actions", { token, body: { action: { type: "publish", questId } } }),
      route("studio/actions"),
    );
    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.error).toBe("invalid_graph");
    expect(data.problems.join()).toMatch(/start leads to unknown scene missing/);
  });
});
