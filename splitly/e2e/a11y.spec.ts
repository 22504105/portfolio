import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// An automated accessibility check (axe, WCAG 2.2 A and AA) of every screen,
// in both themes, with the forms and panels opened. It finds what a machine
// can find: contrast, names, roles, labels. It does not replace someone
// using the app with a screen reader, which has not been done.

const problems = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes
        .map((node) => node.target.join(" "))
        .slice(0, 3)
        .join(" | ")}`,
  );
};

/** The screens, each with a way to open what is folded away on it. */
const SCREENS: [string, string, ((page: Page) => Promise<void>)?][] = [
  ["front page", "/en"],
  ["home", "/en/demo"],
  ["groups, with the new-group form", "/en/demo/groups", async (page) => page.getByRole("button", { name: "New group" }).click()],
  [
    "group: expenses, one opened",
    "/en/demo/groups/demo-istanbul",
    async (page) => page.getByRole("button", { name: /Taxi from the airport/ }).click(),
  ],
  [
    "group: debts, settling one",
    "/en/demo/groups/demo-istanbul",
    async (page) => {
      await page.getByRole("tab", { name: "Debts" }).click();
      await page.getByRole("button", { name: "Settle" }).first().click();
    },
  ],
  ["group: analytics", "/en/demo/groups/demo-flat", async (page) => page.getByRole("tab", { name: "Analytics" }).click()],
  ["group: settings", "/en/demo/groups/demo-istanbul", async (page) => page.getByRole("tab", { name: "Settings" }).click()],
  [
    "new expense, with complaints showing",
    "/en/demo/add?group=demo-istanbul",
    async (page) => {
      await page.getByText("By amounts", { exact: true }).click();
      await page.getByRole("button", { name: "Add expense", exact: true }).click();
    },
  ],
  ["scanner", "/en/demo/scan?group=demo-istanbul"],
  [
    "scanner: a receipt by hand",
    "/en/demo/scan?group=demo-istanbul",
    async (page) => {
      await page.getByRole("button", { name: "Enter the lines by hand" }).click();
      await page.getByRole("button", { name: "Add a line" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
    },
  ],
  ["analytics", "/en/demo/analytics"],
  ["activity", "/en/demo/activity"],
  ["profile", "/en/demo/profile"],
  ["privacy", "/en/privacy"],
  ["outside Telegram", "/en/app"],
  ["home, in Russian", "/ru/demo"],
  ["not found", "/en/nothing/here"],
];

for (const theme of ["light", "dark"] as const) {
  test(`no accessibility problems a machine can find, ${theme} theme`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript((value) => window.localStorage.setItem("splitly-theme", value), theme);
    const found: Record<string, string[]> = {};
    for (const [name, path, open] of SCREENS) {
      await page.goto(path, { waitUntil: "networkidle" });
      await open?.(page);
      // The confirmation that slides in at the bottom is checked too, when it is there.
      const seen = await problems(page);
      if (seen.length > 0) found[name] = seen;
    }
    expect(found).toEqual({});
  });
}
