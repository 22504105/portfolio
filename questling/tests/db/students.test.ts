import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { quickQuestKeys } from "@/lib/content/quick-quest-keys";
import type { Facts } from "@/lib/game/facts";
import { balance, dailyQuests } from "@/lib/game/stats";
import { dayOf } from "@/lib/game/time";
import { handle } from "@/lib/server/api";
import { resetPool } from "@/lib/server/db";
import { act, ServiceError, signInWithTelegram } from "@/lib/server/service";
import { loadFacts } from "@/lib/server/store";
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
      expect(await codeOf(() => pg.asApiRole(role, (db) => db.query("select * from questling.users")))).toBe("42501");
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
});
