import { campaignById, campaigns, campaignVersion } from "@/lib/content/campaigns";
import type { DailyEntry } from "@/lib/content/daily";
import type { Campaign } from "@/lib/story/graph";
import type { Facts } from "./facts";

// What surrounds a student's own record: the groups they joined, what their teachers assigned, the
// teachers' campaigns those assignments (and the student's runs) need, and the mentors' replies.
// The server loads it with the facts; the demo has none, so the demo plays the built-in campaigns.
// Campaign graphs here carry no answer keys: those stay on the server.

export type World = {
  /** `recommend: false`: the teacher turned practice suggestions off for the group. */
  groups: { id: string; name: string; cefr: string; mentor: string; recommend?: boolean }[];
  /** Active assignments of the student's groups, in the order they were given. */
  assignments: { groupId: string; campaign: string; version: number | null; dueAt: string | null }[];
  /** Teachers' campaigns (exact versions) this student may play or has a run on. */
  campaigns: Campaign[];
  messages: { id: string; ref: string; body: string; mentor: string; createdAt: string }[];
  /** The groups' teachers' words of the day (lib/studio/daily.ts), by day; their quiz keys stay on the server. */
  daily?: { day: string; entry: DailyEntry }[];
  /** Links to the teachers' recordings this student may hear, by recording id (scene.audio, word.audio). */
  media?: Record<string, string>;
};

export const emptyWorld = (): World => ({ groups: [], assignments: [], campaigns: [], messages: [] });

export const worldOf = (facts: Facts): World => facts.world ?? emptyWorld();

/** A campaign by id: a built-in one (latest, or the version asked for), or a teacher's from the world. */
export function findCampaign(facts: Facts, id: string, version?: number): Campaign | null {
  if (campaignById.has(id)) return version ? campaignVersion(id, version) : campaignById.get(id)!;
  const own = worldOf(facts).campaigns.filter((c) => c.id === id);
  if (version) return own.find((c) => c.version === version) ?? null;
  return own.reduce<Campaign | null>((latest, c) => (!latest || c.version > latest.version ? c : latest), null);
}

/**
 * The campaigns on the student's map, in order. A student in a group plays what their teachers
 * assigned (the brief: content by assignment and level, not to everyone); a student in no group, or
 * whose groups have assigned nothing yet, plays the built-in campaigns.
 */
export function studentCampaigns(facts: Facts): Campaign[] {
  const assigned = worldOf(facts).assignments;
  if (!assigned.length) return campaigns;
  const list: Campaign[] = [];
  for (const a of assigned) {
    const found = findCampaign(facts, a.campaign, a.version ?? undefined);
    if (found && !list.some((c) => c.id === found.id)) list.push(found);
  }
  return list.length ? list : campaigns;
}

/** Whether a campaign was assigned to the student: assigned ones open without the built-in order. */
export const isAssigned = (facts: Facts, id: string) => worldOf(facts).assignments.some((a) => a.campaign === id);
