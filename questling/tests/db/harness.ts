import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import type { Client } from "pg";

// A throwaway PostgreSQL for the tests, with the API roles a Supabase database has, and the
// migrations applied. Carried over from Splitly.

const ROOT = resolve(import.meta.dirname, "../..");
const MIGRATIONS = join(ROOT, "supabase/migrations");
// Inside the project: an ASCII path, whatever the name of the home directory.
const DATA_ROOT = join(ROOT, ".tmp");

export type TestDatabase = {
  db: Client;
  url: string;
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
    // UTF-8 whatever the machine's own locale is (this one would make WIN1251).
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("questling_test");

  const db = postgres.getPgClient("questling_test");
  await db.connect();
  await db.query("set time zone 'UTC'");
  await db.query("create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;");
  for (const file of readdirSync(MIGRATIONS).sort()) await db.query(readFileSync(join(MIGRATIONS, file), "utf8"));

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
    try {
      rmSync(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {}
  };

  return { db, url: `postgres://postgres:postgres@127.0.0.1:${port}/questling_test`, asApiRole, stop };
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
