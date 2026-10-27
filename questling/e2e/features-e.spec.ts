import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { demoAt, sceneOn } from "./demo-run";
// Gate E (docs/features-audit.md): the forest's picture search and the talk with the spirit (built-in
// campaign, version 2), played on the demo; the studio's forms for talks, searches and voice-acting
// scenes. The demo student starts at tower-2; the story is walked to the forest through the demo store.

test("the picture search: nothing where nothing is, a wrong find explained, the hint, the right order, the glow sprite", async ({
  page,
}) => {
  await demoAt(page, "f-search");
  const picture = page.locator("[data-search-picture]");
  await expect(picture).toBeVisible();
  // An empty corner: told so, nothing counted.
  const box = (await picture.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.08);
  await expect(page.getByRole("status")).toContainText("Здесь ничего нет");
  // Tapping the stone on the right, on the picture: wrong, with its name.
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.6);
  await expect(page.getByRole("status")).toContainText("Не то: the stone with P, O, P");
  await page.locator('[data-spot="ferns"]').click();
  await expect(page.locator("[data-search-hint]")).toContainText("Буква R есть только на одном камне");
  // The left stone on the picture, then the mushrooms from the list (the accessible way).
  // The list click scrolled the page: measure the picture again.
  await picture.scrollIntoViewIfNeeded();
  const again = (await picture.boundingBox())!;
  await page.mouse.click(again.x + again.width * 0.23, again.y + again.height * 0.6);
  await expect(page.locator('[data-found="stone-r"]')).toBeVisible();
  await page.locator('[data-spot="mushrooms"]').click();
  await expect(page.getByText("Всё найдено!")).toBeVisible();
  await expect(page.getByText("Новый предмет в инвентаре: Светлячок-дух")).toBeVisible();
  await page.locator("[data-action=next]").click();
  await expect.poll(() => sceneOn(page)).toBe("f-spirit");
  await page.goto("/ru/demo/inventory");
  await expect(page.getByText("Светлячок-дух").first()).toBeVisible();
});

test("the talk: the owl's line only after the owl's note, then on to the riddle", async ({ page }) => {
  await demoAt(page, "f-ask", { "t-choice": "reread" });
  await expect(page.locator("[data-talk-line=why]")).toBeVisible();
  await page.locator("[data-response=letter]").click();
  await expect(page.locator("[data-talk-line=letter]")).toBeVisible();
  await expect(page.locator("[data-response=owl]")).toBeVisible();
  await page.locator("[data-response=owl]").click();
  await expect(page.locator("[data-talk-line=owl]")).toContainText("wiser than the king's men");
  await page.locator("[data-response=ready]").click();
  await expect.poll(() => sceneOn(page)).toBe("f-riddle");
});

test("without the owl's note, that answer is not offered", async ({ page }) => {
  await demoAt(page, "f-ask", { "t-choice": "now" });
  await page.locator("[data-response=letter]").click();
  await expect(page.locator("[data-talk-line=letter]")).toBeVisible();
  await expect(page.locator("[data-response=owl]")).toHaveCount(0);
  await expect(page.locator("[data-response=forgot]")).toBeVisible();
});

test("the new scenes fit a 320px phone and pass axe", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const scene of ["f-search", "f-ask"]) {
    await demoAt(page, scene, { "t-choice": "reread" });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".material-symbols-outlined").analyze();
    expect(violations.map((v) => `${scene} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  }
});

test("studio: a talk, a picture search with a spot drawn on the picture, and a voice-acting scene from the teacher's own", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ru/demo/studio/builder?quest=99999999-0000-4000-8000-000000000001");
  await expect(page.locator("[data-builder]")).toBeVisible();

  await page.locator('[data-palette="talk"]').click();
  const talk = page.locator("[data-talk-form]");
  await expect(talk).toBeVisible();
  await talk.locator("[data-action=add-talk-line]").click();
  await expect(talk.locator("[data-talk-line]")).toHaveCount(3);

  await page.locator('[data-palette="search"]').click();
  const search = page.locator("[data-search-form]");
  await expect(search).toBeVisible();
  await search.locator("[data-action=add-spot]").click();
  // A drag across the picture (pointer events, as a finger or a mouse sends them).
  const preview = search.locator("[data-search-preview]");
  const box = (await preview.boundingBox())!;
  const at = (fx: number, fy: number) => ({
    clientX: box.x + box.width * fx,
    clientY: box.y + box.height * fy,
    pointerId: 1,
    bubbles: true,
  });
  await preview.locator("img").dispatchEvent("pointerdown", at(0.1, 0.1));
  await preview.locator("img").dispatchEvent("pointerup", at(0.3, 0.35));
  await expect(search.locator('[data-spot="spot3"]')).toContainText("x 10% · y 10% · 20×25%");
  await search.locator('[data-target="spot3"]').check();

  await page.locator('[data-palette="dub"]').click();
  const dub = page.locator("[data-dub-form]");
  await expect(dub).toBeVisible();
  await dub.locator("[data-field=dub-exercise]").selectOption("d-demo-archive");
  await expect(dub.locator("[data-field=dub-optional]")).toBeChecked();
});
