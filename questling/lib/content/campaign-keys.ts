import type { Locale } from "@/lib/i18n";
import type { GradeResult } from "@/lib/story/types";
import type { Text } from "./text";
import { tr } from "./text";

// Answer keys of the campaign's nodes: server and demo only, like quick-quest-keys.ts.

type QuestionKeyContent = {
  kind: "question";
  correct: string;
  explanations: Record<string, Text>;
};
type PuzzleKeyContent = { kind: "puzzle"; order: string[]; explanation: Text };

const notHere: Text = { ru: "Это не то место.", en: "This is not the place." };

export const campaignKeys: Record<string, QuestionKeyContent | PuzzleKeyContent> = {
  "prologue-1": {
    kind: "question",
    correct: "whisper",
    explanations: {
      whisper: {
        ru: "«Be quiet» — вести себя тихо: в библиотеке говорят шёпотом.",
        en: "“Be quiet” means make little noise: in a library people speak softly.",
      },
      eat: { ru: "В правиле нет ни слова о еде.", en: "The rule says nothing about food." },
      sleep: { ru: "Quiet — не значит «спать»: это про тишину.", en: "Quiet does not mean asleep: it is about noise." },
    },
  },
  "tower-1": {
    kind: "question",
    correct: "archivist",
    explanations: {
      archivist: { ru: "«Сова и луна — знак хранителя библиотеки.»", en: "“The owl and the moon are the sign of the library's keeper.”" },
      cook: { ru: "«Печать повара — ложка, а не сова.»", en: "“The cook's seal is a spoon, not an owl.”" },
      guard: { ru: "«У стражника нет своей печати.»", en: "“The guard has no seal of his own.”" },
    },
  },
  "tower-2": {
    kind: "question",
    correct: "cellar",
    explanations: {
      cellar: {
        ru: "«Подземелье без окон — глубоко под башней, куда лунный свет никогда не проникает.»",
        en: "“A room with no windows, deep under the tower, where moonlight never reaches.”",
      },
      garden: {
        ru: "«В саду лунный свет падает прямо на кроны деревьев и тропы. Это не то место.»",
        en: "“In the garden the moonlight falls straight onto the trees and paths. This is not the place.”",
      },
      tower: {
        ru: "«Шпиль открыт небу: луна заглядывает в его окна каждую ночь. Это не то место.»",
        en: "“The spire is open to the sky: the moon looks through its windows every night. This is not the place.”",
      },
    },
  },
  "tower-3": {
    kind: "puzzle",
    order: ["We", "found", "the", "key"],
    explanation: { ru: "We found the key — «Мы нашли ключ». Сундук открыт!", en: "“We found the key.” The chest is open!" },
  },
  "tower-4": {
    kind: "question",
    correct: "midnight",
    explanations: {
      midnight: { ru: "«Only at midnight» — только в полночь.", en: "“Only at midnight”: at no other time." },
      morning: {
        ru: "«Утром дверь заперта: в манускрипте сказано — только в полночь.»",
        en: "“In the morning the door is locked: the manuscript says only at midnight.”",
      },
      always: { ru: "«Only» — значит «только»: не в любое время.", en: "“Only” means at that one time, not at any time." },
    },
  },
  "tower-5": {
    kind: "question",
    correct: "water",
    explanations: {
      water: { ru: "«Follow the sound of water» — иди на звук воды.", en: "“Follow the sound of water”: go where you hear water." },
      crypt: notHere,
      stairs: { ru: "«Карта ведёт вперёд, на север, а не назад.»", en: "“The map leads on, to the north, not back.”" },
    },
  },
};

/** Grades an answer to any campaign node: an option id, or the tiles in order. */
export function gradeStoryAnswer(nodeId: string, answer: string | string[], locale: Locale): GradeResult | null {
  const key = campaignKeys[nodeId];
  if (!key) return null;
  if (key.kind === "question") {
    if (typeof answer !== "string" || !(answer in key.explanations)) return null;
    return { optionId: answer, correct: answer === key.correct, explanation: tr(key.explanations[answer], locale) };
  }
  if (!Array.isArray(answer)) return null;
  const correct = answer.join(" ") === key.order.join(" ");
  return { optionId: answer.join(" "), correct, explanation: correct ? tr(key.explanation, locale) : "" };
}
