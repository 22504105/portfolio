// A question node as the player sees it, and the part of it only the grader
// may see. The split is the point: a client never receives `QuestionKey`, so the
// answer cannot be read out of the page. (In the demo both live in the browser,
// which is why the demo is labelled and never writes anything.)

export type OptionIcon = "stairs" | "park" | "fort";

export type QuestionOption = {
  id: string;
  /** The English answer, e.g. "The cellar". */
  label: string;
  /** Its gloss in the UI language, e.g. "Подземелье без окон". */
  gloss: string;
  icon: OptionIcon;
};

export type QuestionNode = {
  id: string;
  kind: "question";
  chapter: string;
  cefr: string;
  storyTitle: string;
  location: string;
  image: string;
  /** Position of this clue in the chapter, 1-based, and how many clues the chapter has. */
  clue: { index: number; total: number; text: string; title: string };
  prompt: { lead: string; task: string };
  options: QuestionOption[];
  maxAttempts: number;
  reward: { xp: number };
};

export type QuestionKey = {
  nodeId: string;
  correctOptionId: string;
  /** Why each option is right or wrong; shown after it has been chosen. */
  explanations: Record<string, string>;
  /** Shown after a wrong answer. */
  hint: { topic: string; text: string };
};

export type GradeResult = {
  optionId: string;
  correct: boolean;
  explanation: string;
};
