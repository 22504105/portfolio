import { expect, test, type Page } from "@playwright/test";

// Gate 1, still true after Gate 2: the site opens on the demo, in the visitor's language,
// every student screen fits every phone width, and the language switch works.

async function noHorizontalOverflow(page: Page, label: string) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, `${label}: page must not scroll sideways`).toBeLessThanOrEqual(client);
}

const ready = (page: Page) => expect(page.locator("[data-student-ready]")).toBeVisible();

const SCREENS = [
  "welcome",
  "character",
  "home",
  "map",
  "quest/tower",
  "play",
  "journal",
  "quests",
  "quests/letter",
  "discovery",
  "rewards",
  "profile",
  "settings",
  "wardrobe",
  "shop",
  "inventory",
];

test.describe("a Russian browser", () => {
  test.use({ locale: "ru-RU" });
  test("opens the site on the Russian demo, labelled as a demo", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/ru\/demo\/welcome$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.locator("[data-demo-badge]")).toHaveText("Демо");
    await page.getByRole("link", { name: /Начать путешествие/ }).click();
    // The demo student has chosen a hero already, so the journey goes straight home.
    await expect(page).toHaveURL(/\/ru\/demo\/home$/);
    await expect(page.getByRole("heading", { name: "Барсик" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Опыт" })).toHaveAttribute("aria-valuenow", "340");
  });
});

test.describe("an English browser", () => {
  test.use({ locale: "en-GB" });
  test("opens the site in English", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/demo\/welcome$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("[data-demo-badge]")).toHaveText("Demo");
    await expect(page.getByRole("link", { name: /Start the journey/ })).toBeVisible();
  });
});

for (const width of [320, 360, 390, 430]) {
  test(`every student screen fits a ${width}px phone`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 844 });
    for (const screen of SCREENS) {
      await page.goto(`/ru/demo/${screen}`);
      await ready(page);
      await noHorizontalOverflow(page, screen);
    }
  });
}

test("every student screen fits in English too", async ({ page }) => {
  test.setTimeout(120_000);
  for (const screen of SCREENS) {
    await page.goto(`/en/demo/${screen}`);
    await ready(page);
    await noHorizontalOverflow(page, screen);
  }
});

test("the bottom bar leads to the four main screens", async ({ page }) => {
  await page.goto("/ru/demo/home");
  for (const [label, path] of [
    ["Сюжет", "map"],
    ["Квесты", "quests"],
    ["Профиль", "profile"],
    ["Главная", "home"],
  ]) {
    await page.locator("nav").getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`/ru/demo/${path}$`));
  }
});

test("the language is switched in settings, reached from the profile", async ({ page }) => {
  await page.goto("/ru/demo/profile");
  // One click only: a second click on the same link while the first navigation is still on its way
  // makes Next.js keep the old address (seen when this used to retry). Slow runs get the 10 s expect timeout.
  await page.getByRole("link", { name: /Настройки и Telegram ID/ }).click();
  await expect(page).toHaveURL(/\/ru\/demo\/settings$/);
  await expect(page.getByRole("radio", { name: /Русский/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /English/ }).click();
  await expect(page).toHaveURL(/\/en\/demo\/settings$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.locator("nav").getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/en\/demo\/home$/);
  await expect(page.getByRole("link", { name: /Continue/ })).toBeVisible();
});

test("the welcome screen switches the language too", async ({ page }) => {
  await page.goto("/ru/demo/welcome");
  await page.getByRole("link", { name: "Сменить язык" }).click();
  await expect(page).toHaveURL(/\/en\/demo\/welcome$/);
  await expect(page.getByRole("link", { name: /Start the journey/ })).toBeVisible();
});
