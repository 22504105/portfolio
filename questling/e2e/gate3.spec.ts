import { expect, test, type Page } from "@playwright/test";
import { echoTower } from "../lib/content/campaigns/echo-tower";
import { forgottenAcademy } from "../lib/content/campaigns/forgotten-academy";
import { forgottenAcademyKeys } from "../lib/content/campaigns/forgotten-academy-keys";
import { keysOf } from "../lib/content/campaigns/keys";
import type { Campaign } from "../lib/story/graph";
import { locate } from "../lib/story/run";

// Gate 3: campaigns as story graphs, played in the browser on the demo store with the server's
// rules: every kind of scene, branches that lead to different endings, evidence, the paused
// scene with the mentor and the grimoire, resuming after a reload, and the second campaign
// opening only after the first. The demo student starts at the sealed letter (tower-2).

const ready = (page: Page) => expect(page.locator("[data-student-ready]")).toBeVisible();
const sceneOn = (page: Page) => page.locator("[data-play-scene]").getAttribute("data-play-scene");

/** Plays the scene on screen the right way (choices as given) and waits until the story moves on. */
async function step(page: Page, campaign: Campaign, choices: Record<string, string>) {
  const id = (await sceneOn(page))!;
  if (id.startsWith("chapter-done:")) {
    await page.locator("[data-action=next]").click();
  } else {
    const scene = locate(campaign, id)!.scene;
    const key = keysOf(campaign)[id];
    switch (scene.kind) {
      case "narration":
      case "dialogue":
        await page.locator("[data-action=next]").click();
        break;
      case "choice":
        await page.locator(`[data-option="${choices[id] ?? scene.options[0].id}"]`).click();
        await page.locator("[data-action=choose]").click();
        break;
      case "question":
      case "evidence": {
        if (key.kind === "puzzle" || key.kind === "search") throw new Error(`${id} has a ${key.kind} key`);
        const options = key.kind === "question" ? [key.correct] : key.correct;
        // Evidence: whichever proving clue this path found is the one on screen.
        for (const option of options) {
          const card = page.locator(`[data-option="${option}"]`);
          if (await card.count()) {
            await card.click();
            break;
          }
        }
        await page.locator("[data-action=check]").click();
        await expect(page.locator("[data-phase=correct]")).toBeVisible();
        await page.locator("[data-action=next]").click();
        break;
      }
      case "puzzle":
        if (key.kind !== "puzzle") throw new Error(`${id} has no puzzle key`);
        for (const tile of key.order) await page.locator(`[data-tile="${tile}"]`).click();
        await page.locator("[data-action=check]").click();
        await expect(page.getByRole("status")).toContainText(/Шифр разгадан|Cipher solved/);
        await page.locator("[data-action=next]").click();
        break;
      case "talk": {
        // Gate E: the first answer on offer at each line (the choices name another as "scene:line").
        for (let i = 0; i < 10 && (await sceneOn(page)) === id; i++) {
          const line = await page.locator("[data-talk-line]").getAttribute("data-talk-line");
          const wanted = choices[`${id}:${line}`];
          await page
            .locator(wanted ? `[data-response="${wanted}"]` : "[data-response]")
            .first()
            .click();
          await expect
            .poll(async () =>
              (await sceneOn(page)) === id ? await page.locator("[data-talk-line]").getAttribute("data-talk-line") : "moved",
            )
            .not.toBe(line);
        }
        break;
      }
      case "search":
        if (key.kind !== "search") throw new Error(`${id} has no search key`);
        for (const spot of key.targets) await page.locator(`[data-spot="${spot}"]`).click();
        await expect(page.getByText(/Всё найдено|Everything found/)).toBeVisible();
        await page.locator("[data-action=next]").click();
        break;
      case "dub":
        await page.locator("[data-action=next]").click();
        break;
      case "ending":
        return;
    }
  }
  await expect.poll(() => sceneOn(page)).not.toBe(id);
}

async function playToEnding(page: Page, campaign: Campaign, choices: Record<string, string>): Promise<string> {
  for (let i = 0; i < 80; i++) {
    const id = (await sceneOn(page))!;
    const scene = id.includes(":") ? null : locate(campaign, id)?.scene;
    if (scene?.kind === "ending") return id;
    await step(page, campaign, choices);
  }
  throw new Error("the story never ended");
}

test("a whole campaign: a branch, evidence, the secret ending, and the next campaign opens", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/ru/demo/play");
  await ready(page);
  await expect(page.locator("[data-play-scene=tower-2]")).toBeAttached();

  // Reading the letter again finds a clue the other branch never sees.
  await step(page, forgottenAcademy, {});
  await expect(page.locator("[data-scene=choice]")).toBeVisible();
  await step(page, forgottenAcademy, { "t-choice": "reread" });
  await expect(page.locator("[data-scene=narration]")).toContainText("Trust the owl, not the crown.");

  const ending = await playToEnding(page, forgottenAcademy, { "f-choice": "give" });
  expect(ending).toBe("end-true");
  await expect(page.locator("[data-scene=ending]")).toContainText("Ученик архивариуса");
  await expect(page.locator("[data-scene=ending]")).toContainText("Тайный финал");
  await expect(page.locator("[data-scene=ending]")).toContainText("Открыта новая кампания: «Башня Эха»");

  await page.locator("[data-action=next-campaign]").click();
  await expect(page).toHaveURL(/\/ru\/demo\/play\/echo-tower$/);
  await expect(page.locator("[data-play-scene=e-bell]")).toBeAttached();
  await expect(page.getByText(/a bell rings at midnight in the Tower of Echoes/)).toBeVisible();

  await page.goto("/ru/demo/map");
  await ready(page);
  await expect(page.locator("[data-chapter=forest][data-status=done]")).toBeVisible();
  await expect(page.locator("[data-chapter=echo][data-status=open]")).toBeVisible();
  await expect(page.getByText("Кампания: Башня Эха")).toBeVisible();
});

test("the other branch: keeping the amulet ends differently", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/en/demo/play");
  await ready(page);
  const ending = await playToEnding(page, forgottenAcademy, { "t-choice": "now", "f-choice": "keep" });
  expect(ending).toBe("end-keeper");
  await expect(page.locator("[data-scene=ending]")).toContainText("Keeper of the amulet");
  await expect(page.locator("[data-scene=ending]")).toContainText("A bittersweet ending");
});

test("no attempts left: the paused scene, a request to the mentor, the grimoire wins one back", async ({ page }) => {
  await page.goto("/ru/demo/play");
  await ready(page);
  await page.getByRole("radio", { name: /The garden/ }).click();
  await page.locator("[data-action=check]").click();
  await page.getByRole("button", { name: /Попробовать снова/ }).click();
  await page.getByRole("radio", { name: /The tower/ }).click();
  await page.locator("[data-action=check]").click();

  const paused = page.locator("[data-phase=exhausted]");
  await expect(paused).toBeVisible();
  await expect(paused).toContainText("Попытки исчерпаны (2 из 2)");
  await expect(paused).toContainText("«The garden» и «The tower»");
  await expect(paused).toContainText("Магия отрицаний: Гримуар «Never»");

  await page.locator("[data-action=ask-mentor]").click();
  await expect(page.getByText("Свиток сохранён!")).toBeVisible();
  await expect(page.locator("[data-action=ask-mentor]")).toBeDisabled();

  await page.locator("[data-action=open-grimoire]").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Гримуар знаний");
  await expect(sheet.locator("[data-action=apply-grimoire]")).toBeDisabled();
  await sheet.locator("[data-word=often]").click();
  await expect(sheet.getByRole("alert")).toContainText("Не то слово");
  await sheet.locator("[data-word=never]").click();
  await expect(sheet).toContainText("+1 попытка разгадки восстановлена!");
  await sheet.locator("[data-action=apply-grimoire]").click();

  // One attempt is back: the riddle can be solved, the struck-out answers stay struck out.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-option=garden][aria-disabled="true"]')).toBeVisible();
  await page.getByRole("radio", { name: /The cellar/ }).click();
  await page.locator("[data-action=check]").click();
  await expect(page.locator("[data-phase=correct]")).toBeVisible();
});

test("the run is kept: after a reload the story resumes where it was, attempts and all", async ({ page }) => {
  await page.goto("/ru/demo/play");
  await ready(page);
  await page.getByRole("radio", { name: /The garden/ }).click();
  await page.locator("[data-action=check]").click();
  await expect(page.locator("[data-phase=incorrect]")).toBeVisible();

  await page.reload();
  await ready(page);
  await expect(page.locator("[data-play-scene=tower-2]")).toBeAttached();
  await expect(page.locator('[data-option=garden][aria-disabled="true"]')).toBeVisible();
  await page.getByRole("radio", { name: /The tower/ }).click();
  await page.locator("[data-action=check]").click();
  // That was the second of two attempts: it pauses.
  await expect(page.locator("[data-phase=exhausted]")).toBeVisible();

  await page.reload();
  await ready(page);
  await expect(page.locator("[data-phase=exhausted]")).toBeVisible();
});

test("the second campaign stays locked until the first is finished", async ({ page }) => {
  await page.goto("/ru/demo/map");
  await ready(page);
  const echo = page.locator("[data-chapter=echo]");
  await expect(echo).toHaveAttribute("data-status", "locked");
  await expect(echo).toContainText("Уровень B1 • Сложные загадки");
  await expect(page.locator("[data-chapter=archives]")).toContainText("Финальный босс кампании");
  await expect(page.locator("[data-chapter=forest]")).toContainText("Требуется завершить Главу II");

  await page.goto("/ru/demo/play/echo-tower");
  await expect(page).toHaveURL(/\/ru\/demo\/map$/);
  expect(echoTower.requires).toBe("forgotten-academy");
});

test("evidence offers only the clues found, with their pictures", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/ru/demo/play");
  await ready(page);
  for (let i = 0; i < 40 && (await sceneOn(page)) !== "f-proof"; i++) await step(page, forgottenAcademy, { "t-choice": "now" });
  await expect(page.locator("[data-play-scene=f-proof]")).toBeAttached();
  await expect(page.getByText("Выбери улику из журнала.")).toBeVisible();
  const key = forgottenAcademyKeys["f-proof"];
  if (key.kind !== "evidence") throw new Error("f-proof is evidence");
  // The owl's note is on the other branch: not offered.
  await expect(page.locator("[data-option=owl-note]")).toHaveCount(0);
  await expect(page.locator("[data-option=seal] img")).toHaveAttribute("src", "/images/sealed-letter.webp");
  await page.locator("[data-option=bronze-key]").click();
  await page.locator("[data-action=check]").click();
  await expect(page.locator("[data-phase=incorrect]")).toContainText("Ключ открывает подвал");
});
