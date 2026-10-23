import { describe, expect, it } from "vitest";
import { demoQuestion as node, demoQuestionKey as key } from "@/lib/demo/story";
import { attemptsLeft, canCheck, grade, initialState, reduce, type QuestionAction, type QuestionState } from "@/lib/story/engine";

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
