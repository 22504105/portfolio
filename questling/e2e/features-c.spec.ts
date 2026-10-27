import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Gates B/C (docs/features-audit.md): voice acting on the demo (the built-in scene, takes kept in the
// browser), with Chrome's fake microphone; refusals (no permission, no recorder, interrupted); the
// studio's scenes and review. Real uploads to storage are covered by tests/db/media.test.ts.

// Chrome's fake microphone (a tone) for the whole file; the refusal tests replace getUserMedia themselves.
test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  },
});

const exercise = "d-demo-archive";
const openScene = async (page: Page) => {
  await page.goto(`/ru/demo/dub/${exercise}`);
  await expect(page.locator(`[data-dub="${exercise}"]`)).toBeVisible();
};

test.describe("with a microphone", () => {
  test.use({ permissions: ["microphone"] });

  test("a student voices their part, keeps the takes, hears the scene in their voice and sends it", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/ru/demo/quests");
    await page.locator(`[data-dub-card="${exercise}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/ru/demo/dub/${exercise}$`));
    await page.locator("[data-chip=student]").click();
    await page.locator("[data-chip=voiceover]").click();
    await page.locator("[data-action=start-dub]").click();
    const lines = page.locator("[data-line]");
    await expect(lines).toHaveCount(2);
    await expect(page.locator("[data-action=submit-dub]")).toBeDisabled();

    for (const id of ["l2", "l4"]) {
      const line = page.locator(`[data-line="${id}"]`);
      await line.locator("[data-action=record]").click();
      // The take ends by itself at the end of the line.
      await expect(line.locator("[data-take]")).toHaveCount(1, { timeout: 15_000 });
      await line.locator("[data-action=keep-take]").click();
      await expect(line.locator("[data-saved]")).toBeVisible();
    }
    await expect(page.locator('[data-chip="mine"]')).toBeEnabled();
    await page.locator('[data-chip="mine"]').click();
    await page.locator("[data-action=play-scene]").click();
    await expect(page.locator("[data-action=play-scene]")).toContainText("Остановить");
    await page.locator("[data-action=play-scene]").click();

    await page.locator("[data-action=submit-dub]").click();
    await expect(page.locator("[data-dub-status=submitted]")).toBeVisible();
    // Sent: no more recording until the mentor answers.
    await expect(page.locator("[data-action=record]")).toHaveCount(0);
    await page.goto("/ru/demo/quests");
    await expect(page.locator(`[data-dub-card="${exercise}"]`)).toContainText("Отправлена наставнику");
  });

  test("a take interrupted by the page going to the background is dropped, with the reason", async ({ page }) => {
    await openScene(page);
    await page.locator("[data-action=start-dub]").click();
    const line = page.locator("[data-line]").first();
    await line.locator("[data-action=record]").click();
    await expect(line.locator("[data-action=stop]")).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(line.getByRole("alert")).toContainText("Запись прервалась");
    await expect(line.locator("[data-take]")).toHaveCount(0);
  });
});

test("without permission, the microphone is refused with what to do", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await openScene(page);
  await page.locator("[data-action=start-dub]").click();
  const line = page.locator("[data-line]").first();
  await line.locator("[data-action=record]").click();
  await expect(line.getByRole("alert")).toContainText("Доступ к микрофону запрещён", { timeout: 10_000 });
});

test("a browser that cannot record says so instead of offering a button", async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error — removing the recorder, as on browsers without one
    delete window.MediaRecorder;
  });
  await openScene(page);
  await page.locator("[data-action=start-dub]").click();
  await expect(page.locator("[data-line]").first()).toContainText("Этот браузер не умеет записывать звук");
  await expect(page.locator("[data-action=record]")).toHaveCount(0);
});

test("the scene fits phones and passes axe", async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await openScene(page);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  }
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".material-symbols-outlined").analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
});

test("studio: the demo scene is reviewed — rubric, feedback, accepted", async ({ page }) => {
  await page.goto("/ru/demo/studio");
  await page.locator("[data-action=open-menu]").click();
  await page.locator("#studio-nav").getByRole("link", { name: "Озвучка сцен" }).click();
  await expect(page).toHaveURL(/\/ru\/demo\/studio\/dubbing$/);
  await page.locator("[data-tab=review]").click();
  const panel = page.locator("[data-review-panel]");
  await expect(panel).toBeVisible();
  await panel.locator('[data-rubric="pacing-good"]').click();
  await panel.locator('[data-rubric="stress-work"]').click();
  await panel.getByRole("textbox", { name: "Отзыв ученику" }).fill("Хорошо! Ударение в слове map — короче.");
  await panel.locator("[data-action=approve-dub]").click();
  await expect(page.locator("[data-dubbing]").getByRole("status")).toContainText("Ответ отправлен");
  await expect(page.getByText("Пока никто не отправил озвучку.")).toBeVisible();
});

test("studio: a new scene starts from the built-in clip; lines out of the scene block publishing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ru/demo/studio/dubbing");
  await page.getByRole("textbox", { name: "Название сцены" }).first().fill("Новая проба");
  await page.locator("[data-action=create-dub]").click();
  const editor = page.locator("[data-dub-editor]");
  await expect(editor).toBeVisible();
  await expect(editor.locator("[data-line-editor]")).toHaveCount(5);
  await editor.getByRole("spinbutton", { name: "Конец, с" }).first().fill("10");
  await expect(editor.locator("[data-dub-problems]")).toContainText("outside the trimmed scene");
  await expect(editor.locator("[data-action=publish-dub]")).toBeDisabled();
  await editor.getByRole("spinbutton", { name: "Конец, с" }).first().fill("18");
  await expect(editor.locator("[data-dub-problems]")).toHaveCount(0);
  await editor.locator("[data-action=publish-dub]").click();
  await expect(editor.getByRole("status")).toContainText("Опубликовано");
  // The demo studio keeps no files: no upload offered.
  await expect(editor.locator("[data-upload]")).toHaveCount(0);
});
