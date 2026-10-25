import { describe, expect, it } from "vitest";
import { quickQuestKeys } from "@/lib/content/quick-quest-keys";
import { dailyQuizKeys } from "@/lib/content/daily-keys";
import { demoFacts, DEMO_COINS } from "@/lib/demo/seed";
import { applyEffects, emptyFacts, type Facts } from "@/lib/game/facts";
import { run, settleAchievements, type Action } from "@/lib/game/ops";
import {
  balance,
  bestStreak,
  runOf,
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
import { dayOf, msUntilNextDay, weekOf } from "@/lib/game/time";
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

  it("keeps one quiz mark and one reward a day when a teacher plans the day's word after the student answered", () => {
    // The student answers the built-in quiz; later the same day their teacher plans a word for today.
    let facts = play(newcomer(), [{ type: "answerDailyQuiz", option: key.correct }]);
    const other = dailyEntry("2026-10-25");
    const teacherEntry = { ...other, id: "teacher-entry-1" };
    facts = { ...facts, world: { groups: [], assignments: [], campaigns: [], messages: [], daily: [{ day: TODAY, entry: teacherEntry }] } };
    const ctx = {
      now: NOW,
      locale: "ru" as const,
      demo: false,
      dailyKeys: (id: string) => (id === teacherEntry.id ? dailyQuizKeys[other.id] : null),
    };
    const step = (action: Action) => {
      const result = run(facts, action, ctx);
      if (!result.ok) throw new Error(`${action.type} refused: ${result.refusal}`);
      facts = applyEffects(facts, result.effects, NOW.toISOString());
    };
    // The teacher's quiz can be answered, and then the day claimed …
    step({ type: "answerDailyQuiz", option: dailyQuizKeys[other.id].correct });
    step({ type: "claimDaily" });
    // … without a second quiz mark for the day or a second quiz reward (the database refuses both).
    expect(facts.completions.filter((c) => c.kind === "daily_quiz" && c.ref === TODAY)).toHaveLength(1);
    const keys = facts.ledger.map((l) => `${l.currency}:${l.key}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(balance(facts, "xp")).toBe(entry.quiz.xp + 25);
  });
});

// The story's rules (runs, branches, attempts, the grimoire, rewards) are tested in story-run.test.ts.

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
  it("pays an achievement's item in coins when the student already bought it", () => {
    // The crown is the "moon library" reward (ten manuscripts read on the first try); bought first here.
    let facts = applyEffects(newcomer(), [{ type: "own", item: "star-crown", source: "purchase" }], NOW.toISOString());
    facts = applyEffects(
      facts,
      Array.from({ length: 10 }, (_, i) => ({
        type: "answer" as const,
        scope: "story" as const,
        ref: "forgotten-academy",
        question: `q${i}`,
        attempt: 1,
        correct: true,
        skill: "reading" as const,
      })),
      NOW.toISOString(),
    );
    const effects = settleAchievements(facts);
    expect(effects).toContainEqual({ type: "completion", kind: "achievement", ref: "moon-library" });
    expect(effects).toContainEqual(
      expect.objectContaining({
        type: "ledger",
        currency: "coins",
        amount: itemById.get("star-crown")!.price,
        key: "achievement:moon-library",
      }),
    );
  });

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
    // The prologue done, chapter II begun: the run waits at the sealed letter of the approved player screen.
    expect(runOf(facts, "forgotten-academy")).toMatchObject({ scene: "tower-2", chapters: ["prologue"], ending: null });
    expect(facts.equipped).toMatchObject({ headwear: "wizard-hat", outerwear: "sunset-cloak", handheld: "crystal-staff" });
  });
});

describe("the academy calendar", () => {
  it("turns the day over at midnight in Moscow, for everyone", () => {
    expect(dayOf("2026-10-21T20:59:59Z")).toBe("2026-10-21");
    expect(dayOf("2026-10-21T21:00:00Z")).toBe("2026-10-22");
    expect(msUntilNextDay(new Date("2026-10-21T20:59:00Z"))).toBe(60_000);
    expect(msUntilNextDay(new Date("2026-10-21T21:00:00Z"))).toBe(24 * 3_600_000);
    // The chest's week starts on Monday.
    expect(weekOf("2026-10-25")).toBe("2026-10-19");
    expect(weekOf("2026-10-26")).toBe("2026-10-26");
  });
});

describe("the student's small choices", () => {
  it("saves the day's fact and takes it back", () => {
    let facts = play(newcomer(), [{ type: "toggleSavedFact" }]);
    expect(facts.saved).toEqual([expect.objectContaining({ kind: "fact", ref: dailyEntry(TODAY).id })]);
    facts = play(facts, [{ type: "toggleSavedFact" }]);
    expect(facts.saved.filter((s) => s.kind === "fact")).toEqual([]);
  });

  it("names the hero within bounds, and never with markup", () => {
    expect(play(newcomer(), [{ type: "renameHero", name: "  Барсик  " }]).profile.heroName).toBe("Барсик");
    for (const name of ["Б", "x".repeat(25), "<b>Кот</b>", "{{name}}"])
      expect(refusal(newcomer(), { type: "renameHero", name })).toBe("invalid");
  });
});
