import { achievements, WEEKLY_CHEST_GOAL, type Achievement } from "@/lib/content/achievements";
import { dailyEntries, type DailyEntry } from "@/lib/content/daily";
import { items, type Item } from "@/lib/content/items";
import { DAILY_QUEST_COUNT, quickQuestById, quickQuests, type QuickQuest, type Skill } from "@/lib/content/quick-quests";
import type { Text } from "@/lib/content/text";
import type { Campaign, Chapter, Clue } from "@/lib/story/graph";
import { chapterSolved, chapterState, locate, type ChapterState, type RunState as StoryRun } from "@/lib/story/run";
import type { Facts } from "./facts";
import { dayNumber, dayOf, weekOf } from "./time";
import { findCampaign, isAssigned, studentCampaigns, worldOf } from "./world";

// Everything worked out from a student's facts: balances, level, streak, today's quests,
// story progress, achievement progress. Pure functions; no answer keys, so the signed-in
// student's page uses them too, on the facts the server sends.

// ——— Balances and level ———

export const XP_PER_LEVEL = 500;

export function balance(facts: Facts, currency: "xp" | "coins"): number {
  return facts.ledger.reduce((sum, entry) => (entry.currency === currency ? sum + entry.amount : sum), 0);
}

export function levelOf(xp: number): { level: number; into: number; next: number } {
  const total = Math.max(0, xp);
  return { level: Math.floor(total / XP_PER_LEVEL) + 1, into: total % XP_PER_LEVEL, next: XP_PER_LEVEL };
}

const RANKS: [number, Text][] = [
  [1, { ru: "Новичок академии", en: "Academy newcomer" }],
  [3, { ru: "Ученик мага", en: "Mage apprentice" }],
  [5, { ru: "Хранитель свитков", en: "Keeper of scrolls" }],
  [7, { ru: "Искатель тайн", en: "Secret seeker" }],
  [10, { ru: "Магистр архива", en: "Master of the archive" }],
];

export function rankOf(level: number): Text {
  let rank = RANKS[0][1];
  for (const [from, title] of RANKS) if (level >= from) rank = title;
  return rank;
}

// ——— Activity and streaks ———

/** The academy days on which the student answered or completed anything. */
export function activeDays(facts: Facts): Set<string> {
  const days = new Set<string>();
  for (const answer of facts.answers) days.add(dayOf(answer.at));
  for (const completion of facts.completions) if (completion.kind !== "achievement") days.add(dayOf(completion.at));
  return days;
}

/** Days in a row up to today; a streak still counts on a day not yet played, until that day ends. */
export function currentStreak(facts: Facts, today: string): number {
  const days = activeDays(facts);
  let n = dayNumber(today);
  if (!days.has(today)) n -= 1;
  let streak = 0;
  while (days.has(dayString(n))) {
    streak += 1;
    n -= 1;
  }
  return streak;
}

export function bestStreak(facts: Facts): number {
  const numbers = [...activeDays(facts)].map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < numbers.length; i++) {
    run = i > 0 && numbers[i] === numbers[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

const dayString = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

// ——— Quick quests ———

/** Today's daily quests: a fixed rotation through the daily pool, the same for every student. */
export function dailyQuests(day: string): QuickQuest[] {
  const pool = quickQuests.filter((quest) => quest.audience === "daily");
  const start = (dayNumber(day) * DAILY_QUEST_COUNT) % pool.length;
  return Array.from({ length: Math.min(DAILY_QUEST_COUNT, pool.length) }, (_, i) => pool[(start + i) % pool.length]);
}

/** Quests a mentor has assigned. Assignments arrive with Teacher Studio (Gate 4); the demo has one. */
export function assignedQuests(facts: Facts, demo: boolean): QuickQuest[] {
  return demo ? quickQuests.filter((quest) => quest.audience === "assigned") : [];
}

/** The run a quest is played in: one per day for a daily quest, one in all for an assigned one. */
export function questRef(quest: QuickQuest, day: string): string {
  return quest.audience === "daily" ? `${quest.id}@${day}` : `${quest.id}@assigned`;
}

export const QUESTION_ATTEMPTS = 2;

export type RunState = {
  /** Per question: attempts made, and whether one was right. */
  questions: { attempts: number; correct: boolean; resolved: boolean }[];
  /** The question to answer now; equals the count when all are resolved. */
  current: number;
  finished: boolean;
  correctCount: number;
  started: boolean;
};

export function runState(facts: Facts, quest: QuickQuest, ref: string): RunState {
  const answers = facts.answers.filter((a) => a.scope === "quest" && a.ref === ref);
  const questions = quest.questions.map((q) => {
    const mine = answers.filter((a) => a.question === q.id);
    const correct = mine.some((a) => a.correct);
    return { attempts: mine.length, correct, resolved: correct || mine.length >= QUESTION_ATTEMPTS };
  });
  const current = questions.findIndex((q) => !q.resolved);
  return {
    questions,
    current: current === -1 ? questions.length : current,
    finished: current === -1,
    correctCount: questions.filter((q) => q.correct).length,
    started: answers.length > 0,
  };
}

/** A finished quest earns its reward when at least half of its questions were answered right. */
export const passed = (run: RunState) => run.finished && run.correctCount * 2 >= run.questions.length;

export function completed(facts: Facts, kind: Facts["completions"][number]["kind"], ref: string): boolean {
  return facts.completions.some((c) => c.kind === kind && c.ref === ref);
}

export function questsCompletedOn(facts: Facts, day: string): number {
  return dailyQuests(day).filter((quest) => completed(facts, "quest", questRef(quest, day))).length;
}

// ——— Daily discovery ———

export function dailyEntry(day: string): DailyEntry {
  return dailyEntries[((dayNumber(day) % dailyEntries.length) + dailyEntries.length) % dailyEntries.length];
}

/** The day's discovery for this student: their teacher's, if one is planned for the day, else the built-in one. */
export function dailyFor(facts: Facts, day: string): DailyEntry {
  return worldOf(facts).daily?.find((d) => d.day === day)?.entry ?? dailyEntry(day);
}

/** "День 14 из 30": the day of the student's 30-day cycle, counted from the day they joined. */
export const PROGRAM_DAYS = 30;
export function programDay(facts: Facts, day: string): number {
  return ((((dayNumber(day) - dayNumber(dayOf(facts.profile.joinedAt))) % PROGRAM_DAYS) + PROGRAM_DAYS) % PROGRAM_DAYS) + 1;
}

export function dailyQuizAnswer(facts: Facts, day: string) {
  const entry = dailyFor(facts, day);
  return facts.answers.find((a) => a.scope === "daily" && a.ref === `${entry.id}@${day}`) ?? null;
}

// ——— Story ———

export const runOf = (facts: Facts, campaignId: string): StoryRun | null => facts.runs.find((run) => run.campaign === campaignId) ?? null;

/** The version of a campaign the student plays: the one their run started on, else the latest. */
export function playedCampaign(facts: Facts, campaign: Campaign): Campaign {
  const run = runOf(facts, campaign.id);
  return (run && findCampaign(facts, run.campaign, run.version)) ?? campaign;
}

export const campaignFinished = (facts: Facts, campaignId: string) => Boolean(runOf(facts, campaignId)?.ending);

/** A campaign opens once the one it requires is finished, whichever ending; one a teacher assigned is open at once. */
export const campaignOpen = (facts: Facts, campaign: Campaign) =>
  isAssigned(facts, campaign.id) || !campaign.requires || campaignFinished(facts, campaign.requires);

/** The campaign being played: the first open one not finished yet; the last one once all are. */
export function currentCampaign(facts: Facts): Campaign {
  const list = studentCampaigns(facts);
  return list.find((c) => campaignOpen(facts, c) && !campaignFinished(facts, c.id)) ?? list[list.length - 1];
}

export function chapterStatus(facts: Facts, campaign: Campaign, chapter: Chapter): ChapterState {
  return chapterState(playedCampaign(facts, campaign), runOf(facts, campaign.id), chapter, campaignOpen(facts, campaign));
}

/** The chapter to play next: where the current run is, or the current campaign's first. Null once every campaign is finished. */
export function currentChapter(facts: Facts): { campaign: Campaign; chapter: Chapter } | null {
  const campaign = playedCampaign(facts, currentCampaign(facts));
  const run = runOf(facts, campaign.id);
  if (run?.ending) return null;
  const chapter = run ? locate(campaign, run.scene)?.chapter : campaign.chapters[0];
  return chapter ? { campaign, chapter } : null;
}

export function chapterProgress(facts: Facts, campaign: Campaign, chapter: Chapter): { solved: number; total: number } {
  return chapterSolved(chapter, runOf(facts, campaign.id));
}

/** Every clue found, newest last, with the campaign it belongs to. */
export function foundClues(facts: Facts): { campaign: Campaign; clue: Clue }[] {
  return facts.runs.flatMap((run) => {
    const campaign = findCampaign(facts, run.campaign, run.version);
    return campaign ? run.clues.flatMap((id) => campaign.clues.filter((clue) => clue.id === id).map((clue) => ({ campaign, clue }))) : [];
  });
}

// ——— Weekly chest and achievements ———

export function weeklyQuestCount(facts: Facts, today: string): number {
  const week = weekOf(today);
  return facts.completions.filter((c) => c.kind === "quest" && weekOf(dayOf(c.at)) === week).length;
}

export const chestOpened = (facts: Facts, today: string) => completed(facts, "chest", weekOf(today));
export const chestReady = (facts: Facts, today: string) =>
  weeklyQuestCount(facts, today) >= WEEKLY_CHEST_GOAL && !chestOpened(facts, today);

const firstTry = (facts: Facts, skills: Skill[]) =>
  facts.answers.filter((a) => a.attempt === 1 && a.correct && skills.includes(a.skill)).length;

export function metric(facts: Facts, name: Achievement["metric"]): number {
  switch (name) {
    case "clues":
      return facts.runs.reduce((sum, run) => sum + run.clues.length, 0);
    case "bestStreak":
      return bestStreak(facts);
    case "readingFirstTry":
      return firstTry(facts, ["reading"]);
    case "ciphersFirstTry":
      return firstTry(facts, ["cipher"]);
  }
}

export function achievementProgress(facts: Facts) {
  return achievements.map((achievement) => {
    const value = metric(facts, achievement.metric);
    return { achievement, value: Math.min(value, achievement.goal), earned: completed(facts, "achievement", achievement.id) };
  });
}

// ——— Skills (the profile's learning progress) ———

export function skillProgress(facts: Facts, skill: Skill): { answered: number; correct: number; percent: number } {
  const mine = facts.answers.filter((a) => a.skill === skill);
  const correct = mine.filter((a) => a.correct).length;
  return { answered: mine.length, correct, percent: mine.length ? Math.round((correct / mine.length) * 100) : 0 };
}

// ——— Items ———

export const owns = (facts: Facts, itemId: string) => facts.inventory.some((o) => o.item === itemId);

/** The shop's deal of the day: one item for sale, 25% off, in rotation. */
export const DEAL_DISCOUNT = 0.25;
export function dealOfTheDay(day: string): Item {
  const forSale = items.filter((entry) => entry.price > 0);
  return forSale[(dayNumber(day) * 7) % forSale.length];
}

export function priceOf(item: Item, day: string): number {
  return dealOfTheDay(day).id === item.id ? Math.round(item.price * (1 - DEAL_DISCOUNT)) : item.price;
}

export { quickQuestById };
