// Visual QA: renders an approved Stitch screen (its code.html, with the Stitch
// image links pointed at our local copies) and the matching app route in the
// same Chrome at the same viewport, then compares them pixel by pixel.
//
// Writes docs/visual-qa/<screen>/{reference,app,diff}.png and prints the share
// of pixels that differ. The app must be running (npm run dev or start).
//
// Usage: node scripts/visual-compare.mjs <screen> [<screen> …] [--base http://localhost:3100] [--width 390] [--height 844]
//   screens: see SCREENS below (all 15 student screens and the five player states)
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const design = path.join(root, "design-source", "questling-v2");
const remoteDir = path.join(root, "design-source", "remote-assets");

// screen -> reference html, app route, and how to bring the app into the same state
const SCREENS = {
  welcome: { html: "01_APPROVED_SCREENS/01_welcome/code.html", route: "/ru/demo/welcome" },
  home: { html: "01_APPROVED_SCREENS/02_home_2/code.html", route: "/ru/demo/home" },
  map: { html: "01_APPROVED_SCREENS/03_story_map/code.html", route: "/ru/demo/map" },
  details: { html: "01_APPROVED_SCREENS/04_quest_details/code.html", route: "/ru/demo/quest/tower" },
  player: { html: "01_APPROVED_SCREENS/05_story_player_2/code.html", route: "/ru/demo/play", steps: [["click", "[data-option=cellar]"]] },
  "player-correct": {
    html: "02_STORY_STATES/05_story_player_50_xp/code.html",
    route: "/ru/demo/play",
    steps: [
      ["click", "[data-option=cellar]"],
      ["click", "[data-action=check]"],
      ["wait", "[data-phase=correct]"],
    ],
  },
  "player-incorrect": {
    html: "02_STORY_STATES/05_story_player_3/code.html",
    route: "/ru/demo/play",
    steps: [
      ["click", "[data-option=garden]"],
      ["click", "[data-action=check]"],
      ["wait", "[data-phase=incorrect]"],
    ],
  },
  puzzle: {
    html: "01_APPROVED_SCREENS/06_interactive_puzzle/code.html",
    route: "/ru/demo/play",
    steps: [
      ["click", "[data-option=cellar]"],
      ["click", "[data-action=check]"],
      ["wait", "[data-phase=correct]"],
      ["click", "[data-action=next]"],
      // Gate 3: a choice comes between the letter and the chest.
      ["click", "[data-option=now]"],
      ["click", "[data-action=choose]"],
      ["wait", "[data-tile]"],
    ],
  },
  "player-exhausted": {
    html: "02_STORY_STATES/05_story_player_4/code.html",
    route: "/ru/demo/play",
    steps: [
      ["click", "[data-option=garden]"],
      ["click", "[data-action=check]"],
      ["wait", "[data-phase=incorrect]"],
      ["click", "[data-option=tower]"],
      ["click", "[data-action=check]"],
      ["wait", "[data-phase=exhausted]"],
    ],
  },
  "player-grimoire": {
    html: "02_STORY_STATES/05_story_player_never_2/code.html",
    route: "/ru/demo/play",
    // A sheet over the screen: compared as the phone shows it, one screenful.
    viewportOnly: true,
    steps: [
      ["click", "[data-option=garden]"],
      ["click", "[data-action=check]"],
      ["wait", "[data-phase=incorrect]"],
      ["click", "[data-option=tower]"],
      ["click", "[data-action=check]"],
      ["click", "[data-action=open-grimoire]"],
      ["click", "[data-word=never]"],
      ["wait", "[data-action=apply-grimoire]:not([disabled])"],
    ],
  },
  journal: { html: "01_APPROVED_SCREENS/07_evidence_journal_2/code.html", route: "/ru/demo/journal" },
  quests: { html: "01_APPROVED_SCREENS/08_quick_quests/code.html", route: "/ru/demo/quests" },
  discovery: { html: "01_APPROVED_SCREENS/09_daily_discovery/code.html", route: "/ru/demo/discovery" },
  rewards: { html: "01_APPROVED_SCREENS/10_rewards/code.html", route: "/ru/demo/rewards" },
  profile: { html: "01_APPROVED_SCREENS/11_profile_2/code.html", route: "/ru/demo/profile" },
  character: { html: "01_APPROVED_SCREENS/12_character_select/code.html", route: "/ru/demo/character" },
  wardrobe: { html: "01_APPROVED_SCREENS/13_wardrobe_2/code.html", route: "/ru/demo/wardrobe" },
  shop: { html: "01_APPROVED_SCREENS/14_arcane_shop_2/code.html", route: "/ru/demo/shop" },
  inventory: { html: "01_APPROVED_SCREENS/15_inventory/code.html", route: "/ru/demo/inventory" },
};

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const base = opt("base", "http://localhost:3100");
const width = Number(opt("width", 390));
const height = Number(opt("height", 844));
const names = args.length ? args : Object.keys(SCREENS);

const index = JSON.parse(await readFile(path.join(remoteDir, "index.json"), "utf8"));
const localFor = new Map(index.map((e) => [e.url, path.join(remoteDir, e.file)]));

const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome" });
// Animations would make every run differ; both sides are frozen the same way.
const freeze =
  "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}[data-demo-badge]{display:none!important}";

async function shoot(url, steps = [], route, viewportOnly = false) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage();
  if (route) await page.route(/lh3\.googleusercontent\.com/, route);
  // The app keeps prefetching links, so "network idle" may never come; wait for load and give it a moment.
  await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  // The student screens render once the student's record is loaded.
  if (!url.startsWith("file:")) await page.waitForSelector("[data-student-ready]", { timeout: 15000 });
  await page.addStyleTag({ content: freeze });
  for (const [action, selector] of steps) {
    if (action === "click") await page.click(selector);
    if (action === "wait") await page.waitForSelector(selector);
  }
  await page.evaluate(() => document.fonts.ready);
  // Both sides from the top: a full-page shot of a scrolled page moves its fixed header.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const png = await page.screenshot({ fullPage: !viewportOnly });
  await context.close();
  return png;
}

const serveLocal = async (r) => {
  const url = r
    .request()
    .url()
    .replace(/=s\d+.*$/, "");
  const file = localFor.get(url);
  if (!file) return r.abort();
  await r.fulfill({ body: await readFile(file), contentType: file.endsWith(".png") ? "image/png" : "image/jpeg" });
};

for (const name of names) {
  const screen = SCREENS[name];
  if (!screen) throw new Error(`Unknown screen "${name}". Known: ${Object.keys(SCREENS).join(", ")}`);
  const out = path.join(root, "docs", "visual-qa", name);
  await mkdir(out, { recursive: true });

  // The reference runs the exported page's own script; its first option starts selected, as on the screenshot.
  const reference = await shoot(pathToFileURL(path.join(design, screen.html)).href, [], serveLocal, screen.viewportOnly);
  const app = await shoot(`${base}${screen.route}`, screen.steps, undefined, screen.viewportOnly);

  const [ma, mb] = await Promise.all([sharp(reference).metadata(), sharp(app).metadata()]);
  const w = Math.max(ma.width, mb.width);
  const h = Math.max(ma.height, mb.height);
  const ra = await sharp(reference)
    .extend({ right: w - ma.width, bottom: h - ma.height, background: "#ff00ff" })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const rb = await sharp(app)
    .extend({ right: w - mb.width, bottom: h - mb.height, background: "#ff00ff" })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const diff = Buffer.alloc(w * h * 4);
  let changed = 0;
  for (let i = 0; i < ra.length; i += 4) {
    const delta = Math.abs(ra[i] - rb[i]) + Math.abs(ra[i + 1] - rb[i + 1]) + Math.abs(ra[i + 2] - rb[i + 2]);
    const grey = Math.round((ra[i] + ra[i + 1] + ra[i + 2]) / 3 / 3);
    if (delta > 48) {
      changed++;
      diff.set([255, 40, 90, 255], i);
    } else diff.set([grey, grey, grey, 255], i);
  }
  await writeFile(path.join(out, "reference.png"), reference);
  await writeFile(path.join(out, "app.png"), app);
  await sharp(diff, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(path.join(out, "diff.png"));
  // Reference | app | diff, side by side, for reading the result at a glance.
  await sharp({ create: { width: w * 3 + 16, height: h, channels: 3, background: "#ff00ff" } })
    .composite([
      { input: reference, left: 0, top: 0 },
      { input: app, left: w + 8, top: 0 },
      { input: path.join(out, "diff.png"), left: w * 2 + 16, top: 0 },
    ])
    .png()
    .toFile(path.join(out, "side-by-side.png"));
  const pct = ((changed / (w * h)) * 100).toFixed(2);
  console.log(`${name}: reference ${ma.width}x${ma.height}, app ${mb.width}x${mb.height}, differing pixels ${pct}%`);
}
await browser.close();
