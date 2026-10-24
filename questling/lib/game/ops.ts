import { achievements } from "@/lib/content/achievements";
import { gradeStoryAnswer } from "@/lib/content/campaign-keys";
import { nodeById, STORY_NODE_XP } from "@/lib/content/campaign";
import { isCharacterId } from "@/lib/content/characters";
import { dailyQuizKeys } from "@/lib/content/daily-keys";
import { CHEST_COINS, CHEST_ITEMS, itemById, SLOTS, STARTER_ITEMS, type Slot } from "@/lib/content/items";
import { quickQuestKeys } from "@/lib/content/quick-quest-keys";
import { DAILY_BONUS, quickQuestById } from "@/lib/content/quick-quests";
import { DAILY_CLAIM_XP } from "@/lib/content/daily";
import type { Locale } from "@/lib/i18n";
import { gradeAnswer, validAnswer, type Graded } from "@/lib/learning/questions";
import type { GradeResult } from "@/lib/story/types";
import { applyEffects, type Effect, type Facts } from "./facts";
import {
  assignedQuests,
  balance,
  chapterStatus,
  chestReady,
  completed,
  dailyEntry,
  dailyQuests,
  dailyQuizAnswer,
  levelOf,
  metric,
  nextNode,
  owns,
  passed,
  priceOf,
  questRef,
  runState,
} from "./stats";
import { dayOf, weekOf } from "./time";

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
  | { type: "answerStory"; nodeId: string; answer: string | string[] }
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
  | "not_ready";

/** What the page is told besides the new facts: the grade of an answer, the item a chest gave. */
export type Outcome =
  | { kind: "graded"; correct: boolean; explanation: string; finished?: boolean; rewarded?: { xp: number; coins: number } }
  | { kind: "story"; result: GradeResult; solved: boolean; chapterDone: boolean }
  | { kind: "chest"; item: string | null; coins: number }
  | { kind: "ok" };

export type Context = { now: Date; locale: Locale; demo: boolean };

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
      const entry = dailyEntry(today);
      const ref = `${entry.id}@${today}`;
      const mine = facts.answers.filter((a) => a.scope === "daily" && a.ref === ref);
      if (mine.some((a) => a.correct)) return refuse("already_done");
      const key = dailyQuizKeys[entry.id];
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
        { type: "save", kind: "word", ref: dailyEntry(today).id },
      ]);
    }

    case "toggleSavedFact": {
      const id = dailyEntry(today).id;
      const saved = facts.saved.some((s) => s.kind === "fact" && s.ref === id);
      return done([{ type: saved ? "unsave" : "save", kind: "fact", ref: id }]);
    }

    case "answerStory": {
      const found = nodeById.get(action.nodeId);
      if (!found) return refuse("not_available");
      const { chapter, node } = found;
      // Only the next node of a chapter that is open may be answered.
      if (chapterStatus(facts, chapter) !== "current" || nextNode(facts, chapter)?.id !== node.id) return refuse("not_available");
      const result = gradeStoryAnswer(node.id, action.answer, ctx.locale);
      if (!result) return refuse("invalid");
      if (node.kind === "puzzle" && (!Array.isArray(action.answer) || [...action.answer].sort().join() !== [...node.tiles].sort().join()))
        return refuse("invalid");
      const attempt = facts.answers.filter((a) => a.scope === "story" && a.ref === node.id).length + 1;
      const effects: Effect[] = [
        {
          type: "answer",
          scope: "story",
          ref: node.id,
          question: node.id,
          attempt,
          correct: result.correct,
          skill: node.kind === "puzzle" ? "cipher" : "reading",
        },
      ];
      let chapterDone = false;
      if (result.correct) {
        effects.push({ type: "completion", kind: "story_node", ref: node.id });
        effects.push({ type: "ledger", currency: "xp", amount: STORY_NODE_XP, key: `story_node:${node.id}`, reason: "story_node" });
        const rest = chapter.nodes.filter((n) => n.id !== node.id && !completed(facts, "story_node", n.id));
        if (rest.length === 0) {
          chapterDone = true;
          effects.push({ type: "completion", kind: "chapter", ref: chapter.id });
          effects.push({ type: "ledger", currency: "xp", amount: chapter.reward.xp, key: `chapter:${chapter.id}`, reason: "chapter" });
          effects.push({
            type: "ledger",
            currency: "coins",
            amount: chapter.reward.coins,
            key: `chapter:${chapter.id}`,
            reason: "chapter",
          });
        }
      }
      return done(effects, { kind: "story", result, solved: result.correct, chapterDone });
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
        if (facts.equipped[item.slot] !== item.id) effects.push({ type: "equip", slot: item.slot, item: item.id });
      }
      return done(effects);
    }

    case "openChest": {
      if (!chestReady(facts, today)) return refuse("not_ready");
      const week = weekOf(today);
      const prize = CHEST_ITEMS.find((id) => !owns(facts, id)) ?? null;
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
