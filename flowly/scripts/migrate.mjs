// Applies the SQL migrations in supabase/migrations to a database, in name
// order, each one once. Usage:
//
//   DATABASE_URL in .env.local (Supabase: Project Settings → Database →
//   Connection string → Transaction pooler), then:  npm run db:migrate
//
// The connection string is a secret. It is used by this script only, never by
// the application, and must not be given a NEXT_PUBLIC_ name.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import pg from "pg";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(".env.local")) return null;
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("DATABASE_URL="));
  return line
    ? line
        .slice("DATABASE_URL=".length)
        .trim()
        .replace(/^["']|["']$/g, "")
    : null;
}

const url = databaseUrl();
if (!url) {
  console.error("DATABASE_URL is not set. Put it in .env.local (see .env.example).");
  process.exit(1);
}

const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const db = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await db.connect();
try {
  await db.query("create schema if not exists flowly_meta");
  await db.query(
    "create table if not exists flowly_meta.migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const applied = new Set((await db.query("select name from flowly_meta.migrations")).rows.map((row) => row.name));

  for (const name of readdirSync("supabase/migrations").sort()) {
    if (applied.has(name)) {
      console.log(`already applied  ${name}`);
      continue;
    }
    // A migration goes in whole or not at all.
    await db.query("begin");
    try {
      await db.query(readFileSync(`supabase/migrations/${name}`, "utf8"));
      await db.query("insert into flowly_meta.migrations (name) values ($1)", [name]);
      await db.query("commit");
      console.log(`applied          ${name}`);
    } catch (error) {
      await db.query("rollback");
      console.error(`failed           ${name}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await db.end();
}
