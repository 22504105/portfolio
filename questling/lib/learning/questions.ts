import type { Text } from "@/lib/content/text";

// Question types of the quick quests and the story, and how an answer is graded.
// A question is what the student sees; its key (answers, explanations) is kept apart
// so a signed-in student's page never receives it: the server grades. The demo
// grades in the browser, which is why it is labelled and stores nothing on the server.
//
// Each type is drawn with parts of the approved screens: choices with the story
// player's option rows (05), word tiles and slots with the puzzle chamber's (06).

export type Choice = { id: string; text: string; gloss?: Text };

export type Question =
  /** One right option. `passage` makes it a reading question, `audio` a listening one. */
  | { kind: "choice"; id: string; prompt: Text; passage?: string; audio?: string; options: Choice[] }
  /** Several right options, all of which must be chosen. */
  | { kind: "multi"; id: string; prompt: Text; options: Choice[] }
  /** A gap in a sentence ("___"), filled from a bank of words. */
  | { kind: "fill"; id: string; prompt: Text; sentence: string; bank: string[] }
  /** Words to put in order. */
  | { kind: "order"; id: string; prompt: Text; tiles: string[] }
  /** Each word on the left to its match on the right. */
  | { kind: "match"; id: string; prompt: Text; left: string[]; right: string[] };

export type QuestionKey =
  | { kind: "choice"; correct: string; explanation: Text }
  | { kind: "multi"; correct: string[]; explanation: Text }
  | { kind: "fill"; correct: string; explanation: Text }
  | { kind: "order"; correct: string[]; explanation: Text }
  | { kind: "match"; correct: Record<string, string>; explanation: Text };

/** A student's answer, by question kind. */
export type Answer =
  | { kind: "choice"; option: string }
  | { kind: "multi"; options: string[] }
  | { kind: "fill"; word: string }
  | { kind: "order"; tiles: string[] }
  | { kind: "match"; pairs: Record<string, string> };

export type Graded = { correct: boolean; explanation: Text };

/** Whether an answer is well formed for the question it claims to answer. Anything else is refused, not graded. */
export function validAnswer(question: Question, answer: unknown): answer is Answer {
  if (!answer || typeof answer !== "object") return false;
  const a = answer as Record<string, unknown>;
  if (a.kind !== question.kind) return false;
  const optionIds = "options" in question ? question.options.map((o) => o.id) : [];
  switch (question.kind) {
    case "choice":
      return typeof a.option === "string" && optionIds.includes(a.option);
    case "multi":
      return (
        Array.isArray(a.options) &&
        a.options.length > 0 &&
        a.options.length <= optionIds.length &&
        new Set(a.options).size === a.options.length &&
        a.options.every((o) => typeof o === "string" && optionIds.includes(o))
      );
    case "fill":
      return typeof a.word === "string" && question.bank.includes(a.word);
    case "order":
      return (
        Array.isArray(a.tiles) &&
        a.tiles.length === question.tiles.length &&
        [...a.tiles].sort().join("\u0000") === [...question.tiles].sort().join("\u0000")
      );
    case "match": {
      const pairs = a.pairs;
      if (!pairs || typeof pairs !== "object" || Array.isArray(pairs)) return false;
      const entries = Object.entries(pairs as Record<string, unknown>);
      return (
        entries.length === question.left.length &&
        entries.every(([left, right]) => question.left.includes(left) && typeof right === "string" && question.right.includes(right)) &&
        new Set(entries.map(([, right]) => right)).size === entries.length
      );
    }
  }
}

export function gradeAnswer(key: QuestionKey, answer: Answer): Graded {
  const correct = (() => {
    if (key.kind !== answer.kind) return false;
    switch (key.kind) {
      case "choice":
        return answer.kind === "choice" && answer.option === key.correct;
      case "multi":
        return (
          answer.kind === "multi" && answer.options.length === key.correct.length && key.correct.every((id) => answer.options.includes(id))
        );
      case "fill":
        return answer.kind === "fill" && answer.word === key.correct;
      case "order":
        return answer.kind === "order" && answer.tiles.join(" ") === key.correct.join(" ");
      case "match":
        return answer.kind === "match" && Object.entries(key.correct).every(([left, right]) => answer.pairs[left] === right);
    }
  })();
  return { correct, explanation: key.explanation };
}
