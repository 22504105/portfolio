import { expect, test, type Page } from "@playwright/test";
import { campaignKeys } from "../lib/content/campaign-keys";
import { dailyQuizKeys } from "../lib/content/daily-keys";
import { itemById } from "../lib/content/items";
import { quickQuestKeys } from "../lib/content/quick-quest-keys";
import { dailyEntry, dailyQuests, priceOf } from "../lib/game/stats";
import { dayOf } from "../lib/game/time";

// Gate 2: the student app works end to end on the demo store, with the same rules as the
// server: quick quests, the day's discovery, the story, the shop, the wardrobe, the hero.

const today = () => dayOf(new Date());
const ready = (page: Page) => expect(page.locator("[data-student-ready]")).toBeVisible();
const coins = async (page: Page) => Number(await page.locator("[data-coins]").first().innerText());

async function answerQuestion(page: Page, questId: string, questionId: string) {
  const key = quickQuestKeys[questId][questionId];
  switch (key.kind) {
    case "choice":
      await page.locator(`[data-option="${key.correct}"]`).click();
      break;
    case "multi":
      for (const id of key.correct) await page.locator(`[data-option="${id}"]`).click();
      break;
    case "fill":
      await page.locator(`[data-tile="${key.correct}"]`).click();
      break;
    case "order":
      for (const tile of key.correct) await page.locator(`[data-tile="${tile}"]`).click();
      break;
    case "match":
      for (const right of Object.values(key.correct)) await page.locator(`[data-tile="${right}"]`).click();
      break;
  }
  await page.locator("[data-action=check]").click();
  await expect(page.getByRole("status")).toContainText("Верно!");
  await page.locator("[data-action=next]").click();
}

test("a quick quest is played to the end and rewarded once", async ({ page }) => {
  const quest = dailyQuests(today())[0];
  await page.goto("/ru/demo/quests");
  await ready(page);
  const before = await coins(page);
  await page
    .locator(`[data-quest="${quest.id}"]`)
    .getByRole("link", { name: /Начать квест/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`/ru/demo/quests/${quest.id}$`));
  for (const questionId of Object.keys(quickQuestKeys[quest.id])) await answerQuestion(page, quest.id, questionId);
  await expect(page.getByRole("status")).toContainText("Квест пройден");
  await expect(page.getByRole("status")).toContainText(`+${quest.xp} XP`);
  await page.getByRole("link", { name: /К списку квестов/ }).click();
  await expect(page.locator(`[data-quest="${quest.id}"]`)).toContainText("Квест пройден");
  // The quest's coins, plus the day's bonus once all three are done (the demo had one already).
  expect(await coins(page)).toBeGreaterThanOrEqual(before + quest.coins);
});

test("a wrong answer in a quick quest shows why and allows a second try", async ({ page }) => {
  const quest = dailyQuests(today()).find((q) => q.questions[0].kind === "choice")!;
  const [question] = quest.questions;
  const key = quickQuestKeys[quest.id][question.id];
  if (key.kind !== "choice" || question.kind !== "choice") throw new Error("expected a choice question");
  await page.goto(`/ru/demo/quests/${quest.id}`);
  await ready(page);
  await page.locator(`[data-option="${question.options.find((o) => o.id !== key.correct)!.id}"]`).click();
  await page.locator("[data-action=check]").click();
  await expect(page.getByRole("status")).toContainText("Осталось попыток: 1");
  await page.locator("[data-action=next]").click();
  await expect(page.getByText("Попытка 2 из 2")).toBeVisible();
});

test("the day's discovery: the quiz until it is solved, then the reward, once", async ({ page }) => {
  const entry = dailyEntry(today());
  const right = dailyQuizKeys[entry.id].correct;
  const wrong = entry.quiz.options.find((o) => o.id !== right)!.id;
  await page.goto("/ru/demo/discovery");
  await ready(page);
  await expect(page.locator("[data-action=claim]")).toBeDisabled();
  await page.locator(`[data-option="${wrong}"]`).click();
  await expect(page.locator(`[data-option="${wrong}"]`)).toBeDisabled();
  await page.locator(`[data-option="${right}"]`).click();
  await expect(page.getByRole("status").first()).toContainText("Верно!");
  await page.locator("[data-action=claim]").click();
  await expect(page.locator("[data-action=claim]")).toContainText("Награда получена");
  await page.locator("[data-action=save-fact]").click();
  await expect(page.locator("[data-action=save-fact]")).toHaveAttribute("aria-pressed", "true");
});

test("the story: a clue solved, then the cipher, and the journal fills", async ({ page }) => {
  await page.goto("/ru/demo/map");
  await ready(page);
  await page.getByRole("link", { name: /Продолжить путь/ }).click();
  await expect(page).toHaveURL(/\/ru\/demo\/quest\/tower$/);
  await page.getByRole("link", { name: /Продолжить расследование/ }).click();
  await expect(page).toHaveURL(/\/ru\/demo\/play$/);

  await page.getByRole("radio", { name: /The cellar/ }).click();
  await page.locator("[data-action=check]").click();
  await expect(page.getByText("Верно!")).toBeVisible();
  await page.locator("[data-action=next]").click();

  // The next node is the archivist's chest: a word-order cipher.
  const order = campaignKeys["tower-3"];
  if (order.kind !== "puzzle") throw new Error("tower-3 should be a puzzle");
  for (const tile of order.order) await page.locator(`[data-tile="${tile}"]`).click();
  await page.locator("[data-action=check]").click();
  await expect(page.getByRole("status")).toContainText("Шифр разгадан!");
  await page.getByRole("link", { name: /Забрать сокровища/ }).click();
  await expect(page).toHaveURL(/\/ru\/demo\/journal$/);
  await expect(page.locator("[data-clue=manuscript]")).toBeVisible();
  await expect(page.getByText("3 / 5 найдено")).toBeVisible();
});

test("a wrong story answer explains itself, then a retry can still solve the clue", async ({ page }) => {
  await page.goto("/ru/demo/play");
  await ready(page);
  await page.getByRole("radio", { name: /The garden/ }).click();
  await page.locator("[data-action=check]").click();
  await expect(page.locator("[data-phase=incorrect]")).toBeVisible();
  await expect(page.getByText("Попытка 1 из 2")).toBeVisible();
  await page.getByRole("button", { name: /Перечитать манускрипт/ }).click();
  await expect(page.getByText("Ищите комнату, где никогда не светит луна.")).toBeVisible();
  await page.getByRole("button", { name: /Попробовать снова/ }).click();
  await expect(page.getByRole("radio", { name: /The garden/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /The cellar/ }).click();
  await page.locator("[data-action=check]").click();
  await expect(page.locator("[data-phase=correct]")).toBeVisible();
});

test("buying an item spends its coins, it can be worn, and it all survives a reload", async ({ page }) => {
  const item = itemById.get("red-bow")!;
  await page.goto("/ru/demo/shop");
  await ready(page);
  const before = await coins(page);
  await page.locator(`[data-buy="${item.id}"]`).first().click();
  await expect(page.getByRole("status")).toContainText("теперь в твоём сундуке");
  expect(await coins(page)).toBe(before - priceOf(item, today()));

  await page.goto("/ru/demo/wardrobe");
  await ready(page);
  await page.getByRole("tab", { name: "Амулеты" }).click();
  await page.locator(`[data-item="${item.id}"]`).getByRole("button", { name: "Надеть" }).click();
  await page.locator("[data-action=save-look]").click();
  await expect(page.getByRole("status")).toContainText("Образ сохранён");

  await page.reload();
  await page.goto("/ru/demo/inventory");
  await ready(page);
  await expect(page.locator("[data-equipped=neck]")).toContainText("Красный бант");
});

test("the hero is changed from the profile and shown everywhere", async ({ page }) => {
  await page.goto("/ru/demo/profile");
  await ready(page);
  await page.getByRole("link", { name: "Сменить героя" }).click();
  await expect(page).toHaveURL(/\/ru\/demo\/character$/);
  await page.locator("[data-character=fox]").click();
  await page.locator("[data-action=confirm-character]").click();
  await expect(page).toHaveURL(/\/ru\/demo\/home$/);
  await expect(page.getByRole("heading", { name: "Рен" })).toBeVisible();
  await page.goto("/ru/demo/profile");
  await expect(page.getByRole("link", { name: "Сменить героя" })).toContainText("Рен");
});

test("the weekly chest opens once its five quests are done, and names what is inside", async ({ page }) => {
  await page.goto("/ru/demo/rewards");
  await ready(page);
  const chest = page.locator("[data-action=open-chest]");
  await expect(chest).toContainText("Внутри: «Полуночный плащ»");
  if (await chest.isEnabled()) {
    await chest.click();
    await expect(chest).toContainText("Получено: «Полуночный плащ»");
    await expect(chest).toBeDisabled();
  } else {
    await expect(chest).toContainText("Квестов до вскрытия");
  }
  await expect(page.locator("[data-achievement=first-clue]")).toHaveAttribute("data-earned", "true");
});

test("outside Telegram the real app says so and offers the demo", async ({ page }) => {
  await page.goto("/ru/app");
  await expect(page.locator("[data-live-gate]")).toBeVisible();
  await page.getByRole("link", { name: /Открыть демо/ }).click();
  await expect(page).toHaveURL(/\/ru\/demo\/welcome$/);
});
