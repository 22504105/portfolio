import { expect, test } from "@playwright/test";

// Gate 4: the demo Teacher Studio, on a desktop. The demo runs the same rules as the server
// (lib/studio/ops.ts) in the browser, so these walk the real flows: a group made and given a
// campaign, a draft edited, saved, published and played in the sandbox preview.

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

const QUEST = "99999999-0000-4000-8000-000000000001";

test.beforeEach(async ({ page }) => {
  await page.goto("/ru/demo/studio");
  await page.evaluate(() => window.localStorage.clear());
});

test("the builder edits, autosaves and publishes a draft, and the preview plays it", async ({ page }) => {
  await page.goto(`/ru/demo/studio/builder?quest=${QUEST}`);
  await expect(page.locator("[data-builder]")).toBeVisible();
  await expect(page.locator("[data-node]")).toHaveCount(3);

  // A question added after the start scene, with a wrong scene picked first.
  await page.locator('[data-node="start"]').click();
  await page.locator('[data-palette="question"]').click();
  await expect(page.locator("[data-node]")).toHaveCount(4);
  await expect(page.locator('[data-node="question-2"]')).toBeVisible();
  await expect(page.locator("[data-save]")).toHaveAttribute("data-save", "saved", { timeout: 10_000 });
  await expect(page.locator("[data-validator]")).toHaveAttribute("data-validator", "0");

  // Editing the text in the inspector is a change that is saved too.
  await page.getByRole("textbox", { name: /Текст подсказки/ }).fill("The key is on the shelf.");
  await expect(page.locator("[data-save]")).toHaveAttribute("data-save", "saved", { timeout: 10_000 });

  // Published: the draft becomes v2; the library shows it.
  await page.locator('[data-action="publish"]').click();
  await expect(page.getByText("Опубликовано: v2")).toBeVisible();
  await page.goto("/ru/demo/studio/library");
  await expect(page.locator('[data-library="t-tajna-chasov-demo01"]')).toContainText("v2 Опубликована");

  // The preview plays the campaign in the sandbox, from its first scene.
  await page.goto(`/ru/demo/studio/builder?quest=${QUEST}`);
  await page.locator('[data-action="preview"]').click();
  await expect(page.locator("[data-preview]")).toBeVisible();
  await expect(page.locator("[data-preview]")).toContainText("You open the door of the old library.");
});

test("a broken link is caught by the validator and blocks publishing", async ({ page }) => {
  await page.goto(`/ru/demo/studio/builder?quest=${QUEST}`);
  await page.locator('[data-node="question-1"]').click();
  // Its grimoire answer is set to a word that is not among the grimoire's options.
  await page.getByText(/Гримуар \(возврат попытки\)/).click();
  await page.getByRole("textbox", { name: /Слова \(через \|\)/ }).fill("at | in");
  await expect(page.locator("[data-validator]")).not.toHaveAttribute("data-validator", "0");
  await expect(page.locator('[data-action="publish"]')).toBeDisabled();
});

test("the mentor answers a help request; it leaves the queue", async ({ page }) => {
  await page.goto("/ru/demo/studio/analytics");
  const first = page.locator("[data-request]").first();
  await expect(first).toBeVisible();
  const before = await page.locator("[data-request]").count();
  await page.getByRole("textbox", { name: /Комментарий наставника/ }).fill("Перечитай свиток: подсказка в первом предложении.");
  await page.locator('[data-action="send-reply"]').click();
  await expect(page.getByText("Ответ отправлен: ученик увидит его в Questling.")).toBeVisible();
  // Answered requests are hidden unless asked for; the one on screen stays until another is picked.
  await page.locator("[data-request]").last().click();
  await expect(page.locator("[data-request]")).toHaveCount(before - 1);
});

test("a teacher schedules the word of the day for the group", async ({ page }) => {
  await page.goto("/ru/demo/studio/analytics");
  await page.locator('[data-tab="daily"]').click();
  const daily = page.locator("[data-daily]");
  await daily.locator('input[name="word"]').fill("lantern");
  await page.locator('[data-action="save-daily"]').click();
  await expect(daily.getByText("Заполните все поля и отметьте верный вариант.")).toBeVisible();
  const fields = daily.locator("input:not([type=date]):not([type=radio]), textarea");
  const values = [
    "lantern",
    "ˈlæntən",
    "фонарь",
    "lantern",
    "The lantern shines.",
    "Lanterns",
    "Old lanterns burned oil.",
    "Старые фонари жгли масло.",
    "Old lanterns burned oil.",
    "History book",
    "What did old lanterns burn?",
    "oil",
    "water",
    "sand",
  ];
  for (const [i, value] of values.entries()) await fields.nth(i).fill(value);
  await page.locator('[data-action="save-daily"]').click();
  await expect(daily.getByText("Сохранено", { exact: true })).toBeVisible();
  await expect(daily.getByText(/lantern • Lanterns/)).toBeVisible();
});

test("a published campaign is assigned to a group from the library", async ({ page }) => {
  await page.goto("/ru/demo/studio/library");
  await page.locator('[data-library="t-tajna-chasov-demo01"] [data-action="assign"]').click();
  await page.getByRole("dialog").getByRole("button", { name: "Назначить" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-library="t-tajna-chasov-demo01"]')).toContainText("«Детективы A2»");
});
