// Applies the migrations in supabase/migrations to the database in
// DATABASE_URL (.env.local), in file-name order, each in its own transaction.
// What has been applied is recorded in app.migrations, so running it again
// applies only what is new.
//
// Usage: npm run db:migrate            apply pending migrations
//        npm run db:migrate -- --seed  ...and then the seed (safe to repeat)

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const env = readFileSync(".env.local", "utf8").split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
if (!env) throw new Error("DATABASE_URL is not set in .env.local");
const url = env.slice("DATABASE_URL=".length).trim();
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query("create schema if not exists app");
  await client.query("create table if not exists app.migrations (name text primary key, applied_at timestamptz not null default now())");
  const applied = new Set((await client.query("select name from app.migrations")).rows.map((row) => row.name));

  for (const file of readdirSync("supabase/migrations").sort()) {
    if (applied.has(file)) {
      console.log(`already applied  ${file}`);
      continue;
    }
    await client.query("begin");
    try {
      await client.query(readFileSync(path.join("supabase/migrations", file), "utf8"));
      await client.query("insert into app.migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`applied          ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`${file} failed and was rolled back: ${error.message}`);
    }
  }

  if (process.argv.includes("--seed")) {
    await client.query(readFileSync("supabase/seed.sql", "utf8"));
    console.log("seeded");
  }
} finally {
  await client.end();
}
