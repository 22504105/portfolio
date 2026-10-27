import { expect, test, type Page } from "@playwright/test";

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const LIGHT = "rgb(247, 247, 244)";
const DARK = "rgb(18, 20, 24)";

// The head script must reach the browser as text. Imported from a "use client" module it arrives as a
// reference to a JS chunk ("__html":"$2"), and hydration of <head> then sometimes failed (React #418).
test("the theme script is sent as text, not as a reference to a client module", async ({ request }) => {
  for (const path of ["/", "/login", "/demo/overview"]) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain('__html\\":\\"(function(){');
    expect(html, path).not.toMatch(/__html\\":\\"\$/);
  }
});

test("the page follows the device until a theme is chosen", async ({ page }) => {
  await page.goto("/demo/overview");
  expect([await theme(page), await background(page)]).toEqual(["light", LIGHT]);

  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  expect([await theme(page), await background(page)]).toEqual(["dark", DARK]);
});

test("a chosen theme is applied at once, kept across pages and reloads, and wins over the device", async ({ page }) => {
  await page.goto("/demo/overview", { waitUntil: "networkidle" });
  const toggle = page.getByRole("button", { name: /^Theme:/ }).filter({ visible: true });
  await expect(toggle).toHaveAccessibleName(/Theme: Same as device\. Switch to Light/);

  await toggle.click();
  await expect(toggle).toHaveAccessibleName(/Theme: Light\. Switch to Dark/);
  await toggle.click();
  await expect(toggle).toHaveAccessibleName(/Theme: Dark\. Switch to Same as device/);
  expect([await theme(page), await background(page)]).toEqual(["dark", DARK]);

  // Text is light on dark, and cards are a step lighter than the page.
  const colours = await page.evaluate(() => {
    const card = document.querySelector("main .card")!;
    return { text: getComputedStyle(document.querySelector("main h1")!).color, card: getComputedStyle(card).backgroundColor };
  });
  expect(colours).toEqual({ text: "rgb(233, 235, 239)", card: "rgb(27, 30, 36)" });

  await page.reload();
  expect(await theme(page)).toBe("dark");
  await page.goto("/");
  expect([await theme(page), await background(page)]).toEqual(["dark", DARK]);
  await page.goto("/login");
  expect(await theme(page)).toBe("dark");

  // The device says light; the choice still holds.
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  expect(await theme(page)).toBe("dark");
});

test("the theme is set before the page is drawn: no white flash on a dark page", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("flowly-theme", "dark"));
  // Stop at the first moment the document exists, before any script of the application has run.
  await page.goto("/demo/overview", { waitUntil: "commit" });
  await page.waitForFunction(() => document.body !== null);
  expect(await theme(page)).toBe("dark");
});

test("settings spell the choice out, and going back to the device's setting forgets the choice", async ({ page }) => {
  await page.goto("/demo/settings", { waitUntil: "networkidle" });
  const group = page.getByRole("radiogroup", { name: "Theme" });
  await expect(group.getByRole("radio", { name: "Same as device" })).toBeChecked();
  await group.getByRole("radio", { name: "Dark" }).click();
  await expect(group.getByRole("radio", { name: "Dark" })).toBeChecked();
  expect(await theme(page)).toBe("dark");
  expect(await page.evaluate(() => window.localStorage.getItem("flowly-theme"))).toBe("dark");

  await group.getByRole("radio", { name: "Same as device" }).click();
  expect(await theme(page)).toBe("light");
  expect(await page.evaluate(() => window.localStorage.getItem("flowly-theme"))).toBeNull();
});

test("in the dark theme no page is wider than the screen and nothing is left white", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("flowly-theme", "dark"));
  for (const path of [
    "/",
    "/privacy",
    "/demo/overview",
    "/demo/analytics",
    "/demo/customers",
    "/demo/transactions?order=KK-15500",
    "/demo/imports",
    "/demo/reports",
    "/demo/settings",
  ]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const result = await page.evaluate(() => {
      // Any sizeable block still painted pure white or the light canvas is a surface the theme missed.
      const light = new Set(["rgb(255, 255, 255)", "rgb(247, 247, 244)", "rgb(241, 242, 239)"]);
      const missed = [...document.querySelectorAll("body *")].filter((element) => {
        if (element.closest("svg")) return false;
        const box = element.getBoundingClientRect();
        return box.width > 60 && box.height > 24 && light.has(getComputedStyle(element).backgroundColor);
      });
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        missed: missed.slice(0, 3).map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`),
      };
    });
    expect(result, path).toEqual({ overflow: 0, missed: [] });
  }
});

test("a report printed from the dark theme is still black on white", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("flowly-theme", "dark"));
  await page.goto("/demo/reports", { waitUntil: "networkidle" });
  expect(await background(page)).toBe(DARK);
  await page.emulateMedia({ media: "print" });
  const printed = await page.evaluate(() => ({
    page: getComputedStyle(document.body).backgroundColor,
    sheet: getComputedStyle(document.querySelector("article")!).backgroundColor,
    text: getComputedStyle(document.querySelector("article h2")!).color,
  }));
  expect(printed).toEqual({ page: "rgb(255, 255, 255)", sheet: "rgb(255, 255, 255)", text: "rgb(32, 36, 45)" });
});
