import type { Campaign, CampaignKeys } from "./graph";
import { locate, type Move, type RunState } from "./run";

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
    case "ending":
      return null;
  }
}
