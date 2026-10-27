import { campaigns } from "@/lib/content/campaigns";
import { dailyEntries } from "@/lib/content/daily";
import type { Facts } from "@/lib/game/facts";
import { dailyFor, playedCampaign, runOf } from "@/lib/game/stats";
import { findCampaign } from "@/lib/game/world";
import { locate, sceneProgress } from "@/lib/story/run";
import { attemptSeed, shuffled } from "./shuffle";
import type { Schedule } from "./srs";

// The student's word journal: words and phrases they chose to keep, from word help in the story
// (lib/learning/gloss.ts) and from the word of the day. A card's content is copied from the
// content itself when it is saved (never taken from the page), so a teacher editing a campaign
// later does not change what the student kept. Reviews quiz the meaning (lib/learning/srs.ts).

export type VocabCard = {
  /** Where it came from: "gloss:<campaign>:<scene>:<mark>" or "daily:<day>". */
  ref: string;
  term: string;
  /** The Russian meaning. */
  ru: string;
  example?: string;
  cefr?: string;
  /** "story:<campaign>" or "daily", for the journal's filter and the card's source line. */
  source: string;
  savedAt: string;
  favorite: boolean;
  /** The student marked it as known: out of the reviews, still in the journal. */
  known: boolean;
  schedule: Schedule;
};

export type CardContent = Pick<VocabCard, "term" | "ru" | "example" | "cefr" | "source">;

const MAX_REF = 120;

/**
 * What a reference names, as the student may keep it, or null. A story mark needs the student to
 * have reached its scene (and solved it, for a mark on the answer); the word of the day only today's.
 */
export function cardContent(facts: Facts, ref: string, today: string): CardContent | null {
  if (typeof ref !== "string" || ref.length > MAX_REF) return null;
  const [kind, ...rest] = ref.split(":");
  if (kind === "daily" && rest.length === 1 && rest[0] === today) {
    const { word } = dailyFor(facts, today);
    return { term: word.text, ru: word.translation.ru, example: word.example, cefr: word.cefr, source: "daily" };
  }
  if (kind === "gloss" && rest.length === 3) {
    const [campaignId, sceneId, markId] = rest;
    const run = runOf(facts, campaignId);
    const latest = findCampaign(facts, campaignId);
    if (!run || !latest) return null;
    const campaign = playedCampaign(facts, latest);
    const found = locate(campaign, sceneId);
    const mark = found?.scene.glosses?.find((g) => g.id === markId);
    if (!found || !mark) return null;
    const reached = run.scene === sceneId || run.visited.includes(sceneId) || run.ending === sceneId;
    if (!reached) return null;
    if (mark.answer && !sceneProgress(run, sceneId).solved) return null;
    return {
      term: mark.phrase,
      ru: mark.ru,
      ...(mark.example ? { example: mark.example } : {}),
      cefr: mark.cefr ?? found.chapter.cefr.slice(0, 2),
      source: `story:${campaignId}`,
    };
  }
  return null;
}

const sameSense = (a: Pick<VocabCard, "term" | "ru">, b: Pick<VocabCard, "term" | "ru">) =>
  a.term.trim().toLowerCase() === b.term.trim().toLowerCase() && a.ru.trim().toLowerCase() === b.ru.trim().toLowerCase();

/** The card already holding this word in this sense (the same word with another meaning is another card). */
export const duplicateOf = (facts: Facts, content: Pick<VocabCard, "term" | "ru">) =>
  facts.vocab.find((c) => sameSense(c, content)) ?? null;

/** Whether the student keeps this reference (or the same word and sense from elsewhere). */
export function isKept(facts: Facts, ref: string, content?: Pick<VocabCard, "term" | "ru"> | null): boolean {
  return facts.vocab.some((c) => c.ref === ref) || (!!content && !!duplicateOf(facts, content));
}

/** Russian meanings to mix into reviews when the journal is still small: the built-in content's own. */
const builtInMeanings: string[] = [
  ...new Set([
    ...campaigns.flatMap((c) => c.chapters.flatMap((ch) => ch.scenes.flatMap((s) => (s.glosses ?? []).map((g) => g.ru)))),
    ...dailyEntries.map((d) => d.word.translation.ru),
  ]),
].sort();

export const REVIEW_LETTERS = ["a", "b", "c", "d"] as const;
export type ReviewOption = { id: (typeof REVIEW_LETTERS)[number]; text: string };

/**
 * The four meanings a review of a card offers, in an order fixed for that card on that day. Ids are
 * letters, so the page cannot tell the right one from its id; the server works the same list out
 * again to grade.
 */
export function reviewOptions(facts: Facts, card: VocabCard, today: string): ReviewOption[] {
  const seed = attemptSeed(facts.profile.joinedAt, `review:${today}:${card.ref}`);
  const own = card.ru.trim().toLowerCase();
  const others = [...new Set([...facts.vocab.map((c) => c.ru), ...builtInMeanings])].filter((m) => m.trim().toLowerCase() !== own).sort();
  const distractors = shuffled(others, `${seed}|pool`).slice(0, 3);
  return shuffled([card.ru, ...distractors], seed).map((text, i) => ({ id: REVIEW_LETTERS[i], text }));
}

/** The cards due for review today, oldest due first, at most `limit`. */
export function dueCards(facts: Facts, today: string, limit = 10): VocabCard[] {
  return facts.vocab
    .filter((c) => !c.known && c.schedule.due <= today)
    .sort((a, b) => a.schedule.due.localeCompare(b.schedule.due) || a.savedAt.localeCompare(b.savedAt))
    .slice(0, limit);
}

/** Right reviews that earn XP a day, and how much each: a few, so reviewing cannot be farmed. */
export const REVIEW_XP = 2;
export const REVIEW_XP_PER_DAY = 10;
