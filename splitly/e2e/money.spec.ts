import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

// Stage 4 in a real browser, on the demo: who owes whom, settling up,
// exchange rates, analytics, the activity list and the spreadsheet file.
// The server's side is tested against a real database in tests/db/api.test.ts.

const main = (page: Page) => page.getByRole("main");
/** A tab by its word; the Debts tab may carry a count of payments waiting after it. */
const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}( \\d+)?$`) });
const said = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** The transfers shown, as "Kerem → Alex 830.12 TRY". */
const transfers = (page: Page) =>
  page
    .getByRole("region", { name: /Simplified transfers|All debts/ })
    .getByRole("listitem")
    .evaluateAll((rows) => rows.map((row) => (row.querySelector("span.min-w-0")?.textContent ?? "").replace(/\s+/g, " ").trim()));

test("who should pay whom, simplified and as it happened", async ({ page }) => {
  await page.goto("/en/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  await tab(page, "Debts").click();
  // Alex is owed 1,462.37 and Mira 44.88; Kerem owes 830.12 and Deniz 677.13. Largest debt to largest credit.
  expect(await transfers(page)).toEqual(["KeremAlex830.12 TRY", "DenizAlex632.25 TRY", "DenizMira44.88 TRY"]);
  await expect(page.getByText("After these transfers every debt is closed.")).toBeVisible();

  await page.getByText("All debts", { exact: true }).click();
  const all = await transfers(page);
  // As it happened there are more pairs, and each is between people who shared an expense.
  expect(all.length).toBeGreaterThan(3);
  expect(all.some((row) => row.startsWith("KeremMira"))).toBe(true);
  await expect(page.getByText("After these transfers every debt is closed.")).toHaveCount(0);
});

test("a payment someone says they made waits, changes nothing, and counts once it is confirmed", async ({ page }) => {
  await page.goto("/en/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  await expect(page.getByRole("region", { name: "Where you stand" })).toContainText(/1,462\.37\sTRY/);
  await tab(page, "Debts").click();
  const waiting = page.getByRole("region", { name: "Waiting to be confirmed" });
  await expect(waiting.getByRole("listitem")).toContainText([/Deniz.*Alex.*300\.00\sTRY.*waiting to be confirmed/]);

  await waiting.getByRole("button", { name: "Confirm" }).click();
  await expect(said(page, "Payment confirmed")).toBeVisible();
  await expect(page.getByRole("region", { name: "Waiting to be confirmed" })).toHaveCount(0);
  // Deniz now owes 300.00 less.
  expect(await transfers(page)).toEqual(["KeremAlex830.12 TRY", "DenizAlex332.25 TRY", "DenizMira44.88 TRY"]);
  await tab(page, "Expenses").click();
  await expect(page.getByRole("region", { name: "Where you stand" })).toContainText(/1,162\.37\sTRY/);

  // Taken back: the debt is as it was, and the payment stays on record, crossed out.
  await tab(page, "Debts").click();
  await page.getByRole("region", { name: "Payments" }).getByRole("button", { name: "Take back" }).click();
  await expect(said(page, "Payment cancelled")).toBeVisible();
  expect(await transfers(page)).toEqual(["KeremAlex830.12 TRY", "DenizAlex632.25 TRY", "DenizMira44.88 TRY"]);
  await expect(page.getByRole("region", { name: "Payments" }).getByRole("listitem")).toContainText(["cancelled"]);
});

test("settling a debt, in part and then in full", async ({ page }) => {
  await page.goto("/en/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  await tab(page, "Debts").click();
  const row = page.getByRole("region", { name: "Simplified transfers" }).getByRole("listitem").first();
  await row.getByRole("button", { name: "Settle" }).click();
  // The whole debt is offered; any part of it can be paid.
  await expect(row.getByLabel("Amount paid, TRY")).toHaveValue("830.12");
  await expect(row).toContainText("It will count straight away.");
  await row.getByLabel("Amount paid, TRY").fill("nothing");
  await row.getByRole("button", { name: "Mark as paid" }).click();
  await expect(main(page).getByRole("alert")).toContainText("Type an amount above zero");
  await row.getByLabel("Amount paid, TRY").fill("330,12");
  await row.getByRole("button", { name: "Mark as paid" }).click();
  await expect(said(page, "Payment recorded")).toBeVisible();
  // Kerem now owes 500.00, Deniz still 677.13: the transfers are worked out afresh, largest debt first.
  expect(await transfers(page)).toEqual(["DenizAlex677.13 TRY", "KeremAlex455.12 TRY", "KeremMira44.88 TRY"]);

  // One of the two that are left for Kerem, in full.
  const rest = page
    .getByRole("region", { name: "Simplified transfers" })
    .getByRole("listitem")
    .filter({ hasText: /Kerem.*Alex/ });
  await rest.getByRole("button", { name: "Settle" }).click();
  await expect(rest.getByLabel("Amount paid, TRY")).toHaveValue("455.12");
  await rest.getByRole("button", { name: "Mark as paid" }).click();
  await expect(said(page, "Payment recorded")).toBeVisible();
  expect(await transfers(page)).toEqual(["DenizAlex677.13 TRY", "KeremMira44.88 TRY"]);
  await expect(page.getByRole("region", { name: "Payments" }).getByRole("listitem")).toHaveCount(2);

  // It is still so after a reload, and the people's balances agree: Kerem owes what is left, 830.12 − 330.12 − 455.12.
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("region", { name: "People", exact: true }).getByRole("listitem").filter({ hasText: "Kerem" })).toContainText(
    /owes -44\.88\sTRY/,
  );
});

test("when nobody owes anything it says so", async ({ page }) => {
  await page.goto("/en/demo/groups", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New group" }).click();
  await page.getByLabel("Group name").fill("Fresh");
  await page.getByRole("button", { name: "Create group" }).click();
  await tab(page, "Debts").click();
  await expect(page.getByText("Everyone is square")).toBeVisible();
  await tab(page, "Analytics").click();
  await expect(page.getByText("No spending in this period.")).toBeVisible();
  await expect(page.getByTestId("analytics-average")).toHaveText("—");
});

test("analytics: totals in the group's currency, with other currencies converted at a recorded rate", async ({ page }) => {
  await page.goto("/en/demo/groups/demo-flat", { waitUntil: "networkidle" });
  await tab(page, "Analytics").click();
  await page.getByLabel("Period").selectOption("all");
  // 1,200.00 + 86.40 + 35.00 EUR, and 640.00 TRY at the recorded 1 EUR = 36.5 TRY, turned over: 17.53 EUR.
  await expect(page.getByTestId("analytics-total")).toHaveText(/^1,338\.93\sEUR$/);
  await expect(page.getByTestId("analytics-average")).toHaveText(/^334\.73\sEUR$/);
  await expect(
    page.getByText("Shown in EUR: expenses in other currencies are converted at the rate recorded for their day."),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "By category" }).getByRole("listitem")).toHaveText([
    /Lodging1,200\.00\sEUR90%/,
    /Groceries103\.93\sEUR8%/,
    /Other35\.00\sEUR3%/,
  ]);

  await page.getByText("By person", { exact: true }).click();
  const people = page.getByRole("list", { name: "By person" }).getByRole("listitem");
  await expect(people).toHaveCount(3);
  await expect(people.first()).toContainText("Alex");
  await expect(page.getByText("Each person's share of what was spent, not what they paid.")).toBeVisible();
});

test("an expense with no rate is left out of the figures and said to be, until a rate is recorded", async ({ page }) => {
  await page.goto("/en/demo/add?group=demo-flat", { waitUntil: "networkidle" });
  await page.getByLabel("Description").fill("Airport snack");
  await page.getByLabel("Amount", { exact: true }).fill("5");
  await page.getByLabel("Currency").selectOption("USD");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await expect(said(page, "Expense saved")).toBeVisible();

  await tab(page, "Analytics").click();
  await page.getByLabel("Period").selectOption("all");
  await expect(page.getByTestId("analytics-total")).toHaveText(/^1,338\.93\sEUR$/);
  await expect(main(page).getByRole("status").filter({ hasText: "Not in these figures" })).toContainText(/1 of 5\.00\sUSD/);

  // A rate that is not one is refused; a real one is recorded and listed.
  await tab(page, "Settings").click();
  const rates = page.getByRole("region", { name: "Exchange rates" });
  await expect(rates.getByRole("listitem")).toHaveText([/1 EUR = 36\.5 TRY/]);
  await rates.getByLabel("Currency").selectOption("USD");
  await rates.getByLabel("1 USD in EUR").fill("about ninety cents");
  await rates.getByRole("button", { name: "Add the rate" }).click();
  await expect(rates.getByRole("alert")).toContainText("Type the rate as a number above zero");
  await rates.getByLabel("1 USD in EUR").fill("0,9");
  await rates.getByRole("button", { name: "Add the rate" }).click();
  await expect(said(page, "Rate added")).toBeVisible();
  await expect(rates.getByRole("listitem").filter({ hasText: "1 USD = 0.9 EUR" })).toBeVisible();

  // Now the snack is in: 5.00 USD at 0.9 is 4.50 EUR.
  await tab(page, "Analytics").click();
  await page.getByLabel("Period").selectOption("all");
  await expect(page.getByTestId("analytics-total")).toHaveText(/^1,343\.43\sEUR$/);
  await expect(main(page).getByRole("status").filter({ hasText: "Not in these figures" })).toHaveCount(0);
  // And nobody's debt was converted: balances are still per currency.
  await tab(page, "Expenses").click();
  await expect(page.getByRole("region", { name: "Where you stand" })).toContainText("USD");
});

test("the expenses can be downloaded as a spreadsheet file", async ({ page }) => {
  await page.goto("/en/demo/groups/demo-flat", { waitUntil: "networkidle" });
  await tab(page, "Settings").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download as a spreadsheet (CSV)" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("splitly-Flat-in-Moda.csv");
  const csv = await readFile((await download.path())!, "utf8");
  const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
  expect(lines[0]).toBe("Date,Description,Category,Amount,Currency,State,Paid by,Shares");
  expect(lines).toHaveLength(5);
  expect(lines.find((line) => line.includes("Rent, October"))).toMatch(
    /^\d{4}-\d{2}-\d{2},"Rent, October",lodging,1200\.00,EUR,active,Nika: 1200\.00,Alex: 480\.00; Nika: 360\.00; Sam: 360\.00$/,
  );
});

test("the activity list and the analytics page look across groups", async ({ page, isMobile }) => {
  await page.goto("/en/demo", { waitUntil: "networkidle" });
  await page
    .getByRole("navigation", { name: "Main" })
    .filter({ visible: true })
    .getByRole("link", { name: "Activity", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();
  const events = main(page).getByRole("listitem");
  await expect(events.first()).toBeVisible();
  await expect(events.filter({ hasText: "Deniz says they paid Alex" })).toContainText(/Istanbul weekend.*300\.00\sTRY/);
  await expect(events.filter({ hasText: "Hotel deposit" })).toContainText("cancelled since");
  await expect(events.filter({ hasText: "Rent, October" })).toContainText("Flat in Moda");
  await events.filter({ hasText: "Rent, October" }).getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat in Moda" })).toBeVisible();

  // Analytics across groups: on the rail of a wide screen, from Home on a phone.
  await page.goto("/en/demo", { waitUntil: "networkidle" });
  await (isMobile ? main(page) : page.getByRole("navigation", { name: "Main" }).filter({ visible: true }))
    .getByRole("link", { name: "Analytics" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();
  await page.getByLabel("Period").selectOption("all");
  await expect(page.getByTestId("analytics-total")).toHaveText(/^5,560\.50\sTRY$/);
  await page.getByRole("radiogroup", { name: "Group" }).getByText("Flat in Moda").click();
  await page.getByLabel("Period").selectOption("all");
  await expect(page.getByTestId("analytics-total")).toHaveText(/^1,338\.93\sEUR$/);
  expect(isMobile ? await overflow(page) : 0).toBe(0);
});

test("in Russian, and on a phone: the money screens fit and their controls are big enough", async ({ page, isMobile }) => {
  const check = async (where: string) => {
    expect([where, await overflow(page)]).toEqual([where, 0]);
    if (!isMobile) return;
    const small = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "main a, main button, main select, main input:not([type=checkbox]):not([type=radio]), main label:has(input[type=radio])",
        ),
      ]
        .filter((element) => element.offsetParent !== null)
        .map((element) => ({
          text: (element.textContent || element.getAttribute("aria-label") || element.tagName).trim().slice(0, 30),
          height: Math.round(element.getBoundingClientRect().height),
        }))
        .filter((entry) => entry.height < 44),
    );
    expect([where, small]).toEqual([where, []]);
  };
  await page.goto("/ru/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  await tab(page, "Долги").click();
  await expect(page.getByText("После этих переводов все долги будут закрыты.")).toBeVisible();
  await page.getByRole("region", { name: "Упрощённые переводы" }).getByRole("button", { name: "Погасить" }).first().click();
  await expect(page.getByRole("button", { name: "Отметить как погашено" })).toBeVisible();
  await check("debts");
  await tab(page, "Аналитика").click();
  await page.getByLabel("Период").selectOption("all");
  await expect(page.getByTestId("analytics-total")).toHaveText(/^5\s560,50\sTRY$/);
  await check("analytics");
  await tab(page, "Настройки").click();
  await expect(page.getByRole("region", { name: "Курсы валют" })).toBeVisible();
  await check("settings");
  await page.goto("/ru/demo/activity", { waitUntil: "networkidle" });
  await expect(main(page).getByRole("listitem").first()).toBeVisible();
  await check("activity");
});

test("a report is made as Excel and PDF files for what was chosen, and a backup holds every group", async ({ page }) => {
  await page.goto("/en/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  await tab(page, "Settings").click();
  const reports = page.getByRole("region", { name: "Reports" });
  const save = async (button: string) => {
    const [download] = await Promise.all([page.waitForEvent("download"), reports.getByRole("button", { name: button }).click()]);
    return { name: download.suggestedFilename(), bytes: await readFile((await download.path())!) };
  };

  // Nothing chosen: no file, and the reason in words.
  await reports.getByText("Expenses", { exact: true }).click();
  await reports.getByRole("button", { name: "Download as Excel (XLSX)" }).click();
  await expect(reports.getByRole("alert")).toHaveText("Choose at least one thing to include.");

  await reports.getByText("Debts as they stand", { exact: true }).click();
  await reports.getByText("Payments", { exact: true }).click();
  const csv = await save("Download as a spreadsheet (CSV)");
  expect(csv.name).toBe("splitly-Istanbul-weekend.csv");
  const blocks = csv.bytes.toString("utf8").replace(/^﻿/, "").trim().split("\r\n\r\n");
  expect(blocks.map((block) => block.split("\r\n")[0])).toEqual(["Debts as they stand", "Payments"]);
  expect(blocks[0].split("\r\n").slice(1)).toEqual([
    "From,To,Amount,Currency",
    "Kerem,Alex,830.12,TRY",
    "Deniz,Alex,632.25,TRY",
    "Deniz,Mira,44.88,TRY",
  ]);

  const xlsx = await save("Download as Excel (XLSX)");
  expect(xlsx.name).toBe("splitly-Istanbul-weekend.xlsx");
  // A ZIP archive, with the debts sheet inside as numbers.
  expect(xlsx.bytes.subarray(0, 4).toString("latin1")).toBe("PK\u0003\u0004");
  expect(xlsx.bytes.toString("utf8")).toContain('<c r="C2" s="2"><v>830.12</v></c>');

  const pdf = await save("Download as PDF");
  expect(pdf.name).toBe("splitly-Istanbul-weekend.pdf");
  expect(pdf.bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(pdf.bytes.length).toBeGreaterThan(5_000);

  // One currency only: the other's rows are not in the file.
  await page.goto("/en/demo/groups/demo-flat", { waitUntil: "networkidle" });
  await tab(page, "Settings").click();
  await reports.getByLabel("Report currency").selectOption("TRY");
  const lira = (await save("Download as a spreadsheet (CSV)")).bytes.toString("utf8").trim().split("\r\n");
  expect(lira.length).toBeGreaterThan(1);
  expect(lira.slice(1).every((line) => line.includes(",TRY,"))).toBe(true);

  await page.goto("/en/demo/profile", { waitUntil: "networkidle" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download the backup (JSON)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^splitly-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup).toMatchObject({ format: "splitly-backup", version: 1, amounts: "minor-units" });
  expect(backup.groups.map((group: { name: string }) => group.name).sort()).toEqual(["Flat in Moda", "Istanbul weekend"]);
  expect(backup.groups.find((group: { name: string }) => group.name === "Flat in Moda").expenses).toHaveLength(4);
});
