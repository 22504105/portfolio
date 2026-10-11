import { expect, test } from "@playwright/test";

const SECTIONS = ["Overview", "Analytics", "Customers", "Transactions", "Imports", "Reports", "Settings"];

test("a visitor reaches the demo from the front page without an account", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Understand your business. Move with confidence.");
  await page.getByRole("link", { name: "Explore live demo" }).first().click();
  await expect(page).toHaveURL(/\/demo\/overview$/);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await expect(page.getByText("Demo workspace").filter({ visible: true })).toHaveCount(1);
});

test("the front page shows the same figures as the demo", async ({ page }) => {
  await page.goto("/");
  const preview = page.getByRole("figure", { name: "Live preview of the demo workspace" });
  const revenue = await preview.locator("dd").first().locator("span").first().textContent();
  expect(revenue).toMatch(/^\$[\d,]+\.\d{2}$/);
  await page.goto("/demo/overview");
  await expect(page.locator("main dd").first().locator("span").first()).toHaveText(revenue!);
});

test("every section of the navigation opens a page", async ({ page, isMobile }) => {
  await page.goto("/demo/overview");
  for (const name of SECTIONS) {
    if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
    const nav = isMobile ? page.getByRole("dialog") : page.locator("aside");
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/demo/${name.toLowerCase()}$`));
    const current = isMobile
      ? page.getByRole("navigation", { name: "Breadcrumb" }).locator("[aria-current=page]")
      : nav.locator("[aria-current=page]");
    await expect(current).toHaveText(name);
  }
});

test("no page is wider than the screen", async ({ page }) => {
  for (const path of ["/", "/demo/overview", "/demo/analytics", "/login", "/privacy"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("addresses that do not exist say so, and the private workspace asks to sign in", async ({ page }) => {
  const missing = await page.goto("/demo/nothing-here");
  expect(missing?.status()).toBe(404);
  await page.goto("/app/overview");
  await expect(page).toHaveURL(/\/login$/);
});

test("security headers are set", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-powered-by"]).toBeUndefined();
});
