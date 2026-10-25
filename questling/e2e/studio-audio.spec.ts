import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { demoStudio } from "@/lib/studio/demo";
import type { MediaItem, StudioFacts } from "@/lib/studio/model";

// The audio field of the quest builder. In the demo studio it says files need the real studio. In the
// signed-in studio the server is stood in for by routes (the end-to-end build has no database; the
// server side of uploads is tested on PostgreSQL in tests/db/studio.test.ts): upload, listen, replace,
// remove, and the reasons a file is refused.

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

const QUEST = "99999999-0000-4000-8000-000000000001";
const mp3 = readFileSync(path.join(process.cwd(), "tests", "fixtures", "audio", "ok.mp3"));

test("the demo studio says recordings need the signed-in studio", async ({ page }) => {
  await page.goto(`/ru/demo/studio/builder?quest=${QUEST}`);
  await page.locator('[data-node="start"]').click();
  await expect(page.locator("[data-audio-demo]")).toContainText("В демо-студии записи не загружаются");
});

/** The signed-in studio with a stand-in server; returns what was uploaded and removed. */
async function liveStudio(page: Page, upload: (n: number) => { status: number; body: unknown }) {
  const facts: StudioFacts = { ...demoStudio(new Date()), media: [] };
  const seen = { uploads: 0, removed: [] as string[] };
  await page.addInitScript(() => {
    window.sessionStorage.setItem("questling-studio-session", JSON.stringify({ token: "test", expiresAt: 4_000_000_000 }));
  });
  await page.route("**/api/v1/studio/state", (route) => route.fulfill({ json: { facts } }));
  await page.route("**/api/v1/studio/actions", (route) => route.fulfill({ json: { outcome: { kind: "ok" }, facts } }));
  await page.route("**/api/v1/studio/media", async (route) => {
    seen.uploads++;
    const { status, body } = upload(seen.uploads);
    if (status === 200) facts.media = [(body as { asset: MediaItem }).asset, ...facts.media];
    await route.fulfill({ status, json: body });
  });
  await page.route("**/api/v1/studio/media/delete", async (route) => {
    seen.removed.push((route.request().postDataJSON() as { id: string }).id);
    await route.fulfill({ json: { status: "deleted" } });
  });
  await page.route("**/test-audio/*.mp3", (route) => route.fulfill({ body: mp3, contentType: "audio/mpeg" }));
  await page.goto(`/ru/studio/builder?quest=${QUEST}`);
  await page.locator('[data-node="start"]').click();
  return seen;
}

const asset = (n: number): MediaItem => ({
  id: `aaaaaaaa-0000-4000-8000-00000000000${n}`,
  name: `голос-${n}.mp3`,
  mime: "audio/mpeg",
  size: mp3.length,
  durationMs: 1500,
  createdAt: new Date().toISOString(),
  url: `/test-audio/${n}.mp3`,
});

test("a teacher uploads a recording, listens to it, replaces it and removes it", async ({ page }) => {
  const seen = await liveStudio(page, (n) => ({ status: 200, body: { asset: asset(n) } }));
  const field = page.locator("[data-audio-field]");
  await field.locator("input[type=file]").setInputFiles({ name: "голос-1.mp3", mimeType: "audio/mpeg", buffer: mp3 });
  await expect(field).toContainText("голос-1.mp3");
  await expect(field).toContainText("1.5 с");
  await expect(field.locator("[data-audio-preview]")).toHaveAttribute("src", "/test-audio/1.mp3");

  // Replaced: the new one is shown, and the old one is asked to go (it is unused now).
  await field.locator("input[type=file]").setInputFiles({ name: "голос-2.mp3", mimeType: "audio/mpeg", buffer: mp3 });
  await expect(field).toContainText("голос-2.mp3");
  await expect.poll(() => seen.removed).toEqual([asset(1).id]);

  // Removed from the scene.
  await field.locator("[data-action=remove-audio]").click();
  await expect(field.locator("[data-audio-preview]")).toHaveCount(0);
  await expect.poll(() => seen.removed).toEqual([asset(1).id, asset(2).id]);
});

test("a refused file says why, and a file over 2 MB is not even sent", async ({ page }) => {
  const seen = await liveStudio(page, () => ({ status: 422, body: { error: "too_long" } }));
  const field = page.locator("[data-audio-field]");
  await field.locator("input[type=file]").setInputFiles({ name: "long.mp3", mimeType: "audio/mpeg", buffer: mp3 });
  await expect(field.locator("[role=alert]")).toHaveText("Запись длиннее 60 секунд.");

  await field
    .locator("input[type=file]")
    .setInputFiles({ name: "huge.wav", mimeType: "audio/wav", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
  await expect(field.locator("[role=alert]")).toHaveText("Файл больше 2 МБ.");
  expect(seen.uploads).toBe(1);
});
