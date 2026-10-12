import { expect, test, type Page } from "@playwright/test";

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

test("an address without a language goes to the visitor's own", async ({ browser }) => {
  for (const [locale, expected] of [
    ["ru-RU", "/ru"],
    ["en-US", "/en"],
    ["tr-TR", "/en"],
  ]) {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(new RegExp(`${expected}$`));
    await page.goto("/demo/groups");
    await expect(page).toHaveURL(new RegExp(`${expected}/demo/groups$`));
    await context.close();
  }
});

test("the front page leads into the demo, which says that it is one", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Share the bill, not the awkwardness");
  await page.getByRole("link", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/en\/demo$/);
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await expect(page.getByText("Demo data")).toBeVisible();
});

test("every place in the navigation opens its screen and is marked as current", async ({ page, isMobile }) => {
  await page.goto("/en/demo", { waitUntil: "networkidle" });
  // The bar at the bottom on a phone, the column on the left elsewhere: whichever is showing.
  const nav = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
  await expect(nav).toHaveCount(1);
  for (const [name, path, heading] of [
    ["Groups", "/en/demo/groups", "Groups"],
    ["Activity", "/en/demo/activity", "Activity"],
    ["Profile", "/en/demo/profile", "Profile"],
    ["Add expense", "/en/demo/add", "Add expense"],
    ["Home", "/en/demo", "Home"],
  ]) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(nav.locator("[aria-current=page]")).toHaveAccessibleName(name);
  }
  expect(isMobile ? await page.locator("nav.fixed").isVisible() : await page.locator("aside").isVisible()).toBe(true);
});

test("the language switch shows the same screen in the other language", async ({ page }) => {
  await page.goto("/en/demo/groups", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Русский" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/ru\/demo\/groups$/);
  await expect(page.getByRole("heading", { level: 1, name: "Группы" })).toBeVisible();
  await expect(page.getByText("Демо-данные")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("ru");
  await page.getByRole("link", { name: "English" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/en\/demo\/groups$/);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
});

test("the theme follows the device, can be chosen, and the choice survives a reload and a change of language", async ({ page }) => {
  await page.goto("/en/demo/profile", { waitUntil: "networkidle" });
  expect(await theme(page)).toBe("light");
  const group = page.getByRole("radiogroup", { name: "Theme" });
  await expect(group.getByRole("radio", { name: "Same as device" })).toBeChecked();

  await group.getByRole("radio", { name: "Dark" }).click();
  expect(await theme(page)).toBe("dark");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(17, 26, 23)");

  await page.reload();
  expect(await theme(page)).toBe("dark");
  await page.goto("/ru/demo");
  expect(await theme(page)).toBe("dark");

  await page.goto("/en/demo/profile", { waitUntil: "networkidle" });
  await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Same as device" }).click();
  expect(await theme(page)).toBe("light");
});

test("a dark device gets the dark theme without being asked, before the page is drawn", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/en", { waitUntil: "commit" });
  await page.waitForFunction(() => document.body !== null);
  expect(await theme(page)).toBe("dark");
  await context.close();
});

test("no screen is wider than the display, in either language or theme", async ({ page }) => {
  for (const stored of ["light", "dark"]) {
    await page.addInitScript((value) => window.localStorage.setItem("splitly-theme", value), stored);
    for (const path of [
      "/en",
      "/ru",
      "/ru/demo",
      "/ru/demo/groups",
      "/ru/demo/activity",
      "/ru/demo/add",
      "/ru/demo/profile",
      "/en/demo/profile",
    ]) {
      await page.goto(path);
      expect(await overflow(page), `${stored} ${path}`).toBeLessThanOrEqual(0);
    }
  }
});

test("touch targets are at least 44 px, and the last line of a screen clears the bottom bar", async ({ page, isMobile }) => {
  test.skip(!isMobile, "about the phone layout");
  await page.goto("/ru/demo", { waitUntil: "networkidle" });
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("a, button")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          box.width > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "inline" &&
          !element.closest(".fixed.-translate-y-24") &&
          (box.height < 44 || box.width < 44)
        );
      })
      .map(
        (element) =>
          `${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 20)} ${Math.round(element.getBoundingClientRect().width)}x${Math.round(element.getBoundingClientRect().height)}`,
      ),
  );
  // The two halves of the language switch are 36 px high inside a 44 px control: the control is the target.
  expect(small.filter((entry) => !/^(English|Русский) /.test(entry))).toEqual([]);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const clear = await page.evaluate(() => {
    const bar = document.querySelector("nav.fixed")!.getBoundingClientRect();
    const last = [...document.querySelectorAll("main li")].at(-1)!.getBoundingClientRect();
    return last.bottom <= bar.top;
  });
  expect(clear).toBe(true);
});

test("the health endpoint answers, and says nothing it should not", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(["ok", "region", "service", "stage", "time"]);
  expect(body).toMatchObject({ ok: true, service: "splitly", stage: 1 });
});

test("only Telegram may frame the site, and the headers are set", async ({ request }) => {
  const headers = (await request.get("/en")).headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'self' https://web.telegram.org https://*.telegram.org");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["permissions-policy"]).toContain("camera=(self)");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("an address that is not a page says so", async ({ page }) => {
  const response = await page.goto("/en/nothing/here");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Nothing here" })).toBeVisible();
});

test("nothing on any screen pretends to work: no dead buttons or empty links", async ({ page }) => {
  for (const path of ["/en", "/en/demo", "/en/demo/groups", "/en/demo/activity", "/en/demo/add", "/en/demo/profile"]) {
    await page.goto(path);
    const dead = await page.evaluate(() =>
      [...document.querySelectorAll("a")]
        .filter((link) => !link.getAttribute("href") || link.getAttribute("href") === "#")
        .map((link) => link.textContent)
        .concat([...document.querySelectorAll("button[disabled], button[aria-disabled=true]")].map((button) => button.textContent)),
    );
    expect(dead, path).toEqual([]);
  }
});
