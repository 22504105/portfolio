// A story node as the player sees it, and the part of it only the grader
// may see. The split is the point: a client never receives the key, so the
// answer cannot be read out of the page. (In the demo both live in the browser,
// which is why the demo is labelled and never writes anything to the server.)

export type OptionIcon = "stairs" | "park" | "fort" | "local_library" | "restaurant" | "nightlight" | "skull" | "water_drop" | "door_front";

export type QuestionOption = {
  id: string;
  /** The English answer, e.g. "The cellar". */
  label: string;
  /** Its gloss in the UI language, e.g. "Подземелье без окон". */
  gloss: string;
  icon: OptionIcon;
};

/** What every node shows about where it is in the story. */
type NodeFrame = {
  id: string;
  chapter: string;
  cefr: string;
  storyTitle: string;
  location: string;
  image: string;
  /** Position of this clue in the chapter, 1-based, and how many clues the chapter has. */
  clue: { index: number; total: number; text: string; title: string };
  maxAttempts: number;
  reward: { xp: number };
};

export type QuestionNode = NodeFrame & {
  kind: "question";
  prompt: { lead: string; task: string };
  options: QuestionOption[];
  /** The parchment's line in the interface language, offered after a wrong answer. */
  translation: string;
  /** Shown after a wrong answer: points the way without giving the answer. */
  hint: { topic: string; text: string };
};

/** A word-order cipher (06_interactive_puzzle). */
export type PuzzleNode = NodeFrame & {
  kind: "puzzle";
  title: string;
  task: string;
  scroll: string;
  altar: string;
  tiles: string[];
  hint: string;
};

export type StoryNode = QuestionNode | PuzzleNode;

export type GradeResult = {
  optionId: string;
  correct: boolean;
  explanation: string;
};
