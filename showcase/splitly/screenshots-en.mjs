// The five portfolio screenshots of Splitly with the English interface, taken from the live browser demo
// (invented people and amounts). Same screens and sizes as the Russian set in splitly/docs/screenshots/stitch/.
// Kept outside splitly/ so that changing it does not count as a change to the Splitly build.
//
//   node showcase/splitly/screenshots-en.mjs [origin]     writes splitly/docs/screenshots/stitch-en/*.webp
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const splitly = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../splitly");
const require = createRequire(path.join(splitly, "package.json"));
const { chromium, devices } = require("@playwright/test");
const sharp = require("sharp");

const base = process.argv[2] ?? "https://splitly-self.vercel.app";
const out = path.join(splitly, "docs/screenshots/stitch-en");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });

async function session(name, options, theme, shots) {
  const context = await browser.newContext(options);
  await context.addInitScript((value) => window.localStorage.setItem("splitly-theme", value), theme);
  const page = await context.newPage();
  const go = (to) => page.goto(`${base}${to}`, { waitUntil: "networkidle" });
  const save = async (file) => {
    await page.waitForTimeout(350);
    const png = await page.screenshot();
    await sharp(png)
      .resize({ width: options.viewport?.width ?? 412, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(`${out}/${name}-${file}.webp`);
    console.log(`${name}-${file}.webp`);
  };
  try {
    await shots({ page, go, save });
  } finally {
    await context.close();
  }
}

try {
  await session("phone", { ...devices["Pixel 7"] }, "light", async ({ page, go, save }) => {
    await go("/en/demo");
    await save("home");
    // The receipt of the e2e fixtures, read on the device and given out.
    await go("/en/demo/scan?group=demo-istanbul");
    await page.locator("input[type=file]").setInputFiles(path.join(splitly, "e2e/fixtures/receipt-tr.png"));
    await page.locator("main img").waitFor();
    await page.getByRole("button", { name: "Read the receipt" }).click();
    await page.getByRole("heading", { level: 1, name: "Check the receipt" }).waitFor({ timeout: 120_000 });
    await save("scan-2-review");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("heading", { level: 1, name: "Who had what" }).waitFor();
    const lines = page.getByRole("group");
    for (let index = 0; index < (await lines.count()); index++) {
      if (index === 3) await lines.nth(index).getByRole("button").first().click();
      else await lines.nth(index).getByRole("button").last().click();
    }
    await save("scan-3-assign");
  });
  const wide = { viewport: { width: 1440, height: 900 } };
  await session("desktop", wide, "light", async ({ go, save }) => {
    await go("/en/demo/groups/demo-istanbul");
    await save("group");
  });
  await session("desktop-dark", wide, "dark", async ({ go, save }) => {
    await go("/en/demo/analytics");
    await save("analytics");
  });
} finally {
  await browser.close();
}
