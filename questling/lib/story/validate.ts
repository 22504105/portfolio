import type { Campaign, CampaignKeys, Next } from "./graph";
import { isGraded } from "./graph";
import { locate, nextScene } from "./run";

// Checks a campaign and its keys before anyone plays it: every transition leads to a scene,
// every scene can be reached, every path ends in an ending, and wherever evidence is asked for,
// the student has found a clue that proves it, whichever way they came. Walks every path,
// which is cheap for stories of this size. Returns the problems found; none means it is sound.

export function validateCampaign(campaign: Campaign, keys: CampaignKeys): string[] {
  const problems: string[] = [];
  const problem = (text: string) => problems.push(`${campaign.id}@${campaign.version}: ${text}`);
  const scenes = campaign.chapters.flatMap((chapter) => chapter.scenes);
  const ids = new Set<string>();
  for (const scene of scenes) {
    if (ids.has(scene.id)) problem(`scene ${scene.id} appears twice`);
    ids.add(scene.id);
  }
  const clueIds = new Set(campaign.clues.map((clue) => clue.id));
  const targets = (next: Next | undefined) => (next === undefined ? [] : typeof next === "string" ? [next] : next.map((b) => b.to));

  for (const chapter of campaign.chapters) if (chapter.scenes.length === 0) problem(`chapter ${chapter.id} has no scenes`);

  for (const scene of scenes) {
    const leads = scene.kind === "choice" ? scene.options.map((o) => o.to) : targets(scene.next);
    for (const to of leads) if (!ids.has(to)) problem(`${scene.id} leads to unknown scene ${to}`);
    if (Array.isArray(scene.next)) {
      const last = scene.next[scene.next.length - 1];
      if (!last || !("all" in last.when) || last.when.all.length > 0)
        problem(`${scene.id}: the last branch must always hold ({ all: [] })`);
    }
    if (scene.kind === "ending" && scene.next !== undefined) problem(`ending ${scene.id} leads on`);
    if ("clue" in scene && scene.clue && !clueIds.has(scene.clue)) problem(`${scene.id} gives unknown clue ${scene.clue}`);

    if (!isGraded(scene)) continue;
    const key = keys[scene.id];
    if (!key || key.kind !== scene.kind) {
      problem(`${scene.id} has no ${scene.kind} key`);
      continue;
    }
    if (!scene.grimoire.quiz.options.includes(key.grimoire)) problem(`${scene.id}: grimoire answer is not among its options`);
    if ((scene.grimoire.quiz.sentence.match(/___/g) ?? []).length !== 1) problem(`${scene.id}: grimoire sentence needs one ___`);
    if (scene.maxAttempts < 1) problem(`${scene.id}: no attempts`);
    if (scene.kind === "question" && key.kind === "question") {
      if (!scene.options.some((o) => o.id === key.correct)) problem(`${scene.id}: correct answer is not an option`);
      for (const option of scene.options) if (!key.explanations[option.id]) problem(`${scene.id}: no explanation for ${option.id}`);
    }
    if (scene.kind === "puzzle" && key.kind === "puzzle") {
      if ([...key.order].sort().join("|") !== [...scene.tiles].sort().join("|")) problem(`${scene.id}: order is not made of its tiles`);
      if (key.order.join("|") === scene.tiles.join("|")) problem(`${scene.id}: tiles start solved`);
    }
    if (scene.kind === "evidence" && key.kind === "evidence") {
      for (const clue of scene.clues) {
        if (!clueIds.has(clue)) problem(`${scene.id} offers unknown clue ${clue}`);
        if (!key.explanations[clue]) problem(`${scene.id}: no explanation for ${clue}`);
      }
      if (!key.correct.length || key.correct.some((clue) => !scene.clues.includes(clue)))
        problem(`${scene.id}: correct clues must be offered`);
    }
  }
  if (problems.length) return problems;

  // Every path, with what the student holds on it: (scene, flags, clues) states, each walked once.
  const reached = new Set<string>();
  const seen = new Set<string>();
  const walk = (scene: string, flags: string[], clues: string[], depth: number) => {
    const state = `${scene}|${[...flags].sort()}|${[...clues].sort()}`;
    if (seen.has(state)) return;
    seen.add(state);
    reached.add(scene);
    if (depth > 500) return problem(`a path through ${scene} never ends`);
    const here = locate(campaign, scene)!.scene;
    const go = (to: string | null, nextFlags: string[], nextClues: string[]) => {
      if (!to) return problem(`${scene} leads nowhere`);
      walk(to, nextFlags, nextClues, depth + 1);
    };
    switch (here.kind) {
      case "ending":
        return;
      case "choice":
        for (const option of here.options) go(option.to, [...new Set([...flags, ...(option.set ?? [])])], clues);
        return;
      case "evidence": {
        const key = keys[here.id];
        if (key?.kind === "evidence" && !key.correct.some((clue) => clues.includes(clue)))
          problem(`${here.id} can be reached without a clue that proves it (holding ${clues.join(", ") || "nothing"})`);
        break;
      }
    }
    const found = "clue" in here && here.clue && !clues.includes(here.clue) ? [...clues, here.clue] : clues;
    go(nextScene(campaign, here.id, { flags, clues: found }), flags, found);
  };
  walk(campaign.chapters[0].scenes[0].id, [], [], 0);

  for (const scene of scenes) if (!reached.has(scene.id)) problem(`${scene.id} can never be reached`);
  if (!scenes.some((scene) => scene.kind === "ending")) problem("no ending");
  return problems;
}
