import type { Campaign, CampaignKeys, Chapter, Condition, GradedScene, Next, Scene } from "./graph";
import { isGraded } from "./graph";

// Playing a campaign: the run's state and how each move changes it. Pure functions, run by the
// demo in the browser and by the server on the stored run. Only the scene the run is at can be
// played; where it leads is worked out here from the graph, never taken from the page.

export type SceneProgress = { used: number; restored: number; eliminated: string[]; solved: boolean };

export type RunState = {
  campaign: string;
  version: number;
  /** The scene the student is at; an ending once the campaign is over. */
  scene: string;
  flags: string[];
  clues: string[];
  choices: Record<string, string>;
  /** Scenes passed, in order. */
  visited: string[];
  progress: Record<string, SceneProgress>;
  chapters: string[];
  ending: string | null;
};

export type Grant = { currency: "xp" | "coins"; amount: number; key: string; reason: "story_node" | "chapter" | "ending" };

export type MoveResult =
  | {
      ok: true;
      run: RunState;
      grants: Grant[];
      /** For graded scenes: the answer as recorded. */
      answer?: { correct: boolean; attempt: number; explanation: { ru: string; en: string } };
      /** For the grimoire's quiz. */
      grimoire?: { correct: boolean };
      chapterDone: string | null;
    }
  | { ok: false; refusal: "invalid" | "not_available" | "exhausted" | "not_exhausted" };

// ——— Reading the graph ———

type Located = { chapter: Chapter; chapterIndex: number; scene: Scene; sceneIndex: number };

const indexes = new WeakMap<Campaign, Map<string, Located>>();
export function locate(campaign: Campaign, sceneId: string): Located | null {
  let index = indexes.get(campaign);
  if (!index) {
    index = new Map();
    campaign.chapters.forEach((chapter, chapterIndex) =>
      chapter.scenes.forEach((scene, sceneIndex) => index!.set(scene.id, { chapter, chapterIndex, scene, sceneIndex })),
    );
    indexes.set(campaign, index);
  }
  return index.get(sceneId) ?? null;
}

export function holds(condition: Condition, run: Pick<RunState, "flags" | "clues">): boolean {
  if ("flag" in condition) return run.flags.includes(condition.flag);
  if ("clue" in condition) return run.clues.includes(condition.clue);
  if ("not" in condition) return !holds(condition.not, run);
  if ("all" in condition) return condition.all.every((c) => holds(c, run));
  return condition.any.some((c) => holds(c, run));
}

function resolve(next: Next, run: Pick<RunState, "flags" | "clues">): string | null {
  if (typeof next === "string") return next;
  return next.find((branch) => holds(branch.when, run))?.to ?? null;
}

/** Where a scene leads: its own transition, else the next scene of its chapter, else the next chapter's first. */
export function nextScene(campaign: Campaign, sceneId: string, run: Pick<RunState, "flags" | "clues">): string | null {
  const here = locate(campaign, sceneId);
  if (!here) return null;
  if (here.scene.next !== undefined) return resolve(here.scene.next, run);
  const following = here.chapter.scenes[here.sceneIndex + 1];
  if (following) return following.id;
  return campaign.chapters[here.chapterIndex + 1]?.scenes[0]?.id ?? null;
}

export function startRun(campaign: Campaign): RunState {
  return {
    campaign: campaign.id,
    version: campaign.version,
    scene: campaign.chapters[0].scenes[0].id,
    flags: [],
    clues: [],
    choices: {},
    visited: [],
    progress: {},
    chapters: [],
    ending: null,
  };
}

export function sceneProgress(run: RunState, sceneId: string): SceneProgress {
  return run.progress[sceneId] ?? { used: 0, restored: 0, eliminated: [], solved: false };
}

export function attemptsAllowed(scene: GradedScene, progress: SceneProgress): number {
  return scene.maxAttempts + progress.restored;
}

export function isExhausted(scene: GradedScene, progress: SceneProgress): boolean {
  return !progress.solved && progress.used >= attemptsAllowed(scene, progress);
}

// ——— Moving ———

const grantKey = (run: RunState, what: string) => `story:${run.campaign}:${what}`;

/** Leaves the current scene for `to`: marks it passed, completes a chapter when one is left, ends the campaign at an ending. */
function moveTo(campaign: Campaign, run: RunState, to: string | null, grants: Grant[]): { run: RunState; chapterDone: string | null } {
  if (!to) throw new Error(`scene ${run.scene} of ${campaign.id} leads nowhere`);
  const from = locate(campaign, run.scene)!;
  const target = locate(campaign, to);
  if (!target) throw new Error(`scene ${run.scene} of ${campaign.id} leads to unknown ${to}`);
  const next: RunState = { ...run, scene: to, visited: [...run.visited, run.scene] };
  let chapterDone: string | null = null;
  const finishChapter = (chapter: Chapter) => {
    if (next.chapters.includes(chapter.id)) return;
    next.chapters = [...next.chapters, chapter.id];
    chapterDone = chapter.id;
    if (chapter.reward.xp) grants.push({ currency: "xp", amount: chapter.reward.xp, key: grantKey(run, `chapter:${chapter.id}`), reason: "chapter" });
    if (chapter.reward.coins) grants.push({ currency: "coins", amount: chapter.reward.coins, key: grantKey(run, `chapter:${chapter.id}`), reason: "chapter" });
  };
  if (target.chapterIndex !== from.chapterIndex) finishChapter(from.chapter);
  if (target.scene.kind === "ending") {
    finishChapter(target.chapter);
    next.ending = to;
    const { xp, coins } = target.scene.reward;
    if (xp) grants.push({ currency: "xp", amount: xp, key: grantKey(run, "ending"), reason: "ending" });
    if (coins) grants.push({ currency: "coins", amount: coins, key: grantKey(run, "ending"), reason: "ending" });
  }
  return { run: next, chapterDone };
}

const withClue = (run: RunState, clue: string | undefined): RunState => (clue && !run.clues.includes(clue) ? { ...run, clues: [...run.clues, clue] } : run);

export type Move =
  | { type: "advance"; scene: string }
  | { type: "choose"; scene: string; option: string }
  | { type: "answer"; scene: string; answer: string | string[] }
  | { type: "grimoire"; scene: string; word: string };

export function move(campaign: Campaign, keys: CampaignKeys, run: RunState, action: Move): MoveResult {
  if (run.ending || action.scene !== run.scene) return { ok: false, refusal: "not_available" };
  const here = locate(campaign, run.scene);
  if (!here) return { ok: false, refusal: "invalid" };
  const scene = here.scene;
  const grants: Grant[] = [];

  switch (action.type) {
    case "advance": {
      if (scene.kind !== "narration" && scene.kind !== "dialogue") return { ok: false, refusal: "invalid" };
      const found = withClue(run, scene.clue);
      const moved = moveTo(campaign, found, nextScene(campaign, scene.id, found), grants);
      return { ok: true, run: moved.run, grants, chapterDone: moved.chapterDone };
    }

    case "choose": {
      if (scene.kind !== "choice") return { ok: false, refusal: "invalid" };
      const option = scene.options.find((o) => o.id === action.option);
      if (!option) return { ok: false, refusal: "invalid" };
      const chosen: RunState = {
        ...run,
        flags: [...new Set([...run.flags, ...(option.set ?? [])])],
        choices: { ...run.choices, [scene.id]: option.id },
      };
      const moved = moveTo(campaign, chosen, option.to, grants);
      return { ok: true, run: moved.run, grants, chapterDone: moved.chapterDone };
    }

    case "answer": {
      if (!isGraded(scene)) return { ok: false, refusal: "invalid" };
      const key = keys[scene.id];
      if (!key || key.kind !== scene.kind) return { ok: false, refusal: "invalid" };
      const progress = sceneProgress(run, scene.id);
      if (isExhausted(scene, progress)) return { ok: false, refusal: "exhausted" };

      let correct: boolean;
      let explanation: { ru: string; en: string };
      let eliminated: string | null = null;
      if (key.kind === "puzzle") {
        if (scene.kind !== "puzzle" || !Array.isArray(action.answer)) return { ok: false, refusal: "invalid" };
        if ([...action.answer].sort().join("\u0000") !== [...scene.tiles].sort().join("\u0000")) return { ok: false, refusal: "invalid" };
        correct = action.answer.join(" ") === key.order.join(" ");
        explanation = correct ? key.explanation : { ru: "", en: "" };
      } else {
        const option = action.answer;
        if (typeof option !== "string" || progress.eliminated.includes(option)) return { ok: false, refusal: "invalid" };
        if (scene.kind === "question" && !scene.options.some((o) => o.id === option)) return { ok: false, refusal: "invalid" };
        // Evidence: only a clue offered by the scene, and found by the student, can be shown.
        if (scene.kind === "evidence" && (!scene.clues.includes(option) || !run.clues.includes(option))) return { ok: false, refusal: "invalid" };
        correct = key.kind === "question" ? option === key.correct : key.correct.includes(option);
        explanation = key.explanations[option] ?? { ru: "", en: "" };
        if (!correct) eliminated = option;
      }

      const attempt = progress.used + 1;
      const updated: SceneProgress = {
        ...progress,
        used: attempt,
        solved: correct,
        eliminated: eliminated ? [...progress.eliminated, eliminated] : progress.eliminated,
      };
      let next: RunState = { ...run, progress: { ...run.progress, [scene.id]: updated } };
      let chapterDone: string | null = null;
      if (correct) {
        if (scene.xp) grants.push({ currency: "xp", amount: scene.xp, key: grantKey(run, `scene:${scene.id}`), reason: "story_node" });
        next = withClue(next, scene.clue);
        const moved = moveTo(campaign, next, nextScene(campaign, scene.id, next), grants);
        next = moved.run;
        chapterDone = moved.chapterDone;
      }
      return { ok: true, run: next, grants, answer: { correct, attempt, explanation }, chapterDone };
    }

    case "grimoire": {
      if (!isGraded(scene)) return { ok: false, refusal: "invalid" };
      const progress = sceneProgress(run, scene.id);
      if (!isExhausted(scene, progress)) return { ok: false, refusal: "not_exhausted" };
      if (!scene.grimoire.quiz.options.includes(action.word)) return { ok: false, refusal: "invalid" };
      const correct = keys[scene.id]?.grimoire === action.word;
      // Studying the rule wins back exactly one attempt; a wrong word costs nothing.
      const next: RunState = correct ? { ...run, progress: { ...run.progress, [scene.id]: { ...progress, restored: progress.restored + 1 } } } : run;
      return { ok: true, run: next, grants, grimoire: { correct }, chapterDone: null };
    }
  }
}

// ——— Progress for the screens ———

export function gradedScenes(chapter: Chapter): GradedScene[] {
  return chapter.scenes.filter(isGraded);
}

export type ChapterState = "done" | "current" | "open" | "locked";

export function chapterState(campaign: Campaign, run: RunState | null, chapter: Chapter, campaignOpen: boolean): ChapterState {
  if (!campaignOpen) return "locked";
  if (run?.chapters.includes(chapter.id)) return "done";
  const index = campaign.chapters.indexOf(chapter);
  if (!run) return index === 0 ? "open" : "locked";
  if (locate(campaign, run.scene)?.chapter === chapter) return "current";
  return "locked";
}

/** Solved graded scenes of a chapter, and how many the chapter has. */
export function chapterSolved(chapter: Chapter, run: RunState | null): { solved: number; total: number } {
  const graded = gradedScenes(chapter);
  return { solved: graded.filter((scene) => run?.progress[scene.id]?.solved).length, total: graded.length };
}
