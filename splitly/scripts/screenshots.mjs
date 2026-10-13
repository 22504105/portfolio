// Takes the README's screenshots from the built site, on the demo's invented
// data: a phone in the light theme, one screen in the dark theme, and the
// wide layout. Run `npm run build` first.
//
//   node scripts/screenshots.mjs      writes docs/screenshots/*.webp
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import sharp from "sharp";

const PORT = 3320;
const base = `http://localhost:${PORT}`;
const out = "docs/screenshots";
mkdirSync(out, { recursive: true });

const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  // The demo alone: no database, no bot.
  env: { ...process.env, DATABASE_URL: "", TELEGRAM_BOT_TOKEN: "", SESSION_SECRET: "" },
  stdio: "ignore",
});
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome" });
  const save = async (page, name, width) => {
    const png = await page.screenshot({ fullPage: false });
    await sharp(png).resize({ width }).webp({ quality: 82 }).toFile(`${out}/${name}.webp`);
    console.log(`${out}/${name}.webp`);
  };
  const tab = (page, name) => page.getByRole("tab", { name, exact: true }).click();

  const phone = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await phone.newPage();
  await page.goto(`${base}/en/demo`, { waitUntil: "networkidle" });
  await save(page, "home", 412);
  await page.goto(`${base}/en/demo/groups/demo-istanbul`, { waitUntil: "networkidle" });
  await save(page, "group", 412);
  await tab(page, "Debts");
  await save(page, "debts", 412);
  await page.goto(`${base}/en/demo/groups/demo-flat`, { waitUntil: "networkidle" });
  await tab(page, "Analytics");
  await page.getByLabel("Period").selectOption("all");
  await save(page, "analytics", 412);
  await page.goto(`${base}/en/demo/add?group=demo-istanbul`, { waitUntil: "networkidle" });
  await page.getByLabel("Description").fill("Dinner at the harbour");
  await page.getByLabel("Amount", { exact: true }).fill("1250,50");
  await page.getByRole("button", { name: "Eating out" }).click();
  await save(page, "new-expense", 412);
  await page.goto(`${base}/en/demo/scan?group=demo-istanbul`, { waitUntil: "networkidle" });
  await page.locator("input[type=file]").setInputFiles("e2e/fixtures/receipt-tr.png");
  await page.getByRole("button", { name: "Read the receipt" }).click();
  await page.getByRole("heading", { level: 1, name: "Check the receipt" }).waitFor({ timeout: 90_000 });
  await save(page, "receipt", 412);
  await phone.close();

  const dark = await browser.newContext({ ...devices["Pixel 7"], colorScheme: "dark" });
  const night = await dark.newPage();
  await night.goto(`${base}/en/demo`, { waitUntil: "networkidle" });
  await save(night, "home-dark", 412);
  await dark.close();

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const wide = await desktop.newPage();
  await wide.goto(`${base}/en/demo/groups/demo-istanbul`, { waitUntil: "networkidle" });
  await save(wide, "wide", 1280);
  await wide.goto(`${base}/en`, { waitUntil: "networkidle" });
  await save(wide, "cover", 1280);
  await desktop.close();
  await browser.close();
} finally {
  server.kill();
}
