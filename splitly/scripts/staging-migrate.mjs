// Applies the migrations to the trial stand's database, and to nothing else: the address comes from .env.staging
// through the checks of staging-env.mjs, which refuse production's.
//
//   node scripts/staging-migrate.mjs
import { stagingEnv } from "./staging-env.mjs";

const env = stagingEnv();
if (env.problems.length > 0) {
  for (const problem of env.problems) console.error(`PROBLEM  ${problem}`);
  process.exit(1);
}
console.log(`migrating the trial stand's database at ${env.host}`);
process.env.DATABASE_URL = env.databaseUrl;
await import("./migrate.mjs");
