import { describe, expect, it } from "vitest";
import { forgottenAcademy } from "@/lib/content/campaigns/forgotten-academy";
import { keysOf } from "@/lib/content/campaigns/keys";
import { applyEffects, emptyFacts, type AnswerRecord, type Facts } from "@/lib/game/facts";
import { run, type Action } from "@/lib/game/ops";
import { balance } from "@/lib/game/stats";
import { addDays, dayOf } from "@/lib/game/time";
import { exercises, gaps, objectiveOf, recommendations } from "@/lib/learning/recommend";
import { newSchedule, review } from "@/lib/learning/srs";
import { reviewOptions, type VocabCard } from "@/lib/learning/vocab";
import { rightMove } from "@/lib/story/autoplay";
import { runSeed, startRun } from "@/lib/story/run";
import { groupGaps } from "@/lib/studio/views";
import type { StudioFacts } from "@/lib/studio/model";

// Gate D (docs/features-audit.md): the word journal, its spaced repetition, and practice
// suggestions from the student's own mistakes.

const NOW = new Date("2026-10-27T09:00:00Z");
const TODAY = dayOf(NOW);
const at = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

function attempt(facts: Facts, action: Action, now = NOW) {
  const result = run(facts, action, { now, locale: "ru", demo: false });
  return { result, facts: result.ok ? applyEffects(facts, result.effects, now.toISOString()) : facts };
}
function play(facts: Facts, action: Action, now = NOW): Facts {
  const { result, facts: next } = attempt(facts, action, now);
  if (!result.ok) throw new Error(`${action.type} refused: ${result.refusal}`);
  return next;
}

/** A student who has played the first campaign up to (not including) a scene, right every time. */
function student(until: string): Facts {
  let facts = play(emptyFacts("2026-10-01T10:00:00.000Z"), { type: "chooseCharacter", characterId: "cat" });
  const campaign = forgottenAcademy;
  for (let i = 0; i < 40; i++) {
    const current = facts.runs.find((r) => r.campaign === campaign.id) ?? startRun(campaign, runSeed(facts.profile.joinedAt, campaign));
    if (current.scene === until) return facts;
    const move = rightMove(campaign, keysOf(campaign), current);
    if (!move) break;
    facts = play(facts, { type: "story", campaign: campaign.id, move });
  }
  throw new Error(`never reached ${until}`);
}

const ref = (scene: string, mark: string) => `gloss:forgotten-academy:${scene}:${mark}`;

describe("spaced repetition", () => {
  it("brings a word back after 1, 3, then growing gaps; a mistake brings it back tomorrow and lowers its ease", () => {
    let s = newSchedule(TODAY);
    expect(s.due).toBe(addDays(TODAY, 1));
    const gapsSeen: number[] = [];
    let day = s.due;
    for (let i = 0; i < 4; i++) {
      s = review(s, true, day);
      gapsSeen.push(s.interval);
      day = s.due;
    }
    expect(gapsSeen.slice(0, 2)).toEqual([1, 3]);
    expect(gapsSeen[2]).toBeGreaterThan(3);
    expect(gapsSeen[3]).toBeGreaterThan(gapsSeen[2]);
    const lapsed = review(s, false, day);
    expect(lapsed).toMatchObject({ due: addDays(day, 1), interval: 1, reps: 0, lapses: 1 });
    expect(lapsed.ease).toBeLessThan(s.ease);
  });
});

describe("the word journal", () => {
  it("keeps a word only once its scene is reached, copying the content from the campaign", () => {
    const early = student("p-greet");
    expect(attempt(early, { type: "keepWord", ref: ref("tower-2", "tower-2-1") }).result).toMatchObject({
      ok: false,
      refusal: "not_available",
    });
    const facts = play(early, { type: "keepWord", ref: ref("p-arrive", "p-arrive-1") });
    expect(facts.vocab).toHaveLength(1);
    expect(facts.vocab[0]).toMatchObject({ term: "Forgotten", ru: "забытая", cefr: "A2", source: "story:forgotten-academy", known: false });
    expect(facts.vocab[0].schedule.due).toBe(addDays(TODAY, 1));
  });

  it("holds back a mark on the answer until the scene is solved", () => {
    const facts = student("tower-4");
    expect(attempt(facts, { type: "keepWord", ref: ref("tower-4", "tower-4-2") }).result).toMatchObject({
      ok: false,
      refusal: "not_available",
    });
    expect(attempt(facts, { type: "keepWord", ref: ref("tower-4", "tower-4-1") }).result.ok).toBe(true);
    const solved = student("tower-5");
    expect(attempt(solved, { type: "keepWord", ref: ref("tower-4", "tower-4-2") }).result.ok).toBe(true);
  });

  it("refuses refs it cannot resolve and words kept twice; the word of the day only today", () => {
    const facts = student("p-greet");
    for (const bad of ["gloss:x:y:z", "gloss:forgotten-academy:p-arrive:nope", "daily:2020-01-01", "anything", "a".repeat(200)])
      expect(attempt(facts, { type: "keepWord", ref: bad }).result).toMatchObject({ ok: false });
    const kept = play(facts, { type: "keepWord", ref: `daily:${TODAY}` });
    expect(kept.vocab[0].source).toBe("daily");
    expect(attempt(kept, { type: "keepWord", ref: `daily:${TODAY}` }).result).toMatchObject({ ok: false, refusal: "already_done" });
  });

  it("flags and drops only the student's own cards", () => {
    let facts = play(student("p-greet"), { type: "keepWord", ref: ref("p-arrive", "p-arrive-2") });
    facts = play(facts, { type: "flagWord", ref: facts.vocab[0].ref, favorite: true, known: true });
    expect(facts.vocab[0]).toMatchObject({ favorite: true, known: true });
    expect(attempt(facts, { type: "flagWord", ref: "gloss:other", favorite: true }).result.ok).toBe(false);
    facts = play(facts, { type: "dropWord", ref: facts.vocab[0].ref });
    expect(facts.vocab).toEqual([]);
  });
});

describe("reviews", () => {
  const withCard = () => play(student("p-greet"), { type: "keepWord", ref: ref("p-arrive", "p-arrive-1") });

  it("offers four meanings under letter ids that do not tell the right one, the same all day", () => {
    const facts = withCard();
    const card = facts.vocab[0];
    const day = card.schedule.due;
    const options = reviewOptions(facts, card, day);
    expect(options.map((o) => o.id)).toEqual(["a", "b", "c", "d"]);
    expect(options.filter((o) => o.text === "забытая")).toHaveLength(1);
    expect(new Set(options.map((o) => o.text)).size).toBe(4);
    expect(reviewOptions(facts, card, day)).toEqual(options);
    // Over many students the right meaning is not stuck in one place.
    const places = new Set(
      Array.from({ length: 40 }, (_, i) => {
        const other = { ...facts, profile: { ...facts.profile, joinedAt: new Date(Date.UTC(2026, 9, 1, i)).toISOString() } };
        return reviewOptions(other, card, day).findIndex((o) => o.text === "забытая");
      }),
    );
    expect(places.size).toBeGreaterThan(2);
  });

  it("is only for due cards; a right answer pushes the card on and pays a little XP, a wrong one costs nothing", () => {
    const facts = withCard();
    const card = facts.vocab[0];
    expect(attempt(facts, { type: "reviewWord", ref: card.ref, option: "a" }).result).toMatchObject({ ok: false, refusal: "already_done" });
    const due = at(1);
    const right = reviewOptions(facts, card, dayOf(due)).find((o) => o.text === card.ru)!.id;
    const wrong = reviewOptions(facts, card, dayOf(due)).find((o) => o.text !== card.ru)!.id;

    const bad = attempt(facts, { type: "reviewWord", ref: card.ref, option: wrong }, due);
    expect(bad.result).toMatchObject({ ok: true, outcome: { kind: "review", correct: false, right, rewarded: 0 } });
    expect(balance(bad.facts, "xp")).toBe(balance(facts, "xp"));
    expect(bad.facts.vocab[0].schedule.due).toBe(addDays(dayOf(due), 1));
    // Once reviewed, the card is not due again today: no second try for XP.
    expect(attempt(bad.facts, { type: "reviewWord", ref: card.ref, option: right }, due).result).toMatchObject({ ok: false });

    const good = attempt(facts, { type: "reviewWord", ref: card.ref, option: right }, due);
    expect(good.result).toMatchObject({ ok: true, outcome: { kind: "review", correct: true, rewarded: 2 } });
    expect(balance(good.facts, "xp")).toBe(balance(facts, "xp") + 2);
    expect(attempt(facts, { type: "reviewWord", ref: card.ref, option: "z" }, due).result).toMatchObject({ ok: false, refusal: "invalid" });
  });

  it("pays review XP for at most ten right answers a day", () => {
    let facts = student("p-greet");
    const cards: VocabCard[] = Array.from({ length: 12 }, (_, i) => ({
      ref: `gloss:t:s:${i}`,
      term: `word${i}`,
      ru: `слово${i}`,
      source: "story:t",
      savedAt: NOW.toISOString(),
      favorite: false,
      known: false,
      schedule: { ...newSchedule(TODAY), due: TODAY },
    }));
    facts = { ...facts, vocab: cards };
    let paid = 0;
    for (const card of cards) {
      const right = reviewOptions(facts, card, TODAY).find((o) => o.text === card.ru)!.id;
      const { result, facts: next } = attempt(facts, { type: "reviewWord", ref: card.ref, option: right });
      if (result.ok && result.outcome.kind === "review") paid += result.outcome.rewarded;
      facts = next;
    }
    expect(paid).toBe(20);
  });
});

const answer = (
  scope: AnswerRecord["scope"],
  refName: string,
  question: string,
  correct: boolean,
  i: number,
  attemptNo = 1,
): AnswerRecord => ({
  scope,
  ref: refName,
  question,
  attempt: attemptNo,
  correct,
  skill: "grammar",
  at: new Date(NOW.getTime() + i * 60_000).toISOString(),
});

describe("practice suggestions", () => {
  const base = emptyFacts("2026-10-01T10:00:00.000Z");

  it("say nothing on a cold start or with too few exercises", () => {
    expect(recommendations(base)).toEqual([]);
    const two = {
      ...base,
      answers: [answer("quest", "mist@2026-10-20", "went", false, 0), answer("quest", "mist@2026-10-21", "went", false, 1)],
    };
    expect(recommendations(two)).toEqual([]);
  });

  it("count an exercise by its first attempt, and suggest where mistakes repeat, with the numbers behind it", () => {
    const answers = [
      answer("quest", "mist@2026-10-20", "went", false, 0),
      answer("quest", "mist@2026-10-20", "went", true, 1, 2), // a retry: the exercise still counts as wrong
      answer("quest", "mist@2026-10-21", "saw", false, 2),
      answer("quest", "mist@2026-10-22", "question", true, 3),
      answer("quest", "stars@2026-10-22", "under", true, 4),
      answer("quest", "stars@2026-10-23", "between", true, 5),
      answer("quest", "stars@2026-10-23", "sentence", false, 6), // word order: one mistake only
    ];
    const facts = { ...base, answers };
    expect(recommendations(facts)).toEqual([{ objective: "past-simple", errors: 2, of: 3, last: answers[3].at }]);
  });

  it("look only at the recent window: old mistakes fade", () => {
    const answers = [0, 1, 2].map((i) => answer("quest", `mist@2026-10-0${i + 1}`, "went", false, i));
    for (let i = 3; i < 8; i++) answers.push(answer("quest", `mist@2026-10-1${i}`, "went", true, i));
    expect(recommendations({ ...base, answers })).toEqual([]);
  });

  it("read a teacher's own tag on their scene, and the built-in table for built-in scenes", () => {
    expect(objectiveOf(base, { scope: "story", ref: "forgotten-academy", question: "tower-2" })).toBe("frequency");
    expect(objectiveOf(base, { scope: "daily", ref: "whisper@x", question: "a" })).toBe("vocabulary");
    const own = structuredClone(forgottenAcademy);
    own.id = "t-own-campaign";
    const scene = own.chapters[1].scenes.find((s) => s.id === "tower-2")!;
    if (scene.kind === "question") scene.objective = "conditionals";
    const facts = { ...base, world: { groups: [], assignments: [], campaigns: [own], messages: [] } };
    expect(objectiveOf(facts, { scope: "story", ref: "t-own-campaign", question: "tower-2" })).toBe("conditionals");
  });

  it("studio: the group's gaps are counts per objective, without names", () => {
    const struggling = [0, 1, 2].map((i) => answer("quest", `mist@2026-10-2${i}`, i === 2 ? "saw" : "went", i < 2, i));
    const fine = [0, 1, 2].map((i) => answer("quest", `mist@2026-10-2${i}`, "went", true, i));
    const member = (userId: string, answers: AnswerRecord[]) => ({
      userId,
      heroName: null,
      characterId: null,
      username: null,
      groups: [{ groupId: "g", joinedAt: NOW.toISOString() }],
      xp: 0,
      answers,
      completions: [],
      runs: [],
    });
    const facts = {
      teacher: { userId: "t", displayName: "T", email: "t@x" },
      groups: [{ id: "g", name: "G", cefr: "A2", inviteCode: "ABCDEFGH", createdAt: NOW.toISOString(), archivedAt: null }],
      members: [
        member(
          "a",
          struggling.map((a) => ({ ...a, correct: !a.correct })),
        ),
        member("b", fine),
      ],
      quests: [],
      assignments: [],
      daily: [],
      messages: [],
    } as unknown as StudioFacts;
    const list = groupGaps(facts, "g");
    expect(list[0]).toMatchObject({ objective: "past-simple", students: 1, exercises: 6 });
    expect(JSON.stringify(list)).not.toMatch(/"a"|"b"/);
    expect(list[0].quests).toContain("mist");
    expect(exercises(facts as unknown as Facts, struggling)).toHaveLength(3);
    expect(gaps([])).toEqual([]);
  });
});
