import type { Text } from "@/lib/content/text";

// What an exercise trains, finer than its skill: the grammar theme or word set a mistake points at.
// Built-in exercises are tagged here; a teacher's scenes carry their own tag (scene.objective),
// chosen from the same list. Recommendations (recommend.ts) count mistakes per objective.

export const OBJECTIVES = {
  vocabulary: { ru: "Слова и значения", en: "Words and meanings" },
  modals: { ru: "Модальные глаголы (must, can)", en: "Modal verbs (must, can)" },
  questions: { ru: "Вопросы (whose, did…)", en: "Questions (whose, did…)" },
  frequency: { ru: "Наречия частоты (never, often)", en: "Adverbs of frequency (never, often)" },
  time: { ru: "Выражения времени (only at, until)", en: "Time expressions (only at, until)" },
  prepositions: { ru: "Предлоги места и направления", en: "Prepositions of place and direction" },
  adjectives: { ru: "Прилагательные (too + adjective)", en: "Adjectives (too + adjective)" },
  "word-order": { ru: "Порядок слов", en: "Word order" },
  "past-simple": { ru: "Past Simple", en: "Past Simple" },
  "present-perfect": { ru: "Present Perfect", en: "Present Perfect" },
  "past-perfect": { ru: "Past Perfect", en: "Past Perfect" },
  conditionals: { ru: "Условные предложения", en: "Conditionals" },
  "relative-clauses": { ru: "Придаточные (who, whoever)", en: "Relative clauses (who, whoever)" },
  "reported-speech": { ru: "Косвенная речь", en: "Reported speech" },
  politeness: { ru: "Вежливые фразы", en: "Polite phrases" },
  reading: { ru: "Понимание прочитанного", en: "Reading for detail" },
  listening: { ru: "Понимание на слух", en: "Listening for detail" },
  deduction: { ru: "Доказательства и выводы", en: "Evidence and conclusions" },
} satisfies Record<string, Text>;

export type Objective = keyof typeof OBJECTIVES;
export const OBJECTIVE_IDS = Object.keys(OBJECTIVES) as Objective[];
export const isObjective = (value: unknown): value is Objective => typeof value === "string" && value in OBJECTIVES;

/** Built-in story scenes, by campaign and scene. */
export const STORY_OBJECTIVES: Record<string, Record<string, Objective>> = {
  "forgotten-academy": {
    "prologue-1": "modals",
    "tower-1": "questions",
    "tower-2": "frequency",
    "tower-3": "word-order",
    "tower-4": "time",
    "tower-5": "prepositions",
    "f-riddle": "adjectives",
    "f-proof": "deduction",
    "f-thanks": "politeness",
  },
  "echo-tower": {
    "e-wind": "adjectives",
    "e-cipher": "present-perfect",
    "e-tense": "past-perfect",
    "e-proof": "deduction",
    "a-cond": "conditionals",
    "a-cipher": "relative-clauses",
    "a-reported": "reported-speech",
    "a-proof": "deduction",
  },
};

/** Built-in quick quests' questions, by quest and question. */
export const QUEST_OBJECTIVES: Record<string, Record<string, Objective>> = {
  letter: { seal: "vocabulary", candle: "vocabulary", words: "vocabulary" },
  mist: { went: "past-simple", question: "past-simple", saw: "past-simple" },
  raven: { where: "listening", when: "listening", bring: "listening" },
  stars: { under: "prepositions", between: "prepositions", sentence: "word-order" },
  runes: { door: "word-order", owl: "word-order", opposites: "vocabulary" },
  bells: { who: "listening", stairs: "listening", often: "frequency" },
  scroll: { why: "reading", when: "reading", box: "reading" },
};
