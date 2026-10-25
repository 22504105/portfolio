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
