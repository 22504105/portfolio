import { achievements } from "@/lib/content/achievements";
import { keysOf } from "@/lib/content/campaigns/keys";
import { isCharacterId } from "@/lib/content/characters";
import { dailyQuizKeys } from "@/lib/content/daily-keys";
import { CHEST_COINS, CHEST_ITEMS, itemById, SLOTS, STARTER_ITEMS, type Slot } from "@/lib/content/items";
import { quickQuestKeys } from "@/lib/content/quick-quest-keys";
import { DAILY_BONUS, quickQuestById } from "@/lib/content/quick-quests";
import { DAILY_CLAIM_XP } from "@/lib/content/daily";
import type { Text } from "@/lib/content/text";
import type { Locale } from "@/lib/i18n";
import { gradeAnswer, validAnswer, type Graded } from "@/lib/learning/questions";
import { isGraded, type Campaign, type CampaignKeys } from "@/lib/story/graph";
import { isExhausted, locate, move, sceneProgress, startRun, type Move } from "@/lib/story/run";
import { applyEffects, type Effect, type Facts } from "./facts";
import {
  assignedQuests,
  balance,
  campaignOpen,
  chestReady,
  completed,
  dailyFor,
  dailyQuests,
  dailyQuizAnswer,
  levelOf,
  metric,
  owns,
  passed,
  playedCampaign,
  priceOf,
  questRef,
  runOf,
  runState,
} from "./stats";
import { dayOf, weekOf } from "./time";
import { findCampaign } from "./world";

// What a student can do, as pure functions: (facts, input) → effects, or a refusal.
// The server runs these on the facts it holds, under a lock on the student, and stores
// the effects in the same transaction; the demo runs them in the browser. This module
// reads answer keys, so it is never part of a signed-in student's page.

export type Action =
  | { type: "chooseCharacter"; characterId: string }
  | { type: "renameHero"; name: string }
  | { type: "answerQuest"; questId: string; questionId: string; answer: unknown }
  | { type: "answerDailyQuiz"; option: string }
  | { type: "claimDaily" }
  | { type: "toggleSavedFact" }
  /** A move in a campaign's story; the first one starts the run. */
  | { type: "story"; campaign: string; move: Move }
  /** From a scene with no attempts left: ask the mentor for help. */
  | { type: "askMentor"; campaign: string; scene: string }
  | { type: "buy"; itemId: string }
  | { type: "saveLook"; equipped: Partial<Record<Slot, string | null>> }
  | { type: "openChest" };

export type Refusal =
  | "invalid"
  | "no_character"
  | "not_available"
  | "already_done"
  | "not_owned"
  | "already_owned"
  | "not_enough_coins"
  | "level_too_low"
  | "not_ready"
  | "exhausted"
  | "not_exhausted"
  | "wrong_species"
  | "conflict";

/** What the page is told besides the new facts: the grade of an answer, the item a chest gave. */
export type Outcome =
  | { kind: "graded"; correct: boolean; explanation: string; finished?: boolean; rewarded?: { xp: number; coins: number } }
  | {
      kind: "story";
      /** For an answer: whether it was right, and why. */
      answer?: { correct: boolean; explanation: string };
      /** For the grimoire's quiz: whether the word was right (an attempt is back if so). */
      grimoire?: { correct: boolean };
      /** The chapter this move finished, and the ending it reached. */
      chapterDone: string | null;
      ending: string | null;
      rewarded: { xp: number; coins: number };
    }
  | { kind: "chest"; item: string | null; coins: number }
  | { kind: "ok" };

/**
 * `random` draws the weekly chest's prize: a number in [0, 1). The server uses a cryptographic source.
 * `keys` gives a teacher's campaign its answer keys (the server holds them); built-in ones have their own.
 */
export type Context = {
  now: Date;
  locale: Locale;
  demo: boolean;
  random?: () => number;
  keys?: (campaign: Campaign) => CampaignKeys | null;
  /** A teacher's word of the day's quiz key, by entry id (the server holds them). */
  dailyKeys?: (entryId: string) => { correct: string; explanation: Text } | null;
};

export type OpResult = { ok: true; effects: Effect[]; outcome: Outcome } | { ok: false; refusal: Refusal };

const refuse = (refusal: Refusal): OpResult => ({ ok: false, refusal });
const done = (effects: Effect[], outcome: Outcome = { kind: "ok" }): OpResult => ({ ok: true, effects, outcome });

const gradedOutcome = (graded: Graded, locale: Locale) => ({ correct: graded.correct, explanation: graded.explanation[locale] });

export function run(facts: Facts, action: Action, ctx: Context): OpResult {
  const result = perform(facts, action, ctx);
  if (!result.ok) return result;
  // Whatever happened may have reached an achievement's goal: grant it in the same step.
  const after = applyEffects(facts, result.effects, ctx.now.toISOString());
  return { ...result, effects: [...result.effects, ...settleAchievements(after)] };
}

function perform(facts: Facts, action: Action, ctx: Context): OpResult {
  const today = dayOf(ctx.now);
  if (action.type !== "chooseCharacter" && !facts.profile.characterId) return refuse("no_character");

  switch (action.type) {
    case "chooseCharacter": {
      if (!isCharacterId(action.characterId)) return refuse("invalid");
      const effects: Effect[] = [{ type: "profile", characterId: action.characterId }];
      // The first choice also hands out the free starting kit, worn at once.
      if (!facts.profile.characterId) {
        for (const id of STARTER_ITEMS) {
          if (owns(facts, id)) continue;
          effects.push({ type: "own", item: id, source: "starter" });
          const item = itemById.get(id)!;
          if (!facts.equipped[item.slot]) effects.push({ type: "equip", slot: item.slot, item: id });
        }
      }
      return done(effects);
    }

    case "renameHero": {
      const name = typeof action.name === "string" ? action.name.trim().replace(/\s+/g, " ") : "";
      if (name.length < 2 || name.length > 24 || /[<>{}]/.test(name)) return refuse("invalid");
      return done([{ type: "profile", heroName: name }]);
    }

    case "answerQuest": {
      const quest = quickQuestById.get(action.questId);
      const available = quest && (dailyQuests(today).includes(quest) || assignedQuests(facts, ctx.demo).includes(quest));
      if (!quest || !available) return refuse("not_available");
      const ref = questRef(quest, today);
      if (completed(facts, "quest", ref)) return refuse("already_done");
      const state = runState(facts, quest, ref);
      const index = quest.questions.findIndex((q) => q.id === action.questionId);
      // Questions are answered in order, each within its attempts.
      if (index !== state.current) return refuse("not_available");
      const question = quest.questions[index];
      if (!validAnswer(question, action.answer)) return refuse("invalid");
      const key = quickQuestKeys[quest.id]?.[question.id];
      if (!key) return refuse("invalid");

      const graded = gradeAnswer(key, action.answer);
      const effects: Effect[] = [
        {
          type: "answer",
          scope: "quest",
          ref,
          question: question.id,
          attempt: state.questions[index].attempts + 1,
          correct: graded.correct,
          skill: question.kind === "order" || question.kind === "match" ? "cipher" : quest.skill,
        },
      ];
      const after = runState(applyEffects(facts, effects, ctx.now.toISOString()), quest, ref);
      let rewarded: { xp: number; coins: number } | undefined;
      if (after.finished) {
        effects.push({ type: "completion", kind: "quest", ref });
        if (passed(after)) {
          rewarded = { xp: quest.xp, coins: quest.coins };
          effects.push({ type: "ledger", currency: "xp", amount: quest.xp, key: `quest:${ref}`, reason: "quest" });
          effects.push({ type: "ledger", currency: "coins", amount: quest.coins, key: `quest:${ref}`, reason: "quest" });
        }
        // All of today's daily quests finished: the day's bonus, once.
        const daily = dailyQuests(today);
        const finishedToday = daily.filter((q) => q === quest || completed(facts, "quest", questRef(q, today))).length;
        if (quest.audience === "daily" && finishedToday === daily.length && !completed(facts, "daily_bonus", today)) {
          effects.push({ type: "completion", kind: "daily_bonus", ref: today });
          effects.push({ type: "ledger", currency: "xp", amount: DAILY_BONUS.xp, key: `daily_bonus:${today}`, reason: "daily_bonus" });
          effects.push({
            type: "ledger",
            currency: "coins",
            amount: DAILY_BONUS.coins,
            key: `daily_bonus:${today}`,
            reason: "daily_bonus",
          });
        }
      }
      return done(effects, { kind: "graded", ...gradedOutcome(graded, ctx.locale), finished: after.finished, rewarded });
    }

    case "answerDailyQuiz": {
      // Tries until the right answer is found, each option once; the XP is for a right first try.
      const entry = dailyFor(facts, today);
      const ref = `${entry.id}@${today}`;
      const mine = facts.answers.filter((a) => a.scope === "daily" && a.ref === ref);
      if (mine.some((a) => a.correct)) return refuse("already_done");
      const key = ctx.dailyKeys?.(entry.id) ?? dailyQuizKeys[entry.id];
      if (!key || !entry.quiz.options.some((o) => o.id === action.option) || mine.some((a) => a.question === action.option))
        return refuse("invalid");
      const correct = action.option === key.correct;
      const attempt = mine.length + 1;
      const effects: Effect[] = [{ type: "answer", scope: "daily", ref, question: action.option, attempt, correct, skill: "vocabulary" }];
      if (attempt === 1) effects.push({ type: "completion", kind: "daily_quiz", ref: today });
      const rewarded = correct && attempt === 1;
      if (rewarded)
        effects.push({ type: "ledger", currency: "xp", amount: entry.quiz.xp, key: `daily_quiz:${today}`, reason: "daily_quiz" });
      return done(effects, {
        kind: "graded",
        correct,
        explanation: key.explanation[ctx.locale],
        rewarded: rewarded ? { xp: entry.quiz.xp, coins: 0 } : undefined,
      });
    }

    case "claimDaily": {
      if (!dailyQuizAnswer(facts, today)) return refuse("not_ready");
      if (completed(facts, "daily_claim", today)) return refuse("already_done");
      // Claiming the day's discovery also puts its word into the student's vocabulary.
      return done([
        { type: "completion", kind: "daily_claim", ref: today },
        { type: "ledger", currency: "xp", amount: DAILY_CLAIM_XP, key: `daily_claim:${today}`, reason: "daily_claim" },
        { type: "save", kind: "word", ref: dailyFor(facts, today).id },
      ]);
    }

    case "toggleSavedFact": {
      const id = dailyFor(facts, today).id;
      const saved = facts.saved.some((s) => s.kind === "fact" && s.ref === id);
      return done([{ type: saved ? "unsave" : "save", kind: "fact", ref: id }]);
    }

    case "story": {
      const latest = findCampaign(facts, action.campaign);
      if (!latest) return refuse("not_available");
      const existing = runOf(facts, latest.id);
      if (!existing && !campaignOpen(facts, latest)) return refuse("not_available");
      const campaign = playedCampaign(facts, latest);
      const before = existing ?? startRun(campaign);
      const keys = ctx.keys?.(campaign) ?? keysOf(campaign);
      const result = move(campaign, keys, before, action.move);
      if (!result.ok) return refuse(result.refusal);

      const after = result.run;
      const effects: Effect[] = [{ type: "run", state: after }];
      const scene = locate(campaign, action.move.scene)!.scene;
      if (result.answer && isGraded(scene)) {
        effects.push({
          type: "answer",
          scope: "story",
          ref: campaign.id,
          question: scene.id,
          attempt: result.answer.attempt,
          correct: result.answer.correct,
          skill: scene.kind === "puzzle" ? "cipher" : scene.kind === "question" && scene.listen ? "listening" : "reading",
        });
        if (result.answer.correct) effects.push({ type: "completion", kind: "story_node", ref: `${campaign.id}/${scene.id}` });
      }
      for (const chapter of after.chapters.filter((id) => !before.chapters.includes(id)))
        effects.push({ type: "completion", kind: "chapter", ref: `${campaign.id}/${chapter}` });
      if (after.ending && !before.ending) effects.push({ type: "completion", kind: "ending", ref: campaign.id });
      for (const grant of result.grants) effects.push({ type: "ledger", ...grant });

      const sum = (currency: "xp" | "coins") => result.grants.filter((g) => g.currency === currency).reduce((n, g) => n + g.amount, 0);
      return done(effects, {
        kind: "story",
        answer: result.answer && { correct: result.answer.correct, explanation: result.answer.explanation[ctx.locale] },
        grimoire: result.grimoire,
        chapterDone: result.chapterDone,
        ending: after.ending && !before.ending ? after.ending : null,
        rewarded: { xp: sum("xp"), coins: sum("coins") },
      });
    }

    case "askMentor": {
      const latest = findCampaign(facts, action.campaign);
      const run = latest ? runOf(facts, latest.id) : null;
      if (!latest || !run || run.scene !== action.scene) return refuse("not_available");
      const scene = locate(playedCampaign(facts, latest), run.scene)?.scene;
      if (!scene || !isGraded(scene) || !isExhausted(scene, sceneProgress(run, scene.id))) return refuse("not_exhausted");
      const ref = `${latest.id}/${scene.id}`;
      if (completed(facts, "help_request", ref)) return refuse("already_done");
      // Kept for the mentor: Teacher Studio (Gate 4) shows a group's requests.
      return done([{ type: "completion", kind: "help_request", ref }]);
    }

    case "buy": {
      const item = itemById.get(action.itemId);
      if (!item || item.price <= 0) return refuse("not_available");
      if (owns(facts, item.id)) return refuse("already_owned");
      if (levelOf(balance(facts, "xp")).level < item.level) return refuse("level_too_low");
      const price = priceOf(item, today);
      if (balance(facts, "coins") < price) return refuse("not_enough_coins");
      return done([
        { type: "ledger", currency: "coins", amount: -price, key: `purchase:${item.id}`, reason: "purchase" },
        { type: "own", item: item.id, source: "purchase" },
      ]);
    }

    case "saveLook": {
      const wanted = action.equipped;
      if (!wanted || typeof wanted !== "object") return refuse("invalid");
      const level = levelOf(balance(facts, "xp")).level;
      const effects: Effect[] = [];
      for (const [slot, itemId] of Object.entries(wanted)) {
        if (!(SLOTS as readonly string[]).includes(slot)) return refuse("invalid");
        if (itemId === null) {
          if (facts.equipped[slot as Slot]) effects.push({ type: "equip", slot: slot as Slot, item: null });
          continue;
        }
        const item = typeof itemId === "string" ? itemById.get(itemId) : undefined;
        if (!item || item.slot !== slot) return refuse("invalid");
        if (!owns(facts, item.id)) return refuse("not_owned");
        if (level < item.level) return refuse("level_too_low");
        if (!item.species.includes(facts.profile.characterId!)) return refuse("wrong_species");
        if (facts.equipped[item.slot] !== item.id) effects.push({ type: "equip", slot: item.slot, item: item.id });
      }
      // The look as it would be: no worn item may share it with a slot it rules out.
      const look: Partial<Record<Slot, string | null>> = { ...facts.equipped, ...wanted };
      for (const id of Object.values(look)) {
        const item = id ? itemById.get(id) : undefined;
        if (item?.conflicts.some((slot) => look[slot])) return refuse("conflict");
      }
      return done(effects);
    }

    case "openChest": {
      if (!chestReady(facts, today)) return refuse("not_ready");
      const week = weekOf(today);
      const left = CHEST_ITEMS.filter((id) => !owns(facts, id));
      const draw = Math.min(left.length - 1, Math.floor((ctx.random ?? Math.random)() * left.length));
      const prize = left.length ? left[draw] : null;
      const effects: Effect[] = [{ type: "completion", kind: "chest", ref: week }];
      if (prize) effects.push({ type: "own", item: prize, source: "chest" });
      else effects.push({ type: "ledger", currency: "coins", amount: CHEST_COINS, key: `chest:${week}`, reason: "chest" });
      return done(effects, { kind: "chest", item: prize, coins: prize ? 0 : CHEST_COINS });
    }
  }
}

/** Achievements whose goal has been reached but which have not been granted yet. */
export function settleAchievements(facts: Facts): Effect[] {
  const effects: Effect[] = [];
  for (const achievement of achievements) {
    if (completed(facts, "achievement", achievement.id) || metric(facts, achievement.metric) < achievement.goal) continue;
    effects.push({ type: "completion", kind: "achievement", ref: achievement.id });
    if ("coins" in achievement.reward)
      effects.push({
        type: "ledger",
        currency: "coins",
        amount: achievement.reward.coins,
        key: `achievement:${achievement.id}`,
        reason: "achievement",
      });
    else if (!owns(facts, achievement.reward.item)) effects.push({ type: "own", item: achievement.reward.item, source: "achievement" });
  }
  return effects;
}
