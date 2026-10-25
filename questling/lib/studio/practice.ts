import { keysOf } from "@/lib/content/campaigns/keys";
import { campaignById } from "@/lib/content/campaigns";
import type { Campaign, CampaignKeys, PuzzleScene, QuestionScene, Scene } from "@/lib/story/graph";
import { locate } from "@/lib/story/run";
import type { Cefr, StudioFacts } from "./model";
import { starterCampaign } from "./starter";
import { campaignFor, topics } from "./views";

// "Собрать мини-тест по ошибкам": a draft campaign of the questions a group gets wrong most — the
// same scenes (with their hints and grimoires) and their answer keys, one after another, then an
// ending. No generator, no AI: the scenes are the ones the class already met. Evidence scenes are
// left out (they need clues found earlier in their own story).

export function practiceCampaign(facts: StudioFacts, groupId: string | null, slug: string, title: string, cefr: Cefr, count = 4) {
  const chosen: { scene: QuestionScene | PuzzleScene; keys: CampaignKeys[string] }[] = [];
  for (const topic of topics(facts, groupId, "ru")) {
    if (chosen.length >= count || topic.errorRate === 0) break;
    const [campaignId, ...rest] = topic.id.split("/");
    const sceneId = rest.join("/");
    const campaign: Campaign | null = campaignFor(facts, campaignId);
    const scene = campaign && locate(campaign, sceneId)?.scene;
    if (!campaign || !scene || (scene.kind !== "question" && scene.kind !== "puzzle")) continue;
    const keys = campaignById.has(campaign.id)
      ? keysOf(campaign)
      : (facts.quests.find((q) => q.slug === campaign.id)?.versions.find((v) => v.status === "published")?.keys ?? {});
    if (!keys[sceneId] || chosen.some((c) => c.scene.id === sceneId)) continue;
    chosen.push({ scene, keys: keys[sceneId] });
  }
  const base = starterCampaign(slug, title, cefr);
  if (!chosen.length) return base;
  const [start, , ending] = base.graph.chapters[0].scenes;
  // Each scene on its own: no clue to find, no branch to follow; one after another.
  const scenes: Scene[] = [
    start,
    ...chosen.map(({ scene }) => ({ ...structuredClone(scene), clue: undefined, next: undefined }) as Scene),
    ending,
  ];
  const graph: Campaign = {
    ...base.graph,
    clues: [],
    chapters: [{ ...base.graph.chapters[0], scenes, mission: { ru: "Повторить трудные места.", en: "Practise the hard parts." } }],
  };
  const keys: CampaignKeys = Object.fromEntries(chosen.map(({ scene, keys }) => [scene.id, structuredClone(keys)]));
  return { graph, keys };
}
