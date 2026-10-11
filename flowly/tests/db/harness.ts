import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import type { Client } from "pg";

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS = join(ROOT, "supabase/migrations");
const SHIM = join(import.meta.dirname, "supabase-shim.sql");
// Inside the project: an ASCII path, whatever the name of the home directory.
const DATA_ROOT = join(ROOT, ".tmp");

export type TestDatabase = {
  /** A superuser connection, for arranging and inspecting data. Row level security does not apply to it. */
  db: Client;
  /**
   * Runs statements the way the API would for a signed-in user (or, with
   * null, for a visitor): under that role and with the user's id in the JWT
   * claims. Commits unless `rollback` is set, so a test can look at the result.
   */
  as: <T>(userId: string | null, run: (db: Client) => Promise<T>, rollback?: boolean) => Promise<T>;
  /** A new account. */
  user: (email: string) => Promise<string>;
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

/** Starts a throwaway PostgreSQL with the Supabase shim and the migrations applied. */
export async function startTestDatabase(): Promise<TestDatabase> {
  mkdirSync(DATA_ROOT, { recursive: true });
  const databaseDir = mkdtempSync(join(DATA_ROOT, "pg-"));
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port: await freePort(),
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });

  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("flowly_test");

  const db = postgres.getPgClient("flowly_test");
  await db.connect();
  await db.query("set time zone 'UTC'");
  await db.query(readFileSync(SHIM, "utf8"));
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, file), "utf8"));
  }

  const as: TestDatabase["as"] = async (userId, run, rollback = false) => {
    const role = userId ? "authenticated" : "anon";
    await db.query("begin");
    try {
      await db.query(`set local role ${role}`);
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role } : { role })]);
      const result = await run(db);
      await db.query(rollback ? "rollback" : "commit");
      return result;
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  };

  const user = async (email: string) =>
    (await db.query("insert into auth.users (email) values ($1) returning id", [email])).rows[0].id as string;

  const stop = async () => {
    await db.end().catch(() => {});
    await postgres.stop();
    // On Windows the server can still be letting go of its files for a moment.
    try {
      rmSync(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {}
  };

  return { db, as, user, stop };
}

/** The error code PostgreSQL answers with, or null if the statement went through. */
export async function codeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}
