// Gives the Vercel project "questling" the server's settings from .env.local
// (DATABASE_URL, TELEGRAM_BOT_TOKEN, SESSION_SECRET; SUPABASE_URL, SUPABASE_ANON_KEY for teachers' sign-in; MEDIA_S3_* and
// CRON_SECRET for media storage, docs/media-storage.md), for Production. Values go to Vercel on
// standard input; none is printed. Run from questling/ after `vercel link`:
//
//   node scripts/vercel-env.mjs
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SCOPE = "riddle6";
const NAMES = [
  "DATABASE_URL",
  "TELEGRAM_BOT_TOKEN",
  "SESSION_SECRET",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "MEDIA_S3_ENDPOINT",
  "MEDIA_S3_REGION",
  "MEDIA_S3_BUCKET",
  "MEDIA_S3_ACCESS_KEY_ID",
  "MEDIA_S3_SECRET_ACCESS_KEY",
  "CRON_SECRET",
];

const local = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
);

const vercel = (args, input) => spawnSync("npx", ["vercel", ...args, "--scope", SCOPE], { input, encoding: "utf8", shell: true });

for (const name of NAMES) {
  const value = local[name];
  if (!value) {
    console.error(`MISSING  ${name} in .env.local`);
    process.exitCode = 1;
    continue;
  }
  // Replace rather than fail if it is there from an earlier run.
  vercel(["env", "rm", name, "production", "--yes"]);
  const added = vercel(["env", "add", name, "production"], value);
  const said = `${added.stdout}${added.stderr}`.split(value).join("***");
  console.log(`${added.status === 0 ? "set     " : "FAILED  "}${name}${added.status === 0 ? "" : `: ${said.trim().split("\n").pop()}`}`);
  if (added.status !== 0) process.exitCode = 1;
}
