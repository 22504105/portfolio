import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { codeOf, startTestDatabase, type TestDatabase } from "./harness";

// The database itself, with its policies, on a real PostgreSQL: what user A
// can do to user B's data (nothing), what a visitor can do (nothing), and
// what the import functions do.

let t: TestDatabase;
let ann = "";
let bob = "";
let annWorkspace = "";
let bobWorkspace = "";
let annBatch = "";
let bobBatch = "";

const TABLES = ["workspaces", "import_batches", "customers", "orders", "order_lines"] as const;

const order = (id: string, net: string, extra: Record<string, unknown> = {}) => ({
  external_id: id,
  placed_at: "2026-09-10T15:00:00Z",
  status: "completed",
  channel: "Direct",
  gross: net,
  discount: "0",
  net,
  refund: "0",
  customer: null,
  lines: [{ product: "Tea", category: "Tea", quantity: 1, unit_price: net, gross: net, discount: "0", net }],
  ...extra,
});

async function workspace(userId: string, name: string, currency = "USD") {
  return t.as(userId, async (db) => {
    const id = (
      await db.query(
        "insert into public.workspaces (owner_user_id, name, currency_code, timezone) values ($1, $2, $3, 'UTC') returning id",
        [userId, name, currency],
      )
    ).rows[0].id as string;
    return id;
  });
}

async function batch(userId: string, workspaceId: string) {
  return t.as(
    userId,
    async (db) =>
      (
        await db.query(
          "insert into public.import_batches (workspace_id, filename, file_type, interpretation, row_count) values ($1, 'orders.csv', 'csv', 'order_per_row', 3) returning id",
          [workspaceId],
        )
      ).rows[0].id as string,
  );
}

const importOrders = (userId: string, batchId: string, orders: unknown[], replace = false) =>
  t.as(
    userId,
    async (db) =>
      (await db.query("select public.import_orders($1, $2::jsonb, $3) as r", [batchId, JSON.stringify(orders), replace])).rows[0].r,
  );

const count = async (table: string, where = "true", params: unknown[] = []) =>
  (await t.db.query(`select count(*)::int as n from public.${table} where ${where}`, params)).rows[0].n as number;

beforeAll(async () => {
  t = await startTestDatabase();
  ann = await t.user("ann@example.com");
  bob = await t.user("bob@example.com");
  annWorkspace = await workspace(ann, "Ann's shop");
  bobWorkspace = await workspace(bob, "Bob's shop");
  annBatch = await batch(ann, annWorkspace);
  bobBatch = await batch(bob, bobWorkspace);
  await importOrders(ann, annBatch, [
    order("A-1", "10.00", { customer: { identity_key: "id:c1", external_id: "c1", name: "Cy", email: "cy@example.com" } }),
    order("A-2", "25.50"),
  ]);
  await importOrders(bob, bobBatch, [
    order("B-1", "99.00", {
      customer: { identity_key: "email:dee@example.com", external_id: null, name: "Dee", email: "dee@example.com" },
    }),
  ]);
}, 180_000);

afterAll(async () => {
  await t?.stop();
});

describe("a user and somebody else's workspace", () => {
  it.each(TABLES)("cannot read %s", async (table) => {
    const rows = await t.as(ann, async (db) => (await db.query(`select * from public.${table}`)).rows);
    expect(rows.length).toBeGreaterThan(0);
    const column = table === "workspaces" ? "id" : "workspace_id";
    // Everything Ann sees is Ann's; Bob's rows are not there at all.
    expect(new Set(rows.map((row) => row[column]))).toEqual(new Set([annWorkspace]));
  });

  it("cannot change or delete it: the statements find nothing", async () => {
    const changed = await t.as(
      ann,
      async (db) => (await db.query("update public.workspaces set name = 'taken' where id = $1", [bobWorkspace])).rowCount,
    );
    expect(changed).toBe(0);
    for (const table of ["orders", "customers", "import_batches", "workspaces"]) {
      const column = table === "workspaces" ? "id" : "workspace_id";
      const deleted = await t.as(
        ann,
        async (db) => (await db.query(`delete from public.${table} where ${column} = $1`, [bobWorkspace])).rowCount,
      );
      expect([table, deleted]).toEqual([table, 0]);
    }
    expect(await count("orders", "workspace_id = $1", [bobWorkspace])).toBe(1);
    expect((await t.db.query("select name from public.workspaces where id = $1", [bobWorkspace])).rows[0].name).toBe("Bob's shop");
  });

  it("cannot write rows into it", async () => {
    expect(
      await codeOf(() =>
        t.as(ann, (db) =>
          db.query(
            "insert into public.import_batches (workspace_id, filename, file_type, interpretation, row_count) values ($1, 'x.csv', 'csv', 'order_per_row', 1)",
            [bobWorkspace],
          ),
        ),
      ),
    ).toBe("42501");
    expect(
      await codeOf(() =>
        t.as(ann, (db) => db.query("insert into public.customers (workspace_id, identity_key) values ($1, 'id:evil')", [bobWorkspace])),
      ),
    ).toBe("42501");
  });

  it("cannot import into its batch, close it or delete it", async () => {
    expect(await codeOf(() => importOrders(ann, bobBatch, [order("X-1", "1.00")]))).toBe("P0002");
    expect(await codeOf(() => t.as(ann, (db) => db.query("select public.finish_import($1, 0)", [bobBatch])))).toBe("P0002");
    expect(await codeOf(() => t.as(ann, (db) => db.query("select public.delete_import($1)", [bobBatch])))).toBe("P0002");
    expect(await count("orders", "workspace_id = $1", [bobWorkspace])).toBe(1);
  });

  it("cannot create a workspace in someone else's name, nor a second one of their own", async () => {
    expect(
      await codeOf(() =>
        t.as(ann, (db) =>
          db.query("insert into public.workspaces (owner_user_id, name, currency_code, timezone) values ($1, 'x', 'USD', 'UTC')", [bob]),
        ),
      ),
    ).toBe("42501");
    expect(await codeOf(() => workspace(ann, "Second"))).toBe("23505");
  });

  it("cannot edit imported orders at all, even their own", async () => {
    expect(
      await codeOf(() => t.as(ann, (db) => db.query("update public.orders set net_amount = 0 where workspace_id = $1", [annWorkspace]))),
    ).toBe("42501");
  });
});

describe("a visitor who is not signed in", () => {
  it.each(TABLES)("cannot read %s", async (table) => {
    expect(await codeOf(() => t.as(null, (db) => db.query(`select * from public.${table}`)))).toBe("42501");
  });

  it("cannot call the import functions", async () => {
    expect(await codeOf(() => t.as(null, (db) => db.query("select public.import_orders($1, '[]'::jsonb)", [annBatch])))).toBe("42501");
    expect(await codeOf(() => t.as(null, (db) => db.query("select public.delete_import($1)", [annBatch])))).toBe("42501");
  });
});

describe("importing", () => {
  it("stores orders with their lines and links customers", async () => {
    expect(await count("orders", "workspace_id = $1", [annWorkspace])).toBe(2);
    expect(await count("order_lines", "workspace_id = $1", [annWorkspace])).toBe(2);
    const linked = (
      await t.db.query(
        "select c.name from public.orders o join public.customers c on c.id = o.customer_id where o.external_order_id = 'A-1'",
      )
    ).rows;
    expect(linked).toEqual([{ name: "Cy" }]);
    expect((await t.db.query("select customer_id from public.orders where external_order_id = 'A-2'")).rows[0].customer_id).toBeNull();
  });

  it("skips an order number the workspace already has, and counts it", async () => {
    const result = await importOrders(ann, annBatch, [order("A-2", "999.00"), order("A-3", "5.00")]);
    expect(result).toEqual({ inserted: 1, skipped: 1, replaced: 0 });
    expect((await t.db.query("select net_amount::text from public.orders where external_order_id = 'A-2'")).rows[0].net_amount).toBe(
      "25.5000",
    );
  });

  it("replaces it when asked, without leaving the old lines behind", async () => {
    const result = await importOrders(ann, annBatch, [order("A-2", "30.00")], true);
    expect(result).toEqual({ inserted: 1, skipped: 0, replaced: 1 });
    expect((await t.db.query("select net_amount::text from public.orders where external_order_id = 'A-2'")).rows[0].net_amount).toBe(
      "30.0000",
    );
    expect(await count("order_lines", "order_id in (select id from public.orders where external_order_id = 'A-2')")).toBe(1);
  });

  it("lets two workspaces use the same order number", async () => {
    expect(await importOrders(bob, bobBatch, [order("A-1", "7.00")])).toMatchObject({ inserted: 1 });
  });

  it("reuses a customer who is already known, by the same identity", async () => {
    await importOrders(ann, annBatch, [
      order("A-4", "12.00", { customer: { identity_key: "id:c1", external_id: "c1", name: "Someone Else", email: null } }),
    ]);
    expect(await count("customers", "workspace_id = $1", [annWorkspace])).toBe(1);
    // The first record of a person stands; a later file does not rename them.
    expect((await t.db.query("select name from public.customers where workspace_id = $1", [annWorkspace])).rows[0].name).toBe("Cy");
  });

  it("takes a chunk whole or not at all", async () => {
    const before = await count("orders", "workspace_id = $1", [annWorkspace]);
    expect(await codeOf(() => importOrders(ann, annBatch, [order("A-50", "1.00"), order("A-51", "1.00", { status: "lost" })]))).toBe(
      "23514",
    );
    expect(await count("orders", "workspace_id = $1", [annWorkspace])).toBe(before);
  });

  it("refuses an order that does not add up to its lines, a negative amount, a refund above the net", async () => {
    expect(await codeOf(() => importOrders(ann, annBatch, [order("A-60", "10.00", { net: "9.00" })]))).toBe("23514");
    expect(await codeOf(() => importOrders(ann, annBatch, [order("A-61", "-5.00")]))).toBe("23514");
    expect(await codeOf(() => importOrders(ann, annBatch, [order("A-62", "10.00", { refund: "11.00" })]))).toBe("23514");
    expect(await codeOf(() => importOrders(ann, annBatch, [order("A-63", "10.00", { lines: [] })]))).toBe("23514");
    expect(await codeOf(() => importOrders(ann, annBatch, [order("A-64", "1.00"), order("A-64", "1.00")]))).toBe("23505");
  });

  it("refuses more than 500 orders in a request", async () => {
    const many = Array.from({ length: 501 }, (_, index) => order(`M-${index}`, "1.00"));
    expect(await codeOf(() => importOrders(ann, annBatch, many))).toBe("22023");
  });

  it("stores every order in the workspace's currency and will not let the currency change under them", async () => {
    expect((await t.db.query("select distinct currency_code from public.orders where workspace_id = $1", [annWorkspace])).rows).toEqual([
      { currency_code: "USD" },
    ]);
    expect(
      await codeOf(() => t.as(ann, (db) => db.query("update public.workspaces set currency_code = 'EUR' where id = $1", [annWorkspace]))),
    ).toBe("23503");
    // Name and time zone can change freely.
    await t.as(ann, (db) =>
      db.query("update public.workspaces set name = 'Ann & Co', timezone = 'Europe/London' where id = $1", [annWorkspace]),
    );
    expect((await t.db.query("select name from public.workspaces where id = $1", [annWorkspace])).rows[0].name).toBe("Ann & Co");
  });

  it("closes a batch with the count of what it really holds, once", async () => {
    const held = await count("orders", "import_batch_id = $1", [annBatch]);
    const result = await t.as(
      ann,
      async (db) => (await db.query("select public.finish_import($1, 2, '[\"note\"]'::jsonb) as r", [annBatch])).rows[0].r,
    );
    expect(result).toEqual({ accepted: held });
    const row = (await t.db.query("select status, accepted_count, rejected_count from public.import_batches where id = $1", [annBatch]))
      .rows[0];
    expect(row).toEqual({ status: "completed", accepted_count: held, rejected_count: 2 });
    expect(await codeOf(() => t.as(ann, (db) => db.query("select public.finish_import($1, 0)", [annBatch])))).toBe("P0002");
    // A closed batch takes no more orders.
    expect(await codeOf(() => importOrders(ann, annBatch, [order("A-99", "1.00")]))).toBe("P0001");
  });
});

describe("deleting", () => {
  it("removes a batch with its orders and lines, and the customers left with none", async () => {
    const second = await batch(ann, annWorkspace);
    await importOrders(ann, second, [
      order("D-1", "40.00", { customer: { identity_key: "id:c9", external_id: "c9", name: "Only Here", email: null } }),
      order("D-2", "8.00", { customer: { identity_key: "id:c1", external_id: "c1", name: "Cy", email: null } }),
    ]);
    const before = await count("orders", "workspace_id = $1", [annWorkspace]);

    const result = await t.as(ann, async (db) => (await db.query("select public.delete_import($1) as r", [second])).rows[0].r);
    expect(result).toEqual({ orders_removed: 2, customers_removed: 1 });
    expect(await count("orders", "workspace_id = $1", [annWorkspace])).toBe(before - 2);
    expect(await count("order_lines", "order_id not in (select id from public.orders)")).toBe(0);
    // Cy still has orders from the first batch and stays; the other customer is gone.
    expect((await t.db.query("select name from public.customers where workspace_id = $1", [annWorkspace])).rows).toEqual([{ name: "Cy" }]);
  });

  it("removes everything a user had when their account goes, and nothing of anyone else's", async () => {
    const eve = await t.user("eve@example.com");
    const eveWorkspace = await workspace(eve, "Eve's shop");
    const eveBatch = await batch(eve, eveWorkspace);
    await importOrders(eve, eveBatch, [
      order("E-1", "3.00", { customer: { identity_key: "id:e", external_id: "e", name: "E", email: null } }),
    ]);
    const others = await count("orders", "workspace_id <> $1", [eveWorkspace]);

    await t.db.query("delete from auth.users where id = $1", [eve]);
    for (const table of TABLES) {
      const column = table === "workspaces" ? "id" : "workspace_id";
      expect([table, await count(table, `${column} = $1`, [eveWorkspace])]).toEqual([table, 0]);
    }
    expect(await count("orders")).toBe(others);
  });
});
