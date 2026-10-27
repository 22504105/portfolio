import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { quickQuestKeys } from "@/lib/content/quick-quest-keys";
import type { Facts } from "@/lib/game/facts";
import { balance, dailyQuests } from "@/lib/game/stats";
import { dayOf } from "@/lib/game/time";
import { handle } from "@/lib/server/api";
import { resetPool } from "@/lib/server/db";
import { act, deleteStudent, exportData, ServiceError, signInWithTelegram } from "@/lib/server/service";
import { reviewOptions } from "@/lib/learning/vocab";
import { loadFacts } from "@/lib/server/store";
import { campaignById } from "@/lib/content/campaigns";
import { keysOf } from "@/lib/content/campaigns/keys";
import { runOf } from "@/lib/game/stats";
import { rightMove } from "@/lib/story/autoplay";
import { startRun } from "@/lib/story/run";
import { sign, TOKEN } from "../telegram-fixture";
import { codeOf, startTestDatabase, type TestDatabase } from "./harness";

// The student record on a real PostgreSQL: the schema's guarantees, the service, and the API.

let pg: TestDatabase;

beforeAll(async () => {
  pg = await startTestDatabase();
  process.env.DATABASE_URL = pg.url;
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  process.env.SESSION_SECRET = "test-only-session-secret-of-at-least-32-characters";
  await resetPool();
}, 120_000);

afterAll(async () => {
  await resetPool();
  await pg?.stop();
});

beforeEach(async () => {
  await pg.db.query("truncate questling.users, questling.rate_limits cascade");
});

const telegramUser = (id: number) => ({
  id,
  firstName: "Test",
  lastName: null,
  username: `student${id}`,
  languageCode: "ru",
  photoUrl: null,
});

/** Runs a service call in its own transaction, as the API does. */
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

async function newStudent(id = 1): Promise<string> {
  const userId = await tx((db) => signInWithTelegram(db, telegramUser(id)));
  await tx((db) => act(db, userId, { action: { type: "chooseCharacter", characterId: "cat" } }));
  return userId;
}

describe("the schema", () => {
  it("grants a reward once: a second ledger row with the same key is refused", async () => {
    const userId = await newStudent();
    const insert = () =>
      pg.db.query("insert into questling.ledger (user_id, currency, amount, key, reason) values ($1, 'xp', 10, 'quest:x', 'quest')", [
        userId,
      ]);
    expect(await codeOf(insert)).toBeNull();
    expect(await codeOf(insert)).toBe("23505");
  });

  it("never lets the coin balance go below zero, and never rewrites the ledger", async () => {
    const userId = await newStudent();
    expect(
      await codeOf(() =>
        tx((db) =>
          db.query(
            "insert into questling.ledger (user_id, currency, amount, key, reason) values ($1, 'coins', -1, 'purchase:x', 'purchase')",
            [userId],
          ),
        ),
      ),
    ).toBe("23514");
    await pg.db.query("insert into questling.ledger (user_id, currency, amount, key, reason) values ($1, 'coins', 5, 'k', 'quest')", [
      userId,
    ]);
    expect(await codeOf(() => pg.db.query("update questling.ledger set amount = 500 where user_id = $1", [userId]))).toBe("23514");
  });

  it("lets only owned items be worn", async () => {
    const userId = await newStudent();
    expect(
      await codeOf(() => pg.db.query("insert into questling.equipped (user_id, slot, item) values ($1, 'neck', 'red-bow')", [userId])),
    ).toBe("23503");
  });

  it("gives Supabase's public API roles nothing", async () => {
    await newStudent();
    for (const role of ["anon", "authenticated"] as const) {
      for (const table of ["users", "story_runs"])
        expect(await codeOf(() => pg.asApiRole(role, (db) => db.query(`select * from questling.${table}`)))).toBe("42501");
    }
  });
});

describe("the service", () => {
  it("finds the same student for the same Telegram account, and a new one for another", async () => {
    const first = await tx((db) => signInWithTelegram(db, telegramUser(7)));
    const again = await tx((db) => signInWithTelegram(db, telegramUser(7)));
    const other = await tx((db) => signInWithTelegram(db, telegramUser(8)));
    expect(again).toBe(first);
    expect(other).not.toBe(first);
  });

  it("stores exactly what the rules decided: the facts read back equal the ones computed", async () => {
    const userId = await newStudent();
    const quest = dailyQuests(dayOf(new Date()))[0];
    let computed: Facts | null = null;
    for (const [questionId, key] of Object.entries(quickQuestKeys[quest.id])) {
      const answer =
        key.kind === "choice"
          ? { kind: "choice", option: key.correct }
          : key.kind === "multi"
            ? { kind: "multi", options: key.correct }
            : key.kind === "fill"
              ? { kind: "fill", word: key.correct }
              : key.kind === "order"
                ? { kind: "order", tiles: key.correct }
                : { kind: "match", pairs: key.correct };
      computed = (await tx((db) => act(db, userId, { action: { type: "answerQuest", questId: quest.id, questionId, answer } }))).facts;
    }
    const stored = await loadFacts(pg.db, userId);
    expect(balance(stored!, "xp")).toBe(quest.xp);
    expect(balance(stored!, "coins")).toBe(quest.coins);
    expect(stored!.completions.map((c) => c.ref)).toEqual(computed!.completions.map((c) => c.ref));
    // Asking again is refused, not rewarded twice.
    const [questionId, key] = Object.entries(quickQuestKeys[quest.id])[0];
    await expect(
      tx((db) => act(db, userId, { action: { type: "answerQuest", questId: quest.id, questionId, answer: key } })),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it("refuses an action that is not shaped like one", async () => {
    const userId = await newStudent();
    for (const action of [undefined, {}, { type: "buy" }, { type: "grantXp", amount: 1000 }, { type: "buy", itemId: 5 }]) {
      await expect(tx((db) => act(db, userId, { action }))).rejects.toMatchObject({ code: "invalid" });
    }
  });

  it("lets two purchases at once spend the same coins only once", async () => {
    const userId = await newStudent();
    await pg.db.query("insert into questling.ledger (user_id, currency, amount, key, reason) values ($1, 'coins', 130, 'gift', 'demo')", [
      userId,
    ]);
    // Two connections, two transactions, one wallet that can pay for one of the two items.
    const { Client } = await import("pg");
    const clients = [new Client({ connectionString: pg.url }), new Client({ connectionString: pg.url })];
    await Promise.all(clients.map((c) => c.connect()));
    const buy = async (client: (typeof clients)[number], itemId: string) => {
      await client.query("begin");
      try {
        await act(client, userId, { action: { type: "buy", itemId } });
        await client.query("commit");
        return "bought";
      } catch (error) {
        await client.query("rollback");
        return (error as { code?: string }).code ?? "error";
      }
    };
    const results = await Promise.all([buy(clients[0], "forest-hood"), buy(clients[1], "brown-coat")]);
    await Promise.all(clients.map((c) => c.end()));
    expect(results.filter((r) => r === "bought")).toHaveLength(1);
    const stored = await loadFacts(pg.db, userId);
    expect(balance(stored!, "coins")).toBeGreaterThanOrEqual(0);
  });

  it("deletes everything of a student with the student", async () => {
    const userId = await newStudent();
    await pg.db.query("delete from questling.users where id = $1", [userId]);
    for (const table of ["auth_identities", "ledger", "answers", "completions", "saved", "inventory", "equipped"]) {
      expect((await pg.db.query(`select count(*)::int as n from questling.${table} where user_id = $1`, [userId])).rows[0].n).toBe(0);
    }
  });
});

describe("story runs", () => {
  const academy = campaignById.get("forgotten-academy")!;
  /** Plays right moves on the server until `until` or an ending; returns the facts the last move left. */
  async function playUntil(userId: string, until: string | null, choices: Record<string, string> = {}): Promise<Facts> {
    let facts = (await loadFacts(pg.db, userId))!;
    for (let step = 0; step < 100; step++) {
      const current = runOf(facts, academy.id) ?? startRun(academy);
      if (current.ending || current.scene === until) return facts;
      const move = rightMove(academy, keysOf(academy), current, choices)!;
      facts = (await tx((db) => act(db, userId, { action: { type: "story", campaign: academy.id, move } }))).facts;
    }
    throw new Error("story never ended");
  }

  it("keeps the run between sessions: the scene, the attempts used, the clues", async () => {
    const userId = await newStudent();
    await playUntil(userId, "tower-2");
    await tx((db) =>
      act(db, userId, { action: { type: "story", campaign: academy.id, move: { type: "answer", scene: "tower-2", answer: "garden" } } }),
    );
    const stored = (await loadFacts(pg.db, userId))!;
    const run = runOf(stored, academy.id)!;
    expect(run).toMatchObject({
      campaign: "forgotten-academy",
      version: academy.version, // new runs start on the latest version (2 since gate E)
      scene: "tower-2",
      chapters: ["prologue"],
      clues: ["prologue-tome", "seal"],
    });
    expect(run.progress["tower-2"]).toEqual({ used: 1, restored: 0, eliminated: ["garden"], solved: false });
    const row = await pg.db.query("select campaign, version from questling.story_runs where user_id = $1", [userId]);
    expect(row.rows).toEqual([{ campaign: "forgotten-academy", version: academy.version }]);
  });

  it("stores the grimoire's attempt, the help request, and the ending's reward once", async () => {
    const userId = await newStudent();
    await playUntil(userId, "prologue-1");
    const move = (m: object) => tx((db) => act(db, userId, { action: { type: "story", campaign: academy.id, move: m } }));
    await move({ type: "answer", scene: "prologue-1", answer: "eat" });
    await move({ type: "answer", scene: "prologue-1", answer: "sleep" });
    await expect(move({ type: "answer", scene: "prologue-1", answer: "whisper" })).rejects.toMatchObject({
      code: "exhausted",
      status: 409,
    });
    await tx((db) => act(db, userId, { action: { type: "askMentor", campaign: academy.id, scene: "prologue-1" } }));
    const studied = await move({ type: "grimoire", scene: "prologue-1", word: "must" });
    expect(studied.outcome).toMatchObject({ kind: "story", grimoire: { correct: true } });
    await move({ type: "answer", scene: "prologue-1", answer: "whisper" });

    const facts = await playUntil(userId, null, { "t-choice": "reread", "f-choice": "give" });
    expect(runOf(facts, academy.id)?.ending).toBe("end-true");
    const rows = await pg.db.query(
      "select kind, ref from questling.completions where user_id = $1 and kind in ('help_request', 'ending') order by kind",
      [userId],
    );
    expect(rows.rows).toEqual([
      { kind: "ending", ref: "forgotten-academy" },
      { kind: "help_request", ref: "forgotten-academy/prologue-1" },
    ]);
    const ending = await pg.db.query(
      "select currency, amount from questling.ledger where user_id = $1 and reason = 'ending' order by currency",
      [userId],
    );
    expect(ending.rows).toEqual([
      { currency: "coins", amount: 70 },
      { currency: "xp", amount: 250 },
    ]);
    // The story is over: no move is taken, and the reward cannot be granted again.
    await expect(move({ type: "advance", scene: "end-true" })).rejects.toMatchObject({ code: "not_available" });
    expect(
      await codeOf(() =>
        pg.db.query(
          "insert into questling.ledger (user_id, currency, amount, key, reason) values ($1, 'xp', 1, 'story:forgotten-academy:ending', 'ending')",
          [userId],
        ),
      ),
    ).toBe("23505");
  });

  it("refuses a move that is not shaped like one", async () => {
    const userId = await newStudent();
    for (const move of [
      { type: "teleport", scene: "end-true" },
      { type: "answer", scene: "prologue-1" },
      { type: "grimoire", scene: "x", word: "" },
    ])
      await expect(tx((db) => act(db, userId, { action: { type: "story", campaign: academy.id, move } }))).rejects.toMatchObject({
        code: "invalid",
        status: 422,
      });
    await expect(
      tx((db) => act(db, userId, { action: { type: "story", campaign: "echo-tower", move: { type: "advance", scene: "e-bell" } } })),
    ).rejects.toMatchObject({ code: "not_available" });
  });
});

describe("the API", () => {
  const origin = "http://localhost:3000";
  const request = (method: string, path: string, init: { body?: unknown; token?: string; origin?: string } = {}) =>
    new Request(`${origin}/api/v1/${path}`, {
      method,
      headers: {
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
        ...(init.origin ? { Origin: init.origin } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  const initData = (id: number) =>
    sign({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id, first_name: "Test", username: `s${id}`, language_code: "ru" }),
    });

  it("signs a student in from Telegram's signed data, and only from it", async () => {
    const good = await handle(request("POST", "session", { body: { initData: initData(501) } }), ["session"]);
    expect(good.status).toBe(200);
    const data = await good.json();
    expect(data.token).toEqual(expect.any(String));
    expect(data.account.telegram).toEqual({ username: "s501", id: 501 });

    const tampered = initData(502).replace("s502", "s503");
    expect((await handle(request("POST", "session", { body: { initData: tampered } }), ["session"])).status).toBe(401);
    expect((await handle(request("POST", "session", { body: { initData: "user=1" } }), ["session"])).status).toBe(401);
  });

  it("acts for the session's student only, and refuses strangers", async () => {
    const { token } = await (await handle(request("POST", "session", { body: { initData: initData(601) } }), ["session"])).json();
    const choose = await handle(
      request("POST", "actions", { token, body: { action: { type: "chooseCharacter", characterId: "owl" }, locale: "en" } }),
      ["actions"],
    );
    expect(choose.status).toBe(200);
    expect((await choose.json()).facts.profile.characterId).toBe("owl");

    expect((await handle(request("GET", "state"), ["state"])).status).toBe(401);
    expect((await handle(request("GET", "state", { token: `${token}x` }), ["state"])).status).toBe(401);
    expect(
      (
        await handle(request("POST", "actions", { token, origin: "https://evil.example", body: { action: { type: "claimDaily" } } }), [
          "actions",
        ])
      ).status,
    ).toBe(403);
    // A refusal by the rules is a 409 with its reason, not a server error.
    const refused = await handle(request("POST", "actions", { token, body: { action: { type: "claimDaily" } } }), ["actions"]);
    expect(refused.status).toBe(409);
    expect((await refused.json()).error).toBe("not_ready");
  });

  it("returns the state the student left, after a fresh sign-in", async () => {
    const first = await (await handle(request("POST", "session", { body: { initData: initData(701) } }), ["session"])).json();
    await handle(request("POST", "actions", { token: first.token, body: { action: { type: "chooseCharacter", characterId: "girl" } } }), [
      "actions",
    ]);
    const again = await (await handle(request("POST", "session", { body: { initData: initData(701) } }), ["session"])).json();
    expect(again.facts.profile.characterId).toBe("girl");
    const viaState = await (await handle(request("GET", "state", { token: again.token }), ["state"])).json();
    expect(viaState.facts.inventory).toHaveLength(3);
  });

  it("hands a student everything stored about them, and nobody else's", async () => {
    const mine = await (await handle(request("POST", "session", { body: { initData: initData(801) } }), ["session"])).json();
    await handle(request("POST", "actions", { token: mine.token, body: { action: { type: "chooseCharacter", characterId: "fox" } } }), [
      "actions",
    ]);
    const theirs = await (await handle(request("POST", "session", { body: { initData: initData(802) } }), ["session"])).json();

    expect((await handle(request("GET", "export"), ["export"])).status).toBe(401);
    const exported = await handle(request("GET", "export", { token: mine.token }), ["export"]);
    expect(exported.status).toBe(200);
    expect(exported.headers.get("cache-control")).toBe("no-store");
    const data = await exported.json();
    expect(data.format).toBe("questling-export-1");
    expect(data.identities).toEqual([expect.objectContaining({ provider: "telegram", subject: "801", username: "s801" })]);
    expect(data.users[0].character_id).toBe("fox");
    expect(data.inventory.length).toBeGreaterThan(0);
    // Every row is the student's own.
    for (const [table, rows] of Object.entries(data))
      if (Array.isArray(rows) && table !== "users")
        for (const row of rows as { user_id?: string }[]) expect(row.user_id, table).toBe(data.users[0].id);
    expect(JSON.stringify(data)).not.toContain("s802");
    expect(exported.headers.get("content-disposition")).toContain("attachment");

    // Telegram's downloader sends no headers: a ticket in the link stands for the session, for this only.
    const { url } = await (await handle(request("POST", "export/ticket", { token: mine.token, body: {} }), ["export", "ticket"])).json();
    const viaTicket = await handle(new Request(`${origin}${url}`), ["export"]);
    expect(viaTicket.status).toBe(200);
    expect((await viaTicket.json()).users[0].id).toBe(data.users[0].id);
    const ticket = new URL(url, origin).searchParams.get("ticket")!;
    expect((await handle(request("GET", "state", { token: ticket }), ["state"])).status).toBe(401);
    expect((await handle(new Request(`${origin}/api/v1/export?ticket=${ticket}x`), ["export"])).status).toBe(401);
    expect((await handle(request("POST", "export/ticket", { token: theirs.token, body: {} }), ["export", "ticket"])).status).toBe(200);
  });

  it("deletes a student and everything about them, only when asked plainly, and keeps others", async () => {
    const mine = await (await handle(request("POST", "session", { body: { initData: initData(901) } }), ["session"])).json();
    await handle(request("POST", "actions", { token: mine.token, body: { action: { type: "chooseCharacter", characterId: "cat" } } }), [
      "actions",
    ]);
    const theirs = await (await handle(request("POST", "session", { body: { initData: initData(902) } }), ["session"])).json();

    // Not without the confirmation, not from another site, not without a session.
    expect((await handle(request("POST", "account/delete", { token: mine.token, body: {} }), ["account", "delete"])).status).toBe(422);
    expect(
      (
        await handle(
          request("POST", "account/delete", { token: mine.token, origin: "https://evil.example", body: { confirm: "delete" } }),
          ["account", "delete"],
        )
      ).status,
    ).toBe(403);
    expect((await handle(request("POST", "account/delete", { body: { confirm: "delete" } }), ["account", "delete"])).status).toBe(401);

    const deleted = await handle(request("POST", "account/delete", { token: mine.token, body: { confirm: "delete" } }), [
      "account",
      "delete",
    ]);
    expect(deleted.status).toBe(200);
    const left = await pg.db.query<{ n: number }>(
      `select (select count(*) from questling.auth_identities where subject = '901')::int
            + (select count(*) from questling.ledger l join questling.auth_identities i on i.user_id = l.user_id where i.subject = '901')::int as n`,
    );
    expect(left.rows[0].n).toBe(0);
    // The old session now opens nothing; signing in again starts afresh.
    expect((await handle(request("GET", "state", { token: mine.token }), ["state"])).status).toBe(404);
    const fresh = await (await handle(request("POST", "session", { body: { initData: initData(901) } }), ["session"])).json();
    expect(fresh.facts.profile.characterId).toBeNull();
    // The other student is untouched.
    expect((await handle(request("GET", "state", { token: theirs.token }), ["state"])).status).toBe(200);
  });
});

describe("the word journal on the database (gate D)", () => {
  it("keeps a word as the rules decided, reads it back the same, exports it, and deletes it with the student", async () => {
    const userId = await newStudent(41);
    const now = new Date();
    const today = dayOf(now);
    const kept = await tx((db) => act(db, userId, { action: { type: "keepWord", ref: `daily:${today}` } }, now));
    expect(kept.facts.vocab).toHaveLength(1);
    const card = kept.facts.vocab[0];
    expect(card.source).toBe("daily");

    const flagged = await tx((db) => act(db, userId, { action: { type: "flagWord", ref: card.ref, favorite: true } }, now));
    const stored = await loadFacts(pg.db, userId);
    expect(stored!.vocab).toEqual(flagged.facts.vocab);
    expect(stored!.vocab[0]).toMatchObject({ favorite: true, known: false, schedule: { due: card.schedule.due, ease: 250 } });

    // Kept twice: refused, nothing changes. A made-up reference: refused.
    await expect(tx((db) => act(db, userId, { action: { type: "keepWord", ref: `daily:${today}` } }, now))).rejects.toThrow(ServiceError);
    await expect(tx((db) => act(db, userId, { action: { type: "keepWord", ref: "gloss:t-x:y:z" } }, now))).rejects.toThrow(ServiceError);
    await expect(tx((db) => act(db, userId, { action: { type: "reviewWord", ref: card.ref, option: "e" } }, now))).rejects.toThrow(
      ServiceError,
    );

    const exported = await exportData(pg.db, userId);
    expect((exported.vocab as { ref: string }[]).map((r) => r.ref)).toEqual([card.ref]);

    await tx((db) => deleteStudent(db, userId));
    expect((await pg.db.query("select count(*)::int as n from questling.vocab where user_id = $1", [userId])).rows[0].n).toBe(0);
  });

  it("pays a review once per card and day, through the ledger's unique key", async () => {
    const userId = await newStudent(42);
    const now = new Date();
    const card = (await tx((db) => act(db, userId, { action: { type: "keepWord", ref: `daily:${dayOf(now)}` } }, now))).facts.vocab[0];
    const due = new Date(now.getTime() + 86_400_000);
    const facts = (await loadFacts(pg.db, userId))!;
    const right = reviewOptions(facts, card, dayOf(due)).find((o) => o.text === card.ru)!.id;
    const done = await tx((db) => act(db, userId, { action: { type: "reviewWord", ref: card.ref, option: right } }, due));
    expect(done.outcome).toMatchObject({ kind: "review", correct: true, rewarded: 2 });
    const rows = await pg.db.query("select amount, reason from questling.ledger where user_id = $1 and reason = 'review'", [userId]);
    expect(rows.rows).toEqual([{ amount: 2, reason: "review" }]);
    await expect(tx((db) => act(db, userId, { action: { type: "reviewWord", ref: card.ref, option: right } }, due))).rejects.toThrow(
      ServiceError,
    );
  });
});

describe("story rewards on the database (gate E)", () => {
  it("a picture search found in order gives its item once, kept with the source 'story'", async () => {
    const userId = await newStudent(51);
    const academy = campaignById.get("forgotten-academy")!;
    for (let i = 0; i < 80; i++) {
      const facts = (await loadFacts(pg.db, userId))!;
      const run = runOf(facts, academy.id) ?? startRun(academy);
      if (run.scene === "f-search") break;
      await tx((db) =>
        act(db, userId, { action: { type: "story", campaign: academy.id, move: rightMove(academy, keysOf(academy), run)! } }),
      );
    }
    const tap = (spot: string) =>
      tx((db) => act(db, userId, { action: { type: "story", campaign: academy.id, move: { type: "tap", scene: "f-search", spot } } }));
    expect((await tap("ferns")).outcome).toMatchObject({ kind: "story", tapped: { correct: false } });
    // The mushrooms out of order (wrong), then in order (right): two attempts at the same spot.
    expect((await tap("mushrooms")).outcome).toMatchObject({ kind: "story", tapped: { correct: false } });
    await tap("stone-r");
    expect((await tap("mushrooms")).outcome).toMatchObject({ kind: "story", items: ["sprite"], tapped: { done: true } });
    const rows = await pg.db.query("select item, source from questling.inventory where user_id = $1 and item = 'sprite'", [userId]);
    expect(rows.rows).toEqual([{ item: "sprite", source: "story" }]);
  });
});
