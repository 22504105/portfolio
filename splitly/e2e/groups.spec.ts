import { expect, test, type Page } from "@playwright/test";

// Stage 2 in a real browser, on the demo, in the concept's design: groups,
// people and expenses typed in by hand. The demo applies the same rules as
// the server (the server's own are tested against a real database in
// tests/db/api.test.ts).

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const main = (page: Page) => page.getByRole("main");
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });
/** The list of people with what each is owed or owes, on a group's Expenses tab. */
const balances = (page: Page) => page.getByRole("region", { name: "People", exact: true }).getByRole("listitem");
const said = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });
const openAdd = (page: Page) => main(page).getByRole("link", { name: "Add expense" }).click();
const save = (page: Page) => page.getByRole("button", { name: "Add expense", exact: true }).click();

/** Creates a group with two people added by name and lands on its Expenses tab. */
async function newGroup(page: Page, name: string) {
  await page.goto("/en/demo/groups", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New group" }).click();
  await page.getByLabel("Group name").fill(name);
  await page.getByLabel("Main currency").selectOption("EUR");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await tab(page, "Settings").click();
  for (const guest of ["Lena", "Omar"]) {
    await page.getByLabel("Add someone by name").fill(guest);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(said(page, `${guest} added`)).toBeVisible();
  }
  await tab(page, "Expenses").click();
}

test("home, as in the concept: a greeting, one group on the green card, its latest expenses", async ({ page }) => {
  await page.goto("/en/demo", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Hi, Alex!" })).toBeVisible();

  const card = page.getByRole("region", { name: "Istanbul weekend" });
  await expect(card).toContainText("Spent by the group");
  // 420 − 450 + 2,480 + 1,800 + 360.50 + 950: the cancelled deposit does not count.
  await expect(card).toContainText("5,560.50 TRY");
  await expect(card.getByRole("link", { name: "Add expense" })).toHaveAttribute("href", "/en/demo/add?group=demo-istanbul");
  const recent = page.getByRole("region", { name: "Recent expenses" });
  await expect(recent.getByRole("listitem")).toHaveCount(5);
  await expect(recent.getByRole("listitem").first()).toContainText("Baklava and tea");

  // The other group, picked from the switch above the card.
  await page.getByRole("radiogroup", { name: "Group" }).getByText("Flat in Moda").click();
  const flat = page.getByRole("region", { name: "Flat in Moda" });
  await expect(flat).toContainText("1,321.40 EUR");
  await expect(flat).toContainText("640.00 TRY");

  // Both groups together, each currency on its own line: 1,462.37 + 426.66 TRY owed to you, 485.47 EUR owed by you.
  await expect(page.getByRole("region", { name: "Where you stand" }).getByRole("listitem")).toHaveText([
    "You owe485.47 EUR",
    "You are owed1,889.03 TRY",
  ]);
  await expect(page.getByText("Each currency is kept apart")).toBeVisible();

  // The other button on the card opens the scanner, for that group.
  await flat.getByRole("link", { name: "Scan receipt" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Scan a receipt" })).toBeVisible();
  await expect(page).toHaveURL(/\/en\/demo\/scan\?group=demo-flat$/);
  await expect(page.getByRole("button", { name: "Open the camera" })).toBeVisible();
});

test("a group, as in the concept: faces, tabs, and everyone's balance with its sign", async ({ page }) => {
  await page.goto("/en/demo/groups", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: /Istanbul weekend/ })).toContainText("People: 4 · Expenses: 6 · TRY");
  await page.getByRole("link", { name: /Flat in Moda/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat in Moda" })).toBeVisible();
  await expect(page.getByText("People: 3 • EUR")).toBeVisible();

  // Rent 1,200.00 at 40 / 30 / 30, paid by Nika; internet 35.00 by you; groceries 86.40 by Sam.
  await expect(balances(page).filter({ hasText: "Nika" })).toContainText(/gets back \+799\.53\sEUR/);
  await expect(balances(page).filter({ hasText: "Alex" })).toContainText(/owes -485\.47\sEUR/);
  await expect(balances(page).filter({ hasText: "Alex" })).toContainText(/gets back \+426\.66\sTRY/);

  // Each tab has its own screen (the money ones are tested in money.spec.ts).
  await tab(page, "Debts").click();
  await expect(page.getByRole("tabpanel")).toContainText("Simplified transfers");
  await tab(page, "Analytics").click();
  await expect(page.getByRole("tabpanel")).toContainText("Total spent");
  await tab(page, "Settings").click();
  await expect(page.getByRole("region", { name: "Group settings" })).toBeVisible();
  expect(await overflow(page)).toBe(0);
});

test("the demo never talks to the server about data", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1")) calls.push(request.url());
  });
  await newGroup(page, "Offline trip");
  await openAdd(page);
  await page.getByLabel("Description").fill("Coffee");
  await page.getByLabel("Amount", { exact: true }).fill("9");
  await save(page);
  await expect(said(page, "Expense saved")).toBeVisible();
  expect(calls).toEqual([]);
});

test("a new group, two people added by name, and an expense split equally to the last cent", async ({ page }) => {
  await newGroup(page, "Road trip");
  await openAdd(page);
  await expect(page.getByRole("heading", { level: 1, name: "New expense" })).toBeVisible();
  await expect(page.getByLabel("Currency")).toHaveValue("EUR");

  await page.getByRole("button", { name: "Transport" }).click();
  await expect(page.getByRole("button", { name: "Transport" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Description").fill("Petrol");
  await page.getByLabel("Amount", { exact: true }).fill("100");
  // 100.00 between three: the extra cent goes to the first person listed.
  await expect(page.getByTestId(/^share-/)).toHaveText(["33.34 EUR", "33.33 EUR", "33.33 EUR"]);
  await save(page);

  await expect(page).toHaveURL(/\/en\/demo\/groups\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("region", { name: "Where you stand" })).toContainText("You are owed");
  await expect(page.getByRole("region", { name: "Where you stand" })).toContainText("66.66 EUR");
  await expect(balances(page)).toContainText([/Alex.*gets back \+66\.66\sEUR/, /Lena.*owes -33\.33\sEUR/, /Omar.*owes -33\.33\sEUR/]);

  // It is still there after a reload: kept in this browser.
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /Petrol/ })).toContainText("100.00 EUR");
  await expect(page.getByRole("button", { name: /Petrol/ })).toContainText("your share 33.34 EUR");
  await page.getByRole("button", { name: /Petrol/ }).click();
  await expect(page.getByText("Transport", { exact: true })).toBeVisible();
});

test("the form says what is wrong, in words, and saves nothing until it is right", async ({ page }) => {
  await newGroup(page, "Checks");
  await openAdd(page);
  await save(page);
  await expect(main(page).getByRole("alert")).toContainText(["Type an amount above zero", "Say what it was"]);
  await expect(page.getByLabel("Description")).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel("Description").fill("Hotel");
  // An amount that could be read two ways is refused, not guessed.
  await page.getByLabel("Amount", { exact: true }).fill("1.234");
  await expect(main(page).getByRole("alert")).toContainText(["Type an amount above zero"]);
  await page.getByLabel("Amount", { exact: true }).fill("300");
  await expect(main(page).getByRole("alert")).toHaveCount(0);

  // Someone who did not take part is tapped out, and back in.
  await page.getByLabel("Omar takes part").uncheck({ force: true });
  await expect(page.getByTestId(/^share-/)).toHaveText(["150.00 EUR", "150.00 EUR"]);
  await page.getByLabel("Omar takes part").check({ force: true });

  // By amounts: the form says how much is left as it is typed.
  await page.getByText("By amounts", { exact: true }).click();
  await page.getByLabel("Alex: By amounts").fill("100");
  await page.getByLabel("Lena: By amounts").fill("150");
  await page.getByLabel("Omar: By amounts").fill("0");
  await expect(page.getByText("50.00 EUR still to assign")).toBeVisible();
  await save(page);
  await expect(main(page).getByRole("alert")).toContainText(["The amounts must add up to the total."]);
  await page.getByLabel("Omar: By amounts").fill("60");
  await expect(page.getByText("10.00 EUR too much")).toBeVisible();
  await page.getByLabel("Omar: By amounts").fill("50");
  await expect(main(page).getByRole("alert")).toHaveCount(0);

  // By percent.
  await page.getByText("By percent", { exact: true }).click();
  await page.getByLabel("Alex: By percent").fill("50");
  await page.getByLabel("Lena: By percent").fill("25");
  await page.getByLabel("Omar: By percent").fill("20");
  await expect(page.getByText("5% still to assign")).toBeVisible();
  await page.getByLabel("Omar: By percent").fill("25");
  await expect(page.getByTestId(/^share-/)).toHaveText(["150.00 EUR", "75.00 EUR", "75.00 EUR"]);

  // Several people paid.
  await page.getByLabel("Several people paid").check();
  await page.getByLabel("Alex paid").fill("200");
  await expect(page.getByText("100.00 EUR still to assign")).toBeVisible();
  await page.getByLabel("Lena paid").fill("100");

  await save(page);
  await expect(said(page, "Expense saved")).toBeVisible();
  // You paid 200 and owe 150; Lena paid 100 and owes 75; Omar owes 75.
  await expect(balances(page)).toContainText([/Alex.*gets back \+50\.00\sEUR/, /Lena.*gets back \+25\.00\sEUR/, /Omar.*owes -75\.00\sEUR/]);

  await page.getByRole("button", { name: /Hotel/ }).click();
  await expect(page.getByRole("button", { name: /Hotel/ })).toContainText("2 people paid");
  await expect(page.getByText("Owes · By percent")).toBeVisible();
});

test("an expense is changed by replacing it and cancelled without erasing it", async ({ page }) => {
  await page.goto("/en/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Dinner in Karaköy/ }).click();
  await page.getByRole("link", { name: "Change" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Change expense" })).toBeVisible();
  await expect(page.getByLabel("Description")).toHaveValue("Dinner in Karaköy");
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("2480.00");
  await expect(page.getByRole("button", { name: "Eating out" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Amount", { exact: true }).fill("2000");
  await page.getByLabel("Description").fill("Dinner in Karaköy, corrected");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(said(page, "Expense changed")).toBeVisible();

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
  await expect(said(page, "Expense cancelled")).toBeVisible();
  await expect(page.getByRole("button", { name: /corrected/ })).toContainText("cancelled");
  // Without the dinner you paid 500.00 of the taxi and owe 450 + 90.13 + 237.50 + 120.
  await expect(page.getByRole("region", { name: "Where you stand" })).toContainText("You owe");
  await expect(page.getByRole("region", { name: "Where you stand" })).toContainText("397.63 TRY");
});

test("people: roles, removing someone, and an honest word about invitations", async ({ page }) => {
  await page.goto("/en/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  await tab(page, "Settings").click();
  const people = page.getByRole("region", { name: "Manage people" });
  await expect(people.getByRole("listitem").filter({ hasText: "Deniz" })).toContainText("Manager");
  await expect(people.getByRole("listitem").filter({ hasText: "Kerem" })).toContainText("no account");
  // A guest cannot be made a manager; the owner's own role is not on offer.
  await expect(people.getByLabel("Role of Kerem")).toHaveCount(0);
  await expect(people.getByLabel("Role of Alex")).toHaveCount(0);

  await people.getByLabel("Role of Mira").selectOption("admin");
  await expect(said(page, "Role changed")).toBeVisible();
  await expect(people.getByRole("listitem").filter({ hasText: "Mira" })).toContainText("Manager");

  await people.getByRole("button", { name: "Remove: Mira" }).click();
  await people.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(people.getByRole("listitem").filter({ hasText: "Mira" })).toHaveCount(0);
  await expect(people).toContainText("the demo has none");

  // What Mira paid and owes is still in the balances, and she is not offered for new expenses.
  await tab(page, "Expenses").click();
  await expect(balances(page).filter({ hasText: "Mira" })).toContainText("left the group");
  await openAdd(page);
  await expect(page.getByLabel("Mira takes part")).toHaveCount(0);
  await expect(page.getByLabel("Deniz takes part")).toBeChecked();
});

test("a group can be renamed, archived, searched for and deleted", async ({ page }) => {
  await newGroup(page, "Temporary");
  await tab(page, "Settings").click();
  await page.getByRole("region", { name: "Group settings" }).getByLabel("Group name").fill("Renamed group");
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Renamed group" })).toBeVisible();

  await page.getByRole("button", { name: "Archive group" }).click();
  await expect(page.getByText("This group is archived")).toBeVisible();
  await expect(page.getByLabel("Add someone by name")).toHaveCount(0);
  await tab(page, "Expenses").click();
  await expect(main(page).getByRole("link", { name: "Add expense" })).toHaveCount(0);

  await page.goto("/en/demo/groups", { waitUntil: "networkidle" });
  await page.getByLabel("Search groups").fill("renamed");
  await expect(page.getByRole("link", { name: /Renamed group/ })).toContainText("Archived");
  await expect(page.getByRole("link", { name: /Istanbul weekend/ })).toHaveCount(0);
  await page.getByLabel("Search groups").fill("zzz");
  await expect(page.getByText("No group matches “zzz”.")).toBeVisible();

  await page.getByLabel("Search groups").fill("renamed");
  await page.getByRole("link", { name: /Renamed group/ }).click();
  await tab(page, "Settings").click();
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
  await expect(said(page, "The demo is as it started")).toBeVisible();
  await page.goto("/en/demo/groups", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: /Mine/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Istanbul weekend/ })).toBeVisible();

  await page.goto("/en/demo/groups/no-such-group", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "No such group" })).toBeVisible();
});

test("in Russian the same screens speak Russian, amounts included", async ({ page }) => {
  await page.goto("/ru/demo", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Привет, Алексей!" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Выходные в Стамбуле" })).toContainText(/Общие расходы группы5\s560,50\sTRY/);

  await page.goto("/ru/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Выходные в Стамбуле" })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveText(["Расходы", "Долги1", "Аналитика", "Настройки"]);
  await expect(page.getByRole("region", { name: "Ваш баланс" })).toContainText("Вам должны");
  await expect(page.getByRole("region", { name: "Ваш баланс" })).toContainText(/1\s462,37\sTRY/);
  await main(page).getByRole("link", { name: "Добавить расход" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Новый расход" })).toBeVisible();
  await page.getByRole("button", { name: "Добавить расход", exact: true }).click();
  await expect(main(page).getByRole("alert")).toContainText(["Введите сумму больше нуля", "Напишите, на что потрачено"]);
  expect(await overflow(page)).toBe(0);
});

test("no screen is wider than the display, and its controls are big enough for a thumb", async ({ page, isMobile }) => {
  for (const path of [
    "/en/demo",
    "/en/demo/groups",
    "/en/demo/groups/demo-istanbul",
    "/en/demo/add?group=demo-istanbul",
    "/ru/demo/groups/demo-flat",
    "/ru/demo/add?group=demo-flat",
    "/ru",
  ]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("main h1")).toBeVisible();
    if (path.includes("/add")) {
      // The widest the form gets: a box per person and a row per payer.
      await page.locator("label:has(input[name=split-mode])").nth(1).click();
      await page.locator("label:has(input[type=checkbox])").nth(1).click();
    }
    if (path.includes("/groups/demo-")) await page.getByRole("tab").last().click();
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

test("the look of the concept: the deep green card and rail, faces for people, pictures for categories", async ({ page, isMobile }) => {
  await page.goto("/en/demo", { waitUntil: "networkidle" });
  const card = page.getByRole("region", { name: "Istanbul weekend" });
  // Deep green in the light theme and in the dark one: the card does not turn pale when the page turns dark.
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const [background, color] = await card.evaluate((element) => [
      getComputedStyle(element).backgroundImage,
      getComputedStyle(element).color,
    ]);
    expect([scheme, /gradient/.test(background), color]).toEqual([scheme, true, "rgb(255, 255, 255)"]);
  }
  // Three faces and "+1" for the four people of the group.
  await expect(card.locator("svg[viewBox='0 0 40 40']")).toHaveCount(3);
  await expect(card).toContainText("+1");
  if (!isMobile)
    expect(await page.locator("aside").evaluate((element) => /gradient/.test(getComputedStyle(element).backgroundImage))).toBe(true);

  // Different people get different faces.
  await page.goto("/en/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  const faces = await balances(page).evaluateAll((rows) => rows.map((row) => row.querySelector("svg")?.innerHTML));
  expect(new Set(faces).size).toBe(faces.length);
});

test("a face is the person's photo when there is one, and a drawing when there is not or it fails to load", async ({ page }) => {
  // The demo has only drawings. To see a photo and a dead address, two are written into the demo's own stored data.
  await page.goto("/en/demo/groups/demo-istanbul", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await page.getByLabel("Role of Mira").selectOption("admin");
  await expect(page.getByRole("status").filter({ hasText: "Role changed" })).toBeVisible();
  const pixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  await page.evaluate((photo) => {
    const state = JSON.parse(localStorage.getItem("splitly-demo-v1")!);
    const members = state.groups.find((group: { id: string }) => group.id === "demo-istanbul").members;
    members.find((member: { id: string }) => member.id === "t-deniz").photoUrl = photo;
    members.find((member: { id: string }) => member.id === "t-mira").photoUrl = "/no-such-photo.jpg";
    localStorage.setItem("splitly-demo-v1", JSON.stringify(state));
  }, pixel);
  await page.reload({ waitUntil: "networkidle" });

  const row = (name: string) => page.getByRole("region", { name: "People", exact: true }).getByRole("listitem").filter({ hasText: name });
  await expect(row("Deniz").locator("img")).toHaveAttribute("src", pixel);
  await expect(row("Deniz").locator("img")).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(row("Deniz").locator("svg")).toHaveCount(0);
  // The dead address: the picture is dropped and the drawn face takes its place.
  await expect(row("Mira").locator("img")).toHaveCount(0);
  await expect(row("Mira").locator("svg")).toHaveCount(1);
  // No photo at all: a drawing from the start.
  await expect(row("Alex").locator("svg")).toHaveCount(1);
});

test("the pictures a page may load: its own, and profile photos from Telegram's servers", async ({ request }) => {
  const policy = (await request.get("/en")).headers()["content-security-policy"];
  expect(policy).toMatch(
    /img-src 'self' data: blob: https:\/\/t\.me https:\/\/\*\.telegram\.org https:\/\/\*\.telesco\.pe https:\/\/\*\.telegram-cdn\.org;/,
  );
  const cover = await request.get("/illustrations/friends.svg");
  expect([cover.status(), cover.headers()["content-type"]]).toEqual([200, "image/svg+xml"]);
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

test("privacy is said in plain words, and a usual currency is remembered on the device", async ({ page }) => {
  await page.goto("/en", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "What Splitly keeps, and what it does not" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "In the browser demo",
    "When you sign in through Telegram",
    "Groups and expenses",
    "Receipts",
    "What is not there",
    "Deleting",
  ]);
  await expect(page.getByRole("main")).toContainText("It is never uploaded and never stored.");
  await page.goto("/ru/privacy", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Что Splitly хранит и чего не хранит" })).toBeVisible();

  // The currency chosen in the profile is the one offered for a new group, after a reload too.
  await page.goto("/en/demo/profile", { waitUntil: "networkidle" });
  await expect(page.getByRole("combobox", { name: "Your usual currency" })).toHaveValue("TRY");
  await page.getByRole("combobox", { name: "Your usual currency" }).selectOption("GBP");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("combobox", { name: "Your usual currency" })).toHaveValue("GBP");
  await page.getByRole("main").getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/en\/privacy$/);
  await page.goto("/en/demo/groups", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New group" }).click();
  await expect(page.getByLabel("Main currency")).toHaveValue("GBP");
});
