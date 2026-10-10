// Runs the email queue once against the local server, the way the scheduler
// does in production. Usage: npm run jobs   (with `npm run dev` running)
// Reminders become due a day or two hours before an appointment; this is how
// to send whatever is due without waiting for a scheduler.

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
);

const response = await fetch(`${env.APP_URL}/api/cron/notifications`, {
  headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
});
console.log(response.status, await response.text());
