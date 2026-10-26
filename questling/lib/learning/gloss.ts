import type { Locale } from "@/lib/i18n";
import type { Text } from "@/lib/content/text";
import { tr } from "@/lib/content/text";

// Word help inside an exercise: a word or phrase of the English text, marked by its place in that
// text, with a translation the student can open by tapping it. The English stays on screen; only
// the marked words open help. A mark is anchored by offsets and the words it covered, so editing
// the text never silently moves it onto other words: it is found again or reported as lost.
// Translations are only ever what the author wrote: a text without marks is shown as it is.

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type Cefr = (typeof CEFR_LEVELS)[number];

export type Gloss = {
  id: string;
  /** Which text of the scene it marks: "text", "parchment", "question", "line:0"… */
  field: string;
  /** Its place in that text (UTF-16 offsets, as JavaScript strings count), end exclusive. */
  start: number;
  end: number;
  /** The words it covered when it was placed: the check that the offsets still point at them. */
  phrase: string;
  /** The translation into Russian: "скрытый, спрятанный". */
  ru: string;
  /** A short English definition. */
  definition?: string;
  /** An English example: "a hidden door". */
  example?: string;
  /** What the words mean here, in the interface language. */
  note?: Text;
  /** The level of the words themselves; above the student's level they always get help. */
  cefr?: Cefr;
  /** The words are (part of) the answer: their help opens only once the exercise is solved. */
  answer?: boolean;
};

/** How much word help a campaign gives: by the chapter's level (the default), every mark, or none. */
export type Support = "auto" | "all" | "none";

/** A mark as the student's screen gets it: in the interface language, already checked. */
export type GlossView = {
  id: string;
  field: string;
  start: number;
  end: number;
  phrase: string;
  ru: string;
  definition?: string;
  example?: string;
  note?: string;
  cefr?: Cefr;
};

const level = (cefr: string) => {
  const i = CEFR_LEVELS.indexOf(cefr.slice(0, 2) as Cefr);
  return i < 0 ? 0 : i;
};

export const anchored = (text: string, gloss: Pick<Gloss, "start" | "end" | "phrase">) =>
  gloss.start >= 0 && gloss.end > gloss.start && gloss.end <= text.length && text.slice(gloss.start, gloss.end) === gloss.phrase;

/** Every place the phrase stands in the text. */
export function occurrences(text: string, phrase: string): number[] {
  const found: number[] = [];
  if (!phrase) return found;
  for (let i = text.indexOf(phrase); i >= 0; i = text.indexOf(phrase, i + 1)) found.push(i);
  return found;
}

/** The mark after its text was edited: where it was, else the same words nearest to where they were, else null (lost). */
export function reanchor<G extends Gloss>(text: string, gloss: G): G | null {
  if (anchored(text, gloss)) return gloss;
  const places = occurrences(text, gloss.phrase);
  if (!places.length) return null;
  const start = places.reduce((best, p) => (Math.abs(p - gloss.start) < Math.abs(best - gloss.start) ? p : best));
  return { ...gloss, start, end: start + gloss.phrase.length };
}

/** What is wrong with the marks of one text: lost anchors and overlaps. */
export function glossProblems(text: string, glosses: Pick<Gloss, "id" | "start" | "end" | "phrase" | "ru">[]): string[] {
  const problems: string[] = [];
  const sorted = [...glosses].sort((a, b) => a.start - b.start);
  sorted.forEach((g, i) => {
    if (!anchored(text, g)) problems.push(`gloss ${g.id}: "${g.phrase}" is no longer in the text`);
    if (!g.ru.trim()) problems.push(`gloss ${g.id}: no translation`);
    const before = sorted[i - 1];
    if (before && g.start < before.end) problems.push(`gloss ${g.id} overlaps ${before.id}`);
  });
  return problems;
}

/** Whether a mark is offered: by the campaign's support, the chapter's level and, for answers, whether it is solved. */
export function offered(gloss: Gloss, chapterCefr: string, support: Support = "auto", solved = false): boolean {
  if (gloss.answer && !solved) return false;
  if (support === "none") return false;
  if (support === "all") return true;
  // A1 and A2 get every mark; from B1 on, words more than a level below the chapter are taken as known.
  const chapter = level(chapterCefr);
  if (chapter <= 1) return true;
  return level(gloss.cefr ?? chapterCefr) >= chapter - 1;
}

export function glossView(gloss: Gloss, locale: Locale): GlossView {
  return {
    id: gloss.id,
    field: gloss.field,
    start: gloss.start,
    end: gloss.end,
    phrase: gloss.phrase,
    ru: gloss.ru,
    ...(gloss.definition ? { definition: gloss.definition } : {}),
    ...(gloss.example ? { example: gloss.example } : {}),
    ...(gloss.note && tr(gloss.note, locale) ? { note: tr(gloss.note, locale) } : {}),
    ...(gloss.cefr ? { cefr: gloss.cefr } : {}),
  };
}

/** The marks of a scene a student gets, in the interface language: offered, anchored, not overlapping. */
export function glossViews(
  glosses: Gloss[] | undefined,
  text: (field: string) => string | null,
  opts: { locale: Locale; cefr: string; support?: Support; solved?: boolean },
): GlossView[] {
  return (glosses ?? [])
    .filter((g) => offered(g, opts.cefr, opts.support, opts.solved))
    .filter((g) => {
      const t = text(g.field);
      return t !== null && anchored(t, g);
    })
    .map((g) => glossView(g, opts.locale));
}

export type Segment = { text: string; gloss?: GlossView };

/** The text cut into plain runs and marked words; a mark overlapping an earlier one is left out. */
export function segments(text: string, glosses: GlossView[]): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const g of [...glosses].sort((a, b) => a.start - b.start)) {
    if (g.start < at || !anchored(text, g)) continue;
    if (g.start > at) out.push({ text: text.slice(at, g.start) });
    out.push({ text: text.slice(g.start, g.end), gloss: g });
    at = g.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
