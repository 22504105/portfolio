import { describe, expect, it } from "vitest";
import { campaignById } from "@/lib/content/campaigns";
import { keysOf } from "@/lib/content/campaigns/keys";
import { applyEffects, emptyFacts, type Facts } from "@/lib/game/facts";
import { run, type Action, type OpResult } from "@/lib/game/ops";
import { balance, campaignFinished, chapterStatus, currentChapter, foundClues, metric, runOf } from "@/lib/game/stats";
import { rightMove } from "@/lib/story/autoplay";
import type { QuestionScene } from "@/lib/story/graph";
import { locate, startRun, type Move } from "@/lib/story/run";

const now = new Date("2026-10-24T09:00:00Z");
const academy = campaignById.get("forgotten-academy")!;
const echo = campaignById.get("echo-tower")!;

function student(): { facts: Facts; act: (action: Action) => OpResult } {
  const state = { facts: emptyFacts(now.toISOString()) };
  const act = (action: Action) => {
    const result = run(state.facts, action, { now, locale: "ru", demo: false });
    if (result.ok) state.facts = applyEffects(state.facts, result.effects, now.toISOString());
    return result;
  };
  act({ type: "chooseCharacter", characterId: "cat" });
  return {
    get facts() {
      return state.facts;
    },
    act,
  };
}

/** Plays a campaign with right moves until `until` (a scene) or the end; returns the ending reached. */
function play(s: ReturnType<typeof student>, campaign = academy, choices: Record<string, string> = {}, until?: string) {
  for (let step = 0; step < 100; step++) {
    const current = runOf(s.facts, campaign.id) ?? startRun(campaign);
    if (current.ending || current.scene === until) return current.ending;
    const move = rightMove(campaign, keysOf(campaign), current, choices);
    if (!move) throw new Error(`no right move at ${current.scene}`);
    const result = s.act({ type: "story", campaign: campaign.id, move });
    if (!result.ok) throw new Error(`${current.scene}: ${result.refusal}`);
  }
  throw new Error("story never ended");
}

const story = (s: ReturnType<typeof student>, move: Move, campaign = academy.id) => s.act({ type: "story", campaign, move });

describe("campaign runs", () => {
  it("every choice leads to its own ending: guardian, keeper, and the secret one", () => {
    expect(play(student(), academy, { "t-choice": "now", "f-choice": "give" })).toBe("end-guardian");
    expect(play(student(), academy, { "t-choice": "now", "f-choice": "keep" })).toBe("end-keeper");
    expect(play(student(), academy, { "t-choice": "reread", "f-choice": "give" })).toBe("end-true");
    expect(play(student(), academy, { "t-choice": "reread", "f-choice": "keep" })).toBe("end-keeper");
  });

  it("the second campaign opens only once the first is finished, and has three endings too", () => {
    const s = student();
    expect(story(s, { type: "advance", scene: "e-bell" }, echo.id)).toEqual({ ok: false, refusal: "not_available" });
    play(s);
    expect(campaignFinished(s.facts, academy.id)).toBe(true);
    expect(currentChapter(s.facts)?.chapter.id).toBe("echo");
    expect(play(s, echo, { "e-choice": "climb", "a-choice": "reveal" })).toBe("end-justice");

    const pressed = student();
    play(pressed);
    expect(play(pressed, echo, { "e-choice": "press", "a-choice": "mercy" })).toBe("end-redemption");
    const climbed = student();
    play(climbed);
    expect(play(climbed, echo, { "e-choice": "climb", "a-choice": "mercy" })).toBe("end-mercy");
    expect(currentChapter(climbed.facts)).toBeNull();
  });

  it("rewards are granted once: per scene, per chapter, per ending", () => {
    const s = student();
    play(s, academy, { "t-choice": "reread", "f-choice": "give" });
    const keys = s.facts.ledger.map((e) => `${e.currency}:${e.key}`);
    expect(new Set(keys).size).toBe(keys.length);
    const graded = academy.chapters.flatMap((c) => c.scenes).filter((sc) => sc.kind !== "ending" && "xp" in sc);
    // The path with the reread letter and the gift skips only the keeper's dialogue: every graded scene is on it.
    const sceneXp = graded.reduce((sum, sc) => sum + ("xp" in sc ? sc.xp : 0), 0);
    const chapterXp = academy.chapters.reduce((sum, c) => sum + c.reward.xp, 0);
    const ending = locate(academy, "end-true")!.scene;
    expect(balance(s.facts, "xp")).toBe(sceneXp + chapterXp + (ending.kind === "ending" ? ending.reward.xp : 0));
    expect(s.facts.completions.filter((c) => c.kind === "chapter").map((c) => c.ref)).toEqual([
      "forgotten-academy/prologue",
      "forgotten-academy/tower",
      "forgotten-academy/forest",
    ]);
    expect(s.facts.completions.some((c) => c.kind === "ending" && c.ref === "forgotten-academy")).toBe(true);
    // A finished story takes no more moves.
    expect(story(s, { type: "advance", scene: "p-arrive" })).toEqual({ ok: false, refusal: "not_available" });
  });

  it("only the scene the run is at can be played, and only in its own way", () => {
    const s = student();
    expect(story(s, { type: "answer", scene: "prologue-1", answer: "whisper" })).toEqual({ ok: false, refusal: "not_available" });
    expect(story(s, { type: "choose", scene: "p-arrive", option: "x" })).toEqual({ ok: false, refusal: "invalid" });
    play(s, academy, {}, "prologue-1");
    expect(story(s, { type: "answer", scene: "prologue-1", answer: "nonsense" })).toEqual({ ok: false, refusal: "invalid" });
    expect(story(s, { type: "advance", scene: "prologue-1" })).toEqual({ ok: false, refusal: "invalid" });
  });

  it("wrong answers use up attempts; the grimoire wins one back; the mentor can be asked", () => {
    const s = student();
    play(s, academy, {}, "prologue-1");
    const wrong = story(s, { type: "answer", scene: "prologue-1", answer: "eat" });
    expect(wrong.ok && wrong.outcome).toMatchObject({
      kind: "story",
      answer: { correct: false, explanation: "В правиле нет ни слова о еде." },
    });
    // The same wrong option cannot be tried twice.
    expect(story(s, { type: "answer", scene: "prologue-1", answer: "eat" })).toEqual({ ok: false, refusal: "invalid" });
    expect(story(s, { type: "grimoire", scene: "prologue-1", word: "must" })).toEqual({ ok: false, refusal: "not_exhausted" });
    expect(s.act({ type: "askMentor", campaign: academy.id, scene: "prologue-1" })).toEqual({ ok: false, refusal: "not_exhausted" });
    story(s, { type: "answer", scene: "prologue-1", answer: "sleep" });
    expect(story(s, { type: "answer", scene: "prologue-1", answer: "whisper" })).toEqual({ ok: false, refusal: "exhausted" });

    expect(s.act({ type: "askMentor", campaign: academy.id, scene: "prologue-1" }).ok).toBe(true);
    expect(s.act({ type: "askMentor", campaign: academy.id, scene: "prologue-1" })).toEqual({ ok: false, refusal: "already_done" });
    expect(s.facts.completions.some((c) => c.kind === "help_request" && c.ref === "forgotten-academy/prologue-1")).toBe(true);

    const scene = locate(academy, "prologue-1")!.scene as QuestionScene;
    expect(story(s, { type: "grimoire", scene: "prologue-1", word: "not-an-option" })).toEqual({ ok: false, refusal: "invalid" });
    const miss = story(s, { type: "grimoire", scene: "prologue-1", word: scene.grimoire.quiz.options.find((w) => w !== "must")! });
    expect(miss.ok && miss.outcome).toMatchObject({ grimoire: { correct: false } });
    const studied = story(s, { type: "grimoire", scene: "prologue-1", word: "must" });
    expect(studied.ok && studied.outcome).toMatchObject({ grimoire: { correct: true } });
    // Exactly one attempt back: a second study is refused until it is used.
    expect(story(s, { type: "grimoire", scene: "prologue-1", word: "must" })).toEqual({ ok: false, refusal: "not_exhausted" });
    const right = story(s, { type: "answer", scene: "prologue-1", answer: "whisper" });
    expect(right.ok && right.outcome).toMatchObject({
      answer: { correct: true },
      chapterDone: "prologue",
      rewarded: { xp: 100, coins: 10 },
    });
    expect(s.facts.answers.filter((a) => a.ref === academy.id).map((a) => [a.attempt, a.correct])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
  });

  it("evidence takes only clues the student has found", () => {
    const s = student();
    play(s, academy, { "t-choice": "now" }, "f-proof");
    // owl-note was only on the careful path; the bell is from the other campaign.
    expect(story(s, { type: "answer", scene: "f-proof", answer: "owl-note" })).toEqual({ ok: false, refusal: "invalid" });
    const wrong = story(s, { type: "answer", scene: "f-proof", answer: "bronze-key" });
    expect(wrong.ok && wrong.outcome).toMatchObject({ answer: { correct: false } });
    const right = story(s, { type: "answer", scene: "f-proof", answer: "seal" });
    expect(right.ok && right.outcome).toMatchObject({ answer: { correct: true } });
  });

  it("the map and the journal read the run: chapter states, clues found, the clue achievement", () => {
    const s = student();
    expect(academy.chapters.map((c) => chapterStatus(s.facts, academy, c))).toEqual(["open", "locked", "locked"]);
    expect(echo.chapters.map((c) => chapterStatus(s.facts, echo, c))).toEqual(["locked", "locked"]);
    play(s, academy, { "t-choice": "reread" }, "tower-3");
    expect(academy.chapters.map((c) => chapterStatus(s.facts, academy, c))).toEqual(["done", "current", "locked"]);
    expect(foundClues(s.facts).map((f) => f.clue.id)).toEqual(["prologue-tome", "seal", "bronze-key", "owl-note"]);
    expect(metric(s.facts, "clues")).toBe(4);
  });
});
