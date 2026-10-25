// A graded scene as the player shows it, in the interface language, and the grade it gets back.
// Built from the campaign graph (lib/student/story.ts) and never carries an answer key: a client
// cannot read the answer out of the page. (In the demo the keys live in the browser too, which is
// why the demo is labelled and never writes anything to the server.)

export type OptionIcon =
  "stairs" | "park" | "fort" | "castle" | "local_library" | "restaurant" | "nightlight" | "skull" | "water_drop" | "door_front";

export type QuestionOption = {
  id: string;
  /** The English answer, e.g. "The cellar". */
  label: string;
  /** Its gloss in the UI language, e.g. "Подземелье без окон". */
  gloss: string;
  icon: OptionIcon;
  /** A clue's own picture, when the options are clues from the journal (evidence). */
  image?: string;
};

/** The study sheet of a scene (05_story_player_never_2), in the interface language. */
export type GrimoireView = {
  title: string;
  minutes: number;
  heading: string;
  formula: string;
  text: string;
  deduction: string;
  quiz: { sentence: string; options: string[] };
};

/** What every graded scene shows about where it is in the story. */
type NodeFrame = {
  id: string;
  chapter: string;
  cefr: string;
  storyTitle: string;
  subtitle: string;
  location: string;
  image: string;
  /** Position among the chapter's graded scenes (1-based), the English line, and the clue it reveals, if any. */
  clue: { index: number; total: number; text: string; title: string | null };
  /** The English line in the interface language. */
  translation: string;
  /** Attempts allowed now: the scene's own plus any won back with the grimoire. */
  maxAttempts: number;
  reward: { xp: number };
  grimoire: GrimoireView;
};

export type QuestionNode = NodeFrame & {
  kind: "question";
  prompt: { lead: string; task: string };
  options: QuestionOption[];
  /** Shown after a wrong answer: points the way without giving the answer. */
  hint: { topic: string; text: string };
  /** Evidence: the options are clues the student found. */
  evidence: boolean;
  /** A listening riddle: the line is read aloud, and shown only once answered. */
  listen: boolean;
  /** A teacher's recording of the line (its id; the screen finds its link in the student's world). */
  audio?: string;
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
