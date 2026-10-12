import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import type { Client } from "pg";

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS = join(ROOT, "supabase/migrations");
// Inside the project: an ASCII path, whatever the name of the home directory.
const DATA_ROOT = join(ROOT, ".tmp");

export type TestDatabase = {
  /** The owner's connection: what the application's server uses. */
  db: Client;
  /** Runs statements in one transaction and commits; a failure rolls everything back and is thrown. */
  tx: <T>(run: (db: Client) => Promise<T>) => Promise<T>;
  /** Runs statements under one of the hosting platform's API roles, then rolls back. */
  asApiRole: <T>(role: "anon" | "authenticated", run: (db: Client) => Promise<T>) => Promise<T>;
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

/** Starts a throwaway PostgreSQL, with the API roles a Supabase database has, and applies the migrations. */
export async function startTestDatabase(): Promise<TestDatabase> {
  mkdirSync(DATA_ROOT, { recursive: true });
  const databaseDir = mkdtempSync(join(DATA_ROOT, "pg-"));
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port: await freePort(),
    persistent: false,
    // UTF-8 whatever the machine's own locale is: names and comments are not all Latin.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("splitly_test");

  const db = postgres.getPgClient("splitly_test");
  await db.connect();
  await db.query("set time zone 'UTC'");
  // The two roles a Supabase project's public API runs as, so the migrations' revokes have something to act on.
  await db.query("create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;");
  for (const file of readdirSync(MIGRATIONS).sort()) await db.query(readFileSync(join(MIGRATIONS, file), "utf8"));

  const tx: TestDatabase["tx"] = async (run) => {
    await db.query("begin");
    try {
      const result = await run(db);
      await db.query("commit");
      return result;
    } catch (error) {
      await db.query("rollback").catch(() => {});
      throw error;
    }
  };

  const asApiRole: TestDatabase["asApiRole"] = async (role, run) => {
    await db.query("begin");
    try {
      await db.query(`set local role ${role}`);
      return await run(db);
    } finally {
      await db.query("rollback");
    }
  };

  const stop = async () => {
    await db.end().catch(() => {});
    await postgres.stop();
    // On Windows the server can still be letting go of its files for a moment.
    try {
      rmSync(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {}
  };

  return { db, tx, asApiRole, stop };
}

/** The error code PostgreSQL answers with, or null if the statements went through. */
export async function codeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}
