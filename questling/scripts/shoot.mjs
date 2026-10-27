// Screenshots of app routes for checking by eye: node scripts/shoot.mjs <out-dir> <width> <route> [<route> …]
// Uses the running app on --base (default http://localhost:3100); waits for the student record.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const base = baseIndex >= 0 ? args.splice(baseIndex, 2)[1] : "http://localhost:3100";
const [out, width, ...routes] = args;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome" });
const page = await browser.newPage({ viewport: { width: Number(width), height: 844 }, deviceScaleFactor: 2 });
for (const route of routes) {
  await page.goto(`${base}${route}`, { waitUntil: "load" });
  await page.waitForSelector("[data-student-ready], [data-studio-ready]", { timeout: 30000 }).catch(() => {});
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important}[data-demo-badge]{display:none!important}:root{--demo-bar:0px!important}",
  });
  await page.waitForTimeout(600);
  const file = path.join(out, `${route.replace(/^\//, "").replace(/[/?=&]/g, "_")}-${width}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(file);
}
await browser.close();
