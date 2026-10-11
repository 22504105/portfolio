import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const SAMPLES = join(__dirname, "../public/samples");

const csv = (name: string, content: string) => ({ name, mimeType: "text/csv", buffer: Buffer.from(content, "utf8") });

async function upload(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto("/demo/imports", { waitUntil: "networkidle" });
  await page.locator("input[type=file]").setInputFiles(file);
}

/** The figure in a summary tile, by its label. */
const tile = (page: Page, label: string) =>
  page.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::dd[1]");

test("the sample CSV goes through all four steps untouched, and the demo stores nothing", async ({ page }) => {
  await upload(page, { name: "flowly-sample.csv", mimeType: "text/csv", buffer: readFileSync(join(SAMPLES, "flowly-sample.csv")) });

  // Map: the file is described, previewed, and its columns are already matched.
  await expect(page.getByText("flowly-sample.csv · 60 rows")).toBeVisible();
  await expect(page.getByText("Read as text separated by comma.")).toBeVisible();
  await expect(page.getByRole("region", { name: "First 20 rows" }).getByText("S-2001")).toBeVisible();
  await expect(page.getByLabel("Order number", { exact: true })).toHaveValue("0");
  await expect(page.getByLabel("Amount (net)", { exact: true })).toHaveValue("11");
  // Each control has an id of its own.
  expect(
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
      return ids.filter((id, i) => ids.indexOf(id) !== i);
    }),
  ).toEqual([]);
  await expect(page.getByText("Still needed")).toHaveCount(0);
  // A wide preview scrolls inside its frame; the page itself stays as wide as the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Continue" }).click();

  // Validate: every row is fine.
  await expect(tile(page, "Rows in the file")).toHaveText("60");
  await expect(tile(page, "Rows left out")).toHaveText("0");
  await expect(tile(page, "Orders to import")).toHaveText("60");
  await expect(page.getByText("Every row is fine.")).toBeVisible();
  await expect(page.getByText(/count as orders and revenue, never as customers/)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Confirm: a summary, and in the demo no way to store anything.
  await expect(page.getByRole("heading", { name: "This is as far as the demo goes" })).toBeVisible();
  await expect(tile(page, "Net revenue of completed orders")).toHaveText(/^\$[\d,]+\.\d{2}$/);
  await expect(page.getByRole("button", { name: /^Import \d+ orders$/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Create workspace" })).toHaveAttribute("href", "/signup");
});

test("the Excel template is read with its dates and numbers", async ({ page }) => {
  await upload(page, {
    name: "flowly-template.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: readFileSync(join(SAMPLES, "flowly-template.xlsx")),
  });
  await expect(page.getByText("flowly-template.xlsx · 8 rows")).toBeVisible();
  await expect(page.getByText('Read the sheet "Orders".')).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(tile(page, "Orders to import")).toHaveText("8");
  await expect(page.getByText("Every row is fine.")).toBeVisible();
});

test("bad rows are listed with their line and reason, and can be downloaded", async ({ page }) => {
  await upload(
    page,
    csv(
      "messy.csv",
      "Order ID,Order Date,Total,Status\nA-1,2026-09-14,10.00,paid\nA-2,someday,10.00,paid\nA-3,2026-09-14,ten,paid\nA-4,2026-09-14,-5,paid\nA-5,2026-09-14,10.00,sideways\n",
    ),
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(tile(page, "Rows left out")).toHaveText("4");
  await expect(tile(page, "Orders to import")).toHaveText("1");

  const problems = page.getByRole("region", { name: /Problems found/ });
  await expect(problems.getByRole("row")).toHaveCount(5); // heading + four problems
  await expect(problems.getByRole("row").nth(1)).toContainText("3");
  await expect(problems.getByRole("row").nth(1)).toContainText("Not a date Flowly can read");
  await expect(problems.getByText("Amount is negative")).toBeVisible();
  await expect(problems.getByText("Unknown status")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all as CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("flowly-import-problems.csv");
  const text = readFileSync(await file.path(), "utf8");
  expect(text.trim().split("\r\n")).toHaveLength(5);
  // The negative amount would be a formula in a spreadsheet; it is written so that it is not.
  expect(text).toContain(",'-5");
});

test("a file with nothing importable cannot be continued", async ({ page }) => {
  await upload(page, csv("bad.csv", "Order ID,Order Date,Total,Status\nA-1,never,10,paid\n"));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("There is nothing to import.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
});

test("ambiguous dates must be settled by the user, not guessed", async ({ page }) => {
  await upload(page, csv("dates.csv", "Order ID,Order Date,Total,Status\nA-1,03/04/2026,10,paid\nA-2,05/06/2026,12,paid\n"));
  await expect(page.getByText(/Still needed: How are dates like 03\/04\/2026 written\?/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

  await page.getByLabel("How are dates like 03/04/2026 written?").selectOption("dmy");
  await expect(page.getByText("Still needed")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(tile(page, "Orders to import")).toHaveText("2");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(tile(page, "Order dates")).toHaveText("Apr 3, 2026 – Jun 5, 2026");
});

test("a missing status is refused unless a default is chosen; a missing order number unless numbering is", async ({ page }) => {
  await upload(page, csv("bare.csv", "Order Date,Total\n2026-09-14,10\n2026-09-15,12\n"));
  await expect(page.getByText("Still needed: Order number")).toBeVisible();
  await page.getByLabel(/number the orders by their row/).check();
  await expect(page.getByText("Still needed")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(tile(page, "Orders to import")).toHaveText("0");
  await expect(page.getByText("No status, and no default status was chosen.").first()).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await page.getByLabel("Rows without a status").selectOption("completed");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(tile(page, "Orders to import")).toHaveText("2");
  await expect(page.getByText("Order numbers were made up from row numbers.")).toBeVisible();
});

test("files that are not what they claim are refused with a reason", async ({ page }) => {
  await upload(page, { name: "report.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7") });
  await expect(page.locator("main").getByRole("alert")).toContainText("Only .csv and .xlsx files can be imported");

  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "orders.xlsx", mimeType: "text/plain", buffer: Buffer.from("not a workbook") });
  await expect(page.locator("main").getByRole("alert")).toContainText("not an Excel workbook");

  await page.locator("input[type=file]").setInputFiles(csv("empty.csv", "Order ID,Total\n"));
  await expect(page.locator("main").getByRole("alert")).toContainText("no data under it");
});

test("what a file contains is shown as text and never run", async ({ page }) => {
  let dialogs = 0;
  page.on("dialog", (dialog) => {
    dialogs++;
    void dialog.dismiss();
  });
  await upload(
    page,
    csv(
      "hostile.csv",
      'Order ID,Order Date,Total,Status,Product\nA-1,2026-09-14,10,paid,<img src=x onerror=alert(1)>\nA-2,2026-09-14,10,paid,"=HYPERLINK(""http://x"",""y"")"\n',
    ),
  );
  const preview = page.getByRole("region", { name: /First 2 rows/ });
  await expect(preview.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
  await expect(preview.getByText('=HYPERLINK("http://x","y")')).toBeVisible();
  expect(await page.locator("main img").count()).toBe(0);
  expect(dialogs).toBe(0);
});

test("the sample files can be downloaded", async ({ request }) => {
  const sample = await request.get("/samples/flowly-sample.csv");
  expect(sample.status()).toBe(200);
  expect((await sample.text()).split("\r\n")[0]).toContain("Order ID,Order Date");
  const template = await request.get("/samples/flowly-template.xlsx");
  expect(template.status()).toBe(200);
  expect((await template.body()).subarray(0, 2).toString()).toBe("PK");
});

test("without a database the account pages say so and the workspace is closed", async ({ page }) => {
  for (const path of ["/login", "/signup", "/reset-password"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: "Accounts are not set up here" })).toBeVisible();
    await expect(page.locator("form")).toHaveCount(0);
  }
  for (const path of ["/app", "/app/overview", "/app/imports", "/app/welcome", "/update-password"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/(login|reset-password)(\?.*)?$/);
  }
  expect((await page.request.get("/app/export/transactions")).status()).toBe(401);
  // A sign-in link with nothing behind it ends at the sign-in page, not at an error.
  await page.goto("/auth/callback?code=made-up&next=https://evil.example");
  await expect(page).toHaveURL(/\/login\?error=link$/);
});
