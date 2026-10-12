/* eslint-disable @typescript-eslint/no-explicit-any -- answers are untyped JSON here; the assertions are what checks their shape */
import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handle } from "@/lib/server/api";
import { resetPool } from "@/lib/server/db";
import { issueSession } from "@/lib/server/session";
import { startTestDatabase, type TestDatabase } from "./harness";

// The server as a client meets it: real requests into the real handler, a
// real PostgreSQL behind it, and sign-ins signed the way Telegram signs them
// (with a made-up bot token). The point of most of these tests is what one
// person cannot do to another's group.

const BOT_TOKEN = "1234567890:TEST-ONLY-token-for-signing-fixtures-0";
const SECRET = "test-only-session-secret-of-at-least-32-characters";
const ORIGIN = "https://splitly.test";

let t: TestDatabase;

/** Sign-in data as Telegram would issue it for a user, signed with the test bot's token. */
function initData(
  user: { id: number; first_name: string; language_code?: string; photo_url?: string },
  authDate = Math.floor(Date.now() / 1000),
  token = BOT_TOKEN,
): string {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: "AAF-test", user: JSON.stringify(user) });
  const check = [...params]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return params.toString();
}

type CallOptions = { token?: string; body?: unknown; headers?: Record<string, string>; raw?: string };

async function call(method: string, path: string, { token, body, headers = {}, raw }: CallOptions = {}) {
  const request = new Request(`${ORIGIN}/api/v1/${path}`, {
    method,
    headers: {
      ...(body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const response = await handle(request, path.split("/"));
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

let nextTelegramId = 5000;
/** A new person, signed in. Each gets an address of their own so sign-in limits do not interfere. */
async function person(name: string, language = "en") {
  const id = nextTelegramId++;
  const result = await call("POST", "session", {
    body: { initData: initData({ id, first_name: name, language_code: language }) },
    headers: { "x-real-ip": `10.0.${id % 250}.${id % 199}` },
  });
  expect(result.status).toBe(200);
  return { token: result.body.token as string, userId: result.body.profile.id as string, telegramId: id };
}

const expense = (payer: string, participants: string[], totalMinor = 1000, extra: Record<string, unknown> = {}) => ({
  description: "Dinner",
  category: "food",
  date: "2026-10-12",
  currency: "TRY",
  totalMinor,
  payers: [{ memberId: payer, paidMinor: totalMinor }],
  split: { mode: "equal", parts: participants.map((memberId) => ({ memberId, value: 1 })) },
  ...extra,
});

async function groupOf(token: string, id: string) {
  const result = await call("GET", `groups/${id}`, { token });
  expect(result.status).toBe(200);
  return result.body.group;
}
const selfIn = (group: any) => group.members.find((member: any) => member.self).id as string;

beforeAll(async () => {
  t = await startTestDatabase();
  process.env.DATABASE_URL = t.url;
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
  process.env.SESSION_SECRET = SECRET;
}, 180_000);

afterAll(async () => {
  await resetPool();
  await t?.stop();
});

describe("signing in", () => {
  it("accepts sign-in data that Telegram signed, and gives a session", async () => {
    const result = await call("POST", "session", { body: { initData: initData({ id: 4001, first_name: "Ann", language_code: "ru" }) } });
    expect(result.status).toBe(200);
    expect(result.body.profile).toMatchObject({ displayName: "Ann", locale: "ru" });
    expect((await call("GET", "me", { token: result.body.token })).body).toMatchObject({ displayName: "Ann" });
  });

  it("is the same person the next time, and a different one for a different Telegram account", async () => {
    const first = await call("POST", "session", { body: { initData: initData({ id: 4002, first_name: "Bob" }) } });
    const again = await call("POST", "session", { body: { initData: initData({ id: 4002, first_name: "Bob renamed" }) } });
    const other = await call("POST", "session", { body: { initData: initData({ id: 4003, first_name: "Bob" }) } });
    expect(again.body.profile.id).toBe(first.body.profile.id);
    expect(other.body.profile.id).not.toBe(first.body.profile.id);
  });

  it("refuses data signed with another bot's token, altered after signing, or too old: all with the same answer", async () => {
    const good = initData({ id: 4004, first_name: "Cy" });
    const forged = initData({ id: 4004, first_name: "Cy" }, undefined, "999:another-bot-entirely-AAAAAAAAAAAAAAAAAAAAAA");
    // The signature of user 4004, with the user swapped for someone else.
    const swapped = new URLSearchParams(good);
    swapped.set("user", JSON.stringify({ id: 4001, first_name: "Ann" }));
    const stale = initData({ id: 4004, first_name: "Cy" }, Math.floor(Date.now() / 1000) - 2 * 60 * 60);
    const future = initData({ id: 4004, first_name: "Cy" }, Math.floor(Date.now() / 1000) + 10 * 60);

    for (const bad of [
      forged,
      swapped.toString(),
      stale,
      future,
      "",
      "hash=abc",
      good.replace(/hash=[0-9a-f]{4}/, "hash=0000"),
      12345,
      null,
    ]) {
      const result = await call("POST", "session", { body: { initData: bad } });
      expect([String(bad).slice(0, 24), result.status, result.body]).toEqual([String(bad).slice(0, 24), 401, { error: "unauthenticated" }]);
    }
    // Nobody was created for any of the refused attempts.
    expect((await t.db.query("select count(*)::int as n from splitly.telegram_identities where telegram_user_id = 4004")).rows[0].n).toBe(
      0,
    );
  });

  it("limits how often one address may try", async () => {
    const headers = { "x-real-ip": "203.0.113.77" };
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 32; attempt++)
      statuses.push((await call("POST", "session", { body: { initData: "hash=nope" }, headers })).status);
    expect(statuses.slice(0, 30).every((status) => status === 401)).toBe(true);
    expect(statuses.slice(30)).toEqual([429, 429]);
  });
});

describe("without a valid session", () => {
  it("nothing is readable or writable", async () => {
    const stranger = issueSession(randomUUID(), "a-completely-different-secret-of-32-chars!!").token;
    const expired = issueSession(randomUUID(), SECRET, Math.floor(Date.now() / 1000) - 24 * 60 * 60).token;
    for (const token of [undefined, "garbage", stranger, expired, "a.b.c"]) {
      for (const [method, path, body] of [
        ["GET", "groups", undefined],
        ["GET", "me", undefined],
        ["POST", "groups", { name: "x", baseCurrency: "TRY" }],
        ["GET", `groups/${randomUUID()}`, undefined],
        ["POST", `groups/${randomUUID()}/expenses`, { idempotencyKey: randomUUID(), expense: {} }],
        ["POST", "invites/accept", { token: "x" }],
      ] as const) {
        const result = await call(method, path, { token, body });
        expect([String(token).slice(0, 8), method, path.split("/")[0], result.status]).toEqual([
          String(token).slice(0, 8),
          method,
          path.split("/")[0],
          401,
        ]);
      }
    }
  });

  it("a session for someone who no longer exists reads nothing", async () => {
    const ghost = issueSession(randomUUID(), SECRET).token;
    expect((await call("GET", "groups", { token: ghost })).body).toEqual({ groups: [] });
    expect((await call("GET", "me", { token: ghost })).status).toBe(404);
  });
});

describe("two people and their private groups", () => {
  it("neither can see, change, add to or delete the other's group, by any route", async () => {
    const ann = await person("Ann");
    const bob = await person("Bob");
    const annGroup = (await call("POST", "groups", { token: ann.token, body: { name: "Ann's trip", baseCurrency: "TRY" } })).body
      .id as string;
    const bobGroup = (await call("POST", "groups", { token: bob.token, body: { name: "Bob's flat", baseCurrency: "EUR" } })).body
      .id as string;
    const annMember = selfIn(await groupOf(ann.token, annGroup));
    const bobMember = selfIn(await groupOf(bob.token, bobGroup));
    const annExpense = (
      await call("POST", `groups/${annGroup}/expenses`, {
        token: ann.token,
        body: { idempotencyKey: randomUUID(), expense: expense(annMember, [annMember]) },
      })
    ).body.id as string;

    // Each sees their own group and only that.
    expect((await call("GET", "groups", { token: ann.token })).body.groups.map((group: any) => group.name)).toEqual(["Ann's trip"]);
    expect((await call("GET", "groups", { token: bob.token })).body.groups.map((group: any) => group.name)).toEqual(["Bob's flat"]);

    // Everything Bob might try on Ann's group answers exactly as it would for a group that does not exist.
    const nowhere = randomUUID();
    const attempts: [string, string, unknown][] = [
      ["GET", "groups/G", undefined],
      ["PATCH", "groups/G", { name: "Bob's now" }],
      ["DELETE", "groups/G", undefined],
      ["POST", "groups/G/members", { name: "Mallory" }],
      ["PATCH", `groups/G/members/${annMember}`, { role: "member" }],
      ["DELETE", `groups/G/members/${annMember}`, undefined],
      ["POST", "groups/G/invites", {}],
      ["DELETE", "groups/G/invites", undefined],
      ["POST", "groups/G/expenses", { idempotencyKey: randomUUID(), expense: expense(annMember, [annMember]) }],
      ["PUT", `groups/G/expenses/${annExpense}`, { idempotencyKey: randomUUID(), expense: expense(annMember, [annMember], 1) }],
      ["DELETE", `groups/G/expenses/${annExpense}`, undefined],
    ];
    for (const [method, path, body] of attempts) {
      const real = await call(method, path.replace("G", annGroup), { token: bob.token, body });
      const missing = await call(method, path.replace("G", nowhere), { token: bob.token, body });
      expect([method, path, real.status, real.body]).toEqual([method, path, 404, { error: "not_found" }]);
      expect([method, path, missing.status, missing.body]).toEqual([method, path, real.status, real.body]);
    }

    // Bob cannot smuggle Ann's member into an expense of his own group, nor his own into hers.
    const smuggled = await call("POST", `groups/${bobGroup}/expenses`, {
      token: bob.token,
      body: { idempotencyKey: randomUUID(), expense: expense(bobMember, [bobMember, annMember]) },
    });
    expect([smuggled.status, smuggled.body.details?.problems]).toEqual([422, ["participant_unknown"]]);
    const asPayer = await call("POST", `groups/${bobGroup}/expenses`, {
      token: bob.token,
      body: { idempotencyKey: randomUUID(), expense: expense(annMember, [bobMember]) },
    });
    expect([asPayer.status, asPayer.body.details?.problems]).toEqual([422, ["payer_unknown"]]);

    // And Ann's group is exactly as she left it.
    const after = await groupOf(ann.token, annGroup);
    expect([after.name, after.members.length, after.expenses.length, after.expenses[0].status]).toEqual(["Ann's trip", 1, 1, "active"]);
  });
});

describe("a group", () => {
  it("is created with its maker as owner, and validated", async () => {
    const ann = await person("Ann");
    for (const body of [
      { name: "", baseCurrency: "TRY" },
      { name: "x".repeat(81), baseCurrency: "TRY" },
      { name: "Trip", baseCurrency: "lira" },
      { baseCurrency: "TRY" },
      {},
    ]) {
      expect((await call("POST", "groups", { token: ann.token, body })).status).toBe(422);
    }
    const id = (await call("POST", "groups", { token: ann.token, body: { name: "  Trip  ", baseCurrency: "TRY" } })).body.id;
    const group = await groupOf(ann.token, id);
    expect(group).toMatchObject({ name: "Trip", baseCurrency: "TRY", archivedAt: null, myNet: {}, expenseCount: 0 });
    expect(group.members).toMatchObject([{ name: "Ann", role: "owner", self: true, guest: false }]);
  });

  it("can be renamed, archived and deleted by its owner", async () => {
    const ann = await person("Ann");
    const id = (await call("POST", "groups", { token: ann.token, body: { name: "Trip", baseCurrency: "TRY" } })).body.id;
    await call("PATCH", `groups/${id}`, { token: ann.token, body: { name: "Trip 2026", archived: true } });
    expect(await groupOf(ann.token, id)).toMatchObject({ name: "Trip 2026" });
    expect((await groupOf(ann.token, id)).archivedAt).not.toBeNull();
    // An archived group takes no new expenses.
    const member = selfIn(await groupOf(ann.token, id));
    expect(
      (
        await call("POST", `groups/${id}/expenses`, {
          token: ann.token,
          body: { idempotencyKey: randomUUID(), expense: expense(member, [member]) },
        })
      ).status,
    ).toBe(409);
    await call("PATCH", `groups/${id}`, { token: ann.token, body: { archived: false } });
    expect(
      (
        await call("POST", `groups/${id}/expenses`, {
          token: ann.token,
          body: { idempotencyKey: randomUUID(), expense: expense(member, [member]) },
        })
      ).status,
    ).toBe(200);
    expect((await groupOf(ann.token, id)).archivedAt).toBeNull();
    expect((await call("DELETE", `groups/${id}`, { token: ann.token })).status).toBe(200);
    expect((await call("GET", `groups/${id}`, { token: ann.token })).status).toBe(404);
  });
});

describe("people in a group", () => {
  it("join by invitation, once each, and only while the invitation is good", async () => {
    const [ann, bob, cy, dee] = await Promise.all([person("Ann"), person("Bob"), person("Cy"), person("Dee")]);
    const id = (await call("POST", "groups", { token: ann.token, body: { name: "Trip", baseCurrency: "TRY" } })).body.id;
    const invite = (await call("POST", `groups/${id}/invites`, { token: ann.token, body: { maxUses: 2 } })).body.invite;
    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Only a hash of the token is stored.
    expect(
      (
        await t.db.query("select count(*)::int as n from splitly.invites where encode(token_hash, 'escape') like $1", [
          `%${invite.token.slice(0, 12)}%`,
        ])
      ).rows[0].n,
    ).toBe(0);

    expect((await call("POST", "invites/preview", { token: bob.token, body: { token: invite.token } })).body).toEqual({
      groupName: "Trip",
      guests: [],
    });
    expect((await call("POST", "invites/accept", { token: bob.token, body: { token: invite.token } })).body).toEqual({ groupId: id });
    expect((await groupOf(bob.token, id)).members.map((member: any) => [member.name, member.role])).toEqual([
      ["Ann", "owner"],
      ["Bob", "member"],
    ]);
    // Accepting again changes nothing and does not spend the invitation.
    await call("POST", "invites/accept", { token: bob.token, body: { token: invite.token } });
    expect((await t.db.query("select uses from splitly.invites where group_id = $1", [id])).rows[0].uses).toBe(1);

    expect((await call("POST", "invites/accept", { token: cy.token, body: { token: invite.token } })).status).toBe(200);
    // Used up: the third person gets the same answer as for a link that never existed.
    const usedUp = await call("POST", "invites/accept", { token: dee.token, body: { token: invite.token } });
    const never = await call("POST", "invites/accept", { token: dee.token, body: { token: "A".repeat(43) } });
    expect([usedUp.status, usedUp.body]).toEqual([404, { error: "not_found" }]);
    expect([never.status, never.body]).toEqual([usedUp.status, usedUp.body]);
    expect((await call("GET", `groups/${id}`, { token: dee.token })).status).toBe(404);
  });

  it("cannot join with an invitation that expired or was revoked", async () => {
    const [ann, bob] = await Promise.all([person("Ann"), person("Bob")]);
    const id = (await call("POST", "groups", { token: ann.token, body: { name: "Trip", baseCurrency: "TRY" } })).body.id;
    const expired = (await call("POST", `groups/${id}/invites`, { token: ann.token, body: {} })).body.invite.token;
    await t.db.query("update splitly.invites set expires_at = now() - interval '1 minute' where group_id = $1", [id]);
    expect((await call("POST", "invites/accept", { token: bob.token, body: { token: expired } })).status).toBe(404);

    const revoked = (await call("POST", `groups/${id}/invites`, { token: ann.token, body: {} })).body.invite.token;
    expect((await call("DELETE", `groups/${id}/invites`, { token: ann.token })).body).toEqual({ revoked: 1 });
    expect((await call("POST", "invites/accept", { token: bob.token, body: { token: revoked } })).status).toBe(404);
    expect((await call("POST", "invites/preview", { token: bob.token, body: { token: revoked } })).status).toBe(404);
  });

  it("a guest added by name can be claimed by the person they were, history and all", async () => {
    const [ann, mehmet] = await Promise.all([person("Ann"), person("Mehmet Y.")]);
    const id = (await call("POST", "groups", { token: ann.token, body: { name: "Trip", baseCurrency: "TRY" } })).body.id;
    const guest = (await call("POST", `groups/${id}/members`, { token: ann.token, body: { name: "Mehmet" } })).body.id;
    const annMember = selfIn(await groupOf(ann.token, id));
    await call("POST", `groups/${id}/expenses`, {
      token: ann.token,
      body: { idempotencyKey: randomUUID(), expense: expense(annMember, [annMember, guest]) },
    });

    const invite = (await call("POST", `groups/${id}/invites`, { token: ann.token, body: {} })).body.invite.token;
    expect((await call("POST", "invites/preview", { token: mehmet.token, body: { token: invite } })).body.guests).toEqual([
      { id: guest, name: "Mehmet" },
    ]);
    await call("POST", "invites/accept", { token: mehmet.token, body: { token: invite, claimMemberId: guest } });

    const group = await groupOf(mehmet.token, id);
    expect(group.members.map((member: any) => [member.id === guest, member.name, member.guest, member.self])).toEqual([
      [false, "Ann", false, false],
      [true, "Mehmet Y.", false, true],
    ]);
    // What the guest owed, the person now owes.
    expect(group.myNet).toEqual({ TRY: -500 });
  });

  it("roles: members add expenses; managers manage people; only the owner makes managers and deletes the group", async () => {
    const [ann, bob, cy] = await Promise.all([person("Ann"), person("Bob"), person("Cy")]);
    const id = (await call("POST", "groups", { token: ann.token, body: { name: "Trip", baseCurrency: "TRY" } })).body.id;
    const invite = (await call("POST", `groups/${id}/invites`, { token: ann.token, body: {} })).body.invite.token;
    await call("POST", "invites/accept", { token: bob.token, body: { token: invite } });
    await call("POST", "invites/accept", { token: cy.token, body: { token: invite } });
    const members = (await groupOf(ann.token, id)).members;
    const [annM, bobM, cyM] = ["Ann", "Bob", "Cy"].map((name) => members.find((member: any) => member.name === name).id);

    // A plain member cannot manage.
    for (const [method, path, body] of [
      ["POST", `groups/${id}/members`, { name: "Guest" }],
      ["POST", `groups/${id}/invites`, {}],
      ["PATCH", `groups/${id}`, { name: "Mine" }],
      ["DELETE", `groups/${id}/members/${cyM}`, undefined],
      ["PATCH", `groups/${id}/members/${cyM}`, { role: "admin" }],
      ["DELETE", `groups/${id}`, undefined],
    ] as const) {
      expect([method, path.split("/").slice(2).join("/"), (await call(method, path, { token: bob.token, body })).status]).toEqual([
        method,
        path.split("/").slice(2).join("/"),
        403,
      ]);
    }
    // But can add an expense.
    expect(
      (
        await call("POST", `groups/${id}/expenses`, {
          token: bob.token,
          body: { idempotencyKey: randomUUID(), expense: expense(bobM, [annM, bobM, cyM], 900) },
        })
      ).status,
    ).toBe(200);

    // The owner makes Bob a manager.
    expect((await call("PATCH", `groups/${id}/members/${bobM}`, { token: ann.token, body: { role: "admin" } })).status).toBe(200);
    expect((await call("POST", `groups/${id}/members`, { token: bob.token, body: { name: "Guest" } })).status).toBe(200);
    // A manager still cannot make managers, delete the group, or remove the owner.
    expect((await call("PATCH", `groups/${id}/members/${cyM}`, { token: bob.token, body: { role: "admin" } })).status).toBe(403);
    expect((await call("DELETE", `groups/${id}`, { token: bob.token })).status).toBe(403);
    expect((await call("DELETE", `groups/${id}/members/${annM}`, { token: bob.token })).status).toBe(403);
    // Nobody is made owner through the role route, and a guest cannot be a manager.
    expect((await call("PATCH", `groups/${id}/members/${bobM}`, { token: ann.token, body: { role: "owner" } })).status).toBe(422);

    // Cy leaves by themselves, and from then on the group does not exist for them; their share of history stays.
    expect((await call("DELETE", `groups/${id}/members/${cyM}`, { token: cy.token })).status).toBe(200);
    expect((await call("GET", `groups/${id}`, { token: cy.token })).status).toBe(404);
    const after = await groupOf(ann.token, id);
    expect(after.members.find((member: any) => member.id === cyM).removedAt).not.toBeNull();
    expect(after.expenses[0].splits.map((split: any) => split.owedMinor)).toEqual([300, 300, 300]);
    // Someone who left takes no part in new expenses.
    const withLeaver = await call("POST", `groups/${id}/expenses`, {
      token: ann.token,
      body: { idempotencyKey: randomUUID(), expense: expense(annM, [annM, cyM]) },
    });
    expect(withLeaver.body.details.problems).toEqual(["participant_unknown"]);
    // The owner cannot leave a group and abandon it.
    expect((await call("DELETE", `groups/${id}/members/${annM}`, { token: ann.token })).status).toBe(403);
  });
});

describe("expenses", () => {
  async function trio() {
    const [ann, bob] = await Promise.all([person("Ann"), person("Bob")]);
    const id = (await call("POST", "groups", { token: ann.token, body: { name: "Trip", baseCurrency: "TRY" } })).body.id as string;
    const invite = (await call("POST", `groups/${id}/invites`, { token: ann.token, body: {} })).body.invite.token;
    await call("POST", "invites/accept", { token: bob.token, body: { token: invite } });
    const guest = (await call("POST", `groups/${id}/members`, { token: ann.token, body: { name: "Mehmet" } })).body.id as string;
    const members = (await groupOf(ann.token, id)).members;
    return { ann, bob, id, annM: members[0].id as string, bobM: members[1].id as string, guest };
  }

  it("are stored balanced, with shares worked out by the server, and move the balances", async () => {
    const { ann, bob, id, annM, bobM, guest } = await trio();
    const sent = { ...expense(annM, [annM, bobM, guest]), splits: [{ memberId: annM, owedMinor: 0 }] };
    const created = await call("POST", `groups/${id}/expenses`, {
      token: ann.token,
      body: { idempotencyKey: randomUUID(), expense: sent },
    });
    expect(created).toMatchObject({ status: 200, body: { repeated: false } });

    const group = await groupOf(ann.token, id);
    expect(group.expenses[0]).toMatchObject({
      description: "Dinner",
      totalMinor: 1000,
      currency: "TRY",
      status: "active",
      date: "2026-10-12",
      category: "food",
    });
    expect(group.expenses[0].splits).toEqual([
      { memberId: annM, owedMinor: 334 },
      { memberId: bobM, owedMinor: 333 },
      { memberId: guest, owedMinor: 333 },
    ]);
    expect(group.myNet).toEqual({ TRY: 666 });
    expect((await groupOf(bob.token, id)).myNet).toEqual({ TRY: -333 });
    // The list and the group's own page agree.
    expect((await call("GET", "groups", { token: bob.token })).body.groups[0]).toMatchObject({ myNet: { TRY: -333 }, expenseCount: 1 });
  });

  it("submitted twice with the same key is one expense", async () => {
    const { ann, id, annM, bobM } = await trio();
    const body = { idempotencyKey: randomUUID(), expense: expense(annM, [annM, bobM]) };
    const [first, second] = await Promise.all([
      call("POST", `groups/${id}/expenses`, { token: ann.token, body }),
      call("POST", `groups/${id}/expenses`, { token: ann.token, body }),
    ]);
    const third = await call("POST", `groups/${id}/expenses`, { token: ann.token, body });
    // Two at the very same moment: one is stored, the other is told there is already one (or is itself the repeat).
    expect([first.status, second.status].sort()).toEqual(expect.arrayContaining([200]));
    expect(third.body).toMatchObject({ repeated: true });
    expect((await groupOf(ann.token, id)).expenses).toHaveLength(1);
    expect((await groupOf(ann.token, id)).myNet).toEqual({ TRY: 500 });
  });

  it("that do not add up are refused with what is wrong, and nothing is stored", async () => {
    const { ann, id, annM, bobM } = await trio();
    const bad = await call("POST", `groups/${id}/expenses`, {
      token: ann.token,
      body: {
        idempotencyKey: randomUUID(),
        expense: expense(annM, [annM, bobM], 1000, {
          payers: [{ memberId: annM, paidMinor: 900 }],
          split: {
            mode: "exact",
            parts: [
              { memberId: annM, value: 500 },
              { memberId: bobM, value: 400 },
            ],
          },
        }),
      },
    });
    expect(bad.status).toBe(422);
    expect(bad.body.details.problems.sort()).toEqual(["payers_sum", "split_sum"]);
    expect(bad.body.details.differences).toEqual({ payers_sum: 100, split_sum: 100 });
    for (const garbage of [
      {},
      { idempotencyKey: "not-a-uuid", expense: expense(annM, [annM]) },
      { idempotencyKey: randomUUID() },
      { idempotencyKey: randomUUID(), expense: "dinner" },
    ]) {
      expect((await call("POST", `groups/${id}/expenses`, { token: ann.token, body: garbage })).status).toBe(422);
    }
    expect((await groupOf(ann.token, id)).expenses).toEqual([]);
  });

  it("are changed by replacement: the old one stays on record and stops counting", async () => {
    const { ann, bob, id, annM, bobM } = await trio();
    const first = (
      await call("POST", `groups/${id}/expenses`, {
        token: ann.token,
        body: { idempotencyKey: randomUUID(), expense: expense(annM, [annM, bobM], 1000) },
      })
    ).body.id;
    const key = randomUUID();
    const changed = await call("PUT", `groups/${id}/expenses/${first}`, {
      token: ann.token,
      body: { idempotencyKey: key, expense: expense(annM, [annM, bobM], 600, { description: "Dinner, corrected" }) },
    });
    expect(changed).toMatchObject({ status: 200, body: { repeated: false } });
    // The same change sent again is not a second change.
    expect(
      (
        await call("PUT", `groups/${id}/expenses/${first}`, {
          token: ann.token,
          body: { idempotencyKey: key, expense: expense(annM, [annM, bobM], 600) },
        })
      ).body,
    ).toEqual({ id: changed.body.id, repeated: true });

    const group = await groupOf(ann.token, id);
    expect(group.expenses.map((item: any) => [item.description, item.totalMinor, item.status]).sort()).toEqual([
      ["Dinner, corrected", 600, "active"],
      ["Dinner", 1000, "replaced"],
    ]);
    expect([group.myNet, group.expenseCount]).toEqual([{ TRY: 300 }, 1]);
    // What was replaced cannot be changed again; the new one can.
    expect(
      (
        await call("PUT", `groups/${id}/expenses/${first}`, {
          token: ann.token,
          body: { idempotencyKey: randomUUID(), expense: expense(annM, [annM], 1) },
        })
      ).status,
    ).toBe(409);
    // A plain member cannot change someone else's expense, but can change their own.
    expect(
      (
        await call("PUT", `groups/${id}/expenses/${changed.body.id}`, {
          token: bob.token,
          body: { idempotencyKey: randomUUID(), expense: expense(bobM, [bobM], 1) },
        })
      ).status,
    ).toBe(403);
    expect((await call("DELETE", `groups/${id}/expenses/${changed.body.id}`, { token: bob.token })).status).toBe(403);
    const bobs = (
      await call("POST", `groups/${id}/expenses`, {
        token: bob.token,
        body: { idempotencyKey: randomUUID(), expense: expense(bobM, [annM, bobM], 200) },
      })
    ).body.id;
    expect(
      (
        await call("PUT", `groups/${id}/expenses/${bobs}`, {
          token: bob.token,
          body: { idempotencyKey: randomUUID(), expense: expense(bobM, [annM, bobM], 400) },
        })
      ).status,
    ).toBe(200);
  });

  it("are cancelled, not erased; cancelling twice is the same as once", async () => {
    const { ann, id, annM, bobM } = await trio();
    const first = (
      await call("POST", `groups/${id}/expenses`, {
        token: ann.token,
        body: { idempotencyKey: randomUUID(), expense: expense(annM, [annM, bobM]) },
      })
    ).body.id;
    expect((await call("DELETE", `groups/${id}/expenses/${first}`, { token: ann.token })).status).toBe(200);
    expect((await call("DELETE", `groups/${id}/expenses/${first}`, { token: ann.token })).status).toBe(200);
    const group = await groupOf(ann.token, id);
    expect([group.expenses[0].status, group.myNet, group.expenseCount]).toEqual(["cancelled", {}, 0]);
    expect(
      (
        await call("PUT", `groups/${id}/expenses/${first}`, {
          token: ann.token,
          body: { idempotencyKey: randomUUID(), expense: expense(annM, [annM]) },
        })
      ).status,
    ).toBe(409);
  });

  it("keep their own currency: balances in different currencies are never added together", async () => {
    const { ann, bob, id, annM, bobM } = await trio();
    await call("POST", `groups/${id}/expenses`, {
      token: ann.token,
      body: { idempotencyKey: randomUUID(), expense: expense(annM, [annM, bobM], 1000) },
    });
    await call("POST", `groups/${id}/expenses`, {
      token: bob.token,
      body: { idempotencyKey: randomUUID(), expense: expense(bobM, [annM, bobM], 3000, { currency: "EUR" }) },
    });
    await call("POST", `groups/${id}/expenses`, {
      token: bob.token,
      body: { idempotencyKey: randomUUID(), expense: expense(bobM, [annM, bobM], 1501, { currency: "JPY" }) },
    });
    expect((await groupOf(ann.token, id)).myNet).toEqual({ TRY: 500, EUR: -1500, JPY: -751 });
  });

  it("every stored expense balances, whatever was thrown at the API", async () => {
    const broken = await t.db.query(
      `select e.id from splitly.expenses e
       where e.total_minor <> (select coalesce(sum(paid_minor), 0) from splitly.expense_payers where expense_id = e.id)
          or e.total_minor <> (select coalesce(sum(owed_minor), 0) from splitly.expense_splits where expense_id = e.id)`,
    );
    expect(broken.rows).toEqual([]);
    expect((await t.db.query("select count(*)::int as n from splitly.expenses")).rows[0].n).toBeGreaterThan(8);
  });
});

describe("the edges of the API", () => {
  it("refuses requests from another site, bodies that are not JSON or too large, and routes that do not exist", async () => {
    const ann = await person("Ann");
    const body = { name: "Trip", baseCurrency: "TRY" };
    expect((await call("POST", "groups", { token: ann.token, body, headers: { Origin: "https://evil.example" } })).status).toBe(403);
    expect((await call("POST", "groups", { token: ann.token, body, headers: { Origin: ORIGIN } })).status).toBe(200);
    expect(
      (
        await call("POST", "groups", {
          token: ann.token,
          raw: "name=Trip",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      ).status,
    ).toBe(415);
    expect((await call("POST", "groups", { token: ann.token, raw: "{not json" })).status).toBe(400);
    expect((await call("POST", "groups", { token: ann.token, raw: "[1,2]" })).status).toBe(400);
    expect(
      (await call("POST", "groups", { token: ann.token, raw: JSON.stringify({ name: "x".repeat(70_000), baseCurrency: "TRY" }) })).status,
    ).toBe(413);
    expect((await call("GET", "passwords", { token: ann.token })).status).toBe(404);
    expect((await call("POST", "groups/not-a-uuid/expenses", { token: ann.token, body: {} })).status).toBe(404);
  });

  it("never answers with a stack trace or a database message", async () => {
    const ann = await person("Ann");
    const id = (await call("POST", "groups", { token: ann.token, body: { name: "Trip", baseCurrency: "TRY" } })).body.id;
    const member = selfIn(await groupOf(ann.token, id));
    const results = [
      await call("POST", `groups/${id}/expenses`, {
        token: ann.token,
        body: { idempotencyKey: randomUUID(), expense: expense(member, [member], 1e18) },
      }),
      await call("POST", `groups/${id}/expenses`, {
        token: ann.token,
        body: { idempotencyKey: randomUUID(), expense: expense("'; drop table splitly.expenses; --", [member]) },
      }),
      await call("GET", `groups/${id}'%20or%20'1'='1`, { token: ann.token }),
    ];
    for (const result of results) {
      expect(result.status).toBeGreaterThanOrEqual(400);
      expect(result.status).toBeLessThan(500);
      expect(JSON.stringify(result.body)).not.toMatch(/pg_|syntax|stack|at \w+ \(|splitly\./i);
    }
    expect((await t.db.query("select count(*)::int as n from splitly.expenses")).rows[0].n).toBeGreaterThan(0);
  });

  it("says so, and touches nothing, when accounts are not configured", async () => {
    const saved = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = "";
    try {
      expect(await call("GET", "groups", {})).toEqual({ status: 503, body: { error: "not_configured" } });
    } finally {
      process.env.TELEGRAM_BOT_TOKEN = saved;
    }
  });
});

describe("deleting an account", () => {
  it("removes groups that were theirs alone, hands on shared ones, and leaves everyone else's balances as they were", async () => {
    const [ann, bob] = await Promise.all([person("Ann"), person("Bob")]);
    const solo = (await call("POST", "groups", { token: ann.token, body: { name: "Just me", baseCurrency: "TRY" } })).body.id;
    const shared = (await call("POST", "groups", { token: ann.token, body: { name: "Shared", baseCurrency: "TRY" } })).body.id;
    const invite = (await call("POST", `groups/${shared}/invites`, { token: ann.token, body: {} })).body.invite.token;
    await call("POST", "invites/accept", { token: bob.token, body: { token: invite } });
    const members = (await groupOf(ann.token, shared)).members;
    await call("POST", `groups/${shared}/expenses`, {
      token: ann.token,
      body: { idempotencyKey: randomUUID(), expense: expense(members[0].id, [members[0].id, members[1].id]) },
    });
    const before = (await groupOf(bob.token, shared)).myNet;

    expect((await call("DELETE", "me", { token: ann.token })).status).toBe(200);

    expect((await t.db.query("select count(*)::int as n from splitly.users where id = $1", [ann.userId])).rows[0].n).toBe(0);
    expect(
      (await t.db.query("select count(*)::int as n from splitly.telegram_identities where telegram_user_id = $1", [ann.telegramId])).rows[0]
        .n,
    ).toBe(0);
    expect((await t.db.query("select count(*)::int as n from splitly.groups where id = $1", [solo])).rows[0].n).toBe(0);
    // Her old session opens nothing.
    expect((await call("GET", "groups", { token: ann.token })).body).toEqual({ groups: [] });

    const after = await groupOf(bob.token, shared);
    expect(after.myNet).toEqual(before);
    expect(after.members.map((member: any) => [member.name, member.role, member.removedAt !== null])).toEqual([
      ["Former member", "member", true],
      ["Bob", "owner", false],
    ]);
    expect(after.expenses).toHaveLength(1);
  });
});

describe("faces", () => {
  it("a person's Telegram photo is shown to the people of their groups, kept fresh, and never taken from anywhere but Telegram", async () => {
    const signIn = (photo_url?: string) =>
      call("POST", "session", {
        body: { initData: initData({ id: 7001, first_name: "Photo Ann", ...(photo_url ? { photo_url } : {}) }) },
        headers: { "x-real-ip": "10.9.9.1" },
      });
    const first = await signIn("https://t.me/i/userpic/320/ann-1.jpg");
    expect(first.body.profile.photoUrl).toBe("https://t.me/i/userpic/320/ann-1.jpg");
    const ann = first.body.token as string;
    const bob = await person("Bob");

    const id = (await call("POST", "groups", { token: ann, body: { name: "Faces", baseCurrency: "TRY" } })).body.id;
    const guest = (await call("POST", `groups/${id}/members`, { token: ann, body: { name: "Guest" } })).body.id;
    const invite = (await call("POST", `groups/${id}/invites`, { token: ann, body: {} })).body.invite.token;
    await call("POST", "invites/accept", { token: bob.token, body: { token: invite } });

    // Bob sees Ann's photo; Bob has none, and neither has someone added by name.
    const photos = async (token: string) =>
      Object.fromEntries((await groupOf(token, id)).members.map((member: any) => [member.name, member.photoUrl]));
    expect(await photos(bob.token)).toEqual({ "Photo Ann": "https://t.me/i/userpic/320/ann-1.jpg", Guest: null, Bob: null });
    expect((await call("GET", "groups", { token: bob.token })).body.groups[0].members[0].photoUrl).toBe(
      "https://t.me/i/userpic/320/ann-1.jpg",
    );
    expect(guest).toBeTruthy();

    // The address is whatever Telegram says at the latest sign-in: replaced, then cleared.
    await signIn("https://t.me/i/userpic/320/ann-2.jpg");
    expect((await photos(bob.token))["Photo Ann"]).toBe("https://t.me/i/userpic/320/ann-2.jpg");
    // An address that is not Telegram's is no photo at all, even in correctly signed data.
    const hostile = await signIn("https://evil.example/track.gif");
    expect(hostile.body.profile.photoUrl).toBeNull();
    expect((await photos(bob.token))["Photo Ann"]).toBeNull();
    await signIn();
    expect((await photos(bob.token))["Photo Ann"]).toBeNull();

    // Nobody outside the group learns it.
    const stranger = await person("Stranger");
    await signIn("https://t.me/i/userpic/320/ann-3.jpg");
    expect((await call("GET", `groups/${id}`, { token: stranger.token })).status).toBe(404);

    // Only the address is stored, and it goes with the account.
    expect((await t.db.query("select photo_url from splitly.users where id = $1", [first.body.profile.id])).rows[0].photo_url).toBe(
      "https://t.me/i/userpic/320/ann-3.jpg",
    );
    await call("DELETE", "me", { token: ann });
    expect((await photos(bob.token))["Former member"]).toBeNull();
  });

  it("the database refuses an address that is not https", async () => {
    const ann = await person("Ann");
    await expect(t.db.query("update splitly.users set photo_url = 'http://t.me/x.jpg' where id = $1", [ann.userId])).rejects.toMatchObject({
      code: "23514",
    });
    await expect(
      t.db.query("update splitly.users set photo_url = $2 where id = $1", [ann.userId, `https://t.me/${"x".repeat(600)}`]),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
