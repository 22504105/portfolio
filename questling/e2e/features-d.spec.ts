import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Gate D (docs/features-audit.md): the word journal, reviews and practice suggestions, on the demo
// student (who kept three words a few days ago, so they are due today).

test("a word kept from the story's word help shows in the journal, and the journal is reachable from the profile", async ({ page }) => {
  await page.goto("/ru/demo/play");
  await expect(page.locator("[data-play-scene=tower-2]")).toBeAttached();
  await page.getByRole("button", { name: "Перевод: never shines" }).click();
  const sheet = page.getByRole("dialog", { name: "never shines" });
  await sheet.locator("[data-action=keep-word]").click();
  await expect(sheet.locator("[data-kept]")).toContainText("В словаре");
  await sheet.getByRole("link", { name: "Открыть словарь" }).click();
  await expect(page).toHaveURL(/\/ru\/demo\/words$/);
  await expect(page.locator("[data-word-list]")).toContainText("never shines");
  await expect(page.locator("[data-word-list]")).toContainText("никогда не светит");

  await page.goto("/ru/demo/profile");
  await page.getByRole("link", { name: /Мой словарь/ }).click();
  await expect(page).toHaveURL(/\/ru\/demo\/words$/);
});

test("today's review: pick a meaning, see the right one, nothing is taken for a mistake", async ({ page }) => {
  await page.goto("/ru/demo/words");
  await expect(page.locator("[data-review-card]")).toContainText("Сегодня к повторению: 3");
  await page.locator("[data-action=start-review]").click();
  const review = page.locator("[data-review]");
  await expect(review).toBeVisible();
  await expect(review.locator("[data-option]")).toHaveCount(4);
  for (let i = 0; i < 3; i++) {
    await review.locator("[data-option]").first().click();
    await expect(review.getByRole("status")).toContainText(/Верно|Не совсем/);
    await review.locator("[data-action=next-word]").click();
  }
  await expect(page.locator("[data-review-card]")).toContainText("Сегодня повторять нечего");
});

test("search, filters and flags work on the kept words", async ({ page }) => {
  await page.goto("/ru/demo/words");
  const list = page.locator("[data-word-list]");
  await expect(list.locator("[data-word]")).toHaveCount(3);
  await page.getByRole("searchbox", { name: "Поиск по словарю" }).fill("архивариус");
  await expect(list.locator("[data-word]")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Поиск по словарю" }).fill("");
  await page.getByRole("button", { name: "В избранное: archivist" }).click();
  await page.locator("[data-filter=favorite]").click();
  await expect(list.locator("[data-word]")).toHaveCount(1);
  await page.locator("[data-filter=daily]").click();
  await expect(list.locator("[data-word]")).toHaveCount(1);
  await page.locator("[data-filter=all]").click();
  await page.getByRole("button", { name: "Удалить из словаря: archivist" }).click();
  await expect(list.locator("[data-word]")).toHaveCount(2);
});

test("the journal passes axe and fits a 320px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/ru/demo/words");
  await expect(page.locator("[data-screen=words]")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude(".material-symbols-outlined")
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
});

test("studio: the group's gaps show counts only, the teacher can turn suggestions off and tag a task", async ({ page }) => {
  await page.goto("/ru/demo/studio/analytics");
  await expect(page.locator("[data-gaps]")).toBeVisible();
  await page.goto("/ru/demo/studio/groups");
  const toggle = page.locator("[data-field=recommend]");
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();

  await page.goto("/ru/demo/studio/builder?quest=99999999-0000-4000-8000-000000000001");
  await page.locator("[data-pane=palette]").click();
  await page.locator('[data-palette="question"]').click();
  await page.locator("[data-field=objective]").selectOption("past-simple");
  await expect(page.locator("[data-field=objective]")).toHaveValue("past-simple");
});
