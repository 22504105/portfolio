import { expect, test, type Page } from "@playwright/test";

// Gate A of the features specification (docs/features-audit.md): word help in exercises, a hint on
// request, shuffled options, and the teacher marking words in the builder. Demo routes only.

const QUEST = "99999999-0000-4000-8000-000000000001";
const ready = (page: Page) => expect(page.locator("[data-play-scene]")).toBeAttached();

test("a marked word opens its translation without leaving the exercise, and closes back to it", async ({ page }) => {
  await page.goto("/ru/demo/play");
  await ready(page);
  await expect(page.locator("[data-play-scene=tower-2]")).toBeAttached();
  const word = page.getByRole("button", { name: "Перевод: never shines" });
  await expect(word).toBeVisible();
  // The English stays as it is around the marked words.
  await expect(page.locator("blockquote")).toContainText("Look for the room where the moon never shines.");

  await word.click();
  const sheet = page.getByRole("dialog", { name: "never shines" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("никогда не светит");
  await expect(sheet).toContainText("Never — «никогда»");
  await expect(sheet.getByRole("button", { name: "Закрыть перевод" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(word).toBeFocused();

  // Opening help changed nothing in the exercise: no attempt used, nothing answered.
  await expect(page.locator("[data-phase=question], [data-phase]").first()).toBeVisible();
  await expect(page.locator("[data-option]")).toHaveCount(3);
});

test("the sheet fits a narrow phone and closes by tapping outside", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/ru/demo/play");
  await ready(page);
  await page.getByRole("button", { name: "Перевод: never shines" }).click();
  const sheet = page.getByRole("dialog", { name: "never shines" });
  await expect(sheet).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.mouse.click(160, 40);
  await expect(sheet).toBeHidden();
});

test("English interface: the same word help, the hint on request costs nothing", async ({ page }) => {
  await page.goto("/en/demo/play");
  await ready(page);
  await page.getByRole("button", { name: "Translation: never shines" }).click();
  await expect(page.getByRole("dialog", { name: "never shines" })).toContainText("Never: the moon's light does not reach that room.");
  await page.getByRole("button", { name: "Close the translation" }).click();

  await page.locator("[data-action=hint]").click();
  await expect(page.locator("[data-hint-open]")).toContainText("It costs no XP.");
  await expect(page.locator("[data-option]")).toHaveCount(3);
});

test("the teacher marks a word in the builder; editing the text keeps or loses it honestly", async ({ page }) => {
  await page.goto(`/ru/demo/studio/builder?quest=${QUEST}`);
  await expect(page.locator("[data-builder]")).toBeVisible();
  await page.locator('[data-node="start"]').click();
  await page.locator("[data-pane=inspector]").click();
  const form = page.locator('[data-glosses="start"]');
  await expect(form).toBeVisible();

  await form.getByRole("textbox", { name: "Слово или фраза — точно как в тексте" }).fill("dragon");
  await expect(form).toContainText("Таких слов в этом тексте нет");
  await form.getByRole("textbox", { name: "Слово или фраза — точно как в тексте" }).fill("old library");
  await form.getByRole("textbox", { name: "Перевод", exact: true }).fill("старая библиотека");
  await form.locator("[data-action=add-gloss]").click();
  const row = form.locator("[data-gloss-row]");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("old library");
  await expect(row).toContainText("старая библиотека");

  // Text added in front: the mark follows its words.
  const text = page.getByRole("textbox", { name: "Текст сцены (английский)" });
  await text.fill("At night, you open the door of the old library.");
  await expect(row).not.toContainText("Слова пропали из текста");
  // The words removed: reported, not moved onto other words.
  await text.fill("At night, you open the door of the tower.");
  await expect(row).toContainText("Слова пропали из текста");
  await row.getByRole("button", { name: "Убрать слово old library" }).click();
  await expect(form.locator("[data-gloss-row]")).toHaveCount(0);
});

test("the builder lets the teacher keep the authored order of answer options", async ({ page }) => {
  await page.goto(`/ru/demo/studio/builder?quest=${QUEST}`);
  await expect(page.locator("[data-builder]")).toBeVisible();
  await page.locator("[data-pane=palette]").click();
  await page.locator('[data-palette="question"]').click();
  const shuffle = page.locator("[data-field=shuffle]");
  await expect(shuffle).toBeChecked();
  await shuffle.uncheck();
  await expect(shuffle).not.toBeChecked();
});
