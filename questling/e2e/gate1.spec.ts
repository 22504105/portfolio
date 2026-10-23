import { expect, test, type Page } from "@playwright/test";

// Gate 1: the demo Home and the story player work as the approved screens
// describe, at every phone width the brief names, without sideways scrolling.

async function noHorizontalOverflow(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, "page must not scroll sideways").toBeLessThanOrEqual(client);
}

test("the site opens on the demo home, labelled as a demo", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/demo\/home$/);
  await expect(page.locator("[data-demo-badge]")).toHaveText("Демо");
  await expect(page.getByRole("heading", { name: "Мяулин Чародей" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Опыт" })).toHaveAttribute("aria-valuenow", "340");
});

for (const width of [320, 360, 390, 430]) {
  test(`home and player fit a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/demo/home");
    await noHorizontalOverflow(page);
    // The bottom bar stays on screen and the last section can scroll clear of it.
    await expect(page.getByRole("link", { name: "Главная" })).toBeInViewport();
    await page.goto("/demo/play");
    await noHorizontalOverflow(page);
  });
}

test("continue on home opens the story player", async ({ page }) => {
  await page.goto("/demo/home");
  await page.getByRole("link", { name: /Продолжить/ }).click();
  await expect(page).toHaveURL(/\/demo\/play$/);
  await expect(page.getByText("Look for the room where the moon never shines.")).toBeVisible();
});

test("a correct answer grants the reward and offers the next clue", async ({ page }) => {
  await page.goto("/demo/play");
  const check = page.locator("[data-action=check]");
  await expect(check).toBeDisabled();
  await page.getByRole("radio", { name: /The cellar/ }).click();
  await expect(page.getByRole("radio", { name: /The cellar/ })).toHaveAttribute("aria-checked", "true");
  await check.click();
  await expect(page.locator("[data-phase=correct]")).toBeVisible();
  await expect(page.getByText("Верно!")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("+50 XP");
  await expect(page.getByRole("link", { name: /К следующей улике/ })).toBeVisible();
});

test("a wrong answer explains itself, then a retry can still solve the clue", async ({ page }) => {
  await page.goto("/demo/play");
  await page.getByRole("radio", { name: /The garden/ }).click();
  await page.locator("[data-action=check]").click();
  await expect(page.locator("[data-phase=incorrect]")).toBeVisible();
  await expect(page.getByText("Попытка 1 из 2")).toBeVisible();
  await expect(page.getByText("НЕВЕРНО")).toBeVisible();
  await expect(page.getByText(/В саду лунный свет/)).toBeVisible();

  await page.getByRole("button", { name: /Перечитать манускрипт/ }).click();
  await expect(page.getByText("Ищите комнату, где никогда не светит луна.")).toBeVisible();

  await page.getByRole("button", { name: /Попробовать снова/ }).click();
  await expect(page.locator("[data-phase=answering]")).toBeVisible();
  // The wrong option stays listed, struck out and no longer choosable; the right one solves the clue.
  await expect(page.getByRole("radio", { name: /The garden/ })).toHaveCount(0);
  await expect(page.getByText("The garden")).toBeVisible();
  await page.getByRole("radio", { name: /The cellar/ }).click();
  await page.locator("[data-action=check]").click();
  await expect(page.locator("[data-phase=correct]")).toBeVisible();
});

test("the back arrow returns home", async ({ page }) => {
  await page.goto("/demo/play");
  await page.getByRole("link", { name: "Назад" }).click();
  await expect(page).toHaveURL(/\/demo\/home$/);
});
