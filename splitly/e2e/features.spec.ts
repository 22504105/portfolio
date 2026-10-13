import { expect, test, type Page } from "@playwright/test";

// The additions the owner approved after the Stitch design, in a real
// browser on the demo: favourite groups, the notifications on the activity
// list, the screen of debts across groups, reminders, exchange rates offered
// from the bank's table, and the pictures beside receipt lines. Report files
// and the backup are in money.spec.ts.

const main = (page: Page) => page.getByRole("main");
const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}( \\d+)?$`) });
const said = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });

test("a favourite group goes to the top, here and on Home, and stays there after a reload", async ({ page }) => {
  await page.goto("/en/demo/groups", { waitUntil: "networkidle" });
  const cards = page.getByRole("region", { name: "Groups" }).getByRole("listitem");
  // The cards in order, by the name each star carries. (A card has lines of its own inside, so cards are counted by their stars.)
  const stars = cards.getByRole("button", { name: /^Keep .+ at the top$/ });
  const names = async () =>
    (
      await cards
        .getByRole("button", { name: /^Keep .+ at the top$/ })
        .evaluateAll((stars) => stars.map((star) => star.getAttribute("aria-label")!))
    ).map((label) => label.replace(/^Keep (.+) at the top$/, "$1"));
  const before = await names();
  const last = before[before.length - 1];
  const star = page.getByRole("button", { name: `Keep ${last} at the top` });
  await expect(star).toHaveAttribute("aria-pressed", "false");
  // Nothing is a favourite yet: there is nothing to narrow to.
  await expect(page.getByText("Favourites only")).toHaveCount(0);

  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");
  expect((await names())[0]).toBe(last);
  await page.getByText("Favourites only").click();
  await expect(stars).toHaveCount(1);
  await page.getByText("Favourites only").click();
  await expect(stars).toHaveCount(before.length);

  await page.reload({ waitUntil: "networkidle" });
  expect((await names())[0]).toBe(last);
  // On Home the first favourite is the group on the green card, and its chip carries the star.
  await page.goto("/en/demo", { waitUntil: "networkidle" });
  await expect(page.getByRole("region", { name: last })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Group" }).getByRole("img", { name: "Favourite" })).toHaveCount(1);

  await page.goto("/en/demo/groups", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: `Keep ${last} at the top` }).click();
  expect(await names()).toEqual(before);
});

test("the bell counts what waits for you, the list marks it, and answering it clears it", async ({ page }) => {
  await page.goto("/en/demo", { waitUntil: "networkidle" });
  // Deniz says they paid Alex: that waits for Alex, whoever looks and whenever.
  const bell = main(page).getByRole("link", { name: /^Activity, / });
  await expect(bell).toHaveAccessibleName("Activity, new for you: 1");
  await bell.click();
  await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();
  const news = page.getByRole("region", { name: "New for you: 1" });
  await expect(news).toBeVisible();
  const waiting = main(page).getByRole("listitem").filter({ hasText: "Deniz says they paid Alex" });
  await expect(waiting).toContainText("Waiting for you");
  // What only happened, and was done by the person themselves, carries no mark.
  await expect(main(page).getByRole("listitem").filter({ hasText: "Taxi from the airport" })).not.toContainText("New");
  // Marking the list read does not make a payment that still waits go away.
  await news.getByRole("button", { name: "Mark all as read" }).click();
  await expect(news).toBeVisible();

  // The event leads to the place where it is answered.
  await waiting.getByRole("link").click();
  await expect(tab(page, "Debts")).toHaveAttribute("aria-selected", "true");
  await page.getByRole("region", { name: "Waiting to be confirmed" }).getByRole("button", { name: "Confirm" }).click();
  await expect(said(page, "Payment confirmed")).toBeVisible();
  await page.goto("/en/demo", { waitUntil: "networkidle" });
  await expect(main(page).getByRole("link", { name: /^Activity, / })).toHaveAccessibleName("Activity, nothing new");
  await page.goto("/en/demo/activity", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0);
});

test("debts from every group on one screen, narrowed by group, currency and person, each leading to its group", async ({
  page,
  isMobile,
}) => {
  await page.goto("/en/demo", { waitUntil: "networkidle" });
  await (isMobile ? main(page) : page.getByRole("navigation", { name: "Main" }).filter({ visible: true }))
    .getByRole("link", { name: isMobile ? "All debts" : "Debts", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Debts" })).toBeVisible();
  const rows = page.getByRole("region", { name: "Debts", exact: true }).getByRole("listitem");
  const all = await rows.count();
  expect(all).toBeGreaterThan(3);
  // Each currency on its own line; nothing is added across them.
  const mine = page.getByRole("region", { name: "Where you stand, all groups" });
  await expect(mine).toContainText(/You owe\s*485\.47\sEUR/);
  await expect(mine).toContainText(/You are owed\s*1,889\.03\sTRY/);

  await page.getByLabel("Group", { exact: true }).selectOption({ label: "Istanbul weekend" });
  await expect(rows).toHaveText([/Kerem.*Alex.*830\.12\sTRY/, /Deniz.*Alex.*632\.25\sTRY/, /Deniz.*Mira.*44\.88\sTRY/]);
  await page.getByLabel("Person", { exact: true }).selectOption({ label: "Mira" });
  await expect(rows).toHaveText([/Deniz.*Mira.*44\.88\sTRY/]);
  await page.getByLabel("Person", { exact: true }).selectOption({ label: "Only mine" });
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("You are owed");

  await page.getByLabel("Group", { exact: true }).selectOption({ label: "All groups" });
  await page.getByLabel("Person", { exact: true }).selectOption({ label: "Everyone" });
  await page.getByLabel("Currency", { exact: true }).selectOption("EUR");
  expect(await rows.count()).toBeLessThan(all);
  for (const text of await rows.allInnerTexts()) expect(text).toMatch(/EUR/);
  await page.getByLabel("Group", { exact: true }).selectOption({ label: "Istanbul weekend" });
  await expect(page.getByRole("region", { name: "Debts", exact: true }).getByRole("status")).toHaveText("No debts for this choice.");

  await page.getByLabel("Currency", { exact: true }).selectOption({ label: "All currencies" });
  await rows.first().getByRole("link", { name: "Settle in the group" }).click();
  await expect(page).toHaveURL(/\/en\/demo\/groups\/demo-istanbul\?tab=debts$/);
  await expect(page.getByRole("heading", { level: 1, name: "Istanbul weekend" })).toBeVisible();
  await expect(tab(page, "Debts")).toHaveAttribute("aria-selected", "true");
});

test("a reminder is a ready message the person sends themselves, and only for what is owed to them", async ({ page }) => {
  await page.goto("/en/demo/groups/demo-istanbul?tab=debts", { waitUntil: "networkidle" });
  const rows = page.getByRole("region", { name: "Simplified transfers" }).getByRole("listitem");
  const kerem = rows.filter({ hasText: /Kerem.*Alex/ });
  await kerem.getByRole("button", { name: "Remind" }).click();
  const box = kerem.getByRole("group", { name: "A reminder for Kerem" });
  await expect(box).toContainText(/Hi, Kerem! A reminder from Splitly: in “Istanbul weekend” you owe me 830\.12\sTRY\./);
  await expect(box).toContainText("Splitly sends nothing by itself.");
  const href = (await box.getByRole("link", { name: "Send in Telegram" }).getAttribute("href"))!;
  expect(href).toMatch(/^https:\/\/t\.me\/share\/url\?url=http/);
  expect(decodeURIComponent(href)).toContain("you owe me 830.12");
  expect(decodeURIComponent(href)).toContain("/en/demo/groups/demo-istanbul");
  // Pressed again, it folds away.
  await kerem.getByRole("button", { name: "Remind" }).click();
  await expect(box).toHaveCount(0);
  // A debt between two other people is not Alex's to remind about.
  await expect(rows.filter({ hasText: /Deniz.*Mira/ }).getByRole("button", { name: "Remind" })).toHaveCount(0);
  await expect(rows.filter({ hasText: /Deniz.*Mira/ }).getByRole("button", { name: "Settle" })).toBeVisible();
});

test("a rate offered from the bank's table fills the form with its day, and counts only once it is added", async ({ page, request }) => {
  let answer: { status: number; json: unknown } = { status: 200, json: { from: "TRY", to: "EUR", rate: "0.0207", date: "2026-10-09" } };
  await page.route("**/api/rates?*", (route) => route.fulfill(answer));
  await page.goto("/en/demo/groups/demo-flat", { waitUntil: "networkidle" });
  await tab(page, "Settings").click();
  const rates = page.getByRole("region", { name: "Exchange rates" });
  const recorded = await rates.getByRole("listitem").count();

  await rates.getByRole("button", { name: "Get today's rate" }).click();
  await expect(rates.getByRole("status")).toHaveText("European Central Bank rate of 9 Oct 2026. Check it, then add it.");
  await expect(rates.getByLabel("1 TRY in EUR")).toHaveValue("0.0207");
  await expect(rates.locator("input[type=date]")).toHaveValue("2026-10-09");
  // Offered is not recorded.
  await expect(rates.getByRole("listitem")).toHaveCount(recorded);
  await rates.getByRole("button", { name: "Add the rate" }).click();
  await expect(said(page, "Rate added")).toBeVisible();
  await expect(rates.getByRole("listitem")).toHaveCount(recorded + 1);
  await expect(rates.getByRole("listitem").filter({ hasText: "1 TRY = 0.0207 EUR" })).toContainText("9 Oct 2026");

  // The source has nothing, or is down: said in words, and the form is still there to type in.
  answer = { status: 502, json: { error: "unavailable" } };
  await rates.getByRole("button", { name: "Get today's rate" }).click();
  await expect(rates.getByRole("alert")).toContainText("No rate could be fetched for this pair");
  await rates.getByLabel("1 TRY in EUR").fill("0,021");
  await rates.getByRole("button", { name: "Add the rate" }).click();
  await expect(rates.getByRole("listitem")).toHaveCount(recorded + 2);

  // The server refuses pairs the table does not have, without asking anyone.
  for (const query of ["from=RUB&to=TRY", "from=EUR&to=EUR", "from=EUR", "from=eur&to=TRY"]) {
    const response = await request.get(`/api/rates?${query}`);
    expect([query, response.status(), await response.json()]).toEqual([query, 404, { error: "unavailable" }]);
  }
});

test("a receipt line gets the picture of its kind, and a name nothing matches gets the plain bag", async ({ page }) => {
  await page.goto("/en/demo/scan?group=demo-istanbul", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Enter the lines by hand" }).click();
  for (const [index, name] of ["Süt 1L", "Ekmek", "XK-4471"].entries()) {
    await page.getByRole("button", { name: "Add a line" }).click();
    await page.getByLabel(`Name of line ${index + 1}`).fill(name);
    await page.getByLabel(`Amount of ${name}`).fill("10");
  }
  await page.getByRole("button", { name: "Tip" }).click();
  await page.getByLabel("Amount of Tip").fill("5");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Who had what" })).toBeVisible();
  const pictures = await main(page)
    .locator("[data-picture]")
    .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute("data-picture")));
  expect(pictures).toEqual(["milk", "bread", "other"]);
});

test("the invitation is a sheet over the group: it opens, keeps the page out of reach, and closes four ways", async ({ page }) => {
  await page.goto("/en/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  const sheet = page.getByRole("dialog", { name: "Istanbul weekend" });
  await expect(sheet).toHaveCount(0);

  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Invitation to the group");
  // The demo has nobody to invite, and says so instead of offering a link that would lead nowhere.
  await expect(sheet).toContainText("the demo has none");
  await expect(sheet.getByRole("button", { name: "Create invite link" })).toHaveCount(0);
  // It is a modal: the keyboard is taken inside it, and a tap on the dimmed page around it only closes it.
  await expect(sheet.getByRole("button", { name: "Close" })).toBeFocused();
  await page.mouse.click(8, 8);
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Expenses" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Invite", exact: true }).click();

  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  // Closed, the page is whole again and nothing was changed by looking.
  await expect(page.getByRole("tab", { name: "Expenses" })).toHaveAttribute("aria-selected", "true");

  // Adding someone by name from the sheet leads to the form that does it.
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Settings" })).toHaveAttribute("aria-selected", "true");
  await page.getByPlaceholder("Name").first().waitFor();
});

test("on a wide screen the group and the analytics stand in columns; on a phone they follow one another", async ({ page, isMobile }) => {
  const box = async (locator: ReturnType<Page["locator"]>) => (await locator.boundingBox())!;
  await page.goto("/en/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  const balances = await box(page.getByRole("heading", { level: 2, name: "People", exact: true }));
  const tabs = await box(page.getByRole("tablist"));
  if (isMobile) expect(tabs.y).toBeGreaterThan(balances.y);
  else {
    // The card with everyone's balance on the left, the tabs beside it, starting level with it.
    expect(tabs.x).toBeGreaterThan(balances.x + 250);
    expect(tabs.y).toBeLessThan(balances.y);
    // The card stays in view while the expenses scroll.
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(200);
    await expect(page.getByRole("heading", { level: 2, name: "People", exact: true })).toBeInViewport();
  }

  await page.goto("/en/demo/analytics", { waitUntil: "networkidle" });
  await page.getByLabel("Period").selectOption("all");
  const total = await box(page.getByTestId("analytics-total"));
  const split = await box(page.getByRole("radiogroup", { name: "What to split the total by" }));
  if (isMobile) expect(split.y).toBeGreaterThan(total.y);
  else expect(split.x).toBeGreaterThan(total.x + 300);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
