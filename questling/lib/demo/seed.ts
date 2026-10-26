import { forgottenAcademy } from "@/lib/content/campaigns/forgotten-academy";
import { keysOf } from "@/lib/content/campaigns/keys";
import { dailyQuizKeys } from "@/lib/content/daily-keys";
import { quickQuestKeys } from "@/lib/content/quick-quest-keys";
import type { Answer, QuestionKey } from "@/lib/learning/questions";
import { applyEffects, emptyFacts, type Facts } from "@/lib/game/facts";
import { run, type Action } from "@/lib/game/ops";
import { balance, dailyEntry, dailyQuests, runOf } from "@/lib/game/stats";
import { rightMove } from "@/lib/story/autoplay";
import { runSeed, startRun } from "@/lib/story/run";
import { dayFromNumber, dayNumber, dayOf } from "@/lib/game/time";

// The demo student's past, played through the real actions: two weeks ago they chose the cat,
// then studied a little every day for the last six days. So every number the demo shows
// (streak, weekly chest, achievement progress, today's quests) comes from the same rules as
// for a real student. Only the totals are topped up, by one entry marked "demo", to the
// balances of the approved screens: 340 / 500 XP at level 7 and 850 coins.

export const DEMO_XP = 6 * 500 + 340;
export const DEMO_COINS = 850;

const answerFor = (key: QuestionKey): Answer => {
  switch (key.kind) {
    case "choice":
      return { kind: "choice", option: key.correct };
    case "multi":
      return { kind: "multi", options: key.correct };
    case "fill":
      return { kind: "fill", word: key.correct };
    case "order":
      return { kind: "order", tiles: key.correct };
    case "match":
      return { kind: "match", pairs: key.correct };
  }
};

/** Noon (Moscow) of the academy day `offset` days from `now`'s. */
const noonOf = (now: Date, offset: number) => new Date(`${dayFromNumber(dayNumber(dayOf(now)) + offset)}T09:00:00Z`);

export function demoFacts(now: Date): Facts {
  let facts = emptyFacts(noonOf(now, -13).toISOString());
  const act = (action: Action, at: Date) => {
    const result = run(facts, action, { now: at, locale: "ru", demo: true });
    if (result.ok) facts = applyEffects(facts, result.effects, at.toISOString());
  };
  const playQuest = (questId: string, at: Date, upTo = Infinity) => {
    const keys = quickQuestKeys[questId];
    Object.entries(keys)
      .slice(0, upTo)
      .forEach(([questionId, key]) => act({ type: "answerQuest", questId, questionId, answer: answerFor(key) }, at));
  };
  // The first campaign played up to (not including) a scene, each move right the first time.
  const playStory = (until: string, at: Date) => {
    const campaign = forgottenAcademy;
    for (let step = 0; step < 50; step++) {
      const run = runOf(facts, campaign.id) ?? startRun(campaign, runSeed(facts.profile.joinedAt, campaign));
      if (run.scene === until) return;
      const move = rightMove(campaign, keysOf(campaign), run);
      if (!move) return;
      act({ type: "story", campaign: campaign.id, move }, at);
    }
  };

  act({ type: "chooseCharacter", characterId: "cat" }, noonOf(now, -13));

  for (let offset = -5; offset <= -1; offset++) {
    const at = noonOf(now, offset);
    playQuest(dailyQuests(dayOf(at))[0].id, at);
    // The day's word, answered and claimed: it goes into the vocabulary.
    act({ type: "answerDailyQuiz", option: dailyQuizKeys[dailyEntry(dayOf(at)).id].correct }, at);
    act({ type: "claimDaily" }, at);
    // The prologue on one day; chapter II begun on another, up to the sealed letter of the story player screen.
    if (offset === -4) playStory("t-intro", at);
    if (offset === -2) playStory("tower-2", at);
  }

  // Today: the third daily quest done, the second one started, the first not yet.
  const today = noonOf(now, 0);
  const todays = dailyQuests(dayOf(today));
  playQuest(todays[2].id, today);
  playQuest(todays[1].id, today, 1);

  // Top up to the screens' balances, then the wardrobe the screens show.
  let topUps = 0;
  const topUp = (currency: "xp" | "coins", target: number) => {
    const missing = target - balance(facts, currency);
    const key = `demo:${currency}:${++topUps}`;
    if (missing !== 0)
      facts = applyEffects(facts, [{ type: "ledger", currency, amount: missing, key, reason: "demo" }], noonOf(now, -13).toISOString());
  };
  const bought = ["sunset-cloak", "crystal-staff", "forest-hood", "round-glasses", "moon-pendant"];
  topUp("xp", DEMO_XP);
  topUp("coins", DEMO_COINS + 250 + 220 + 120 + 90 + 180);
  for (const itemId of bought) act({ type: "buy", itemId }, noonOf(now, -3));
  act({ type: "saveLook", equipped: { outerwear: "sunset-cloak", handheld: "crystal-staff" } }, noonOf(now, -3));
  topUp("coins", DEMO_COINS);
  return facts;
}
