// Gives the trial stand's Vercel project (splitly-staging, never the production project "splitly") its four
// variables: the stand's own bot and database from .env.staging, and a session secret made here for the stand
// alone. Values go straight to Vercel on standard input; none is printed or written anywhere.
//
//   node scripts/staging-vercel-env.mjs
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { stagingEnv } from "./staging-env.mjs";

const PROJECT = "splitly-staging";
const SCOPE = "riddle6";

const env = stagingEnv();
if (env.problems.length > 0) {
  for (const problem of env.problems) console.error(`PROBLEM  ${problem}`);
  process.exit(1);
}

const vercel = (args, input) =>
  spawnSync("npx", ["vercel", ...args, "--project", PROJECT, "--scope", SCOPE], { input, encoding: "utf8", shell: true });

const values = {
  DATABASE_URL: env.databaseUrl,
  TELEGRAM_BOT_TOKEN: env.token,
  TELEGRAM_BOT_USERNAME: env.username,
  SESSION_SECRET: randomBytes(32).toString("hex"),
};
for (const [name, value] of Object.entries(values)) {
  // Replace rather than fail if it is there from an earlier run.
  vercel(["env", "rm", name, "production", "--yes"]);
  const added = vercel(["env", "add", name, "production"], value);
  const said = `${added.stdout}${added.stderr}`;
  // Whatever Vercel says is shown only with the value struck out of it.
  console.log(
    `${added.status === 0 ? "set     " : "FAILED  "}${name}${added.status === 0 ? "" : `: ${said.split(value).join("***").trim().split("\n").pop()}`}`,
  );
  if (added.status !== 0) process.exitCode = 1;
}
