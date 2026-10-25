import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Gate 5: an automated accessibility check (axe, WCAG 2.2 A and AA) of every screen in both
// languages, no sideways scrolling at the brief's widths, and the student's own data in settings.
// axe finds what a machine can find (contrast, names, roles, labels); it does not replace a person
// with a screen reader, which has not been done.

const STUDENT = [
  "welcome",
  "home",
  "map",
  "quest/prologue",
  "play",
  "quests",
  "discovery",
  "journal",
  "rewards",
  "profile",
  "settings",
  "character",
  "wardrobe",
  "shop",
  "inventory",
];
const STUDIO = ["studio", "studio/groups", "studio/builder", "studio/library", "studio/analytics"];

const ready = async (page: Page) => {
  await page.waitForLoadState("load");
  await expect(page.locator("[data-student-ready], [data-studio-ready], main").first()).toBeVisible();
};

const problems = async (page: Page) => {
  // Icons are glyphs of a ligature font, hidden from assistive technology; axe would read them as text.
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude(".material-symbols-outlined")
    .analyze();
  return violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => {
          const d = n.any[0]?.data as
            { fgColor?: string; bgColor?: string; contrastRatio?: number; expectedContrastRatio?: string } | undefined;
          return d?.contrastRatio
            ? `${n.target.join(" ")} [${d.fgColor} on ${d.bgColor} = ${d.contrastRatio}, needs ${d.expectedContrastRatio}]`
            : n.target.join(" ");
        })
        .slice(0, 3)
        .join(" | ")}`,
  );
};

/**
 * How far the page reaches past the viewport's right edge, in CSS pixels, once it has settled: under the
 * parallel suite's load a studio page was once 55 px wide for a moment while hydrating (never reproduced
 * alone, nor with JavaScript off), so a width is measured again a second later before it counts.
 */
const overflow = async (page: Page) => {
  const measure = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if ((await measure()) <= 0) return 0;
  await page.waitForTimeout(1000);
  return measure();
};

test.describe("accessibility", () => {
  for (const locale of ["ru", "en"]) {
    for (const route of STUDENT) {
      test(`student ${locale} ${route}`, async ({ page }) => {
        await page.goto(`/${locale}/demo/${route}`);
        await ready(page);
        expect(await problems(page)).toEqual([]);
      });
    }
  }
  test.describe("studio", () => {
    test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    for (const locale of ["ru", "en"]) {
      for (const route of STUDIO) {
        test(`studio ${locale} ${route}`, async ({ page }) => {
          await page.goto(`/${locale}/demo/${route}`);
          await ready(page);
          expect(await problems(page)).toEqual([]);
        });
      }
    }
  });
});

test.describe("no sideways scrolling", () => {
  for (const width of [320, 360, 390, 430]) {
    test(`student screens at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const wide: string[] = [];
      for (const route of STUDENT) {
        await page.goto(`/ru/demo/${route}`);
        await ready(page);
        const extra = await overflow(page);
        if (extra > 0) wide.push(`${route}: +${extra}px`);
      }
      expect(wide).toEqual([]);
    });
  }
  test.describe("studio", () => {
    test.use({ isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    for (const width of [1280, 1440]) {
      test(`studio screens at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const wide: string[] = [];
        for (const route of STUDIO) {
          await page.goto(`/ru/demo/${route}`);
          await ready(page);
          const extra = await overflow(page);
          if (extra > 0) wide.push(`${route}: +${extra}px`);
        }
        expect(wide).toEqual([]);
      });
    }
  });
});

test.describe("the student's own data (demo)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ru/demo");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("downloads this browser's record as a file", async ({ page }) => {
    await page.goto("/ru/demo/settings");
    await ready(page);
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-action=download-data]").click()]);
    expect(download.suggestedFilename()).toBe("questling-demo-data.json");
    const text = await (await download.createReadStream()).toArray();
    const facts = JSON.parse(Buffer.concat(text).toString("utf8"));
    expect(facts.profile).toBeTruthy();
    await expect(page.locator("[data-settings-data] [role=status]")).toHaveText("Файл с данными скачивается.");
  });

  test("deletes only after asking twice, and the demo starts afresh", async ({ page }) => {
    await page.goto("/ru/demo/settings");
    await ready(page);
    // Something the visitor did: a new hero name, kept in this browser.
    await page.evaluate(() => {
      const facts = JSON.parse(window.localStorage.getItem("questling-demo-v2") ?? "null");
      if (facts) window.localStorage.setItem("questling-demo-v2", JSON.stringify({ ...facts, marker: "visitor" }));
    });
    await page.locator("[data-action=delete-data]").click();
    await expect(page.locator("[data-confirm-delete]")).toBeVisible();
    await page.getByRole("button", { name: "Отмена" }).click();
    await expect(page.locator("[data-confirm-delete]")).toHaveCount(0);

    await page.locator("[data-action=delete-data]").click();
    await page.locator("[data-action=delete-data-confirm]").click();
    await expect(page.locator("[data-confirm-delete]")).toHaveCount(0);
    const stored = await page.evaluate(() => window.localStorage.getItem("questling-demo-v2"));
    expect(stored ?? "").not.toContain("visitor");
  });
});
