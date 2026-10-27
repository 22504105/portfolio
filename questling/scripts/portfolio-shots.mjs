// Portfolio screenshots of the public demo (invented data only): student screens on a phone and
// Teacher Studio on a desktop, written to docs/screenshots/*.jpg.
//   node scripts/portfolio-shots.mjs [origin]      default: the production site
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const origin = process.argv[2] ?? "https://questling-dusky.vercel.app";
const out = "docs/screenshots";
mkdirSync(out, { recursive: true });

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

const shots = [
  ["home", "/en/demo/home", phone],
  ["story-map", "/en/demo/map", phone],
  ["story-player", "/en/demo/play/forgotten-academy", phone],
  ["wardrobe", "/en/demo/wardrobe", phone],
  ["word-journal", "/en/demo/words", phone],
  ["home-ru", "/ru/demo/home", phone],
  ["studio-dashboard", "/en/demo/studio", desktop],
  ["studio-builder", "/en/demo/studio/builder", desktop],
  ["studio-analytics", "/en/demo/studio/analytics", desktop],
];

const browser = await chromium.launch({ channel: "chrome" });
for (const [name, path, device] of shots) {
  // A fresh context per shot: a fresh demo student, nothing carried over.
  const context = await browser.newContext(device);
  const page = await context.newPage();
  await page.goto(origin + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  if (name === "studio-builder") {
    // Open the demo campaign so the graph shows, not the list.
    await page.getByRole("link", { name: /Open/ }).first().click();
    await page.waitForTimeout(4000);
  }
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 82 });
  console.log(name, page.url());
  await context.close();
}
await browser.close();
