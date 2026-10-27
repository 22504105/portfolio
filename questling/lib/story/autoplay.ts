import type { Campaign, CampaignKeys } from "./graph";
import { holds, locate, type Move, type RunState } from "./run";

// The right move at the scene a run is at, made with the answer keys: plays the demo student's
// past (lib/demo/seed.ts) and walks the stories in tests. At a choice it takes the option named
// in `choices` (by scene), else the first one.

export function rightMove(campaign: Campaign, keys: CampaignKeys, run: RunState, choices: Record<string, string> = {}): Move | null {
  const scene = locate(campaign, run.scene)?.scene;
  if (!scene || run.ending) return null;
  const key = keys[scene.id];
  switch (scene.kind) {
    case "narration":
    case "dialogue":
      return { type: "advance", scene: scene.id };
    case "choice":
      return { type: "choose", scene: scene.id, option: choices[scene.id] ?? scene.options[0].id };
    case "question":
      return key?.kind === "question" ? { type: "answer", scene: scene.id, answer: key.correct } : null;
    case "puzzle":
      return key?.kind === "puzzle" ? { type: "answer", scene: scene.id, answer: key.order } : null;
    case "evidence": {
      const proof = key?.kind === "evidence" ? key.correct.find((clue) => run.clues.includes(clue)) : undefined;
      return proof ? { type: "answer", scene: scene.id, answer: proof } : null;
    }
    case "talk": {
      // The first response on offer at the current line, or the one named in `choices` ("scene:line").
      const line = scene.lines.find((l) => l.id === (run.talk?.[scene.id] ?? scene.start));
      const offered = line?.responses.filter((r) => !r.when || holds(r.when, run)) ?? [];
      const wanted = offered.find((r) => r.id === choices[`${scene.id}:${line?.id}`]) ?? offered[0];
      return wanted ? { type: "say", scene: scene.id, response: wanted.id } : null;
    }
    case "search": {
      if (key?.kind !== "search") return null;
      const found = run.found?.[scene.id] ?? [];
      const next = key.targets.find((t) => !found.includes(t));
      return next ? { type: "tap", scene: scene.id, spot: next } : null;
    }
    case "dub":
      return { type: "advance", scene: scene.id };
    case "ending":
      return null;
  }
}
