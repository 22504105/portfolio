import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { codeOf, startTestDatabase, type TestDatabase } from "./harness";

// The schema on a real PostgreSQL: that it applies, and that the rules it
// promises about money hold whatever the application sends.

let t: TestDatabase;
let group = "";
let ann = "";
let bob = "";
let guest = "";

const one = async (sql: string, params: unknown[] = []) => (await t.db.query(sql, params)).rows[0];

type Parts = { payers: [string, number][]; splits: [string, number][] };

/** Writes an expense with its payers and shares in one transaction, the way the application will. */
async function expense(total: number, parts: Parts, extra: { currency?: string; key?: string; group?: string } = {}) {
  return t.tx(async (db) => {
    const id = (
      await db.query(
        `insert into splitly.expenses (group_id, creator_member_id, description, expense_date, currency, total_minor, idempotency_key)
         values ($1, $2, 'Dinner', '2026-10-12', $3, $4, $5) returning id`,
        [extra.group ?? group, ann, extra.currency ?? "TRY", total, extra.key ?? randomUUID()],
      )
    ).rows[0].id as string;
    for (const [member, amount] of parts.payers)
      await db.query("insert into splitly.expense_payers (expense_id, group_id, member_id, paid_minor) values ($1, $2, $3, $4)", [
        id,
        extra.group ?? group,
        member,
        amount,
      ]);
    for (const [member, amount] of parts.splits)
      await db.query("insert into splitly.expense_splits (expense_id, group_id, member_id, owed_minor) values ($1, $2, $3, $4)", [
        id,
        extra.group ?? group,
        member,
        amount,
      ]);
    return id;
  });
}

beforeAll(async () => {
  t = await startTestDatabase();
  const annUser = (await one("insert into splitly.users (display_name) values ('Ann') returning id")).id;
  const bobUser = (await one("insert into splitly.users (display_name) values ('Bob') returning id")).id;
  group = (
    await one("insert into splitly.groups (name, base_currency, owner_id) values ('Istanbul trip', 'TRY', $1) returning id", [annUser])
  ).id;
  ann = (await one("insert into splitly.group_members (group_id, user_id, role) values ($1, $2, 'owner') returning id", [group, annUser]))
    .id;
  bob = (await one("insert into splitly.group_members (group_id, user_id) values ($1, $2) returning id", [group, bobUser])).id;
  guest = (await one("insert into splitly.group_members (group_id, guest_name) values ($1, 'Mehmet') returning id", [group])).id;
}, 180_000);

afterAll(async () => {
  await t?.stop();
});

describe("the schema", () => {
  it("lives in its own schema and leaves the public one alone", async () => {
    const tables = (
      await t.db.query("select schemaname, count(*)::int as n from pg_tables where schemaname in ('splitly', 'public') group by 1")
    ).rows;
    expect(tables).toEqual([{ schemaname: "splitly", n: 16 }]);
  });

  it("gives the platform's API roles nothing at all", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      expect([role, await codeOf(() => t.asApiRole(role, (db) => db.query("select * from splitly.expenses")))]).toEqual([role, "42501"]);
      expect([
        role,
        await codeOf(() => t.asApiRole(role, (db) => db.query("insert into splitly.users (display_name) values ('x')"))),
      ]).toEqual([role, "42501"]);
    }
    const rls = (await t.db.query("select count(*)::int as n from pg_tables where schemaname = 'splitly' and not rowsecurity")).rows[0].n;
    expect(rls).toBe(0);
  });
});

describe("an expense", () => {
  it("is stored when what was paid, its total and what is owed all agree", async () => {
    const id = await expense(1000, {
      payers: [[ann, 1000]],
      splits: [
        [ann, 334],
        [bob, 333],
        [guest, 333],
      ],
    });
    expect((await one("select total_minor::text as total from splitly.expenses where id = $1", [id])).total).toBe("1000");
  });

  it("can be paid by several people", async () => {
    await expense(1000, {
      payers: [
        [ann, 600],
        [bob, 400],
      ],
      splits: [
        [ann, 500],
        [bob, 500],
      ],
    });
  });

  it("is refused, whole, when the shares do not add up to the total", async () => {
    const before = (await one("select count(*)::int as n from splitly.expenses")).n;
    expect(
      await codeOf(() =>
        expense(1000, {
          payers: [[ann, 1000]],
          splits: [
            [ann, 500],
            [bob, 499],
          ],
        }),
      ),
    ).toBe("23514");
    expect(
      await codeOf(() =>
        expense(1000, {
          payers: [[ann, 999]],
          splits: [
            [ann, 500],
            [bob, 500],
          ],
        }),
      ),
    ).toBe("23514");
    // Nothing of the refused expenses was kept: not the expense, not a payer, not a share.
    expect((await one("select count(*)::int as n from splitly.expenses")).n).toBe(before);
  });

  it("is refused with no payers or no shares at all", async () => {
    expect(await codeOf(() => expense(1000, { payers: [], splits: [[ann, 1000]] }))).toBe("23514");
    expect(await codeOf(() => expense(1000, { payers: [[ann, 1000]], splits: [] }))).toBe("23514");
  });

  it("cannot be thrown out of balance afterwards", async () => {
    const id = await expense(1000, {
      payers: [[ann, 1000]],
      splits: [
        [ann, 500],
        [bob, 500],
      ],
    });
    expect(
      await codeOf(() =>
        t.tx((db) => db.query("update splitly.expense_splits set owed_minor = 600 where expense_id = $1 and member_id = $2", [id, bob])),
      ),
    ).toBe("23514");
    expect(await codeOf(() => t.tx((db) => db.query("delete from splitly.expense_payers where expense_id = $1", [id])))).toBe("23514");
    expect(
      (await one("select owed_minor::text as owed from splitly.expense_splits where expense_id = $1 and member_id = $2", [id, bob])).owed,
    ).toBe("500");
  });

  it("is not edited in place: its amount, currency and date are facts", async () => {
    const id = await expense(1000, { payers: [[ann, 1000]], splits: [[ann, 1000]] });
    for (const change of ["total_minor = 900", "currency = 'USD'", "expense_date = '2026-01-01'"]) {
      expect([change, await codeOf(() => t.db.query(`update splitly.expenses set ${change} where id = $1`, [id]))]).toEqual([
        change,
        "23514",
      ]);
    }
    // Cancelling it is allowed, and so is pointing it at its replacement.
    await t.db.query("update splitly.expenses set status = 'cancelled' where id = $1", [id]);
    expect((await one("select status from splitly.expenses where id = $1", [id])).status).toBe("cancelled");
  });

  it("submitted twice with the same key is one expense", async () => {
    const key = randomUUID();
    await expense(500, { payers: [[ann, 500]], splits: [[bob, 500]] }, { key });
    expect(await codeOf(() => expense(500, { payers: [[ann, 500]], splits: [[bob, 500]] }, { key }))).toBe("23505");
    expect((await one("select count(*)::int as n from splitly.expenses where idempotency_key = $1", [key])).n).toBe(1);
  });

  it("can be a refund: a negative total with negative parts", async () => {
    await expense(-300, {
      payers: [[ann, -300]],
      splits: [
        [ann, -150],
        [bob, -150],
      ],
    });
    expect(await codeOf(() => expense(0, { payers: [[ann, 0]], splits: [[ann, 0]] }))).toBe("23514");
  });

  it("cannot involve someone from another group", async () => {
    const owner = (await one("insert into splitly.users (display_name) values ('Cy') returning id")).id;
    const other = (
      await one("insert into splitly.groups (name, base_currency, owner_id) values ('Other', 'USD', $1) returning id", [owner])
    ).id;
    const outsider = (await one("insert into splitly.group_members (group_id, user_id) values ($1, $2) returning id", [other, owner])).id;
    expect(await codeOf(() => expense(1000, { payers: [[ann, 1000]], splits: [[outsider, 1000]] }))).toBe("23503");
    expect(await codeOf(() => expense(1000, { payers: [[outsider, 1000]], splits: [[ann, 1000]] }))).toBe("23503");
  });
});

describe("people in a group", () => {
  it("are either a user or a named guest, never both and never neither", async () => {
    const user = (await one("insert into splitly.users (display_name) values ('Dee') returning id")).id;
    expect(await codeOf(() => t.db.query("insert into splitly.group_members (group_id) values ($1)", [group]))).toBe("23514");
    expect(
      await codeOf(() =>
        t.db.query("insert into splitly.group_members (group_id, user_id, guest_name) values ($1, $2, 'Dee')", [group, user]),
      ),
    ).toBe("23514");
  });

  it("are in a group once", async () => {
    const user = (await one("select user_id from splitly.group_members where id = $1", [bob])).user_id;
    expect(await codeOf(() => t.db.query("insert into splitly.group_members (group_id, user_id) values ($1, $2)", [group, user]))).toBe(
      "23505",
    );
  });

  it("have one Telegram account each, and each Telegram account is one person", async () => {
    const [first, second] = (await t.db.query("insert into splitly.users (display_name) values ('E'), ('F') returning id")).rows.map(
      (row) => row.id,
    );
    await t.db.query("insert into splitly.telegram_identities (user_id, telegram_user_id) values ($1, 777000111)", [first]);
    expect(
      await codeOf(() =>
        t.db.query("insert into splitly.telegram_identities (user_id, telegram_user_id) values ($1, 777000111)", [second]),
      ),
    ).toBe("23505");
  });
});

describe("a member with history", () => {
  it("cannot be deleted out from under their expenses", async () => {
    await expense(900, {
      payers: [[ann, 900]],
      splits: [
        [ann, 450],
        [guest, 450],
      ],
    });
    expect(await codeOf(() => t.tx((db) => db.query("delete from splitly.group_members where id = $1", [guest])))).toBe("23514");
    expect((await one("select count(*)::int as n from splitly.group_members where id = $1", [guest])).n).toBe(1);
  });
});

describe("settlements and rates", () => {
  it("a settlement is between two different people, for a positive amount, and confirmed only with a time", async () => {
    const insert = (from: string, to: string, amount: number, status: string, confirmed: boolean) =>
      t.db.query(
        `insert into splitly.settlements (group_id, from_member_id, to_member_id, currency, amount_minor, status, confirmed_at, idempotency_key, created_by_member_id)
         values ($1, $2, $3, 'TRY', $4, $5, case when $6 then now() end, $7, $2)`,
        [group, from, to, amount, status, confirmed, randomUUID()],
      );
    expect(await codeOf(() => insert(bob, ann, 500, "proposed", false))).toBeNull();
    expect(await codeOf(() => insert(bob, bob, 500, "proposed", false))).toBe("23514");
    expect(await codeOf(() => insert(bob, ann, 0, "proposed", false))).toBe("23514");
    expect(await codeOf(() => insert(bob, ann, 500, "confirmed", false))).toBe("23514");
    expect(await codeOf(() => insert(bob, ann, 500, "proposed", true))).toBe("23514");
    expect(await codeOf(() => insert(bob, ann, 500, "confirmed", true))).toBeNull();
  });

  it("an exchange rate is exact text, positive, and never changes once recorded", async () => {
    const insert = (rate: string) =>
      t.db.query(
        "insert into splitly.fx_rates (group_id, from_currency, to_currency, decimal_rate, effective_at, created_by_member_id) values ($1, 'USD', 'TRY', $2, now(), $3) returning id",
        [group, rate, ann],
      );
    const id = (await insert("41.2537")).rows[0].id;
    for (const bad of ["0", "-1", "1e3", "abc", "1,5", ""]) expect([bad, await codeOf(() => insert(bad))]).toEqual([bad, "23514"]);
    expect(await codeOf(() => t.db.query("update splitly.fx_rates set decimal_rate = '50' where id = $1", [id]))).toBe("23514");
    expect((await one("select decimal_rate from splitly.fx_rates where id = $1", [id])).decimal_rate).toBe("41.2537");
  });
});

describe("deleting a group", () => {
  it("takes its members, expenses, settlements and rates with it, and nothing else", async () => {
    const owner = (await one("insert into splitly.users (display_name) values ('Gus') returning id")).id;
    const doomed = (
      await one("insert into splitly.groups (name, base_currency, owner_id) values ('Doomed', 'EUR', $1) returning id", [owner])
    ).id;
    const member = (
      await one("insert into splitly.group_members (group_id, user_id, role) values ($1, $2, 'owner') returning id", [doomed, owner])
    ).id;
    await t.tx(async (db) => {
      const id = (
        await db.query(
          "insert into splitly.expenses (group_id, creator_member_id, description, expense_date, currency, total_minor, idempotency_key) values ($1, $2, 'x', '2026-10-12', 'EUR', 100, $3) returning id",
          [doomed, member, randomUUID()],
        )
      ).rows[0].id;
      await db.query("insert into splitly.expense_payers (expense_id, group_id, member_id, paid_minor) values ($1, $2, $3, 100)", [
        id,
        doomed,
        member,
      ]);
      await db.query("insert into splitly.expense_splits (expense_id, group_id, member_id, owed_minor) values ($1, $2, $3, 100)", [
        id,
        doomed,
        member,
      ]);
    });
    const others = (await one("select count(*)::int as n from splitly.expenses where group_id <> $1", [doomed])).n;

    await t.tx((db) => db.query("delete from splitly.groups where id = $1", [doomed]));
    for (const table of ["group_members", "expenses", "expense_payers", "expense_splits"]) {
      expect([table, (await one(`select count(*)::int as n from splitly.${table} where group_id = $1`, [doomed])).n]).toEqual([table, 0]);
    }
    expect((await one("select count(*)::int as n from splitly.expenses")).n).toBe(others);
  });
});
