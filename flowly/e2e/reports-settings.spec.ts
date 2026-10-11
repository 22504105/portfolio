import { expect, test, type Page } from "@playwright/test";

const figure = (page: Page, label: string) =>
  page
    .locator("main dt", { hasText: new RegExp(`^${label}$`) })
    .first()
    .locator("xpath=following-sibling::dd[1]/span[1]");

/** A cell of the report's summary table: the row by its label, the column by position. */
const summaryCell = (page: Page, row: string, column: number) =>
  page.locator("article table").first().locator("tr", { hasText: row }).locator("td").nth(column);

test("the report shows the same figures as the dashboard", async ({ page }) => {
  await page.goto("/demo/overview");
  const revenue = await figure(page, "Net revenue").textContent();
  const orders = await figure(page, "Completed orders").textContent();

  await page.goto("/demo/reports");
  const report = page.getByRole("article", { name: "Sales report" });
  await expect(report.getByText("Sep 1 – Sep 30, 2026").first()).toBeVisible();
  await expect(summaryCell(page, "Net revenue", 0)).toHaveText(revenue!);
  await expect(summaryCell(page, "Completed orders", 0)).toHaveText(orders!);
  await expect(summaryCell(page, "Net revenue", 2)).toHaveText(/^[+-]\d+\.\d%$/);
  // It says what it is and how it was calculated.
  await expect(report.getByText("Sample data. The shop, its customers and its orders are invented.")).toBeVisible();
  await expect(report.getByText("How these figures are calculated")).toBeVisible();
  await expect(report.getByText(/Net revenue from .* was \$[\d,.]+ across \d+ completed orders/)).toBeVisible();
  await expect(report.getByRole("heading", { name: "Revenue by channel" })).toBeVisible();
});

test("filters and the period shape the report, and it says which were applied", async ({ page }) => {
  await page.goto("/demo/reports");
  const all = await summaryCell(page, "Net revenue", 0).textContent();
  await expect(page.getByText("None: all orders")).toBeVisible();

  await page.getByLabel("Channel", { exact: true }).selectOption("Email");
  await expect(page).toHaveURL(/channel=Email/);
  await expect(page.getByRole("article").getByText("Channel: Email")).toBeVisible();
  await expect(summaryCell(page, "Net revenue", 0)).not.toHaveText(all!);

  // A period with nothing in it says so instead of drawing an empty chart.
  await page.goto("/demo/reports?from=2026-09-30&to=2026-09-30&product=Digital%20Scale");
  await expect(page.getByText("there is nothing to report")).toBeVisible();
  await expect(summaryCell(page, "Average order value", 0)).toHaveText("N/A");
});

test("printed, the report is the sheet alone: no navigation, no controls, the chart intact", async ({ page }) => {
  await page.goto("/demo/reports", { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print" });

  await expect(page.locator("aside")).toBeHidden();
  await expect(page.locator("header").first()).toBeHidden();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Summary (CSV)" })).toBeHidden();
  await expect(page.getByRole("article", { name: "Sales report" })).toBeVisible();

  // The chart is drawn and fits inside the sheet.
  const fits = await page.evaluate(() => {
    const sheet = document.querySelector("article")!.getBoundingClientRect();
    const chart = document.querySelector("article svg.recharts-surface")?.getBoundingClientRect();
    return chart ? chart.width > 200 && chart.left >= sheet.left - 1 && chart.right <= sheet.right + 1 : false;
  });
  expect(fits).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("the report saves as a PDF on A4", async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== "chromium" || testInfo.project.name !== "desktop", "PDF output is a desktop Chromium feature");
  await page.goto("/demo/reports", { waitUntil: "networkidle" });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pages).toBeGreaterThanOrEqual(1);
  expect(pages).toBeLessThanOrEqual(4);
  // A4 is 595 × 842 points.
  expect(pdf.toString("latin1")).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+59[45](\.\d+)?\s+84[12](\.\d+)?\s*\]/);
});

test("the report's summary downloads as CSV with the same numbers", async ({ page, request }) => {
  await page.goto("/demo/reports");
  const revenue = (await summaryCell(page, "Net revenue", 0).textContent())!.replace(/[$,]/g, "");
  const response = await request.get("/demo/export/report");
  expect(response.headers()["content-disposition"]).toContain("flowly-report-2026-09-01-to-2026-09-30.csv");
  const lines = (await response.text()).trim().split("\r\n");
  expect(lines).toHaveLength(7);
  expect(lines[1].split(",")[1]).toBe(String(Number(revenue)));
});

test("the demo's settings are shown and cannot be changed", async ({ page }) => {
  await page.goto("/demo/settings");
  await expect(page.getByText("This is the demo workspace.")).toBeVisible();
  await expect(page.getByText("Kettle & Kin").filter({ visible: true }).last()).toBeVisible();
  await expect(page.getByText("America/New York")).toBeVisible();
  expect(await page.locator("main").locator("input, select, textarea, form, button").count()).toBe(0);
  await expect(page.getByText("Delete account")).toHaveCount(0);
  await page.getByRole("link", { name: "How data is handled" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
});

test("the privacy page says what happens to data, without claiming certificates", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy and data handling" })).toBeVisible();
  for (const heading of ["The demo", "An account", "What you import", "Deleting", "What the site does not do", "Limits you should know"]) {
    await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
  }
  const text = (await page.locator("main").innerText()).toLowerCase();
  for (const claim of ["gdpr compliant", "soc 2", "iso 27001", "hipaa", "certified"]) expect(text).not.toContain(claim);
  expect(text).toContain("never uploaded");
});

test("every section has a real page: nothing says it is still being built", async ({ page }) => {
  for (const section of ["overview", "analytics", "customers", "transactions", "imports", "reports", "settings"]) {
    await page.goto(`/demo/${section}`);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText(/being built|coming soon|next build phase/i)).toHaveCount(0);
  }
});

test("an opened drawer puts focus on its title, and Escape gives it back to the page", async ({ page }) => {
  await page.goto("/demo/transactions?order=KK-15500", { waitUntil: "networkidle" });
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "KK-15500" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});
