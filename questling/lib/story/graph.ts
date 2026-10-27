import type { Text } from "@/lib/content/text";
import type { Gloss, Support } from "@/lib/learning/gloss";
import type { OptionIcon } from "./types";

// A campaign as a versioned story graph. Scenes (nodes) of eight kinds are joined by
// transitions, some of them conditional on what the student chose and found. A run binds to
// the version it started on, so a later version never changes a story half-way through.
// Content is code for now (lib/content/campaigns); Teacher Studio (Gate 4) authors the same shape.
// Answer keys of graded scenes live apart (lib/content/campaigns/*-keys.ts), never on the page.

/** What a transition or an option may depend on. */
export type Condition = { flag: string } | { clue: string } | { not: Condition } | { all: Condition[] } | { any: Condition[] };

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
  /** Word help: marked words of the scene's English texts (lib/learning/gloss.ts). */
  glosses?: Gloss[];
};

export type NarrationScene = SceneBase & {
  kind: "narration";
  /** The story text: English, the lesson. */
  text: string;
  translation: Text;
  /** A piece of evidence found in this scene. */
  clue?: string;
  /** A teacher's recording of the scene (its id; the student gets a link to it). */
  audio?: string;
};

export type DialogueScene = SceneBase & {
  kind: "dialogue";
  lines: { speaker: Text; text: string; translation: Text }[];
  clue?: string;
  /** A teacher's recording of the whole dialogue. */
  audio?: string;
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
  /** What it trains (lib/learning/objectives.ts), for recommendations and the studio's gaps. */
  objective?: string;
};

export type QuestionScene = SceneBase &
  Graded & {
    kind: "question";
    parchment: string;
    translation: Text;
    /** A listening riddle: the line is heard (read aloud by the device), not shown, until answered. */
    listen?: boolean;
    /** A teacher's recording of the line (else the built-in one, else the device's voice). */
    audio?: string;
    prompt: { lead: Text; task: Text };
    options: { id: string; label: string; gloss: Text; icon: OptionIcon }[];
    /** Options are shown in an order shuffled for each attempt unless the author turns it off (false). */
    shuffle?: boolean;
  };

export type PuzzleScene = SceneBase &
  Graded & {
    kind: "puzzle";
    parchment: string;
    translation: Text;
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
    shuffle?: boolean;
  };

/**
 * An interview with a character (features gate E): the character says a line, the student answers
 * with one of the English responses on offer; responses lead to other lines, may need a flag or a
 * clue the student already has, may set flags and reveal clues. The talk ends on a response that
 * leads to "end", and the story goes on by the scene's own transition. Deterministic: no chatbot.
 */
export type TalkScene = SceneBase & {
  kind: "talk";
  character: { name: Text; image: string };
  /** The line the talk opens with. */
  start: string;
  lines: TalkLine[];
  /** Granted once, when the talk ends. */
  xp: number;
  clue?: string;
};
export type TalkLine = { id: string; text: string; translation: Text; responses: TalkResponse[] };
export type TalkResponse = {
  id: string;
  /** What the student says, in English. */
  text: string;
  gloss: Text;
  /** The next line, or "end". */
  to: string;
  /** Offered only when this holds (a flag set earlier, a clue found). */
  when?: Condition;
  set?: string[];
  clue?: string;
};

/**
 * Find the clue in a picture (features gate E): hotspots on an illustration, as fractions of its width
 * and height so they hold at any size. Which ones are right (and in which order) is in the keys, never
 * on the page; every hotspot is also listed as text, the accessible way to play it.
 */
export type SearchScene = SceneBase & {
  kind: "search";
  /** The English task: "Find the key that opens the cellar." */
  task: string;
  translation: Text;
  /** What the student explores: an app illustration (or, with storage, a teacher's image by id). */
  picture: string;
  spots: SearchSpot[];
  /** Shown after two wrong taps: a nudge, not the answer. */
  hint: Text;
  xp: number;
  clue?: string;
  /** A free cosmetic for solving it (an item id), once. */
  item?: string;
};
export type SearchSpot = { id: string; label: string; gloss: Text; x: number; y: number; w: number; h: number; found: Text };

/**
 * A voice-acting scene inside the story (features gate E): one of the teacher's published scenes
 * (lib/dub/model.ts). The story goes on once the recording is sent, or, when the teacher allows it,
 * without recording (for a student whose device cannot record). XP comes with the teacher's approval.
 */
export type DubScene = SceneBase & {
  kind: "dub";
  /** The teacher's scene, by its slug ("d-…"). */
  exercise: string;
  text: string;
  translation: Text;
  /** The student may go on without recording. */
  optional: boolean;
  /** Found once the recording is sent (or the scene passed without it). */
  clue?: string;
};

export type EndingScene = SceneBase & {
  kind: "ending";
  title: Text;
  text: string;
  translation: Text;
  tone: "bright" | "bittersweet" | "secret";
  reward: { xp: number; coins: number };
};

export type Scene =
  | NarrationScene
  | DialogueScene
  | ChoiceScene
  | QuestionScene
  | PuzzleScene
  | EvidenceScene
  | TalkScene
  | SearchScene
  | DubScene
  | EndingScene;
export type GradedScene = QuestionScene | PuzzleScene | EvidenceScene;

/** The English text of a scene a word-help mark refers to, or null when the scene has no such text. */
export function fieldText(scene: Scene, field: string): string | null {
  if (field.startsWith("line:")) {
    if (scene.kind !== "dialogue") return null;
    return scene.lines[Number(field.slice(5))]?.text ?? null;
  }
  if (field.startsWith("talk:")) {
    if (scene.kind !== "talk") return null;
    return scene.lines.find((l) => l.id === field.slice(5))?.text ?? null;
  }
  switch (field) {
    case "text":
      return scene.kind === "narration" || scene.kind === "choice" || scene.kind === "ending" || scene.kind === "dub" ? scene.text : null;
    case "task":
      return scene.kind === "search" ? scene.task : null;
    case "parchment":
      return scene.kind === "question" || scene.kind === "puzzle" ? scene.parchment : null;
    case "question":
      return scene.kind === "evidence" ? scene.question : null;
    default:
      return null;
  }
}

/** The texts of a scene that can carry word help, by field name. */
export function glossFields(scene: Scene): { field: string; text: string }[] {
  if (scene.kind === "dialogue") return scene.lines.map((line, i) => ({ field: `line:${i}`, text: line.text }));
  if (scene.kind === "talk") return scene.lines.map((line) => ({ field: `talk:${line.id}`, text: line.text }));
  if (scene.kind === "search") return [{ field: "task", text: scene.task }];
  const field = scene.kind === "question" || scene.kind === "puzzle" ? "parchment" : scene.kind === "evidence" ? "question" : "text";
  return [{ field, text: fieldText(scene, field)! }];
}

export const isGraded = (scene: Scene): scene is GradedScene =>
  scene.kind === "question" || scene.kind === "puzzle" || scene.kind === "evidence";

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
  /** The map's banner over this chapter while it is locked, instead of "finish the chapter before". */
  gate?: Text;
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
  /** How much word help the campaign gives (lib/learning/gloss.ts); "auto" when left out. */
  support?: Support;
  /** Where the builder draws each scene on its canvas (Teacher Studio); the story does not depend on it. */
  layout?: Record<string, { x: number; y: number }>;
};

/** Answer keys, by scene id. */
export type CampaignKeys = Record<
  string,
  | { kind: "question"; correct: string; explanations: Record<string, Text>; grimoire: string }
  | { kind: "puzzle"; order: string[]; explanation: Text; grimoire: string }
  | { kind: "evidence"; correct: string[]; explanations: Record<string, Text>; grimoire: string }
  | { kind: "search"; targets: string[]; ordered: boolean }
>;
