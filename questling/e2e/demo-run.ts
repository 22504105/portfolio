import { expect, type Page } from "@playwright/test";
import { forgottenAcademy } from "../lib/content/campaigns/forgotten-academy";
import { keysOf } from "../lib/content/campaigns/keys";
import { demoFacts } from "../lib/demo/seed";
import { rightMove } from "../lib/story/autoplay";
import { move, runSeed, startRun, type RunState } from "../lib/story/run";

// The demo run of the built-in campaign put straight at a scene (gate E and F tests).

export const ready = (page: Page) => expect(page.locator("[data-play-scene]")).toBeAttached();
export const sceneOn = (page: Page) => page.locator("[data-play-scene]").getAttribute("data-play-scene");

/** Puts the demo run straight at a scene, as if played there (the rules decide the run's state). */
export async function demoAt(page: Page, until: string, choices: Record<string, string> = {}, locale: "ru" | "en" = "ru") {
  // The demo student as the demo makes them (lib/demo/seed.ts), moved on by the same rules.
  const facts = demoFacts(new Date());
  const campaign = forgottenAcademy;
  const keys = keysOf(campaign);
  let run: RunState =
    facts.runs.find((r: RunState) => r.campaign === campaign.id) ?? startRun(campaign, runSeed(facts.profile.joinedAt, campaign));
  for (let i = 0; i < 80 && run.scene !== until; i++) {
    const m = rightMove(campaign, keys, run, choices)!;
    const r = move(campaign, keys, run, m);
    if (!r.ok) throw new Error(r.refusal);
    run = r.run;
  }
  facts.runs = [...facts.runs.filter((r: RunState) => r.campaign !== campaign.id), run];
  // Once per test: later navigations keep what the test did.
  await page.addInitScript(
    ({ value, scene }) => {
      if (window.sessionStorage.getItem("seeded") === scene) return;
      window.localStorage.setItem("questling-demo-v2", value);
      window.sessionStorage.setItem("seeded", scene);
    },
    { value: JSON.stringify(facts), scene: until },
  );
  await page.goto(`/${locale}/demo/play`);
  await ready(page);
  await expect(page.locator(`[data-play-scene="${until}"]`)).toBeAttached();
}
