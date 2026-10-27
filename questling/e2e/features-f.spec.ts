import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { forgottenAcademy } from "../lib/content/campaigns/forgotten-academy";
import type { SearchScene } from "../lib/story/graph";
import { demoAt } from "./demo-run";

// Gate F (docs/features-audit.md): the screens added by the features prompt at the student widths the
// prompt names (Telegram 320/360/390/430) in both languages, Teacher Studio's new screens at 1280/1440,
// picture-search taps landing on the same spot at any size, and text a teacher types never running as
// code. All on the demo (no account, nothing stored).

const STUDENT_WIDTHS = [320, 360, 390, 430];
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function axe(page: Page, what: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".material-symbols-outlined").analyze();
  expect(violations.map((v) => `${what} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

for (const locale of ["ru", "en"] as const) {
  test(`${locale}: the word journal, the quests list and the voice-acting scene fit 320–430 px`, async ({ page }) => {
    for (const path of ["words", "quests", "dub/d-demo-archive"]) {
      await page.goto(`/${locale}/demo/${path}`, { waitUntil: "load" });
      await expect(page.locator("main")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const width of STUDENT_WIDTHS) {
        await page.setViewportSize({ width, height: 760 });
        expect(await overflow(page), `${path} at ${width}px`).toBe(0);
      }
      if (locale === "en") await axe(page, `${locale} ${path}`);
    }
  });

  test(`${locale}: the picture search and the talk fit 320–430 px`, async ({ page }) => {
    for (const scene of ["f-search", "f-ask"]) {
      await demoAt(page, scene, { "t-choice": "reread" }, locale);
      await page.evaluate(() => document.fonts.ready);
      for (const width of STUDENT_WIDTHS) {
        await page.setViewportSize({ width, height: 760 });
        expect(await overflow(page), `${scene} at ${width}px`).toBe(0);
      }
      if (locale === "en") await axe(page, `${locale} ${scene}`);
    }
  });
}

/**
 * Taps an empty corner of the search picture until the screen answers: under a full parallel run the first
 * tap can land before the page is interactive. An empty tap counts nothing, so repeating it is harmless.
 */
async function tapNothing(page: Page, said: string) {
  const picture = page.locator("[data-search-picture]");
  await expect(async () => {
    const box = (await picture.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.08);
    await expect(page.getByRole("status")).toContainText(said, { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

test("the English picture search speaks English around the English task", async ({ page }) => {
  await demoAt(page, "f-search", {}, "en");
  await tapNothing(page, "Nothing here");
});

const search = forgottenAcademy.chapters.flatMap((c) => c.scenes).find((s) => s.id === "f-search") as SearchScene;
const centre = (id: string) => {
  const s = search.spots.find((spot) => spot.id === id)!;
  return { fx: s.x + s.w / 2, fy: s.y + s.h / 2 };
};

for (const width of [320, 430, 1440]) {
  test(`a tap on a spot's centre finds it at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await demoAt(page, "f-search");
    const picture = page.locator("[data-search-picture]");
    await picture.scrollIntoViewIfNeeded();
    await tapNothing(page, "Здесь ничего нет");
    for (const id of ["stone-r", "mushrooms"]) {
      const box = (await picture.boundingBox())!;
      const { fx, fy } = centre(id);
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      await expect(page.locator(`[data-found="${id}"]`)).toBeVisible();
    }
  });
}

for (const width of [1280, 1440]) {
  test(`studio at ${width} px: the voice-acting section and the builder's new forms fit and pass axe`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/ru/demo/studio/dubbing", { waitUntil: "load" });
    await expect(page.locator("main")).toBeVisible();
    expect(await overflow(page)).toBe(0);
    await axe(page, `dubbing ${width}`);
    await page.goto("/ru/demo/studio/builder?quest=99999999-0000-4000-8000-000000000001", { waitUntil: "load" });
    await expect(page.locator("[data-builder]")).toBeVisible();
    for (const kind of ["talk", "search", "dub"]) {
      await page.locator(`[data-palette="${kind}"]`).click();
      await expect(page.locator(`[data-${kind}-form]`)).toBeVisible();
      expect(await overflow(page), `${kind} form`).toBe(0);
    }
    await axe(page, `builder ${width}`);
  });
}

test("text a teacher types is shown as text and never runs", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  const payload = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ru/demo/studio/dubbing");
  await page.getByRole("textbox", { name: "Название сцены" }).first().fill(`Сцена ${payload}`);
  await page.locator("[data-action=create-dub]").click();
  const editor = page.locator("[data-dub-editor]");
  await expect(editor).toBeVisible();
  await editor.getByRole("textbox", { name: "Реплика (английский)" }).first().fill(payload);
  await editor.getByRole("textbox", { name: "Перевод" }).first().fill(payload);
  await editor.locator("[data-action=save-dub]").click();
  await page.goto("/ru/demo/studio/dubbing");
  // Saved and opened again: the text is back as typed, in the fields, not as markup.
  await expect(page.getByRole("textbox", { name: "Реплика (английский)" }).first()).toHaveValue(payload);

  await page.goto("/ru/demo/studio/builder?quest=99999999-0000-4000-8000-000000000001");
  await page.locator('[data-palette="talk"]').click();
  const talk = page.locator("[data-talk-form]");
  await talk.getByRole("textbox").first().fill(payload);

  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  expect(dialogs).toEqual([]);
});
