import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Facts } from "@/lib/game/facts";
import { runOf } from "@/lib/game/stats";
import { dayOf } from "@/lib/game/time";
import { handle } from "@/lib/server/api";
import { resetPool } from "@/lib/server/db";
import { issueSession } from "@/lib/server/session";
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, join, signInWithTelegram, state } from "@/lib/server/service";
import { signInTeacher, studioAct, studioState } from "@/lib/server/studio-service";
import { loadStudio, persistStudio } from "@/lib/server/studio-store";
import type { StudioAction } from "@/lib/studio/ops";
import { sign, TOKEN } from "../telegram-fixture";
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

describe("help requests", () => {
  it("the mentor's reply reaches the student who asked, and only them", async () => {
    const alice = await newTeacher(1);
    await studio(alice, { type: "createGroup", name: "Детективы A2", cefr: "A2" });
    const code = (await tx((db) => studioState(db, alice))).groups[0].inviteCode;
    const asking = await newStudent(5);
    const other = await newStudent(6);
    await tx((db) => join(db, asking, code));
    await tx((db) => join(db, other, code));
    // The request as the rules record it (askMentor, once the scene's attempts are used up).
    const ref = "forgotten-academy/tower-2";
    await tx((db) =>
      db.query("insert into questling.completions (user_id, kind, ref, at) values ($1, 'help_request', $2, now())", [asking, ref]),
    );
    // Only someone who asked can be answered.
    await expect(studio(alice, { type: "replyHelp", userId: other, ref, body: "x" })).rejects.toMatchObject({ code: "not_found" });
    await studio(alice, { type: "replyHelp", userId: asking, ref, body: "Перечитай свиток." });

    const seen = (await tx((db) => state(db, asking))).facts.world?.messages ?? [];
    expect(seen).toMatchObject([{ ref, body: "Перечитай свиток.", mentor: "Учитель 1" }]);
    expect((await tx((db) => state(db, other))).facts.world?.messages).toEqual([]);
  });
});

describe("the teacher's word of the day", () => {
  it("reaches the group's students on its day, graded on the server, its answer never in the student's state", async () => {
    const alice = await newTeacher(1);
    const groupId = idOf(await studio(alice, { type: "createGroup", name: "Детективы A2", cefr: "A2" }));
    const code = (await tx((db) => studioState(db, alice))).groups[0].inviteCode;
    const student = await newStudent(3);
    const outsider = await newStudent(4);
    await tx((db) => join(db, student, code));
    const today = dayOf(new Date());
    await studio(alice, {
      type: "setDaily",
      groupId,
      day: today,
      content: {
        word: { text: "lantern", ipa: "ˈlæntən", translation: { ru: "фонарь", en: "lantern" }, example: "The lantern shines." },
        fact: {
          title: "Lanterns",
          text: "Old lanterns burned oil.",
          explanation: { ru: "Старые фонари жгли масло.", en: "Old lanterns burned oil." },
          source: "A history book",
        },
        quiz: {
          question: "What did old lanterns burn?",
          options: [
            { id: "a", text: "water" },
            { id: "b", text: "oil" },
          ],
          correct: "b",
        },
      },
    });

    const seen = (await tx((db) => state(db, student))).facts;
    const entry = seen.world?.daily?.find((d) => d.day === today)?.entry;
    expect(entry?.word.text).toBe("lantern");
    // The teacher's source note is not shown to students, nor is the answer anywhere in their state.
    expect(entry?.fact.source).toBe("Учитель 1");
    expect(JSON.stringify(seen)).not.toContain("A history book");
    expect(JSON.stringify(seen.world?.daily)).not.toContain("correct");

    const wrong = await tx((db) => act(db, student, { action: { type: "answerDailyQuiz", option: "a" } }));
    expect(wrong.outcome).toMatchObject({ kind: "graded", correct: false });
    const right = await tx((db) => act(db, student, { action: { type: "answerDailyQuiz", option: "b" } }));
    expect(right.outcome).toMatchObject({ kind: "graded", correct: true });
    expect(right.facts.answers.filter((a) => a.scope === "daily").map((a) => a.ref)).toEqual([
      `${entry!.id}@${today}`,
      `${entry!.id}@${today}`,
    ]);

    // A student outside the group keeps the built-in word of the day.
    const other = (await tx((db) => state(db, outsider))).facts;
    expect(other.world?.daily ?? []).toEqual([]);
  });
});

describe("deleting", () => {
  it("a published version cannot be changed or deleted alone, but goes with its quest and its teacher", async () => {
    const alice = await newTeacher(1);
    const questId = idOf(await studio(alice, { type: "createQuest", title: "Тайна", cefr: "A2" }));
    await studio(alice, { type: "publish", questId });
    // The next draft is deletable on its own; the published v1 is not.
    await studio(alice, {
      type: "saveDraft",
      questId,
      graph: (await tx((db) => studioState(db, alice))).quests[0].versions[0].graph,
      keys: (await tx((db) => studioState(db, alice))).quests[0].versions[0].keys,
    });
    const drafts = await tx((db) => db.query("delete from questling.quest_versions where quest_id = $1 and status = 'draft'", [questId]));
    expect(drafts.rowCount).toBe(1);
    await expect(tx((db) => db.query("delete from questling.quest_versions where quest_id = $1", [questId]))).rejects.toMatchObject({
      code: "55000",
    });
    await expect(
      tx((db) => db.query("update questling.quest_versions set note = 'x' where quest_id = $1", [questId])),
    ).rejects.toMatchObject({ code: "55000" });
    // Removing the teacher's account takes their quest and its published version with it.
    await tx((db) => db.query("delete from questling.users where id = $1", [alice]));
    const left = await tx((db) => db.query("select count(*)::int as n from questling.quest_versions where quest_id = $1", [questId]));
    expect(left.rows[0].n).toBe(0);
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

  it("a teacher sees a shared student's work on built-in and own campaigns only, not on another teacher's", async () => {
    const alice = await newTeacher(11);
    const bob = await newTeacher(12);
    const aliceGroup = idOf(await studio(alice, { type: "createGroup", name: "Группа Алисы", cefr: "A2" }));
    const bobGroup = idOf(await studio(bob, { type: "createGroup", name: "Группа Боба", cefr: "A2" }));
    const questId = idOf(await studio(bob, { type: "createQuest", title: "Тайна Боба", cefr: "A2" }));
    await studio(bob, { type: "publish", questId });
    const bobFacts = await tx((db) => studioState(db, bob));
    const slug = bobFacts.quests[0].slug;
    await studio(bob, { type: "assign", groupId: bobGroup, campaign: slug });

    const student = await newStudent(13);
    const codes = [
      (await tx((db) => studioState(db, alice))).groups.find((g) => g.id === aliceGroup)!.inviteCode,
      bobFacts.groups[0].inviteCode,
    ];
    for (const code of codes) await tx((db) => join(db, student, code));
    const move = (m: object) => tx((db) => act(db, student, { action: { type: "story", campaign: slug, move: m } }));
    await move({ type: "advance", scene: "start" });
    await move({ type: "answer", scene: "question-1", answer: "table" });

    // Bob sees it; Alice sees the same student, but nothing of Bob's campaign.
    const ofBob = (await tx((db) => studioState(db, bob))).members.find((m) => m.userId === student)!;
    expect(ofBob.runs.some((r) => r.campaign === slug)).toBe(true);
    const ofAlice = (await tx((db) => studioState(db, alice))).members.find((m) => m.userId === student)!;
    expect(ofAlice).toBeTruthy();
    expect(JSON.stringify(ofAlice)).not.toContain(slug);
  });

  it("a student opened by an invite link joins the group; a stale code still lets them in", async () => {
    const alice = await newTeacher(21);
    await studio(alice, { type: "createGroup", name: "Ссылка-приглашение", cefr: "A2" });
    const code = (await tx((db) => studioState(db, alice))).groups[0].inviteCode;
    const open = (id: number, startParam: string) =>
      handle(
        new Request("http://localhost:3000/api/v1/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            initData: sign({
              auth_date: String(Math.floor(Date.now() / 1000)),
              user: JSON.stringify({ id, first_name: "S", username: `link${id}` }),
              start_param: startParam,
            }),
          }),
        }),
        ["session"],
      );
    const joined = await open(9201, code);
    expect(joined.status).toBe(200);
    expect((await joined.json()).account.group?.name).toBe("Ссылка-приглашение");
    const stale = await open(9202, "ZZZZ9999");
    expect(stale.status).toBe(200);
    expect((await stale.json()).account.group).toBeNull();
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

describe("teachers' recordings", () => {
  const SECRET = "test-only-session-secret-of-at-least-32-characters";
  const origin = "http://localhost:3000";
  const fixture = (name: string) => readFileSync(path.join(import.meta.dirname, "..", "fixtures", "audio", name));
  const upload = (token: string, bytes: Uint8Array, name = "line.mp3") =>
    handle(
      new Request(`${origin}/api/v1/studio/media`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", Authorization: `Bearer ${token}`, "X-File-Name": encodeURIComponent(name) },
        body: new Uint8Array(bytes),
      }),
      ["studio", "media"],
    );
  const remove = (token: string, id: string) =>
    handle(
      new Request(`${origin}/api/v1/studio/media/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      }),
      ["studio", "media", "delete"],
    );
  const fetchMedia = (url: string, range?: string) =>
    handle(new Request(`${origin}${url}`, { headers: range ? { Range: range } : {} }), url.split("?")[0].split("/").slice(3));
  const token = (userId: string) => issueSession(userId, SECRET).token;

  it("are uploaded by teachers only, checked by content, and removed only by their owner when unused", async () => {
    const alice = await newTeacher(31);
    const bob = await newTeacher(32);
    const student = await newStudent(33);

    const saved = await upload(token(alice), fixture("ok.m4a"), "Голос Алисы.m4a");
    expect(saved.status).toBe(200);
    const { asset } = await saved.json();
    expect(asset).toMatchObject({ mime: "audio/mp4", name: "Голос Алисы.m4a" });
    expect(asset.durationMs).toBeGreaterThan(1000);

    // Not a teacher; not audio; a renamed picture; too long.
    expect((await upload(token(student), fixture("ok.mp3"))).status).toBe(403);
    expect((await (await upload(token(alice), fixture("notaudio.png"), "x.mp3")).json()).error).toBe("type");
    expect((await (await upload(token(alice), fixture("fake.mp3"))).json()).error).toBe("unreadable");
    expect((await (await upload(token(alice), fixture("long.mp3"))).json()).error).toBe("too_long");

    // The teacher's own list, with a link that plays; not in another teacher's.
    expect((await tx((db) => studioState(db, alice))).media.map((m) => m.id)).toEqual([asset.id]);
    expect((await tx((db) => studioState(db, bob))).media).toEqual([]);
    const played = await fetchMedia(asset.url);
    expect(played.status).toBe(200);
    expect(played.headers.get("content-type")).toBe("audio/mp4");

    // Bob can neither delete it nor publish a campaign with it.
    expect((await remove(token(bob), asset.id)).status).toBe(404);
    const questId = idOf(await studio(bob, { type: "createQuest", title: "Чужой голос", cefr: "A2" }));
    const draft = (await tx((db) => studioState(db, bob))).quests[0].versions[0];
    const graph = structuredClone(draft.graph);
    (graph.chapters[0].scenes[0] as { audio?: string }).audio = asset.id;
    await studio(bob, { type: "saveDraft", questId, graph, keys: draft.keys });
    const refused = await tx((db) => studioAct(db, bob, { action: { type: "publish", questId } })).catch((e) => e);
    expect(refused.problems.join()).toMatch(/recording is not one of yours/);

    // Alice can delete her own when nothing uses it.
    expect((await remove(token(alice), asset.id)).status).toBe(200);
    expect((await fetchMedia(asset.url)).status).toBe(404);
  });

  it("reach the students of the group the campaign is assigned to, and nobody else; in use, they stay", async () => {
    const alice = await newTeacher(41);
    const groupId = idOf(await studio(alice, { type: "createGroup", name: "Слушатели", cefr: "A2" }));
    const code = (await tx((db) => studioState(db, alice))).groups[0].inviteCode;
    const { asset } = await (await upload(token(alice), fixture("ok.mp3"), "intro.mp3")).json();

    const questId = idOf(await studio(alice, { type: "createQuest", title: "Голоса", cefr: "A2" }));
    const draft = (await tx((db) => studioState(db, alice))).quests[0].versions[0];
    const graph = structuredClone(draft.graph);
    (graph.chapters[0].scenes[0] as { audio?: string }).audio = asset.id;
    await studio(alice, { type: "saveDraft", questId, graph, keys: draft.keys });
    await studio(alice, { type: "publish", questId });
    const slug = (await tx((db) => studioState(db, alice))).quests[0].slug;
    await studio(alice, { type: "assign", groupId, campaign: slug });

    const student = await newStudent(42);
    const outsider = await newStudent(43);
    await tx((db) => join(db, student, code));
    const world = (await tx((db) => state(db, student))).facts.world!;
    const url = world.media?.[asset.id];
    expect(url).toMatch(/^\/api\/v1\/media\/.+\?ticket=/);
    expect((await tx((db) => state(db, outsider))).facts.world?.media ?? {}).toEqual({});

    // The file, whole and in ranges (Safari asks for ranges); a ticket for another id opens nothing.
    const whole = await fetchMedia(url!);
    expect(whole.status).toBe(200);
    const size = Number(whole.headers.get("content-length"));
    const part = await fetchMedia(url!, "bytes=0-99");
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 0-99/${size}`);
    expect((await part.arrayBuffer()).byteLength).toBe(100);
    expect((await fetchMedia(url!, `bytes=${size + 10}-`)).status).toBe(416);
    const other = (await (await upload(token(alice), fixture("ok.wav"), "other.wav")).json()).asset.id;
    expect((await fetchMedia(url!.replace(asset.id, other))).status).toBe(403);
    expect((await fetchMedia(`/api/v1/media/${asset.id}?ticket=forged`)).status).toBe(403);

    // Published and played: it cannot be deleted under the students.
    expect((await remove(token(alice), asset.id)).status).toBe(409);
  });
});
