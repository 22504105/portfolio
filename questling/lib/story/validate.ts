import type { Campaign, CampaignKeys, Next } from "./graph";
import { fieldText, isGraded, type TalkScene } from "./graph";
import { glossProblems } from "@/lib/learning/gloss";
import { holds, locate, nextScene } from "./run";

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

    // Word help: every mark on a text the scene has, still on its words, not overlapping another.
    const glosses = scene.glosses ?? [];
    if (new Set(glosses.map((g) => g.id)).size !== glosses.length) problem(`${scene.id}: two word-help marks share an id`);
    for (const field of new Set(glosses.map((g) => g.field))) {
      const text = fieldText(scene, field);
      if (text === null) problem(`${scene.id}: word help on ${field}, which the scene does not have`);
      else
        for (const p of glossProblems(
          text,
          glosses.filter((g) => g.field === field),
        ))
          problem(`${scene.id}: ${p}`);
    }

    if (scene.kind === "talk") {
      const ids = new Set(scene.lines.map((l) => l.id));
      if (ids.size !== scene.lines.length) problem(`${scene.id}: two talk lines share an id`);
      if (!ids.has(scene.start)) problem(`${scene.id}: the talk starts at unknown line ${scene.start}`);
      // Every line can be reached from the first one by some response.
      const reach = new Set<string>([scene.start]);
      for (let grew = true; grew;) {
        grew = false;
        for (const line of scene.lines)
          if (reach.has(line.id))
            for (const r of line.responses)
              if (r.to !== "end" && !reach.has(r.to)) {
                reach.add(r.to);
                grew = true;
              }
      }
      for (const line of scene.lines) if (!reach.has(line.id)) problem(`${scene.id}/${line.id}: no response leads to this line`);
      if (!scene.lines.some((l) => l.responses.some((r) => r.to === "end"))) problem(`${scene.id}: the talk never ends`);
      for (const line of scene.lines) {
        if (!line.responses.length) problem(`${scene.id}/${line.id}: no responses`);
        // A response always on offer at every line: the student can never be left with nothing to say.
        if (!line.responses.some((r) => !r.when))
          problem(`${scene.id}/${line.id}: every response needs a condition; one must always be on offer`);
        for (const r of line.responses) {
          if (r.to !== "end" && !ids.has(r.to)) problem(`${scene.id}/${line.id}: response ${r.id} leads to unknown line ${r.to}`);
          if (r.clue && !clueIds.has(r.clue)) problem(`${scene.id}/${line.id}: response ${r.id} gives unknown clue ${r.clue}`);
        }
      }
    }
    if (scene.kind === "search") {
      const key = keys[scene.id];
      const spots = new Set(scene.spots.map((x) => x.id));
      if (spots.size !== scene.spots.length) problem(`${scene.id}: two spots share an id`);
      if (scene.spots.length < 2) problem(`${scene.id}: a search needs at least two spots (one to find, one not)`);
      for (const spot of scene.spots) {
        if (spot.x < 0 || spot.y < 0 || spot.x + spot.w > 1.0001 || spot.y + spot.h > 1.0001)
          problem(`${scene.id}/${spot.id}: outside the picture`);
        // Big enough to tap on a 360 px phone (about 20 px at the least).
        if (spot.w < MIN_SPOT || spot.h < MIN_SPOT) problem(`${scene.id}/${spot.id}: too small to tap on a phone`);
      }
      if (key?.kind !== "search") problem(`${scene.id} has no search key`);
      else {
        if (!key.targets.length) problem(`${scene.id}: nothing to find`);
        if (key.targets.some((t) => !spots.has(t))) problem(`${scene.id}: a target is not one of its spots`);
        if (key.targets.length === scene.spots.length) problem(`${scene.id}: every spot is a target (nothing to tell apart)`);
      }
    }

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
      // Help on the very words of the answer would give it away: such a mark opens only once solved.
      const answer = scene.options
        .find((o) => o.id === key.correct)
        ?.label.toLowerCase()
        .replace(/^the /, "");
      for (const g of glosses)
        if (answer && !g.answer && overlapsAnswer(g.phrase.toLowerCase(), answer))
          problem(`${scene.id}: word help on "${g.phrase}" gives the answer away (mark it as the answer)`);
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
  // The moves between states are kept, so that afterwards every state can be asked whether some
  // ending is still reachable from it: a loop is fine while a choice can leave it, a trap is not.
  const reached = new Set<string>();
  const seen = new Set<string>();
  const moves = new Map<string, string[]>();
  const endings: string[] = [];
  const stateOf = (scene: string, flags: string[], clues: string[]) => `${scene}|${[...flags].sort()}|${[...clues].sort()}`;
  const walk = (scene: string, flags: string[], clues: string[], depth: number) => {
    const state = stateOf(scene, flags, clues);
    if (seen.has(state)) return;
    seen.add(state);
    reached.add(scene);
    if (depth > 500) return problem(`a path through ${scene} never ends`);
    const here = locate(campaign, scene)!.scene;
    const go = (to: string | null, nextFlags: string[], nextClues: string[]) => {
      if (!to) return problem(`${scene} leads nowhere`);
      moves.set(state, [...(moves.get(state) ?? []), stateOf(to, nextFlags, nextClues)]);
      walk(to, nextFlags, nextClues, depth + 1);
    };
    switch (here.kind) {
      case "ending":
        endings.push(state);
        return;
      case "choice":
        for (const option of here.options) go(option.to, [...new Set([...flags, ...(option.set ?? [])])], clues);
        return;
      case "talk": {
        for (const out of talkEnds(here, flags, clues, (l) =>
          problem(`${here.id}/${l}: in some way through the talk, nothing can be said here`),
        ))
          go(nextScene(campaign, here.id, out), out.flags, out.clues);
        return;
      }
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

  // Backwards from the endings: every state not reached this way is in a loop with no way out.
  const into = new Map<string, string[]>();
  for (const [from, tos] of moves) for (const to of tos) into.set(to, [...(into.get(to) ?? []), from]);
  const canEnd = new Set(endings);
  const queue = [...endings];
  while (queue.length)
    for (const from of into.get(queue.pop()!) ?? []) {
      if (canEnd.has(from)) continue;
      canEnd.add(from);
      queue.push(from);
    }
  const trapped = new Set([...seen].filter((state) => !canEnd.has(state)).map((state) => state.split("|")[0]));
  for (const scene of trapped) problem(`from ${scene} no path reaches an ending`);

  for (const scene of scenes) if (!reached.has(scene.id)) problem(`${scene.id} can never be reached`);
  if (!scenes.some((scene) => scene.kind === "ending")) problem("no ending");
  return problems;
}

/** Whether marked words and the answer share a word of substance ("midnight" and "At midnight"). */
function overlapsAnswer(phrase: string, answer: string): boolean {
  const words = (s: string) => s.split(/[^a-z']+/).filter((w) => w.length > 3);
  const said = new Set(words(answer));
  return phrase.includes(answer) || words(phrase).some((w) => said.has(w));
}

/** The smallest spot side, as a fraction of the picture (about 20 px on a 360 px wide phone). */
const MIN_SPOT = 0.06;

/**
 * Every way out of a talk from the given holdings: the flags and clues each "end" response leaves
 * (the scene's own clue included). Lines where nothing could be said are reported through `stuck`.
 */
function talkEnds(scene: TalkScene, flags: string[], clues: string[], stuck: (line: string) => void) {
  const out = new Map<string, { flags: string[]; clues: string[] }>();
  const seen = new Set<string>();
  const visit = (lineId: string, f: string[], c: string[]) => {
    const state = `${lineId}|${[...f].sort()}|${[...c].sort()}`;
    if (seen.has(state)) return;
    seen.add(state);
    const line = scene.lines.find((l) => l.id === lineId);
    if (!line) return;
    const offered = line.responses.filter((r) => !r.when || holds(r.when, { flags: f, clues: c }));
    if (!offered.length) return stuck(lineId);
    for (const r of offered) {
      const nf = [...new Set([...f, ...(r.set ?? [])])];
      const nc = r.clue && !c.includes(r.clue) ? [...c, r.clue] : c;
      if (r.to === "end") {
        const done = scene.clue && !nc.includes(scene.clue) ? [...nc, scene.clue] : nc;
        out.set(`${[...nf].sort()}|${[...done].sort()}`, { flags: nf, clues: done });
      } else visit(r.to, nf, nc);
    }
  };
  visit(scene.start, flags, clues);
  return [...out.values()];
}
