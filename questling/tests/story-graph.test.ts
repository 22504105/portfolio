import { describe, expect, it } from "vitest";
import { campaigns } from "@/lib/content/campaigns";
import { echoTower } from "@/lib/content/campaigns/echo-tower";
import { echoTowerKeys } from "@/lib/content/campaigns/echo-tower-keys";
import { keysOf } from "@/lib/content/campaigns/keys";
import type { Campaign, ChoiceScene } from "@/lib/story/graph";
import { validateCampaign } from "@/lib/story/validate";

const clone = <T>(value: T): T => structuredClone(value);

describe("campaign graphs", () => {
  for (const campaign of campaigns)
    it(`${campaign.id} is sound: reachable, ends everywhere, evidence always provable`, () => {
      expect(validateCampaign(campaign, keysOf(campaign))).toEqual([]);
    });

  it("two demo campaigns, A1–A2 then B1–B2, each with at least three endings", () => {
    expect(campaigns.map((c) => [c.id, c.cefr, c.requires])).toEqual([
      ["forgotten-academy", "A1–A2", null],
      ["echo-tower", "B1–B2", "forgotten-academy"],
    ]);
    for (const campaign of campaigns) {
      const scenes = campaign.chapters.flatMap((chapter) => chapter.scenes);
      expect(scenes.filter((s) => s.kind === "ending").length).toBeGreaterThanOrEqual(3);
      for (const kind of ["narration", "dialogue", "choice", "question", "puzzle", "evidence"])
        expect(scenes.some((s) => s.kind === kind)).toBe(true);
    }
  });

  it("finds evidence that one branch can never prove", () => {
    const keys = clone(echoTowerKeys);
    // Only the guard's confession proves it: a student who climbed alone never has it.
    keys["e-proof"] = { ...keys["e-proof"], correct: ["guard-confession"] } as (typeof keys)["e-proof"];
    expect(validateCampaign(echoTower, keys).join("\n")).toMatch(/e-proof can be reached without a clue that proves it/);
  });

  it("finds broken transitions and scenes nobody reaches", () => {
    const broken: Campaign = clone(echoTower);
    const choice = broken.chapters[0].scenes.find((s) => s.id === "e-choice") as ChoiceScene;
    choice.options[1].to = "nowhere";
    const problems = validateCampaign(broken, echoTowerKeys).join("\n");
    expect(problems).toMatch(/e-choice leads to unknown scene nowhere/);

    const orphan: Campaign = clone(echoTower);
    (orphan.chapters[0].scenes.find((s) => s.id === "e-choice") as ChoiceScene).options[1].to = "e-confess";
    expect(validateCampaign(orphan, echoTowerKeys).join("\n")).toMatch(/e-footprints can never be reached/);
  });

  it("finds a loop with no way out, but allows one a choice can leave", () => {
    // After the choice, the two paths point at each other: whoever takes either never reaches an ending.
    const trap: Campaign = clone(echoTower);
    const scene = (id: string) => trap.chapters[0].scenes.find((s) => s.id === id) as { next?: unknown };
    scene("e-confess").next = "e-footprints";
    scene("e-footprints").next = "e-confess";
    const problems = validateCampaign(trap, echoTowerKeys).join("\n");
    expect(problems).toMatch(/from e-confess no path reaches an ending/);
    expect(problems).toMatch(/from e-footprints no path reaches an ending/);

    // A loop back to the choice is fine: the student can always take the other way out.
    const back: Campaign = clone(echoTower);
    (back.chapters[0].scenes.find((s) => s.id === "e-footprints") as { next?: unknown }).next = "e-choice";
    expect(validateCampaign(back, echoTowerKeys).join("\n")).not.toMatch(/no path reaches an ending/);
  });

  it("finds a missing answer key", () => {
    const keys = clone(echoTowerKeys);
    delete keys["a-proof"];
    expect(validateCampaign(echoTower, keys)).toContain("echo-tower@1: a-proof has no evidence key");
  });
});
