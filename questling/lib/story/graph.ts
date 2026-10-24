import type { Text } from "@/lib/content/text";
import type { OptionIcon } from "./types";

// A campaign as a versioned story graph. Scenes (nodes) of eight kinds are joined by
// transitions, some of them conditional on what the student chose and found. A run binds to
// the version it started on, so a later version never changes a story half-way through.
// Content is code for now (lib/content/campaigns); Teacher Studio (Gate 4) authors the same shape.
// Answer keys of graded scenes live apart (lib/content/campaigns/*-keys.ts), never on the page.

/** What a transition or an option may depend on. */
export type Condition =
  | { flag: string }
  | { clue: string }
  | { not: Condition }
  | { all: Condition[] }
  | { any: Condition[] };

/** Where a scene leads: one scene, or the first branch whose condition holds (the last should always hold). */
export type Next = string | { when: Condition; to: string }[];

/** A short lesson a stuck student can study to win back one attempt (05_story_player_never_2). */
export type Grimoire = {
  title: Text;
  minutes: number;
  rule: { heading: Text; formula: string; text: Text };
  deduction: Text;
  /** A sentence with "___" where the word goes, and the words to choose from. */
  quiz: { sentence: string; options: string[] };
};

type SceneBase = {
  id: string;
  location: Text;
  image: string;
  next?: Next;
};

export type NarrationScene = SceneBase & {
  kind: "narration";
  /** The story text: English, the lesson. */
  text: string;
  translation: Text;
  /** A piece of evidence found in this scene. */
  clue?: string;
};

export type DialogueScene = SceneBase & {
  kind: "dialogue";
  lines: { speaker: Text; text: string; translation: Text }[];
  clue?: string;
};

export type ChoiceScene = SceneBase & {
  kind: "choice";
  /** The situation, in English, and what is asked, in the interface language. */
  text: string;
  translation: Text;
  prompt: Text;
  options: { id: string; label: string; gloss: Text; icon: OptionIcon; to: string; set?: string[] }[];
};

type Graded = {
  /** Attempts before the scene pauses (the grimoire can win one back each time). */
  maxAttempts: number;
  xp: number;
  hint: { topic: Text; text: Text };
  grimoire: Grimoire;
  /** The evidence found by solving it. */
  clue?: string;
};

export type QuestionScene = SceneBase &
  Graded & {
    kind: "question";
    parchment: string;
    translation: Text;
    prompt: { lead: Text; task: Text };
    options: { id: string; label: string; gloss: Text; icon: OptionIcon }[];
  };

export type PuzzleScene = SceneBase &
  Graded & {
    kind: "puzzle";
    parchment: string;
    title: Text;
    task: Text;
    scroll: Text;
    altar: Text;
    tiles: string[];
  };

/** Using the evidence: pick the found clue that proves a point. */
export type EvidenceScene = SceneBase &
  Graded & {
    kind: "evidence";
    question: string;
    translation: Text;
    prompt: Text;
    /** The clues offered; only the ones the student has found can be chosen. */
    clues: string[];
  };

export type EndingScene = SceneBase & {
  kind: "ending";
  title: Text;
  text: string;
  translation: Text;
  tone: "bright" | "bittersweet" | "secret";
  reward: { xp: number; coins: number };
};

export type Scene = NarrationScene | DialogueScene | ChoiceScene | QuestionScene | PuzzleScene | EvidenceScene | EndingScene;
export type GradedScene = QuestionScene | PuzzleScene | EvidenceScene;

export const isGraded = (scene: Scene): scene is GradedScene => scene.kind === "question" || scene.kind === "puzzle" || scene.kind === "evidence";

export type ChapterIcon = "menu_book" | "castle" | "forest" | "radar" | "nightlight";

export type Chapter = {
  id: string;
  label: Text;
  /** The label as the object of a sentence: "Требуется завершить Главу II". */
  labelAccusative: Text;
  title: Text;
  subtitle: Text;
  cefr: string;
  minutes: number;
  image: string;
  icon: ChapterIcon;
  description: Text;
  skills: Text;
  mission: Text;
  words: string[];
  /** Granted once, when the chapter's last scene is passed. */
  reward: { xp: number; coins: number };
  /** In play order; the first is where the chapter starts. Transitions may skip some. */
  scenes: Scene[];
};

export type Clue = {
  id: string;
  title: Text;
  english: string;
  location: Text;
  image: string;
  description: Text;
  phrase: { text: string; glosses: { word: string; meaning: Text }[] };
  tags: Text[];
  /** The deduction the journal shows once this clue is the latest found. */
  deduction: Text;
  /** What the journal says about it while it is not found yet. */
  teaser: Text;
  /** The journal's button once this is the latest clue found. */
  onward: Text;
};

export type Campaign = {
  id: string;
  version: number;
  title: Text;
  cefr: string;
  /** Another campaign that must be finished (any ending) before this one opens. */
  requires: string | null;
  /** Shown on the locked campaign's first chapter. */
  gate?: Text;
  quote: { text: Text; source: Text };
  chapters: Chapter[];
  clues: Clue[];
  /** The case number in the evidence journal. */
  caseNumber: number;
};

/** Answer keys, by scene id. */
export type CampaignKeys = Record<
  string,
  | { kind: "question"; correct: string; explanations: Record<string, Text>; grimoire: string }
  | { kind: "puzzle"; order: string[]; explanation: Text; grimoire: string }
  | { kind: "evidence"; correct: string[]; explanations: Record<string, Text>; grimoire: string }
>;
