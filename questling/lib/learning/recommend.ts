import type { AnswerRecord, Facts } from "@/lib/game/facts";
import { findCampaign } from "@/lib/game/world";
import { locate } from "@/lib/story/run";
import { QUEST_OBJECTIVES, STORY_OBJECTIVES, isObjective, type Objective } from "./objectives";

// What to practise next, worked out from the student's own answers and nothing else: for each
// objective, the last few exercises (an exercise counts as wrong when its first attempt was), and
// a suggestion only where mistakes repeat. Deterministic and explainable: the screen states the
// numbers it is based on, and stays silent while there is too little to go on.

/** How many recent exercises of an objective are looked at, and the least needed to say anything. */
export const WINDOW = 5;
export const MIN_EXERCISES = 3;
export const MIN_ERRORS = 2;

/** The objective an answer trains: the teacher's tag on their scene, or the built-in table. */
export function objectiveOf(
  facts: Pick<Facts, "world" | "runs">,
  answer: Pick<AnswerRecord, "scope" | "ref" | "question">,
): Objective | null {
  if (answer.scope === "daily") return "vocabulary";
  if (answer.scope === "quest") return QUEST_OBJECTIVES[answer.ref.split("@")[0]]?.[answer.question] ?? null;
  const builtIn = STORY_OBJECTIVES[answer.ref]?.[answer.question];
  if (builtIn) return builtIn;
  const run = facts.runs.find((r) => r.campaign === answer.ref);
  const campaign = findCampaign(facts as Facts, answer.ref, run?.version);
  const scene = campaign ? locate(campaign, answer.question)?.scene : undefined;
  return scene && "objective" in scene && isObjective(scene.objective) ? scene.objective : null;
}

export type Exercise = { objective: Objective; correct: boolean; at: string };

/** One result per exercise (its first attempt), oldest first. */
export function exercises(facts: Pick<Facts, "world" | "runs">, answers: AnswerRecord[]): Exercise[] {
  const seen = new Set<string>();
  const out: Exercise[] = [];
  for (const a of [...answers].sort((x, y) => x.at.localeCompare(y.at))) {
    const id = `${a.scope}|${a.ref}|${a.question}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const objective = objectiveOf(facts, a);
    if (objective) out.push({ objective, correct: a.attempt === 1 ? a.correct : false, at: a.at });
  }
  return out;
}

export type Gap = { objective: Objective; errors: number; of: number; last: string };

/** Objectives with repeated recent mistakes, the clearest first. */
export function gaps(list: Exercise[]): Gap[] {
  const by = new Map<Objective, Exercise[]>();
  for (const e of list) by.set(e.objective, [...(by.get(e.objective) ?? []), e]);
  const out: Gap[] = [];
  for (const [objective, all] of by) {
    const recent = all.slice(-WINDOW);
    const errors = recent.filter((e) => !e.correct).length;
    if (recent.length >= MIN_EXERCISES && errors >= MIN_ERRORS)
      out.push({ objective, errors, of: recent.length, last: recent[recent.length - 1].at });
  }
  return out.sort((a, b) => b.errors / b.of - a.errors / a.of || b.last.localeCompare(a.last) || a.objective.localeCompare(b.objective));
}

/** The student's recommendations: at most `limit` gaps. */
export const recommendations = (facts: Facts, limit = 3): Gap[] => gaps(exercises(facts, facts.answers)).slice(0, limit);

/** Quick quests that train an objective (to suggest as practice). */
export const questsFor = (objective: Objective): string[] =>
  Object.entries(QUEST_OBJECTIVES)
    .filter(([, questions]) => Object.values(questions).includes(objective))
    .map(([quest]) => quest);
