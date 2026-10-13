// Screenshots of the screens brought over from the Stitch design and of the
// additions made after it, on the demo's invented data: a phone and a wide
// screen, light theme, and two screens in the dark one.
//
//   node scripts/stitch-screenshots.mjs [origin]     writes docs/screenshots/stitch/*.webp
//
// `origin` is a running site (default http://localhost:3310, e.g. `npx next dev -p 3310`
// with the database and bot variables empty, so that only the demo exists).
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import sharp from "sharp";

const base = process.argv[2] ?? "http://localhost:3310";
const out = "docs/screenshots/stitch";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome" });

async function session(name, options, theme, shots) {
  const context = await browser.newContext(options);
  await context.addInitScript((value) => window.localStorage.setItem("splitly-theme", value), theme);
  const page = await context.newPage();
  const go = (path) => page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  const tab = (word) => page.getByRole("tab", { name: new RegExp(`^${word}`) }).click();
  const save = async (file, { full = false } = {}) => {
    await page.waitForTimeout(350);
    const png = await page.screenshot({ fullPage: full });
    await sharp(png)
      .resize({ width: options.viewport?.width ?? 412, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(`${out}/${name}-${file}.webp`);
    console.log(`${out}/${name}-${file}.webp`);
  };
  try {
    await shots({ page, go, tab, save });
  } finally {
    await context.close();
  }
}

/** The receipt of the fixtures, read and given out: the four scanner screens. */
async function scanner({ page, go, save }) {
  await go("/ru/demo/scan?group=demo-istanbul");
  await save("scan-1-capture");
  await page.locator("input[type=file]").setInputFiles("e2e/fixtures/receipt-tr.png");
  await page.locator("main img").waitFor();
  await page.getByRole("button", { name: "Распознать чек" }).click();
  await page.getByRole("heading", { level: 1, name: "Проверка чека" }).waitFor({ timeout: 120_000 });
  await save("scan-2-review");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("heading", { level: 1, name: "Распределение покупок" }).waitFor();
  const lines = page.getByRole("group");
  for (let index = 0; index < (await lines.count()); index++) {
    if (index === 3) await lines.nth(index).getByRole("button").first().click();
    else await lines.nth(index).getByRole("button").last().click();
  }
  await save("scan-3-assign");
  await page.getByRole("button", { name: "Создать расход" }).click();
  await page.getByRole("heading", { level: 1 }).filter({ hasText: "распределён" }).waitFor();
  await page.waitForTimeout(3500);
  await save("scan-4-result");
}

try {
  await session("phone", { ...devices["Pixel 7"] }, "light", async (tools) => {
    const { page, go, tab, save } = tools;
    await go("/ru/demo");
    await save("home");
    await go("/ru/demo/groups");
    await save("groups");
    await go("/ru/demo/groups/demo-istanbul");
    await save("group");
    await page.getByRole("button", { name: "Пригласить" }).click();
    await save("invite-sheet");
    await page.getByRole("dialog").getByRole("button", { name: "Закрыть" }).click();
    await tab("Долги");
    await page.getByRole("region", { name: "Упрощённые переводы" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Напомнить" }).first().click();
    await page.getByRole("button", { name: "Напомнить" }).first().scrollIntoViewIfNeeded();
    await save("debts-remind");
    await go("/ru/demo/groups/demo-flat?tab=analytics");
    await page.getByLabel("Период").selectOption("all");
    await save("analytics", { full: true });
    await go("/ru/demo/groups/demo-istanbul?tab=settings");
    await page.getByRole("region", { name: "Отчёты" }).scrollIntoViewIfNeeded();
    await save("reports");
    await go("/ru/demo/debts");
    await save("debts-all");
    await go("/ru/demo/activity");
    await save("activity");
    await go("/ru/demo/profile");
    await save("profile");
    await go("/ru/demo/add?group=demo-istanbul");
    await save("add");
    await scanner(tools);
  });
  await session("phone-dark", { ...devices["Pixel 7"] }, "dark", async ({ go, tab, save }) => {
    await go("/ru/demo");
    await save("home");
    await go("/ru/demo/groups/demo-istanbul");
    await tab("Долги");
    await save("debts");
    await go("/ru/demo/scan?group=demo-istanbul");
    await save("scan-1-capture");
  });
  const wide = { viewport: { width: 1440, height: 900 } };
  await session("desktop", wide, "light", async ({ page, go, save }) => {
    await go("/ru/demo");
    await save("home");
    await go("/ru/demo/groups/demo-istanbul");
    await save("group");
    await page.getByRole("button", { name: "Пригласить" }).click();
    await save("invite-sheet");
    await page.getByRole("dialog").getByRole("button", { name: "Закрыть" }).click();
    await go("/ru/demo/groups/demo-istanbul?tab=debts");
    await save("group-debts");
    await go("/ru/demo/groups/demo-flat?tab=analytics");
    await page.getByLabel("Период").selectOption("all");
    await save("group-analytics");
    await go("/ru/demo/analytics");
    await page.getByLabel("Период").selectOption("all");
    await save("analytics");
    await go("/ru/demo/debts");
    await save("debts-all");
    await go("/ru/demo/activity");
    await save("activity");
    await go("/ru/demo/profile");
    await save("profile");
  });
  await session("desktop-dark", wide, "dark", async ({ go, save }) => {
    await go("/ru/demo/groups/demo-istanbul");
    await save("group");
    await go("/ru/demo/analytics");
    await save("analytics");
  });
} finally {
  await browser.close();
}
