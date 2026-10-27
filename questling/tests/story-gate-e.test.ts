import { describe, expect, it } from "vitest";
import { campaignVersion } from "@/lib/content/campaigns";
import { forgottenAcademy, forgottenAcademyV1 } from "@/lib/content/campaigns/forgotten-academy";
import { keysOf } from "@/lib/content/campaigns/keys";
import { applyEffects, emptyFacts, type Facts } from "@/lib/game/facts";
import { run as act, type Action } from "@/lib/game/ops";
import { owns, runOf } from "@/lib/game/stats";
import { rightMove } from "@/lib/story/autoplay";
import type { Campaign, Scene } from "@/lib/story/graph";
import { locate, move, runSeed, startRun, type RunState } from "@/lib/story/run";
import { validateCampaign } from "@/lib/story/validate";
import { studioRun } from "@/lib/studio/ops";
import { demoStudio } from "@/lib/studio/demo";

// Features gate E (docs/features-audit.md): talks with characters, picture searches, voice-acting
// scenes inside the story, and their rewards.

const campaign = forgottenAcademy;
const keys = keysOf(campaign);
const clone = <T>(v: T): T => structuredClone(v);

/** A run played right up to `until`, taking the named choices on the way. */
function runTo(until: string, choices: Record<string, string> = {}): RunState {
  let run = startRun(campaign, runSeed("2026-10-01T00:00:00.000Z", campaign));
  for (let i = 0; i < 80 && run.scene !== until; i++) {
    const m = rightMove(campaign, keys, run, choices);
    if (!m) break;
    const r = move(campaign, keys, run, m);
    if (!r.ok) throw new Error(`${m.type} at ${run.scene}: ${r.refusal}`);
    run = r.run;
  }
  if (run.scene !== until) throw new Error(`never reached ${until}`);
  return run;
}
const ok = (r: ReturnType<typeof move>) => {
  if (!r.ok) throw new Error(r.refusal);
  return r;
};

describe("talks", () => {
  it("offer the owl's line only to a student who found the owl's note, and set a flag for it", () => {
    const withNote = runTo("f-ask", { "t-choice": "reread" });
    expect(withNote.clues).toContain("owl-note");
    let r = ok(move(campaign, keys, withNote, { type: "say", scene: "f-ask", response: "letter" })).run;
    expect(r.talk?.["f-ask"]).toBe("letter");
    r = ok(move(campaign, keys, r, { type: "say", scene: "f-ask", response: "owl" })).run;
    expect(r.flags).toContain("owl-trust");
    const end = ok(move(campaign, keys, r, { type: "say", scene: "f-ask", response: "ready" }));
    expect(end.run.scene).toBe("f-riddle");
    expect(end.run.talk?.["f-ask"]).toBeUndefined();
    expect(end.grants).toEqual([expect.objectContaining({ currency: "xp", amount: 15, key: "story:forgotten-academy:scene:f-ask" })]);

    const without = runTo("f-ask", { "t-choice": "now" });
    expect(without.clues).not.toContain("owl-note");
    const asked = ok(move(campaign, keys, without, { type: "say", scene: "f-ask", response: "letter" })).run;
    expect(move(campaign, keys, asked, { type: "say", scene: "f-ask", response: "owl" })).toEqual({ ok: false, refusal: "invalid" });
    expect(ok(move(campaign, keys, asked, { type: "say", scene: "f-ask", response: "forgot" })).run.scene).toBe("f-riddle");
  });

  it("refuse a response of another line, and remember the line between sessions (it is in the run)", () => {
    const at = runTo("f-ask");
    expect(move(campaign, keys, at, { type: "say", scene: "f-ask", response: "ready" })).toEqual({ ok: false, refusal: "invalid" });
    const r = ok(move(campaign, keys, at, { type: "say", scene: "f-ask", response: "lost" })).run;
    const reloaded = JSON.parse(JSON.stringify(r)) as RunState;
    expect(ok(move(campaign, keys, reloaded, { type: "say", scene: "f-ask", response: "ok" })).run.scene).toBe("f-riddle");
  });

  it("are checked before publishing: lines nobody reaches, a line where nothing can be said, a talk that never ends", () => {
    const broken = clone(campaign) as Campaign;
    const talk = locate(broken, "f-ask")!.scene as Extract<Scene, { kind: "talk" }>;
    talk.lines.push({
      id: "orphan",
      text: "Hm.",
      translation: { ru: "Хм.", en: "Hm." },
      responses: [{ id: "x", text: "Bye.", gloss: { ru: "Пока.", en: "Bye." }, to: "end" }],
    });
    talk.lines.find((l) => l.id === "letter")!.responses = [{ ...talk.lines.find((l) => l.id === "letter")!.responses[0] }];
    const problems = validateCampaign(broken, keysOf(campaign)).join("\n");
    expect(problems).toMatch(/f-ask\/orphan: no response leads to this line/);
    expect(problems).toMatch(/f-ask\/letter: every response needs a condition/);
    const endless = clone(campaign) as Campaign;
    const t2 = locate(endless, "f-ask")!.scene as Extract<Scene, { kind: "talk" }>;
    for (const l of t2.lines) for (const r of l.responses) r.to = "why";
    expect(validateCampaign(endless, keysOf(campaign)).join("\n")).toMatch(/f-ask: the talk never ends/);
  });
});

describe("picture searches", () => {
  it("count a wrong tap without cost, want the stone before the mushrooms, and pay XP, the item and move on once", () => {
    const at = runTo("f-search");
    const wrong = ok(move(campaign, keys, at, { type: "tap", scene: "f-search", spot: "stone-p" }));
    expect(wrong.tapped).toEqual({ spot: "stone-p", correct: false, done: false });
    expect(wrong.run.progress["f-search"].used).toBe(1);
    // In order: the mushrooms before the stone are wrong.
    expect(ok(move(campaign, keys, at, { type: "tap", scene: "f-search", spot: "mushrooms" })).tapped?.correct).toBe(false);
    const stone = ok(move(campaign, keys, wrong.run, { type: "tap", scene: "f-search", spot: "stone-r" }));
    expect(stone.tapped).toEqual({ spot: "stone-r", correct: true, done: false });
    expect(move(campaign, keys, stone.run, { type: "tap", scene: "f-search", spot: "stone-r" })).toEqual({ ok: false, refusal: "invalid" });
    const done = ok(move(campaign, keys, stone.run, { type: "tap", scene: "f-search", spot: "mushrooms" }));
    expect(done.tapped).toEqual({ spot: "mushrooms", correct: true, done: true });
    expect(done.items).toEqual(["sprite"]);
    expect(done.run.scene).toBe("f-spirit");
    expect(done.grants).toEqual([expect.objectContaining({ amount: 20, key: "story:forgotten-academy:scene:f-search" })]);
  });

  it("through the rules: the glow sprite is owned (once), and the taps are answers for the suggestions", () => {
    let facts: Facts = emptyFacts("2026-10-01T10:00:00.000Z");
    const now = new Date("2026-10-27T09:00:00Z");
    const play = (action: Action) => {
      const r = act(facts, action, { now, locale: "ru", demo: true });
      if (!r.ok) throw new Error(`${action.type}: ${r.refusal}`);
      facts = applyEffects(facts, r.effects, now.toISOString());
      return r;
    };
    play({ type: "chooseCharacter", characterId: "fox" });
    for (let i = 0; i < 80; i++) {
      const current = runOf(facts, campaign.id) ?? startRun(campaign, runSeed(facts.profile.joinedAt, campaign));
      if (current.scene === "f-search") break;
      play({ type: "story", campaign: campaign.id, move: rightMove(campaign, keys, current)! });
    }
    play({ type: "story", campaign: campaign.id, move: { type: "tap", scene: "f-search", spot: "stone-r" } });
    const last = play({ type: "story", campaign: campaign.id, move: { type: "tap", scene: "f-search", spot: "mushrooms" } });
    expect(last.outcome).toMatchObject({ kind: "story", items: ["sprite"], tapped: { done: true } });
    expect(owns(facts, "sprite")).toBe(true);
    expect(facts.inventory.find((o) => o.item === "sprite")?.source).toBe("story");
    expect(facts.answers.filter((a) => a.question.startsWith("f-search:")).map((a) => a.correct)).toEqual([true, true]);
  });

  it("are checked before publishing: targets among the spots, something to tell apart, spots big enough to tap", () => {
    const broken = clone(campaign) as Campaign;
    const search = locate(broken, "f-search")!.scene as Extract<Scene, { kind: "search" }>;
    search.spots[2].w = 0.02;
    const k = clone(keysOf(campaign));
    k["f-search"] = { kind: "search", targets: ["stone-r", "nowhere"], ordered: true };
    const problems = validateCampaign(broken, k).join("\n");
    expect(problems).toMatch(/f-search\/stone-p: too small to tap/);
    expect(problems).toMatch(/f-search: a target is not one of its spots/);
  });
});

describe("voice acting inside the story", () => {
  const withDub = (optional: boolean): Campaign => {
    const c = clone(campaign) as Campaign;
    c.chapters[0].scenes.splice(1, 0, {
      kind: "dub",
      id: "p-dub",
      location: { ru: "Л", en: "L" },
      image: "/images/grand-library.webp",
      exercise: "d-demo-archive",
      text: "Speak for the student.",
      translation: { ru: "Озвучь ученика.", en: "Speak for the student." },
      optional,
      clue: undefined,
    });
    return c;
  };

  it("goes on once the recording is sent, or without it only when the teacher allowed that", () => {
    const strict = withDub(false);
    const at = { ...startRun(strict), scene: "p-dub" };
    expect(move(strict, keys, at, { type: "advance", scene: "p-dub" })).toEqual({ ok: false, refusal: "not_ready" });
    expect(move(strict, keys, at, { type: "advance", scene: "p-dub" }, { dubSent: (e) => e === "d-demo-archive" }).ok).toBe(true);
    const lenient = withDub(true);
    expect(move(lenient, keys, { ...startRun(lenient), scene: "p-dub" }, { type: "advance", scene: "p-dub" }).ok).toBe(true);
  });
});

describe("versions", () => {
  it("a run begun on version 1 keeps playing version 1 (no forest search there); new runs get version 2", () => {
    expect(campaignVersion("forgotten-academy", 1)).toBe(forgottenAcademyV1);
    expect(locate(forgottenAcademyV1, "f-search")).toBeNull();
    expect(locate(campaign, "f-search")).not.toBeNull();
    expect(validateCampaign(forgottenAcademyV1, keysOf(forgottenAcademyV1))).toEqual([]);
    expect(validateCampaign(campaign, keys)).toEqual([]);
  });
});

describe("Teacher Studio", () => {
  const ctx = { now: new Date("2026-10-27T09:00:00Z"), newId: () => crypto.randomUUID(), newCode: () => "ABCDEFGH" };

  it("refuses to publish a campaign whose voice-acting scene is not one of the teacher's published ones", () => {
    let facts = demoStudio(new Date("2026-10-27T09:00:00Z"));
    const quest = facts.quests[0];
    const draft = quest.versions.at(-1)!;
    const graph = clone(draft.graph);
    graph.chapters[0].scenes.splice(1, 0, {
      kind: "dub",
      id: "x-dub",
      location: { ru: "Л", en: "L" },
      image: "/images/grand-library.webp",
      exercise: "d-not-mine-at-all",
      text: "Speak.",
      translation: { ru: "Говори.", en: "Speak." },
      optional: true,
    });
    const saved = studioRun(facts, { type: "saveDraft", questId: quest.id, graph, keys: draft.keys }, ctx);
    if (!saved.ok) throw new Error(saved.refusal);
    facts = {
      ...facts,
      quests: facts.quests.map((q) =>
        q.id === quest.id
          ? {
              ...q,
              versions: [
                ...q.versions.filter((v) => v.status === "published"),
                { ...draft, status: "draft" as const, version: draft.version + (draft.status === "published" ? 1 : 0), graph },
              ],
            }
          : q,
      ),
    };
    const refused = studioRun(facts, { type: "publish", questId: quest.id }, ctx);
    expect(refused).toMatchObject({ ok: false, refusal: "invalid_graph" });
    expect(!refused.ok && refused.problems?.join("\n")).toMatch(/x-dub: choose one of your published voice-acting scenes/);
  });

  it("gives a group the voice-acting scenes of a campaign assigned to it", () => {
    const facts = demoStudio(new Date("2026-10-27T09:00:00Z"));
    const quest = facts.quests.find((q) => q.versions.some((v) => v.status === "published"))!;
    const published = quest.versions.filter((v) => v.status === "published").at(-1)!;
    published.graph.chapters[0].scenes.splice(1, 0, {
      kind: "dub",
      id: "x-dub",
      location: { ru: "Л", en: "L" },
      image: "/images/grand-library.webp",
      exercise: "d-demo-archive",
      text: "Speak.",
      translation: { ru: "Говори.", en: "Speak." },
      optional: true,
    });
    const group = facts.groups[1];
    const result = studioRun(facts, { type: "assign", groupId: group.id, campaign: quest.slug }, ctx);
    if (!result.ok) throw new Error(result.refusal);
    expect(result.effects).toContainEqual(
      expect.objectContaining({
        type: "dub.assign",
        assignment: expect.objectContaining({ groupId: group.id, exercise: "d-demo-archive", version: 1 }),
      }),
    );
  });
});
