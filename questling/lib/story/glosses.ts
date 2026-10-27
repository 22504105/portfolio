import type { Gloss } from "@/lib/learning/gloss";
import { occurrences } from "@/lib/learning/gloss";
import type { Campaign, Scene } from "./graph";
import { fieldText } from "./graph";

// Word help for the built-in campaigns, written by the words it marks rather than by offsets:
// the offsets are worked out here from the scene's own text, so they cannot be typed wrong.
// A mark whose words are not in the text is a mistake in the content and fails loudly.

export type GlossSpec = Omit<Gloss, "id" | "start" | "end" | "phrase" | "field"> & {
  phrase: string;
  /** The text of the scene: "text" (the default for read scenes), "parchment", "question", "line:0"… */
  field?: string;
  /** Which of the phrase's occurrences, when it stands in the text more than once (0, the first, by default). */
  occurrence?: number;
};

const defaultField = (scene: Scene) =>
  scene.kind === "question" || scene.kind === "puzzle" ? "parchment" : scene.kind === "evidence" ? "question" : "text";

export function withGlosses(campaign: Campaign, specs: Record<string, GlossSpec[]>): Campaign {
  const scenes = new Map(campaign.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s]));
  for (const [sceneId, list] of Object.entries(specs)) {
    const scene = scenes.get(sceneId);
    if (!scene) throw new Error(`glosses: no scene ${sceneId} in ${campaign.id}`);
    scene.glosses = list.map(({ phrase, field: wanted, occurrence = 0, ...rest }, i) => {
      const field = wanted ?? defaultField(scene);
      const text = fieldText(scene, field);
      const start = text === null ? undefined : occurrences(text, phrase)[occurrence];
      if (start === undefined) throw new Error(`glosses: "${phrase}" is not in ${sceneId}.${field}`);
      return { id: `${sceneId}-${i + 1}`, field, start, end: start + phrase.length, phrase, ...rest };
    });
  }
  return campaign;
}
