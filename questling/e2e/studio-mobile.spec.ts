import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Teacher Studio on a phone (the owner's request, 2026-10-26): the sidebar becomes a drawer from the
// header's menu button, the search folds into an icon, the builder's three columns become tabs, and
// no screen scrolls sideways. The phone project's 390×844 touch viewport; widths 360 and 430 as well.

const QUEST = "99999999-0000-4000-8000-000000000001";
const SCREENS = [
  "studio",
  "studio/groups",
  `studio/builder?quest=${QUEST}`,
  "studio/library",
  "studio/analytics",
  "studio/dubbing",
  `studio/preview/${QUEST}`,
];

const overflow = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const width of [360, 390, 430]) {
  test(`no studio screen scrolls sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const wide: string[] = [];
    for (const route of SCREENS) {
      await page.goto(`/ru/demo/${route}`);
      await expect(page.locator("[data-studio-section], [data-preview]").first()).toBeVisible();
      let extra = await overflow(page);
      if (extra > 0) {
        await page.waitForTimeout(1000);
        extra = await overflow(page);
      }
      if (extra > 0) wide.push(`${route}: +${extra}px`);
    }
    expect(wide).toEqual([]);
  });
}

test("the sections open from the menu button, and the drawer closes on the way", async ({ page }) => {
  await page.goto("/ru/demo/studio");
  const drawer = page.locator("#studio-nav");
  await expect(drawer).toHaveAttribute("data-drawer", "closed");
  await expect(drawer).not.toBeInViewport();
  await page.locator("[data-action=open-menu]").click();
  await expect(drawer).toHaveAttribute("data-drawer", "open");
  await expect(drawer).toBeInViewport();
  await drawer.getByRole("link", { name: "Управление группами" }).click();
  await expect(page).toHaveURL(/\/ru\/demo\/studio\/groups/);
  await expect(drawer).toHaveAttribute("data-drawer", "closed");
  // The backdrop closes it too.
  await page.locator("[data-action=open-menu]").click();
  await page.locator("[data-drawer-backdrop]").click({ position: { x: 370, y: 400 } });
  await expect(drawer).toHaveAttribute("data-drawer", "closed");
});

test("the search folds into an icon and finds students and campaigns", async ({ page }) => {
  await page.goto("/ru/demo/studio");
  await expect(page.getByRole("searchbox")).toBeHidden();
  await page.locator("[data-action=open-search]").click();
  await page.getByRole("searchbox").fill("тайна");
  await expect(page.getByRole("link", { name: "Тайна часовой башни" })).toBeVisible();
});

test("the builder's palette, scenes and properties take turns as tabs", async ({ page }) => {
  await page.goto(`/ru/demo/studio/builder?quest=${QUEST}`);
  await expect(page.locator("[data-builder]")).toBeVisible();
  await expect(page.locator('[data-node="start"]')).toBeVisible();
  await expect(page.locator('[data-palette="question"]')).toBeHidden();

  await page.locator("[data-pane=palette]").click();
  await expect(page.locator('[data-palette="question"]')).toBeVisible();
  await expect(page.locator('[data-node="start"]')).toBeHidden();
  // A scene added from the palette opens its properties.
  await page.locator('[data-palette="question"]').click();
  await expect(page.locator("[data-pane=inspector]")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("textbox", { name: /Текст подсказки/ })).toBeVisible();

  await page.locator("[data-pane=canvas]").click();
  await expect(page.locator("[data-node]")).toHaveCount(4);
});

test("studio screens pass axe at phone width, with the drawer open", async ({ page }) => {
  for (const route of ["studio", "studio/groups", `studio/builder?quest=${QUEST}`]) {
    await page.goto(`/ru/demo/${route}`);
    await expect(page.locator("[data-studio-section]")).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude(".material-symbols-outlined")
      .analyze();
    expect(violations.map((v) => `${route} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  }
  await page.locator("[data-action=open-menu]").click();
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".material-symbols-outlined").analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});
