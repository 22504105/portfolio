import { expect, test, type Page } from "@playwright/test";

// The audio system (lib/client/audio.ts) in the browser: a built-in recording first, the device's
// English voice when a recording fails, and a clear notice when nothing can be heard. The device's
// voice is replaced by a stub, so what "it said" can be checked; a failed download is a request
// aborted on the way. Real phones and Telegram's WebViews are checked by hand (docs/audio.md).

type Voice = "english" | "none";

/** Replaces speech synthesis: with an English voice that "says" lines into window.__spoken, or with none. */
async function stubVoice(page: Page, voice: Voice) {
  await page.addInitScript((kind: Voice) => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    const synth = {
      getVoices: () => (kind === "english" ? [{ lang: "en-US", name: "Stub English", default: true }] : []),
      speak: (utterance: SpeechSynthesisUtterance) => {
        spoken.push(utterance.text);
        setTimeout(() => utterance.onend?.(new Event("end") as SpeechSynthesisEvent), 50);
      },
      cancel: () => {},
      addEventListener: () => {},
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  }, voice);
}

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
const word = (page: Page) => page.locator("[data-action=pronounce-word]");
const notice = (page: Page) => page.locator("[data-audio-notice]");

test.beforeEach(async ({ page }) => {
  await page.goto("/ru/demo");
  await page.evaluate(() => window.localStorage.clear());
});

test("plays the word of the day from its recording, and ends", async ({ page }) => {
  await stubVoice(page, "none");
  await page.goto("/ru/demo/discovery");
  await expect(word(page)).toHaveAttribute("data-audio", "file");
  const download = page.waitForRequest(/\/audio\/[a-z0-9]+\.mp3$/);
  await word(page).click();
  await download;
  await expect(word(page)).toHaveAttribute("data-audio-state", "playing");
  await expect(word(page)).toHaveAttribute("data-audio-state", "idle", { timeout: 10_000 });
  await expect(notice(page)).toHaveCount(0);
  // Again: a second play works the same.
  await word(page).click();
  await expect(word(page)).toHaveAttribute("data-audio-state", "playing");
});

test("falls back to the device's English voice when the recording cannot be downloaded", async ({ page }) => {
  await stubVoice(page, "english");
  await page.route(/\/audio\/.*\.mp3$/, (route) => route.abort("failed"));
  await page.goto("/ru/demo/discovery");
  await word(page).click();
  await expect.poll(() => spoken(page)).toHaveLength(1);
  await expect(notice(page)).toHaveCount(0);
});

test("says so when the recording fails and the device has no English voice", async ({ page }) => {
  await stubVoice(page, "none");
  await page.route(/\/audio\/.*\.mp3$/, (route) => route.abort("failed"));
  await page.goto("/ru/demo/discovery");
  await word(page).click();
  await expect(notice(page)).toHaveAttribute("data-audio-notice", "failed");
  await expect(notice(page)).toContainText("Не удалось воспроизвести звук");
  await expect(word(page)).toHaveAttribute("data-audio-state", "failed");
});

test("with sound switched off, a speaker says so instead of staying silent", async ({ page }) => {
  await stubVoice(page, "english");
  await page.goto("/ru/demo/discovery");
  await page.evaluate(() => window.localStorage.setItem("questling-sound", "off"));
  await page.reload();
  await expect(word(page)).toHaveAttribute("data-audio", "muted");
  await word(page).click();
  await expect(notice(page)).toHaveAttribute("data-audio-notice", "muted");
  expect(await spoken(page)).toEqual([]);
});

test("one sound at a time: starting another line stops the first", async ({ page }) => {
  await stubVoice(page, "none");
  // Hold the first recording back, so it is still loading when the second is pressed.
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let first = true;
  await page.route(/\/audio\/.*\.mp3$/, async (route) => {
    if (first) {
      first = false;
      await held;
    }
    await route.continue();
  });
  await page.goto("/ru/demo/quest/prologue");
  const words = page.locator("[data-action=pronounce-chapter-word]");
  await expect(words.first()).toHaveAttribute("data-audio", "file");
  await words.nth(0).click();
  await expect(words.nth(0)).toHaveAttribute("data-audio-state", "loading");
  await words.nth(1).click();
  await expect(words.nth(0)).toHaveAttribute("data-audio-state", "idle");
  await expect(words.nth(1)).not.toHaveAttribute("data-audio-state", "idle");
  release();
});
