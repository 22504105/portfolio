import { expect, test, type Page } from "@playwright/test";

// Stage 2 in a real browser, on the demo: groups, people and expenses typed
// in by hand. The demo applies the same rules as the server (the server's own
// are tested against a real database in tests/db/api.test.ts).

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Creates a group with two guests and lands on its page. */
async function newGroup(page: Page, name: string) {
  await page.goto("/en/demo/groups", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New group" }).click();
  await page.getByLabel("Group name").fill(name);
  await page.getByLabel("Main currency").selectOption("EUR");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  for (const guest of ["Lena", "Omar"]) {
    await page.getByLabel("Add someone by name").fill(guest);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: `${guest} added` })).toBeVisible();
  }
}

const balances = (page: Page) => page.getByRole("region", { name: "Balances" }).getByRole("listitem");

test("the demo opens on invented groups with the visitor's balance worked out", async ({ page }) => {
  await page.goto("/en/demo", { waitUntil: "networkidle" });
  const mine = page.getByRole("region", { name: "Where you stand" });
  // Both groups together, each currency on its own line: 1,462.37 + 426.66 TRY owed to you, 485.47 EUR owed by you.
  await expect(mine.getByRole("listitem")).toHaveText(["You owe485.47 EUR", "You are owed1,889.03 TRY"]);
  await expect(mine).toContainText("Each currency is kept apart");
  await expect(page.getByRole("link", { name: /Istanbul weekend/ })).toContainText("People: 4 · Expenses: 6 · TRY");

  await page.getByRole("link", { name: /Flat in Moda/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat in Moda" })).toBeVisible();
  // Rent 1,200.00 at 40 / 30 / 30, paid by Alex; internet 35.00 by you; groceries 86.40 by Sam.
  await expect(balances(page).filter({ hasText: "Alex" })).toContainText("gets back 799.53 EUR");
  await expect(balances(page).filter({ hasText: "You" })).toContainText("owes 485.47 EUR");
  await expect(balances(page).filter({ hasText: "You" })).toContainText("gets back 426.66 TRY");
  expect(await overflow(page)).toBe(0);
});

test("the demo never talks to the server about data", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1")) calls.push(request.url());
  });
  await newGroup(page, "Offline trip");
  await page.getByRole("link", { name: "Add expense" }).first().click();
  await page.getByLabel("What was it").fill("Coffee");
  await page.getByLabel("Amount", { exact: true }).fill("9");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Expense saved" })).toBeVisible();
  expect(calls).toEqual([]);
});

test("a new group, two people added by name, and an expense split equally to the last cent", async ({ page }) => {
  await newGroup(page, "Road trip");
  await page.getByRole("link", { name: "Add expense" }).first().click();
  await expect(page.getByLabel("Group")).toHaveValue(/.+/);
  await expect(page.getByLabel("Currency")).toHaveValue("EUR");

  await page.getByLabel("What was it").fill("Petrol");
  await page.getByLabel("Amount", { exact: true }).fill("100");
  // 100.00 between three: the extra cent goes to the first person listed.
  await expect(page.getByTestId(/^share-/)).toHaveText(["33.34 EUR", "33.33 EUR", "33.33 EUR"]);
  await page.getByRole("button", { name: "Save expense" }).click();

  await expect(page).toHaveURL(/\/en\/demo\/groups\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("region", { name: "Where you stand" })).toContainText("You are owed");
  await expect(page.getByRole("region", { name: "Where you stand" })).toContainText("66.66 EUR");
  await expect(balances(page)).toContainText([/You.*gets back 66\.66\sEUR/, /Lena.*owes 33\.33\sEUR/, /Omar.*owes 33\.33\sEUR/]);

  // It is still there after a reload: kept in this browser.
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /Petrol/ })).toContainText("100.00 EUR");
  await expect(page.getByRole("button", { name: /Petrol/ })).toContainText("your share 33.34 EUR");
});

test("the form says what is wrong, in words, and saves nothing until it is right", async ({ page }) => {
  await newGroup(page, "Checks");
  await page.getByRole("link", { name: "Add expense" }).first().click();
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(["Say what it was", "Type an amount above zero"]);
  await expect(page.getByLabel("What was it")).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel("What was it").fill("Hotel");
  // An amount that could be read two ways is refused, not guessed.
  await page.getByLabel("Amount", { exact: true }).fill("1.234");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(["Type an amount above zero"]);
  await page.getByLabel("Amount", { exact: true }).fill("300");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

  // By amounts: the form says how much is left as it is typed.
  await page.getByText("Amounts", { exact: true }).click();
  await page.getByLabel("You: Amounts").fill("100");
  await page.getByLabel("Lena: Amounts").fill("150");
  await page.getByLabel("Omar: Amounts").fill("0");
  await expect(page.getByText("50.00 EUR still to assign")).toBeVisible();
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(["The amounts must add up to the total."]);
  await page.getByLabel("Omar: Amounts").fill("60");
  await expect(page.getByText("10.00 EUR too much")).toBeVisible();
  await page.getByLabel("Omar: Amounts").fill("50");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

  // By percent.
  await page.getByText("Percent", { exact: true }).click();
  await page.getByLabel("You: Percent").fill("50");
  await page.getByLabel("Lena: Percent").fill("25");
  await page.getByLabel("Omar: Percent").fill("20");
  await expect(page.getByText("5% still to assign")).toBeVisible();
  await page.getByLabel("Omar: Percent").fill("25");
  await expect(page.getByTestId(/^share-/)).toHaveText(["150.00 EUR", "75.00 EUR", "75.00 EUR"]);

  // Several people paid.
  await page.getByLabel("Several people paid").check();
  await page.getByLabel("You paid").fill("200");
  await expect(page.getByText("100.00 EUR still to assign")).toBeVisible();
  await page.getByLabel("Lena paid").fill("100");

  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Expense saved" })).toBeVisible();
  // You paid 200 and owe 150; Lena paid 100 and owes 75; Omar owes 75.
  await expect(balances(page)).toContainText([/You.*gets back 50\.00\sEUR/, /Lena.*gets back 25\.00\sEUR/, /Omar.*owes 75\.00\sEUR/]);

  await page.getByRole("button", { name: /Hotel/ }).click();
  await expect(page.getByRole("button", { name: /Hotel/ })).toContainText("2 people paid");
  await expect(page.getByText("Owes · Percent")).toBeVisible();
});

test("an expense is changed by replacing it and cancelled without erasing it", async ({ page }) => {
  await page.goto("/en/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Dinner in Karaköy/ }).click();
  await page.getByRole("link", { name: "Change" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Change expense" })).toBeVisible();
  await expect(page.getByLabel("What was it")).toHaveValue("Dinner in Karaköy");
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("2480.00");
  await page.getByLabel("Amount", { exact: true }).fill("2000");
  await page.getByLabel("What was it").fill("Dinner in Karaköy, corrected");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Expense changed" })).toBeVisible();

  await expect(page.getByRole("button", { name: /Dinner in Karaköy/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /corrected/ })).toContainText("2,000.00 TRY");
  // The old version is kept, marked, and can be looked at.
  await page.getByLabel("Show cancelled and changed ones too").check();
  await expect(page.getByRole("button", { name: /Dinner in Karaköy/ })).toHaveCount(2);
  await expect(page.getByRole("button", { name: /Dinner in Karaköy/ }).filter({ hasText: "2,480.00 TRY" })).toContainText("changed later");

  // Cancelling asks first, and "No" changes nothing.
  await page.getByRole("button", { name: /corrected/ }).click();
  await page.getByRole("button", { name: "Cancel expense" }).click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.getByRole("button", { name: /corrected/ })).not.toContainText("cancelled");
  await page.getByRole("button", { name: "Cancel expense" }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Expense cancelled" })).toBeVisible();
  await expect(page.getByRole("button", { name: /corrected/ })).toContainText("cancelled");
  // Without the dinner you paid 500.00 of the taxi and owe 450 + 90.13 + 237.50 + 120.
  await expect(page.getByRole("region", { name: "Where you stand" })).toContainText("You owe");
  await expect(page.getByRole("region", { name: "Where you stand" })).toContainText("397.63 TRY");
});

test("people: roles, removing someone, and an honest word about invitations", async ({ page }) => {
  await page.goto("/en/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  const people = page.getByRole("region", { name: "People" });
  await expect(people.getByRole("listitem").filter({ hasText: "Deniz" })).toContainText("Manager");
  await expect(people.getByRole("listitem").filter({ hasText: "Kerem" })).toContainText("no account");
  // A guest cannot be made a manager; the owner's own role is not on offer.
  await expect(people.getByLabel("Role of Kerem")).toHaveCount(0);
  await expect(people.getByLabel("Role of You")).toHaveCount(0);

  await people.getByLabel("Role of Mira").selectOption("admin");
  await expect(page.getByRole("status").filter({ hasText: "Role changed" })).toBeVisible();
  await expect(people.getByRole("listitem").filter({ hasText: "Mira" })).toContainText("Manager");

  await people.getByRole("button", { name: "Remove: Mira" }).click();
  await people.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(people.getByRole("listitem").filter({ hasText: "Mira" })).toHaveCount(0);
  // What Mira paid and owes is still in the balances, and she is not offered for new expenses.
  await expect(balances(page).filter({ hasText: "Mira" })).toContainText("left the group");
  await expect(people).toContainText("the demo has none");
  await page.getByRole("link", { name: "Add expense" }).first().click();
  await expect(page.getByLabel("Mira takes part")).toHaveCount(0);
  await expect(page.getByLabel("Deniz takes part")).toBeChecked();
});

test("a group can be renamed, archived, searched for and deleted", async ({ page }) => {
  await newGroup(page, "Temporary");
  await page.getByRole("region", { name: "Group settings" }).getByLabel("Group name").fill("Renamed group");
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Renamed group" })).toBeVisible();

  await page.getByRole("button", { name: "Archive group" }).click();
  await expect(page.getByText("This group is archived")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add expense" }).filter({ visible: true })).toHaveCount(1); // only the one in the navigation
  await expect(page.getByLabel("Add someone by name")).toHaveCount(0);

  await page.goto("/en/demo/groups", { waitUntil: "networkidle" });
  await page.getByLabel("Search groups").fill("renamed");
  await expect(page.getByRole("link", { name: /Renamed group/ })).toContainText("Archived");
  await expect(page.getByRole("link", { name: /Istanbul weekend/ })).toHaveCount(0);
  await page.getByLabel("Search groups").fill("zzz");
  await expect(page.getByText("No group matches “zzz”.")).toBeVisible();

  await page.getByLabel("Search groups").fill("renamed");
  await page.getByRole("link", { name: /Renamed group/ }).click();
  await page.getByRole("button", { name: "Delete group" }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/demo\/groups$/);
  await expect(page.getByRole("link", { name: /Renamed group/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Istanbul weekend/ })).toBeVisible();
});

test("the demo can be started over, and a group that is not there says so", async ({ page }) => {
  await newGroup(page, "Mine");
  await page.goto("/en/demo/profile", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start the demo over" }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "The demo is as it started" })).toBeVisible();
  await page.goto("/en/demo/groups", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: /Mine/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Istanbul weekend/ })).toBeVisible();

  await page.goto("/en/demo/groups/no-such-group", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "No such group" })).toBeVisible();
});

test("in Russian the same screens speak Russian, amounts included", async ({ page }) => {
  await page.goto("/ru/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Выходные в Стамбуле" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ваш баланс" })).toContainText("Вам должны");
  await expect(page.getByRole("region", { name: "Ваш баланс" })).toContainText(/1\s462,37\sTRY/);
  await page.getByRole("link", { name: "Добавить расход" }).first().click();
  await page.getByRole("button", { name: "Сохранить расход" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(["Напишите, на что потрачено", "Введите сумму больше нуля"]);
  expect(await overflow(page)).toBe(0);
});

test("no stage-2 screen is wider than the display, and its controls are big enough for a thumb", async ({ page, isMobile }) => {
  for (const path of [
    "/en/demo",
    "/en/demo/groups",
    "/en/demo/groups/demo-istanbul",
    "/en/demo/add?group=demo-istanbul",
    "/ru/demo/groups/demo-flat",
    "/ru/demo/add?group=demo-flat",
  ]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("main h1")).toBeVisible();
    if (path.includes("/add")) {
      await page.getByRole("radio").nth(1).check({ force: true });
      await page.getByRole("checkbox").nth(1).check();
    }
    expect([path, await overflow(page)]).toEqual([path, 0]);
    if (!isMobile) continue;
    const small = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "main a, main button, main select, main input:not([type=checkbox]):not([type=radio]), main label:has(input[type=checkbox]), main label:has(input[type=radio])",
        ),
      ]
        .filter((element) => element.offsetParent !== null)
        .map((element) => ({
          text: (element.textContent || element.getAttribute("aria-label") || element.tagName).trim().slice(0, 30),
          height: Math.round(element.getBoundingClientRect().height),
        }))
        .filter((entry) => entry.height < 44),
    );
    expect([path, small]).toEqual([path, []]);
  }
});

test("outside Telegram, a person's own groups stay shut and the way to the demo is shown", async ({ page }) => {
  for (const path of ["/en/app", "/en/app/groups", "/en/app/join?t=" + "A".repeat(43)]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Open Splitly in Telegram" })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
  }
  // Telegram's script is not loaded for someone Telegram did not send.
  expect(await page.evaluate(() => document.querySelectorAll('script[src*="telegram.org"]').length)).toBe(0);
  await page.getByRole("link", { name: "Try the demo instead" }).click();
  await expect(page).toHaveURL(/\/en\/demo$/);
});

test("the data API gives nothing without a session", async ({ request }) => {
  for (const [method, path] of [
    ["GET", "groups"],
    ["GET", "me"],
    ["POST", "groups"],
    ["POST", "session"],
    ["GET", "groups/3f2b1c9e-8a47-4d6b-9c1e-5a7d2f0b6e11"],
  ] as const) {
    const response = await request.fetch(`/api/v1/${path}`, {
      method,
      data: method === "POST" ? { initData: "hash=forged", name: "x" } : undefined,
    });
    // This build has no database or bot configured (as in CI): the API says so and stops there. With them, the answer is 401.
    expect([path, response.status(), await response.json()]).toEqual([path, 503, { error: "not_configured" }]);
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
});
