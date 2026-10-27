import type { Campaign, CampaignKeys } from "@/lib/story/graph";
import { echoTowerKeys } from "./echo-tower-keys";
import { forgottenAcademyKeys } from "./forgotten-academy-keys";

// Answer keys by campaign version. Read by the rules (lib/game/ops.ts), which run on the server
// and in the demo only: never part of a signed-in student's page.

const keys: Record<string, CampaignKeys> = {
  "forgotten-academy@1": forgottenAcademyKeys,
  // Version 2 adds the forest search (gate E): the R stone, then the mushrooms beside it.
  "forgotten-academy@2": { ...forgottenAcademyKeys, "f-search": { kind: "search", targets: ["stone-r", "mushrooms"], ordered: true } },
  "echo-tower@1": echoTowerKeys,
};

export const keysOf = (campaign: Campaign): CampaignKeys => keys[`${campaign.id}@${campaign.version}`] ?? {};
