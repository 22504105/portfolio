import type { Campaign, Clue } from "@/lib/story/graph";
import { echoTower } from "./echo-tower";
import { forgottenAcademy } from "./forgotten-academy";

// Every campaign, in the order the map shows them. A campaign keeps each version it was
// published in: a run plays the version it started on (lib/story/graph.ts), so an old version
// stays here until no run uses it. Answer keys: ./keys.ts.

/** Every version of every campaign. */
const published: Campaign[] = [forgottenAcademy, echoTower];

const byVersion = new Map(published.map((campaign) => [`${campaign.id}@${campaign.version}`, campaign]));

/** The latest version of each campaign, in map order. */
export const campaignById = new Map<string, Campaign>();
for (const campaign of published)
  if ((campaignById.get(campaign.id)?.version ?? 0) < campaign.version) campaignById.set(campaign.id, campaign);
export const campaigns: Campaign[] = [...campaignById.values()];

/** The exact version a run is bound to. */
export const campaignVersion = (id: string, version: number): Campaign | null => byVersion.get(`${id}@${version}`) ?? null;

export const clueOf = (campaign: Campaign, id: string): Clue | null => campaign.clues.find((clue) => clue.id === id) ?? null;

export const chapterOf = (campaign: Campaign, id: string) => campaign.chapters.find((chapter) => chapter.id === id) ?? null;

/** A chapter by id across all campaigns (chapter ids are unique across them). */
export function findChapter(id: string) {
  for (const campaign of campaigns) {
    const chapter = chapterOf(campaign, id);
    if (chapter) return { campaign, chapter };
  }
  return null;
}
