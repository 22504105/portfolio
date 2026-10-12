import { expect, test, type Page } from "@playwright/test";

// Stage 3 in a real browser: a photo of a receipt is read on the device by
// the real recogniser (no stand-in), checked, given out line by line and
// stored as one expense. The receipts are invented and drawn by
// scripts/receipt-fixtures.mjs. On the demo; the server's side of it is
// tested against a real database in tests/db/api.test.ts.

test.describe.configure({ timeout: 90_000 });

const fixture = (name: string) => `e2e/fixtures/${name}.png`;
const main = (page: Page) => page.getByRole("main");
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const names = (page: Page) =>
  page.getByLabel(/^Name of line/).evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
const amounts = (page: Page) =>
  page.getByLabel(/^Amount of/).evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
const who = (page: Page, item: string) => page.getByRole("group", { name: `Who had ${item}` });

/** Chooses a photo and has it read; lands on the review screen or back on the first one with a complaint. */
async function read(page: Page, name: string, language: "tur" | "eng" | "rus", path = "/en/demo/scan?group=demo-istanbul") {
  await page.goto(path, { waitUntil: "networkidle" });
  await page
    .locator("select")
    .filter({ has: page.locator("option[value=tur]") })
    .selectOption(language);
  await page.locator("input[type=file]").setInputFiles(fixture(name));
  await page.locator("main img").waitFor();
  await page
    .locator("main button")
    .filter({ has: page.locator("svg.lucide-scan-line") })
    .click();
  // Reading takes a second or two alone, and longer when several tests read at once.
  await page
    .locator("main h1")
    .filter({ hasText: /Check the receipt|Проверка чека/ })
    .or(page.getByRole("main").getByRole("alert"))
    .first()
    .waitFor({ timeout: 60_000 });
}

test("the concept's receipt, start to finish: read on the device, checked, given out, stored", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== "http://localhost:3300" || url.pathname.startsWith("/api/v1")) outside.push(request.url());
  });

  await read(page, "receipt-tr", "tur");
  await expect(page.getByRole("heading", { level: 1, name: "Check the receipt" })).toBeVisible();
  await expect(page.getByText("The receipt was read")).toBeVisible();
  // Five things bought, named in English from the word list, each with the printed Turkish kept under it.
  expect(await names(page)).toEqual(["Milk 1 l", "Chicken breast", "Bread", "Cheese", "Laundry detergent"]);
  expect(await amounts(page)).toEqual(["80.00", "360.00", "40.00", "240.00", "480.00"]);
  await expect(page.getByText("As printed: TAVUK GÖĞSÜ")).toBeVisible();
  await expect(page.getByTestId("scan-sum")).toHaveText(/1,200\.00\sTRY/);
  await expect(page.getByText("The lines add up to the receipt's total.")).toBeVisible();
  await expect(page.getByText(/reports 96\.12\sTRY of tax already inside its prices/)).toBeVisible();
  expect(await overflow(page)).toBe(0);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Who had what" })).toBeVisible();
  // Nobody is assumed: nothing is owed until lines are given out, and it cannot be stored like that.
  await expect(page.getByTestId("owed-t-mira")).toHaveText(/^0\.00\sTRY$/);
  await page.getByRole("button", { name: "Create the expense" }).click();
  await expect(main(page).getByRole("alert")).toHaveCount(5);
  await expect(page.getByText("Lines still to give out: 5")).toBeVisible();

  // The concept's own split: milk, bread and detergent for everyone; the chicken and the cheese are Mira's.
  for (const item of ["Milk 1 l", "Bread", "Laundry detergent"])
    await who(page, item).getByRole("button", { name: "Everyone (4)" }).click();
  for (const item of ["Chicken breast", "Cheese"]) await page.getByRole("button", { name: `Mira had ${item}` }).click();
  await expect(main(page).getByRole("alert")).toHaveCount(0);
  await expect(page.getByTestId("owed-t-you")).toHaveText(/^150\.00\sTRY$/);
  await expect(page.getByTestId("owed-t-mira")).toHaveText(/^750\.00\sTRY$/);
  expect(await overflow(page)).toBe(0);

  await page.getByRole("button", { name: "Create the expense" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "The receipt is split!" })).toBeVisible();
  await expect(main(page)).toContainText(/1,200\.00\sTRY/);
  await expect(page.getByRole("list", { name: "Who owes whom" }).getByRole("listitem")).toHaveText([
    /Deniz.*Alex.*150\.00\sTRY/,
    /Mira.*Alex.*750\.00\sTRY/,
    /Kerem.*Alex.*150\.00\sTRY/,
  ]);

  await page.getByRole("link", { name: "See the group" }).click();
  const expense = page.getByRole("button", { name: /Receipt/ });
  await expect(expense).toContainText(/1,200\.00\sTRY/);
  await expect(expense).toContainText(/your share 150\.00\sTRY/);
  await expense.click();
  await expect(page.getByText("From a receipt")).toBeVisible();
  await expect(main(page)).toContainText("Chicken breast · Mira");
  await expect(main(page)).toContainText("Milk 1 l · Everyone (4)");
  // You paid 1,200 and owe 150 of it: 1,050 more owed to you than before (1,462.37).
  await expect(page.getByRole("region", { name: "Where you stand" })).toContainText(/2,512\.37\sTRY/);

  // The photo and what was read from it went nowhere: every request was to this site, and none to the data API.
  expect(outside).toEqual([]);
});

test("an English bill and a Russian receipt are read with their discounts, and Russian words are shown to a Russian reader", async ({
  page,
}) => {
  await read(page, "receipt-en", "eng");
  await expect(page.getByRole("heading", { level: 1, name: "Check the receipt" })).toBeVisible();
  expect(await amounts(page)).toEqual(["9.00", "24.50", "12.00", "34.50", "4.55", "5.12"]);
  expect((await names(page)).slice(0, 4)).toEqual(["Lentil soup", "Salmon", "Cola", "Wine"]);
  // 9.00 + 24.50 + 12.00 + 34.50 − 4.55 + 5.12.
  await expect(page.getByTestId("scan-sum")).toHaveText(/^80\.57\sTRY$/);
  await expect(page.getByText("The lines add up to the receipt's total.")).toBeVisible();

  await read(page, "receipt-ru", "rus");
  expect(await amounts(page)).toEqual(["89.90", "54.00", "116.40", "312.50", "30.00"]);
  await expect(page.getByTestId("scan-sum")).toHaveText(/^542\.80\sTRY$/);

  // The Turkish receipt, for someone reading in Russian.
  await read(page, "receipt-tr", "tur", "/ru/demo/scan?group=demo-istanbul");
  await expect(page.getByRole("heading", { level: 1, name: "Проверка чека" })).toBeVisible();
  expect(
    await page.getByLabel(/^Название строки/).evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
  ).toEqual(["Молоко 1 л", "Куриное филе", "Хлеб", "Сыр", "Средство для стирки"]);
  await expect(page.getByText("В чеке: PEYNIR")).toBeVisible();
  expect(await overflow(page)).toBe(0);
});

test("a receipt that does not add up cannot go on until the difference is corrected or recorded", async ({ page }) => {
  await read(page, "receipt-tr", "tur");
  await page.getByLabel("Amount of Bread").fill("45");
  await expect(page.getByText(/The lines add up to 5\.00\sTRY more than the receipt says\./)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(main(page).getByRole("alert")).toHaveText("The lines must add up to the receipt's total before going on.");
  await expect(page.getByRole("heading", { level: 1, name: "Check the receipt" })).toBeVisible();

  // An amount that is not one is refused, not guessed at.
  await page.getByLabel("Amount of Bread").fill("4O");
  await expect(main(page).getByRole("alert").first()).toHaveText("Type an amount above zero, like 1250 or 12,50.");
  await page.getByLabel("Amount of Bread").fill("30");
  await expect(page.getByText(/The receipt says 10\.00\sTRY more than the lines\./)).toBeVisible();

  // The other way out: say what the difference is, as a line of its own.
  await page.getByRole("button", { name: /Add a correction of \+?10\.00\sTRY/ }).click();
  await expect(page.getByText("The lines add up to the receipt's total.")).toBeVisible();
  expect((await names(page)).at(-1)).toBe("Difference from the receipt's total");

  // A line renamed by the person, a line removed and one added.
  await page.getByLabel("Name of line 1").fill("Oat milk");
  await page.getByRole("button", { name: "Remove Cheese" }).click();
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Name of line 6").fill("Kashar");
  await page.getByLabel("Amount of Kashar").fill("240,00");
  await expect(page.getByText("The lines add up to the receipt's total.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Who had what" })).toBeVisible();
  // The correction is spread over everyone in proportion to what they had, unless given to someone.
  await expect(page.getByText("Spread over everyone in proportion to what they had.")).toBeVisible();
  await expect(who(page, "Oat milk")).toBeVisible();
});

test("when reading fails there is always a way on by hand, and what is not a photo is refused with the reason", async ({ page }) => {
  // Out of focus: nothing with a price is found, and it says what to try.
  await read(page, "receipt-tr-blurred", "tur");
  await expect(main(page).getByRole("alert")).toContainText("Nothing that looks like a priced line was found.");
  // Something that is not a receipt at all.
  await read(page, "not-a-receipt", "eng");
  await expect(main(page).getByRole("alert")).toContainText("Nothing that looks like a priced line was found.");

  // A PDF, an empty file and a file that only claims to be a picture.
  const picker = page.locator("input[type=file]");
  await picker.setInputFiles({ name: "receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(main(page).getByRole("alert")).toContainText("PDFs are not supported");
  await picker.setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not a picture at all") });
  await expect(main(page).getByRole("alert")).toContainText("The picture could not be opened.");

  // By hand: the same screens, with the lines typed in.
  await page.getByRole("button", { name: "Enter the lines by hand" }).first().click();
  await expect(page.getByText("Entering a receipt by hand")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(main(page).getByRole("alert")).toHaveText("Add at least one thing that was bought.");
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Name of line 1").fill("Fish");
  await page.getByLabel("Amount of Fish").fill("900");
  await page.getByRole("button", { name: "Tip" }).click();
  await page.getByLabel("Amount of Tip").fill("90");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Alex had Fish" }).click();
  await page.getByRole("button", { name: "Deniz had Fish" }).click();
  // 900 between two, and the tip follows what each had.
  await expect(page.getByTestId("owed-t-you")).toHaveText(/^495\.00\sTRY$/);
  await expect(page.getByTestId("owed-t-deniz")).toHaveText(/^495\.00\sTRY$/);
  await page.getByLabel("Who paid?").selectOption({ label: "Deniz" });
  await page.getByLabel("Description").fill("Fish restaurant");
  await page.getByRole("button", { name: "Create the expense" }).click();
  await expect(page.getByRole("list", { name: "Who owes whom" }).getByRole("listitem")).toHaveText([/Alex.*Deniz.*495\.00\sTRY/]);
  await page.getByRole("button", { name: "Scan another receipt" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Scan a receipt" })).toBeVisible();
});

test("the same photo twice is noticed, and added again only on purpose", async ({ page }) => {
  const once = async () => {
    await read(page, "receipt-en", "eng");
    await page.getByRole("button", { name: "Continue" }).click();
    for (const item of ["Lentil soup", "Salmon", "Cola", "Wine"])
      await who(page, item).getByRole("button", { name: "Everyone (4)" }).click();
    await page.getByRole("button", { name: "Create the expense" }).click();
  };
  await once();
  await expect(page.getByRole("heading", { level: 1, name: "The receipt is split!" })).toBeVisible();

  await once();
  await expect(page.getByRole("alertdialog")).toContainText("This receipt is already in the group");
  await page.getByRole("button", { name: "Add it again" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "The receipt is split!" })).toBeVisible();
  await page.getByRole("link", { name: "See the group" }).click();
  await expect(page.getByRole("button", { name: /Receipt/ })).toHaveCount(2);
});

test("the camera, as in the concept: a frame to aim with and a shutter", async ({ page, context }) => {
  // The browser is started with a stand-in camera (see playwright.config.ts); permission is given here.
  await context.grantPermissions(["camera"]);
  await page.goto("/en/demo/scan?group=demo-istanbul", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open the camera" }).click();
  const camera = page.getByRole("dialog", { name: "Open the camera" });
  await expect(camera.getByText("Fit the receipt in the frame")).toBeVisible();
  await expect(camera.getByRole("button", { name: "Take the photo" })).toBeEnabled();
  await camera.getByRole("button", { name: "Take the photo" }).click();
  // The shot becomes the photo to read; the camera is let go of.
  await expect(camera).toHaveCount(0);
  await expect(page.getByRole("img", { name: "The photo of the receipt" })).toBeVisible();
  await page.getByRole("button", { name: "Turn" }).click();
  await page.getByRole("button", { name: "Sharpen" }).click();
  await expect(page.getByRole("button", { name: "Sharpen" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Another photo" }).click();
  await page.getByRole("button", { name: "Open the camera" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the scanner's screens fit a phone and its controls are big enough for a thumb", async ({ page, isMobile }) => {
  const check = async (where: string) => {
    expect([where, await overflow(page)]).toEqual([where, 0]);
    if (!isMobile) return;
    const small = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "main a, main button, main select, main input:not([type=checkbox]):not([type=radio]):not([type=file]), main summary",
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
  await page.goto("/ru/demo/scan?group=demo-istanbul", { waitUntil: "networkidle" });
  await check("capture");
  await read(page, "receipt-tr", "tur", "/ru/demo/scan?group=demo-istanbul");
  await page.getByRole("heading", { level: 1, name: "Проверка чека" }).waitFor();
  await check("review");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("heading", { level: 1, name: "Распределение покупок" }).waitFor();
  await check("assign");
});

test("the reader is served by the site itself, and the page may compile it but nothing else", async ({ request }) => {
  for (const file of [
    "worker.min.js",
    "core/tesseract-core-simd-lstm.wasm.js",
    "lang/tur.traineddata.gz",
    "lang/eng.traineddata.gz",
    "lang/rus.traineddata.gz",
  ]) {
    expect([file, (await request.head(`/ocr/${file}`)).status()]).toEqual([file, 200]);
  }
  const policy = (await request.get("/en/demo/scan")).headers()["content-security-policy"];
  expect(policy).toContain("'wasm-unsafe-eval'");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).toMatch(/connect-src 'self';/);
  expect(policy).toMatch(/worker-src 'self' blob:;/);
});
