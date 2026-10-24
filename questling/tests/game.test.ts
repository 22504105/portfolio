import { describe, expect, it } from "vitest";
import { campaignKeys } from "@/lib/content/campaign-keys";
import { quickQuestKeys } from "@/lib/content/quick-quest-keys";
import { dailyQuizKeys } from "@/lib/content/daily-keys";
import { demoFacts, DEMO_COINS } from "@/lib/demo/seed";
import { applyEffects, emptyFacts, type Facts } from "@/lib/game/facts";
import { run, type Action } from "@/lib/game/ops";
import {
  balance,
  bestStreak,
  chapterStatus,
  chestReady,
  completed,
  currentStreak,
  dailyEntry,
  dailyQuests,
  dealOfTheDay,
  levelOf,
  owns,
  priceOf,
  questRef,
  runState,
  weeklyQuestCount,
} from "@/lib/game/stats";
import { dayOf } from "@/lib/game/time";
import { chapterById } from "@/lib/content/campaign";
import { itemById } from "@/lib/content/items";
import type { Answer, QuestionKey } from "@/lib/learning/questions";

// The game's rules, as the server and the demo both run them (lib/game/ops.ts).

const NOW = new Date("2026-10-21T09:00:00Z"); // a Wednesday, noon in Moscow
const TODAY = dayOf(NOW);

const right = (key: QuestionKey): Answer =>
  key.kind === "choice"
    ? { kind: "choice", option: key.correct }
    : key.kind === "multi"
      ? { kind: "multi", options: key.correct }
      : key.kind === "fill"
        ? { kind: "fill", word: key.correct }
        : key.kind === "order"
          ? { kind: "order", tiles: key.correct }
          : { kind: "match", pairs: key.correct };

/** Plays actions in order; each must be accepted. */
function play(facts: Facts, actions: Action[], now = NOW): Facts {
  for (const action of actions) {
    const result = run(facts, action, { now, locale: "ru", demo: false });
    if (!result.ok) throw new Error(`${action.type} refused: ${result.refusal}`);
    facts = applyEffects(facts, result.effects, now.toISOString());
  }
  return facts;
}

const newcomer = () => play(emptyFacts(NOW.toISOString()), [{ type: "chooseCharacter", characterId: "fox" }]);

const refusal = (facts: Facts, action: Action, now = NOW) => {
  const result = run(facts, action, { now, locale: "ru", demo: false });
  return result.ok ? null : result.refusal;
};

function finishQuest(facts: Facts, questId: string, now = NOW): Facts {
  const keys = quickQuestKeys[questId];
  return play(
    facts,
    Object.entries(keys).map(([questionId, key]) => ({ type: "answerQuest", questId, questionId, answer: right(key) })),
    now,
  );
}

describe("choosing a hero", () => {
  it("is needed before anything else, and hands out the free starting kit once, worn", () => {
    expect(refusal(emptyFacts(NOW.toISOString()), { type: "claimDaily" })).toBe("no_character");
    const facts = newcomer();
    expect(facts.profile.characterId).toBe("fox");
    expect(facts.inventory.map((o) => o.item).sort()).toEqual(["violet-tunic", "wand", "wizard-hat"]);
    expect(facts.equipped).toEqual({ headwear: "wizard-hat", handheld: "wand", outfit: "violet-tunic" });
    const again = play(facts, [{ type: "chooseCharacter", characterId: "owl" }]);
    expect(again.profile.characterId).toBe("owl");
    expect(again.inventory).toHaveLength(3);
  });

  it("accepts only the six characters", () => {
    expect(refusal(emptyFacts(NOW.toISOString()), { type: "chooseCharacter", characterId: "dragon" })).toBe("invalid");
  });
});

describe("quick quests", () => {
  const quest = dailyQuests(TODAY)[0];

  it("are answered in order, each question within two attempts", () => {
    let facts = newcomer();
    // Today's quest that opens with a choice question: either half of the rotation has one.
    const quest = dailyQuests(TODAY).find((q) => q.questions[0].kind === "choice")!;
    const [first, second] = quest.questions;
    expect(
      refusal(facts, { type: "answerQuest", questId: quest.id, questionId: second.id, answer: right(quickQuestKeys[quest.id][second.id]) }),
    ).toBe("not_available");
    const wrong = (key: QuestionKey): Answer => {
      if (key.kind === "choice")
        return { kind: "choice", option: (first as { options: { id: string }[] }).options.find((o) => o.id !== key.correct)!.id };
      throw new Error("first question of the test quest should be a choice");
    };
    if (first.kind === "choice") {
      facts = play(facts, [
        { type: "answerQuest", questId: quest.id, questionId: first.id, answer: wrong(quickQuestKeys[quest.id][first.id]) },
      ]);
      facts = play(facts, [
        { type: "answerQuest", questId: quest.id, questionId: first.id, answer: wrong(quickQuestKeys[quest.id][first.id]) },
      ]);
      // Two wrong answers resolve the question; the next one is now current.
      expect(runState(facts, quest, questRef(quest, TODAY)).current).toBe(1);
    }
  });

  it("reward a finished quest once, and never again that day", () => {
    let facts = newcomer();
    facts = finishQuest(facts, quest.id);
    expect(completed(facts, "quest", questRef(quest, TODAY))).toBe(true);
    expect(balance(facts, "xp")).toBe(quest.xp);
    expect(balance(facts, "coins")).toBe(quest.coins);
    const firstQuestion = quest.questions[0];
    expect(
      refusal(facts, {
        type: "answerQuest",
        questId: quest.id,
        questionId: firstQuestion.id,
        answer: right(quickQuestKeys[quest.id][firstQuestion.id]),
      }),
    ).toBe("already_done");
  });

  it("refuse a quest that is not in today's rotation, and malformed answers", () => {
    const facts = newcomer();
    const notToday = ["letter", "mist", "stars", "runes", "bells", "scroll"].find((id) => !dailyQuests(TODAY).some((q) => q.id === id))!;
    const firstQuestion = Object.keys(quickQuestKeys[notToday])[0];
    expect(
      refusal(facts, {
        type: "answerQuest",
        questId: notToday,
        questionId: firstQuestion,
        answer: right(quickQuestKeys[notToday][firstQuestion]),
      }),
    ).toBe("not_available");
    expect(
      refusal(facts, {
        type: "answerQuest",
        questId: quest.id,
        questionId: quest.questions[0].id,
        answer: { kind: "choice", option: "nonsense" },
      }),
    ).toBe("invalid");
    expect(
      refusal(facts, { type: "answerQuest", questId: "raven", questionId: "where", answer: { kind: "choice", option: "bridge" } }),
    ).toBe("not_available");
  });

  it("give the day's bonus once all of today's quests are done", () => {
    let facts = newcomer();
    for (const daily of dailyQuests(TODAY)) facts = finishQuest(facts, daily.id);
    const quests = dailyQuests(TODAY).reduce((sum, q) => sum + q.xp, 0);
    expect(completed(facts, "daily_bonus", TODAY)).toBe(true);
    expect(balance(facts, "xp")).toBe(quests + 60);
  });
});

describe("daily discovery", () => {
  const entry = dailyEntry(TODAY);
  const key = dailyQuizKeys[entry.id];
  const wrongOption = entry.quiz.options.find((o) => o.id !== key.correct)!.id;

  it("rewards the quiz only for a right first try, and allows the other options until it is solved", () => {
    let facts = play(newcomer(), [{ type: "answerDailyQuiz", option: key.correct }]);
    expect(balance(facts, "xp")).toBe(entry.quiz.xp);
    expect(refusal(facts, { type: "answerDailyQuiz", option: wrongOption })).toBe("already_done");

    facts = play(newcomer(), [{ type: "answerDailyQuiz", option: wrongOption }]);
    expect(refusal(facts, { type: "answerDailyQuiz", option: wrongOption })).toBe("invalid");
    facts = play(facts, [{ type: "answerDailyQuiz", option: key.correct }]);
    expect(balance(facts, "xp")).toBe(0);
  });

  it("can be claimed once the quiz is answered, once, and keeps the word", () => {
    expect(refusal(newcomer(), { type: "claimDaily" })).toBe("not_ready");
    const facts = play(newcomer(), [{ type: "answerDailyQuiz", option: wrongOption }, { type: "claimDaily" }]);
    expect(balance(facts, "xp")).toBe(25);
    expect(facts.saved).toEqual([expect.objectContaining({ kind: "word", ref: entry.id })]);
    expect(refusal(facts, { type: "claimDaily" })).toBe("already_done");
  });
});

describe("the story", () => {
  const answer = (nodeId: string) => {
    const k = campaignKeys[nodeId];
    return k.kind === "question" ? k.correct : k.order;
  };

  it("opens the next node only, rewards each once, and finishes the chapter with its reward", () => {
    let facts = newcomer();
    expect(refusal(facts, { type: "answerStory", nodeId: "tower-1", answer: answer("tower-1") })).toBe("not_available");
    facts = play(facts, [{ type: "answerStory", nodeId: "prologue-1", answer: answer("prologue-1") }]);
    const prologue = chapterById.get("prologue")!;
    expect(chapterStatus(facts, prologue)).toBe("done");
    expect(balance(facts, "xp")).toBe(50 + prologue.reward.xp);
    expect(refusal(facts, { type: "answerStory", nodeId: "prologue-1", answer: answer("prologue-1") })).toBe("not_available");

    for (const id of ["tower-1", "tower-2", "tower-3", "tower-4"])
      facts = play(facts, [{ type: "answerStory", nodeId: id, answer: answer(id) }]);
    expect(refusal(facts, { type: "answerStory", nodeId: "tower-4", answer: answer("tower-4") })).toBe("not_available");
    facts = play(facts, [{ type: "answerStory", nodeId: "tower-5", answer: answer("tower-5") }]);
    expect(chapterStatus(facts, chapterById.get("tower")!)).toBe("done");
    // The next chapter is open but not written yet (Gate 3).
    expect(chapterStatus(facts, chapterById.get("forest")!)).toBe("unwritten");
  });

  it("records a wrong answer without a reward, and refuses a puzzle answer with other tiles", () => {
    let facts = play(newcomer(), [
      { type: "answerStory", nodeId: "prologue-1", answer: answer("prologue-1") },
      { type: "answerStory", nodeId: "tower-1", answer: "cook" },
    ]);
    expect(completed(facts, "story_node", "tower-1")).toBe(false);
    facts = play(facts, [
      { type: "answerStory", nodeId: "tower-1", answer: "archivist" },
      { type: "answerStory", nodeId: "tower-2", answer: "cellar" },
    ]);
    expect(refusal(facts, { type: "answerStory", nodeId: "tower-3", answer: ["We", "found", "a", "key"] })).toBe("invalid");
  });
});

describe("coins and items", () => {
  const rich = (facts: Facts, coins: number) =>
    applyEffects(facts, [{ type: "ledger", currency: "coins", amount: coins, key: "test", reason: "demo" }], NOW.toISOString());

  it("buy only with enough coins, once, from the item's level, at the day's price", () => {
    const facts = newcomer();
    expect(refusal(facts, { type: "buy", itemId: "red-bow" })).toBe("not_enough_coins");
    const bought = play(rich(facts, 1000), [{ type: "buy", itemId: "red-bow" }]);
    expect(owns(bought, "red-bow")).toBe(true);
    expect(balance(bought, "coins")).toBe(1000 - priceOf(itemById.get("red-bow")!, TODAY));
    // The deal of the day is 25% off.
    const deal = dealOfTheDay(TODAY);
    expect(priceOf(deal, TODAY)).toBe(Math.round(deal.price * 0.75));
    expect(refusal(bought, { type: "buy", itemId: "red-bow" })).toBe("already_owned");
    expect(refusal(rich(facts, 1000), { type: "buy", itemId: "ghost" })).toBe("level_too_low");
    expect(refusal(rich(facts, 1000), { type: "buy", itemId: "midnight-cloak" })).toBe("not_available");
  });

  it("let only owned items be worn, each in its own slot", () => {
    const facts = newcomer();
    expect(refusal(facts, { type: "saveLook", equipped: { neck: "red-bow" } })).toBe("not_owned");
    expect(refusal(facts, { type: "saveLook", equipped: { neck: "wizard-hat" } })).toBe("invalid");
    const bare = play(facts, [{ type: "saveLook", equipped: { headwear: null, handheld: null } }]);
    expect(bare.equipped).toEqual({ outfit: "violet-tunic" });
  });

  it("open the weekly chest after five quests in the week, once, giving a random cloak or glasses not owned yet", () => {
    let facts = newcomer();
    const monday = new Date("2026-10-19T09:00:00Z");
    for (const [offset, count] of [
      [0, 3],
      [1, 2],
    ] as const) {
      const day = new Date(monday.getTime() + offset * 86_400_000);
      for (const quest of dailyQuests(dayOf(day)).slice(0, count)) facts = finishQuest(facts, quest.id, day);
    }
    expect(weeklyQuestCount(facts, TODAY)).toBe(5);
    expect(chestReady(facts, TODAY)).toBe(true);
    // The draw is the context's: here it picks the last item still to win.
    const result = run(facts, { type: "openChest" }, { now: NOW, locale: "ru", demo: false, random: () => 0.999 });
    if (!result.ok) throw new Error(result.refusal);
    facts = applyEffects(facts, result.effects, NOW.toISOString());
    expect(result.outcome).toEqual({ kind: "chest", item: "round-glasses", coins: 0 });
    expect(owns(facts, "round-glasses")).toBe(true);
    expect(refusal(facts, { type: "openChest" })).toBe("not_ready");
  });
});

describe("streaks and achievements", () => {
  it("count days in a row, and grant an achievement once its goal is met", () => {
    let facts = newcomer();
    for (let back = 6; back >= 0; back--) {
      const day = new Date(NOW.getTime() - back * 86_400_000);
      facts = finishQuest(facts, dailyQuests(dayOf(day))[0].id, day);
    }
    expect(currentStreak(facts, TODAY)).toBe(7);
    expect(bestStreak(facts)).toBe(7);
    expect(completed(facts, "achievement", "seven-days")).toBe(true);
    expect(facts.ledger.filter((e) => e.key === "achievement:seven-days")).toHaveLength(1);
  });
});

describe("the demo student", () => {
  it("shows the balances of the approved screens, from a history played by the same rules", () => {
    const facts = demoFacts(NOW);
    expect(facts.profile.characterId).toBe("cat");
    expect(levelOf(balance(facts, "xp"))).toEqual({ level: 7, into: 340, next: 500 });
    expect(balance(facts, "coins")).toBe(DEMO_COINS);
    expect(currentStreak(facts, TODAY)).toBe(6);
    expect(completed(facts, "achievement", "first-clue")).toBe(true);
    expect(facts.equipped).toMatchObject({ headwear: "wizard-hat", outerwear: "sunset-cloak", handheld: "crystal-staff" });
  });
});
