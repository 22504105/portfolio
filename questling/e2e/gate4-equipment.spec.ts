import { expect, test, type Page } from "@playwright/test";

// Gate 4: equipment drawn on the hero (lib/content/rig.json, figureOf). The demo cat starts in the
// wizard hat and the sunset cloak, with the crystal staff; the hat and the cloak have drawn layers,
// the staff has none yet, so the wardrobe says so instead of pretending.

const ready = (page: Page) => expect(page.locator("[data-student-ready]")).toBeVisible();
const layers = (page: Page) => page.locator("[data-figure-layers]").first().locator("img");
const sources = async (page: Page) =>
  await layers(page).evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).getAttribute("src") ?? ""));

test.beforeEach(async ({ page }) => {
  await page.goto("/ru/demo");
  await page.evaluate(() => window.localStorage.clear());
});

test("the hat and the cloak are drawn in back and front layers around the hero; what has no art yet is named, not faked", async ({
  page,
}) => {
  await page.goto("/ru/demo/wardrobe");
  await ready(page);
  expect(await sources(page)).toEqual([
    "/images/layers/ceremonial-cape-back.webp",
    "/images/layers/witch-hat-back.webp",
    "/images/layers/cat-base.webp",
    "/images/layers/ceremonial-cape-front.webp",
    "/images/layers/witch-hat-front.webp",
  ]);
  await expect(page.locator("[data-not-drawn]")).toContainText("Хрустальный посох");
});

test("taking the hat off removes both its layers, and the saved look is the one the profile shows", async ({ page }) => {
  await page.goto("/ru/demo/wardrobe");
  await ready(page);
  await page.locator('[data-item="wizard-hat"]').getByRole("button", { name: /Снять/ }).click();
  expect(await sources(page)).toEqual([
    "/images/layers/ceremonial-cape-back.webp",
    "/images/layers/cat-base.webp",
    "/images/layers/ceremonial-cape-front.webp",
  ]);
  await page.locator("[data-action=save-look]").click();
  await expect(page.getByRole("status")).toContainText("Образ сохранён");

  await page.goto("/ru/demo/profile");
  await ready(page);
  const profile = await sources(page);
  expect(profile).toContain("/images/layers/ceremonial-cape-front.webp");
  expect(profile).not.toContain("/images/layers/witch-hat-front.webp");
});
