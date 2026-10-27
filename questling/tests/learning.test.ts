import { describe, expect, it } from "vitest";
import { forgottenAcademy } from "@/lib/content/campaigns/forgotten-academy";
import { echoTower } from "@/lib/content/campaigns/echo-tower";
import { keysOf } from "@/lib/content/campaigns/keys";
import { quickQuests } from "@/lib/content/quick-quests";
import { quickQuestKeys } from "@/lib/content/quick-quest-keys";
import { anchored, glossProblems, offered, reanchor, segments, type Gloss, type GlossView } from "@/lib/learning/gloss";
import { gradeAnswer, inAttemptOrder, type Question } from "@/lib/learning/questions";
import { attemptSeed, shuffled } from "@/lib/learning/shuffle";
import type { Campaign, QuestionScene } from "@/lib/story/graph";
import { withGlosses } from "@/lib/story/glosses";
import { locate, move, runSeed, startRun, type RunState } from "@/lib/story/run";
import { campaignSchema } from "@/lib/story/schema";
import { validateCampaign } from "@/lib/story/validate";
import { questionNode, sceneGlosses } from "@/lib/student/story";

// Gate A of the features specification: fair answer order and word help (docs/features-audit.md).

const clone = <T>(value: T): T => structuredClone(value);
const students = Array.from({ length: 600 }, (_, i) => new Date(Date.UTC(2026, 9, 1) + i * 37_003).toISOString());

describe("answer order", () => {
  it("is the same for the same seed and an order of the same items", () => {
    const items = ["a", "b", "c", "d"];
    expect(shuffled(items, "x")).toEqual(shuffled(items, "x"));
    expect([...shuffled(items, "x")].sort()).toEqual(items);
    expect(items).toEqual(["a", "b", "c", "d"]); // not changed in place
  });

  it("puts each item in each place about equally often (Fisher–Yates, no bias)", () => {
    // 4 items × 4000 seeds: each of the 16 (item, place) cells expects 1000. Deterministic seeds,
    // so this is a fixed check, not a flaky sample; the bound is loose enough for any fair shuffle.
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++)
      shuffled(["a", "b", "c", "d"], `seed-${i}`).forEach((item, place) => {
        counts.set(`${item}${place}`, (counts.get(`${item}${place}`) ?? 0) + 1);
      });
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(880);
      expect(count).toBeLessThan(1120);
    }
  });

  it("story: the right answer is not always first, and lands in every place across students", () => {
    const campaign = forgottenAcademy;
    const located = locate(campaign, "tower-2")!;
    const scene = located.scene as QuestionScene;
    expect(scene.options[0].id).toBe("cellar"); // authored with the answer first
    const places = [0, 0, 0];
    for (const joinedAt of students) {
      const run = { ...startRun(campaign, runSeed(joinedAt, campaign)), scene: "tower-2" };
      const node = questionNode(campaign, located.chapter, scene, run, "ru");
      places[node.options.findIndex((o) => o.id === "cellar")]++;
    }
    for (const n of places) expect(n).toBeGreaterThan(150);
  });

  it("story: the order holds for the whole run (reloads, wrong answers) and grading goes by id", () => {
    const campaign = forgottenAcademy;
    const { chapter, scene } = locate(campaign, "tower-2")!;
    const run: RunState = { ...startRun(campaign, runSeed(students[3], campaign)), scene: "tower-2" };
    const first = questionNode(campaign, chapter, scene as QuestionScene, run, "ru").options.map((o) => o.id);
    const wrong = first.find((id) => id !== "cellar")!;
    const after = move(campaign, keysOf(campaign), run, { type: "answer", scene: "tower-2", answer: wrong });
    expect(after.ok && after.answer?.correct).toBe(false);
    if (!after.ok) throw new Error("refused");
    expect(questionNode(campaign, chapter, scene as QuestionScene, after.run, "en").options.map((o) => o.id)).toEqual(first);
    const right = move(campaign, keysOf(campaign), after.run, { type: "answer", scene: "tower-2", answer: "cellar" });
    expect(right.ok && right.answer?.correct).toBe(true);
  });

  it("story: a new version is a new attempt (new seed); a run from before shuffling keeps the authored order", () => {
    expect(runSeed(students[0], { id: "c", version: 1 })).not.toBe(runSeed(students[0], { id: "c", version: 2 }));
    const campaign = forgottenAcademy;
    const { chapter, scene } = locate(campaign, "tower-2")!;
    const legacy: RunState = { ...startRun(campaign), scene: "tower-2" };
    expect(legacy.seed).toBeUndefined();
    expect(questionNode(campaign, chapter, scene as QuestionScene, legacy, "ru").options.map((o) => o.id)).toEqual(
      (scene as QuestionScene).options.map((o) => o.id),
    );
  });

  it("story: the author can keep their order", () => {
    const campaign = clone(forgottenAcademy);
    const { chapter, scene } = locate(campaign, "tower-2")!;
    (scene as QuestionScene).shuffle = false;
    for (const joinedAt of students.slice(0, 20)) {
      const run = { ...startRun(campaign, runSeed(joinedAt, campaign)), scene: "tower-2" };
      expect(questionNode(campaign, chapter, scene as QuestionScene, run, "ru").options[0].id).toBe("cellar");
    }
  });

  it("quick quests: options, bank and matches are mixed per attempt, word order is not, grading is unchanged", () => {
    const letter = quickQuests.find((q) => q.id === "letter")!;
    const seal = letter.questions.find((q) => q.id === "seal") as Extract<Question, { kind: "choice" }>;
    const places = new Set(
      students
        .slice(0, 60)
        .map((s) =>
          (inAttemptOrder(seal, attemptSeed(s, "letter@2026-10-26|seal")) as typeof seal).options.findIndex((o) => o.id === "sealed"),
        ),
    );
    expect(places.size).toBe(3);
    const today = attemptSeed(students[0], "letter@2026-10-26|seal");
    expect(inAttemptOrder(seal, today)).toEqual(inAttemptOrder(seal, today));
    for (const quest of quickQuests)
      for (const question of quest.questions) {
        const shown = inAttemptOrder(question, `x|${question.id}`);
        if (question.kind === "order") expect(shown).toBe(question);
        // The same answer grades the same, whatever the order shown.
        const key = quickQuestKeys[quest.id][question.id];
        const answer =
          key.kind === "choice"
            ? { kind: "choice" as const, option: key.correct }
            : key.kind === "multi"
              ? { kind: "multi" as const, options: key.correct }
              : key.kind === "fill"
                ? { kind: "fill" as const, word: key.correct }
                : key.kind === "order"
                  ? { kind: "order" as const, tiles: key.correct }
                  : { kind: "match" as const, pairs: key.correct };
        expect(gradeAnswer(key, answer).correct).toBe(true);
      }
  });
});

const g = (over: Partial<Gloss> & Pick<Gloss, "start" | "end" | "phrase">): Gloss => ({ id: "g", field: "text", ru: "перевод", ...over });

describe("word help", () => {
  it("marks words by place, and finds them again after the text around them is edited", () => {
    const mark = g({ start: 9, end: 15, phrase: "hidden" });
    expect(anchored("Find the hidden entrance", mark)).toBe(true);
    const moved = reanchor("Quickly, find the hidden entrance", mark)!;
    expect(moved.start).toBe(18);
    expect(anchored("Quickly, find the hidden entrance", moved)).toBe(true);
    expect(reanchor("Find the secret entrance", mark)).toBeNull();
  });

  it("keeps the occurrence nearest to where it was when the words repeat", () => {
    const text = "The door and the door again";
    const second = g({ start: 17, end: 21, phrase: "door" });
    expect(anchored(text, second)).toBe(true);
    const edited = "Look: the door and the door again";
    expect(reanchor(edited, second)!.start).toBe(23);
  });

  it("reports overlaps, lost words and missing translations; the screen leaves an overlapping mark out", () => {
    const text = "a hidden door";
    const hidden = g({ id: "a", start: 2, end: 8, phrase: "hidden" });
    const both = g({ id: "b", start: 2, end: 13, phrase: "hidden door" });
    const lost = g({ id: "c", start: 0, end: 4, phrase: "gone" });
    const empty = g({ id: "d", start: 9, end: 13, phrase: "door", ru: " " });
    const problems = glossProblems(text, [hidden, both, lost, empty]).join("\n");
    expect(problems).toMatch(/b overlaps a/);
    expect(problems).toMatch(/c: "gone" is no longer in the text/);
    expect(problems).toMatch(/d: no translation/);
    const view = (x: Gloss): GlossView => ({ id: x.id, field: x.field, start: x.start, end: x.end, phrase: x.phrase, ru: x.ru });
    expect(segments(text, [view(hidden), view(both)]).map((s) => [s.text, s.gloss?.id ?? null])).toEqual([
      ["a ", null],
      ["hidden", "a"],
      [" door", null],
    ]);
  });

  it("cuts multi-line and non-ASCII text without losing a character", () => {
    const text = "Line one — “quoted”\nthe café is near";
    const cafe = g({ start: text.indexOf("café"), end: text.indexOf("café") + 4, phrase: "café" });
    const parts = segments(text, [{ id: cafe.id, field: cafe.field, start: cafe.start, end: cafe.end, phrase: cafe.phrase, ru: "кафе" }]);
    expect(parts.map((p) => p.text).join("")).toBe(text);
    expect(parts.find((p) => p.gloss)?.text).toBe("café");
  });

  it("offers more help at A1–A2, takes easy words as known from B1, honours the campaign's choice and holds answers back", () => {
    const easy = g({ start: 0, end: 1, phrase: "x", cefr: "A1" });
    expect(offered(easy, "A2")).toBe(true);
    expect(offered(easy, "B2")).toBe(false);
    expect(offered(g({ start: 0, end: 1, phrase: "x", cefr: "B1" }), "B2")).toBe(true);
    expect(offered(g({ start: 0, end: 1, phrase: "x" }), "C1")).toBe(true); // a word at the chapter's own level
    expect(offered(easy, "B2", "all")).toBe(true);
    expect(offered(easy, "A1", "none")).toBe(false);
    const answer = g({ start: 0, end: 1, phrase: "x", answer: true });
    expect(offered(answer, "A1")).toBe(false);
    expect(offered(answer, "A1", "auto", true)).toBe(true);
  });

  it("built-in campaigns: marks land on their words, and the answer's own word opens only once solved", () => {
    for (const campaign of [forgottenAcademy, echoTower])
      for (const scene of campaign.chapters.flatMap((c) => c.scenes))
        for (const mark of scene.glosses ?? []) expect(mark.phrase).toBeTruthy();
    const { chapter, scene } = locate(forgottenAcademy, "tower-4")!;
    const ids = (solved: boolean) => sceneGlosses(forgottenAcademy, chapter, scene, "ru", solved).map((x) => x.phrase);
    expect(ids(false)).toEqual(["only"]);
    expect(ids(true)).toEqual(["only", "midnight"]);
    // In the B1 chapter an A2 word ("locked") still gets help; in the B2 one an A2 word ("empty") is taken as known.
    const bell = locate(echoTower, "e-bell")!;
    expect(sceneGlosses(echoTower, bell.chapter, bell.scene, "ru").map((x) => x.phrase)).toEqual(["locked", "for a hundred years"]);
    const hall = locate(echoTower, "a-hall")!;
    expect(sceneGlosses(echoTower, hall.chapter, hall.scene, "ru").map((x) => x.phrase)).toEqual(["barely been disturbed"]);
  });

  it("the validator refuses help that gives the answer away, or that lost its words", () => {
    const campaign = clone(forgottenAcademy) as Campaign;
    const scene = locate(campaign, "tower-4")!.scene;
    scene.glosses = scene.glosses!.map((x) => ({ ...x, answer: undefined }));
    expect(validateCampaign(campaign, keysOf(forgottenAcademy)).join("\n")).toMatch(/"midnight" gives the answer away/);
    const lost = clone(forgottenAcademy) as Campaign;
    const parchment = locate(lost, "tower-4")!.scene as QuestionScene;
    parchment.parchment = "The gate opens at dawn.";
    expect(validateCampaign(lost, keysOf(forgottenAcademy)).join("\n")).toMatch(/"only" is no longer in the text/);
  });

  it("withGlosses refuses words that are not in the scene", () => {
    expect(() => withGlosses(clone(forgottenAcademy), { "tower-4": [{ phrase: "dragon", ru: "дракон" }] })).toThrow(/dragon/);
  });

  it("the studio's schema takes marks only where their place and words agree", () => {
    const base = {
      id: "t-abcd-test",
      version: 1,
      title: { ru: "К", en: "C" },
      cefr: "A2",
      requires: null,
      quote: { text: { ru: "", en: "" }, source: { ru: "", en: "" } },
      clues: [],
      caseNumber: 1,
      support: "all",
      chapters: [
        {
          ...clone(forgottenAcademy.chapters[0]),
          id: "c1",
          gate: undefined,
          scenes: [
            {
              id: "n1",
              kind: "ending",
              location: { ru: "Л", en: "L" },
              image: "/images/forest.webp",
              title: { ru: "К", en: "E" },
              text: "Find the hidden entrance",
              translation: { ru: "Найди", en: "Find" },
              tone: "bright",
              reward: { xp: 0, coins: 0 },
              glosses: [{ id: "w1", field: "text", start: 9, end: 15, phrase: "hidden", ru: "скрытый" }],
            },
          ],
        },
      ],
    };
    expect(campaignSchema.safeParse(base).success).toBe(true);
    const wrong = clone(base);
    wrong.chapters[0].scenes[0].glosses[0].end = 20;
    expect(campaignSchema.safeParse(wrong).success).toBe(false);
  });
});
