import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import type { Client } from "pg";

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS = join(ROOT, "supabase/migrations");
const SEED = join(ROOT, "supabase/seed.sql");
const SHIM = join(import.meta.dirname, "supabase-shim.sql");
// Inside the project: an ASCII path, whatever the name of the home directory.
const DATA_ROOT = join(ROOT, ".tmp");

export type Role = "anon" | "authenticated" | "service_role";

export type TestDatabase = {
  /** A superuser connection, for arranging and inspecting data. */
  db: Client;
  /** Connection string, for code under test that opens its own connections. */
  url: string;
  /** A new connection, for tests that need two sessions at once. */
  connect: () => Promise<Client>;
  /**
   * Runs statements as an API role would: under that role and with the user's
   * id in the JWT claims. Everything is rolled back afterwards.
   */
  as: <T>(role: Role, userId: string | null, run: (db: Client) => Promise<T>) => Promise<T>;
  seed: () => Promise<void>;
  stop: () => Promise<void>;
};

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => (address && typeof address === "object" ? done(address.port) : fail(new Error("no port"))));
    });
  });
}

/** Starts a throwaway PostgreSQL with the Supabase shim, the migrations and the seed applied. */
export async function startTestDatabase(): Promise<TestDatabase> {
  mkdirSync(DATA_ROOT, { recursive: true });
  const databaseDir = mkdtempSync(join(DATA_ROOT, "pg-"));
  const port = await freePort();
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });

  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("cutco_test");

  const clients: Client[] = [];
  const connect = async () => {
    const client = postgres.getPgClient("cutco_test");
    await client.connect();
    clients.push(client);
    return client;
  };

  const db = await connect();
  // A fixed session time zone, so results do not depend on the machine.
  await db.query("set time zone 'UTC'");
  await db.query(readFileSync(SHIM, "utf8"));
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  const seed = async () => {
    await db.query(readFileSync(SEED, "utf8"));
  };
  await seed();

  const as: TestDatabase["as"] = async (role, userId, run) => {
    await db.query("begin");
    try {
      await db.query(`set local role ${role}`);
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(userId ? { sub: userId, role } : { role }),
      ]);
      return await run(db);
    } finally {
      await db.query("rollback");
    }
  };

  const stop = async () => {
    await Promise.allSettled(clients.map((client) => client.end()));
    await postgres.stop();
    // On Windows the server can still be letting go of its files for a moment.
    // A leftover folder is harmless: .tmp is ignored and each run uses a new one.
    try {
      rmSync(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {}
  };

  const url = `postgres://postgres:postgres@127.0.0.1:${port}/cutco_test`;
  return { db, url, connect, as, seed, stop };
}
