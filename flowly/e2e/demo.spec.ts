import { expect, test, type Page } from "@playwright/test";

/** The value of a headline figure, read from the page by its label. */
const figure = (page: Page, label: string) =>
  page
    .locator("main dt", { hasText: new RegExp(`^${label}$`) })
    .first()
    .locator("xpath=following-sibling::dd[1]/span[1]");

const cents = (text: string | null) => Math.round(Number((text ?? "").replace(/[^0-9.-]/g, "")) * 100);

/** Splits one CSV line, minding quoted cells. */
function cells(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted && char === '"' && line[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      out.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  return [...out, cell];
}

test("changing the period changes the figures, and the period follows to other sections", async ({ page }) => {
  await page.goto("/demo/overview");
  const month = await figure(page, "Net revenue").textContent();

  await page
    .getByRole("button", { name: /Change period/ })
    .filter({ visible: true })
    .click();
  await page.getByRole("link", { name: "Last 7 days" }).click();
  await expect(page).toHaveURL(/from=2026-09-24&to=2026-09-30/);
  await expect(figure(page, "Net revenue")).not.toHaveText(month!);
  await expect(page.getByText("vs previous 7 days").first()).toBeVisible();
  const week = await figure(page, "Net revenue").textContent();

  // The period comes along to Analytics, and the figure there is the same.
  await page.goto("/demo/analytics?from=2026-09-24&to=2026-09-30");
  await expect(figure(page, "Net revenue")).toHaveText(week!);
});

test("a custom period can be typed in, and a backwards one is refused", async ({ page }) => {
  await page.goto("/demo/overview");
  await page
    .getByRole("button", { name: /Change period/ })
    .filter({ visible: true })
    .click();
  await page.locator("input[name=from]").fill("2026-03-10");
  await page.locator("input[name=to]").fill("2026-03-01");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "must not be after" })).toBeVisible();
  await page.locator("input[name=to]").fill("2026-03-31");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/from=2026-03-10&to=2026-03-31/);
  await expect(page.getByText("vs previous 22 days").first()).toBeVisible();
});

test("every page shows the same numbers for the same period", async ({ page, request }) => {
  await page.goto("/demo/overview");
  const revenue = await figure(page, "Net revenue").textContent();
  const orders = await figure(page, "Completed orders").textContent();
  const customers = await figure(page, "Identified customers").textContent();

  // Analytics: the headline, the breakdown total and the time table total.
  await page.goto("/demo/analytics");
  await expect(figure(page, "Net revenue")).toHaveText(revenue!);
  for (const total of await page.locator("tfoot tr").all()) {
    await expect(total.locator("td").first()).toHaveText(revenue!);
  }

  // Customers: as many as the headline says.
  await page.goto("/demo/customers");
  await expect(page.getByText(`${customers} identified customers`)).toBeVisible();

  // The transactions export: completed rows add up to the revenue and count to the orders.
  const csv = (await (await request.get("/demo/export/transactions")).text()).trim().split("\r\n");
  const header = cells(csv[0].replace("﻿", ""));
  const [status, net, refunded] = ["Status", "Net", "Refunded"].map((name) => header.indexOf(name));
  const completed = csv
    .slice(1)
    .map(cells)
    .filter((row) => row[status] === "completed");
  expect(String(completed.length)).toBe(orders);
  expect(completed.reduce((sum, row) => sum + cents(row[net]) - cents(row[refunded]), 0)).toBe(cents(revenue));
});

test("a filter changes the figures, the chart's table and the transactions alike", async ({ page }) => {
  await page.goto("/demo/overview");
  // What the overview says Email brought in.
  const emailRow = page
    .locator("section", { has: page.getByRole("heading", { name: "Revenue by channel" }) })
    .locator("li", { hasText: "Email" });
  const email = (await emailRow.locator("span.tabular-nums").textContent())!.match(/\$[\d,]+\.\d{2}/)![0];

  await page.goto("/demo/analytics");
  await page.getByLabel("Channel", { exact: true }).selectOption("Email");
  await expect(page).toHaveURL(/channel=Email/);
  await expect(figure(page, "Net revenue")).toHaveText(email);
  await expect(page.locator("tfoot tr").last().locator("td").first()).toHaveText(email);

  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/channel=/);

  // Status chips toggle.
  await page.goto("/demo/transactions");
  const all = await page.getByText(/\d+ orders in/).textContent();
  await page.getByRole("link", { name: "Refunded", exact: true }).click();
  await expect(page).toHaveURL(/status=refunded/);
  await expect(page.getByText(/\d+ orders in/)).not.toHaveText(all!);
  const shown = page.locator("main").getByText("Refunded", { exact: true }).filter({ visible: true });
  expect(await shown.count()).toBeGreaterThan(1);
  await expect(page.locator("main").getByText("Completed", { exact: true }).filter({ visible: true })).toHaveCount(1); // only the filter chip
});

test("clicking a channel on the overview opens analytics filtered to it", async ({ page }) => {
  await page.goto("/demo/overview");
  await page.getByRole("link", { name: "Show only Marketplace" }).click();
  await expect(page).toHaveURL(/\/demo\/analytics\?.*channel=Marketplace/);
  await expect(page.getByLabel("Channel", { exact: true })).toHaveValue("Marketplace");
});

test("an order opens in a drawer with its lines, and closes back to the list", async ({ page }) => {
  await page.goto("/demo/transactions", { waitUntil: "networkidle" });
  const link = page
    .getByRole("link", { name: /Open details for order KK-/ })
    .filter({ visible: true })
    .first();
  const id = (await link.textContent())!.trim();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`order=${id}`));
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: id })).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Lines" })).toBeVisible();
  await expect(drawer.getByText("America/New_York")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/order=/);
  await expect(drawer).toBeHidden();
});

test("customers can be searched and opened, and an unknown one is not invented", async ({ page }) => {
  await page.goto("/demo/customers?from=2025-08-01&to=2026-09-30", { waitUntil: "networkidle" });
  await page.getByRole("searchbox", { name: "Search customers" }).fill("dubois");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=dubois/);
  await page.waitForLoadState("networkidle");
  const first = page
    .getByRole("link", { name: /Open details for .*Dubois/ })
    .filter({ visible: true })
    .first();
  await first.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Order history" })).toBeVisible();
  await expect(drawer.getByText("@example.com")).toBeVisible();

  await page.goto("/demo/customers?customer=nobody");
  await expect(page.getByRole("dialog").getByText("This customer is not in the workspace.")).toBeVisible();
});

test("sorting and paging the transactions", async ({ page }) => {
  await page.goto("/demo/transactions?sort=amount", { waitUntil: "networkidle" });
  await expect(page.getByText(/1–25 of \d+/)).toBeVisible();
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(/26–50 of \d+/)).toBeVisible();
  // A page far past the end shows the last page, not an empty one.
  await page.goto("/demo/transactions?page=9999");
  await expect(page.getByText(/of \d+ · Page (\d+) of \1|–\d+ of \d+/).first()).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: /Open details for order/ })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test("nonsense in the address is ignored, not obeyed", async ({ page }) => {
  const response = await page.goto("/demo/overview?from=tomorrow&to=%3Cscript%3E&status=evil&page=-1&g=century");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("vs previous 30 days").first()).toBeVisible();
  await page.goto("/demo/transactions?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E");
  await expect(page.getByText("No transactions match")).toBeVisible();
  expect(await page.locator("img[src='x']").count()).toBe(0);
});

test("downloads are CSV files named after what they hold", async ({ request }) => {
  for (const [kind, name] of [
    ["transactions", "flowly-transactions-2026-09-01-to-2026-09-30.csv"],
    ["customers", "flowly-customers-2026-09-01-to-2026-09-30.csv"],
    ["breakdown", "flowly-by-channel-2026-09-01-to-2026-09-30.csv"],
    ["series", "flowly-revenue-by-day-2026-09-01-to-2026-09-30.csv"],
  ]) {
    const response = await request.get(`/demo/export/${kind}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("text/csv; charset=utf-8");
    expect(response.headers()["content-disposition"]).toContain(name);
  }
  expect((await request.get("/demo/export/passwords")).status()).toBe(404);
});

test("no workspace page is wider than the screen", async ({ page }) => {
  for (const path of [
    "/demo/overview",
    "/demo/analytics?by=product",
    "/demo/customers",
    "/demo/transactions",
    "/demo/transactions?order=KK-15500",
  ]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
