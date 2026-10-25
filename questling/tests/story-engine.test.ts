import { describe, expect, it } from "vitest";
import { forgottenAcademy } from "@/lib/content/campaigns/forgotten-academy";
import { forgottenAcademyKeys } from "@/lib/content/campaigns/forgotten-academy-keys";
import { attemptsLeft, canCheck, initialState, reduce, type QuestionAction, type QuestionState } from "@/lib/story/engine";
import type { QuestionScene } from "@/lib/story/graph";
import { locate, startRun } from "@/lib/story/run";
import type { GradeResult, QuestionNode } from "@/lib/story/types";
import { questionNode } from "@/lib/student/story";

const { chapter, scene } = locate(forgottenAcademy, "tower-2")!;
const node = questionNode(forgottenAcademy, chapter, scene as QuestionScene, startRun(forgottenAcademy), "ru");
const grade = (_key: unknown, optionId: string): GradeResult => {
  const key = forgottenAcademyKeys["tower-2"];
  if (key.kind !== "question") throw new Error("tower-2 is a question");
  return { optionId, correct: optionId === key.correct, explanation: key.explanations[optionId].ru };
};
const key = null;

const run = (...actions: QuestionAction[]) => actions.reduce<QuestionState>((s, a) => reduce(node, s, a), initialState(node));
const answer = (optionId: string): QuestionAction[] => [
  { type: "select", optionId },
  { type: "graded", result: grade(key, optionId) },
];

describe("question node", () => {
  it("starts answering with nothing selected and cannot be checked yet", () => {
    const s = initialState(node);
    expect(s.phase).toBe("answering");
    expect(canCheck(s)).toBe(false);
    expect(attemptsLeft(node, s)).toBe(2);
  });

  it("selects only options that exist", () => {
    expect(run({ type: "select", optionId: "cellar" }).selected).toBe("cellar");
    expect(run({ type: "select", optionId: "attic" }).selected).toBeNull();
  });

  it("a correct answer grants the node's XP once and moves to correct", () => {
    const s = run(...answer("cellar"));
    expect(s.phase).toBe("correct");
    expect(s.xpGranted).toBe(50);
    expect(s.last?.explanation).toContain("Подземелье");
    // Nothing more can be chosen or graded after the node is solved.
    expect(reduce(node, s, { type: "select", optionId: "garden" })).toBe(s);
    expect(reduce(node, s, { type: "graded", result: grade(key, "cellar") })).toBe(s);
  });

  it("a wrong answer uses an attempt, strikes the option out and shows its explanation", () => {
    const s = run(...answer("garden"));
    expect(s.phase).toBe("incorrect");
    expect(s.attemptsUsed).toBe(1);
    expect(s.eliminated).toEqual(["garden"]);
    expect(s.last?.correct).toBe(false);
    expect(s.xpGranted).toBe(0);
    expect(reduce(node, s, { type: "select", optionId: "garden" })).toBe(s);
  });

  it("retry or choosing again returns to answering", () => {
    expect(run(...answer("garden"), { type: "retry" }).phase).toBe("answering");
    const s = run(...answer("garden"), { type: "select", optionId: "cellar" });
    expect(s.phase).toBe("answering");
    expect(s.selected).toBe("cellar");
  });

  it("the last wrong attempt exhausts the node", () => {
    const s = run(...answer("garden"), ...answer("tower"));
    expect(s.phase).toBe("exhausted");
    expect(attemptsLeft(node, s)).toBe(0);
    expect(canCheck(s)).toBe(false);
  });

  it("passing the grimoire restores exactly one attempt", () => {
    const exhausted = run(...answer("garden"), ...answer("tower"));
    expect(reduce(node, exhausted, { type: "grimoirePassed" })).toBe(exhausted);
    const back = run(...answer("garden"), ...answer("tower"), { type: "openGrimoire" }, { type: "grimoirePassed" });
    expect(back.phase).toBe("answering");
    expect(attemptsLeft(node, back)).toBe(1);
    const solved = reduce(node, reduce(node, back, { type: "select", optionId: "cellar" }), {
      type: "graded",
      result: grade(key, "cellar"),
    });
    expect(solved.phase).toBe("correct");
  });

  it("ignores a grade for an option other than the selected one", () => {
    const s = run({ type: "select", optionId: "cellar" });
    expect(reduce(node, s, { type: "graded", result: grade(key, "garden") })).toBe(s);
  });
});

describe("the story in both languages", () => {
  it("is the same question: only the interface-language texts differ", () => {
    const en = questionNode(forgottenAcademy, chapter, scene as QuestionScene, startRun(forgottenAcademy), "en");
    const shape = (n: QuestionNode) => ({
      clue: n.clue.text,
      options: n.options.map((o) => [o.id, o.label, o.icon]),
      attempts: n.maxAttempts,
      xp: n.reward.xp,
      quiz: n.grimoire.quiz,
    });
    expect(shape(en)).toEqual(shape(node));
    expect(en.prompt.lead).not.toEqual(node.prompt.lead);
    expect(en.grimoire.title).not.toEqual(node.grimoire.title);
  });
});

describe("question node resumed from a run", () => {
  it("opens with the attempts and ruled-out options the run recorded", () => {
    const s = initialState(node, { attemptsUsed: 1, eliminated: ["garden"] });
    expect(s.phase).toBe("answering");
    expect(attemptsLeft(node, s)).toBe(1);
    expect(reduce(node, s, { type: "select", optionId: "garden" }).selected).toBeNull();
  });

  it("opens paused when no attempts are left", () => {
    expect(initialState(node, { attemptsUsed: 2, eliminated: ["garden", "tower"] }).phase).toBe("exhausted");
  });
});
