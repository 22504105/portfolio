import type { CharacterId } from "@/lib/content/characters";
import type { AnswerRecord, Completion } from "@/lib/game/facts";
import type { Campaign, CampaignKeys } from "@/lib/story/graph";
import type { RunState } from "@/lib/story/run";

// What Teacher Studio knows, as plain facts, the way the student app keeps a student's record
// (lib/game/facts.ts): the teacher's groups, their members and what those members did, the
// teacher's own campaigns and their versions, assignments, scheduled daily entries and replies to
// help requests. Actions (ops.ts) read these and return effects; the server stores the effects
// (lib/server/studio-store.ts) inside one transaction, the demo studio keeps them in the browser.
// A teacher's facts only ever hold their own groups and the students in them.

export type Cefr = "A1" | "A2" | "B1" | "B2" | "C1";
export const CEFR_LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1"];

export type Group = {
  id: string;
  name: string;
  cefr: Cefr;
  inviteCode: string;
  createdAt: string;
  archivedAt: string | null;
  /** Whether the group's students see practice suggestions from their mistakes (lib/learning/recommend.ts); on unless turned off. */
  recommend?: boolean;
};

/** A student as their teacher sees them: the profile, and what they did (no Telegram id, no coins history). */
export type Member = {
  userId: string;
  heroName: string | null;
  characterId: CharacterId | null;
  username: string | null;
  groups: { groupId: string; joinedAt: string }[];
  xp: number;
  answers: AnswerRecord[];
  completions: Completion[];
  runs: RunState[];
};

export type QuestVersion = {
  version: number;
  status: "draft" | "published";
  graph: Campaign;
  keys: CampaignKeys;
  note: string | null;
  updatedAt: string;
  publishedAt: string | null;
};

export type Quest = {
  id: string;
  slug: string;
  title: string;
  cefr: Cefr;
  createdAt: string;
  archivedAt: string | null;
  versions: QuestVersion[];
};

export type Assignment = { id: string; groupId: string; campaign: string; version: number | null; startsAt: string; dueAt: string | null };

export type DailyContent = {
  word: { text: string; ipa: string; translation: { ru: string; en: string }; example: string; audio?: string };
  fact: { title: string; text: string; explanation: { ru: string; en: string }; source: string };
  quiz: { question: string; options: { id: string; text: string }[]; correct: string };
};

export type DailyEntry = { id: string; groupId: string; day: string; content: DailyContent };

export type MentorMessage = { id: string; userId: string; ref: string; body: string; createdAt: string; readAt: string | null };

export type StudioFacts = {
  teacher: { userId: string; displayName: string; email: string };
  groups: Group[];
  members: Member[];
  quests: Quest[];
  assignments: Assignment[];
  daily: DailyEntry[];
  messages: MentorMessage[];
  /** The teacher's recordings (lib/server/media.ts), with links to play them; none in the demo. */
  media: MediaItem[];
};

export type MediaItem = { id: string; name: string; mime: string; size: number; durationMs: number; createdAt: string; url: string };

export type StudioEffect =
  | { type: "group.create"; group: Omit<Group, "createdAt" | "archivedAt"> }
  | { type: "group.update"; groupId: string; name?: string; cefr?: Cefr; inviteCode?: string; archived?: boolean; recommend?: boolean }
  | { type: "member.remove"; groupId: string; userId: string }
  | { type: "quest.create"; quest: Omit<Quest, "createdAt" | "archivedAt" | "versions"> }
  | { type: "quest.update"; questId: string; title?: string; cefr?: Cefr; archived?: boolean }
  | { type: "version.saveDraft"; questId: string; version: number; graph: Campaign; keys: CampaignKeys; note: string | null }
  | { type: "version.publish"; questId: string; version: number }
  | { type: "assignment.set"; assignment: Omit<Assignment, "startsAt"> & { startsAt?: string } }
  | { type: "assignment.remove"; assignmentId: string }
  | { type: "daily.set"; entry: DailyEntry }
  | { type: "daily.remove"; entryId: string }
  | { type: "message.send"; message: Omit<MentorMessage, "createdAt" | "readAt"> }
  | { type: "audit"; action: string; target: string | null };

/** The facts with the effects added, as of `at`: the demo studio's whole write path, the server's mirror image. */
export function applyStudioEffects(facts: StudioFacts, effects: StudioEffect[], at: string): StudioFacts {
  const next: StudioFacts = {
    ...facts,
    groups: [...facts.groups],
    members: facts.members.map((m) => ({ ...m, groups: [...m.groups] })),
    quests: facts.quests.map((q) => ({ ...q, versions: [...q.versions] })),
    assignments: [...facts.assignments],
    daily: [...facts.daily],
    messages: [...facts.messages],
  };
  for (const effect of effects) {
    switch (effect.type) {
      case "group.create":
        next.groups.push({ ...effect.group, createdAt: at, archivedAt: null });
        break;
      case "group.update":
        next.groups = next.groups.map((g) =>
          g.id !== effect.groupId
            ? g
            : {
                ...g,
                ...(effect.name !== undefined ? { name: effect.name } : {}),
                ...(effect.cefr !== undefined ? { cefr: effect.cefr } : {}),
                ...(effect.inviteCode !== undefined ? { inviteCode: effect.inviteCode } : {}),
                ...(effect.archived !== undefined ? { archivedAt: effect.archived ? at : null } : {}),
                ...(effect.recommend !== undefined ? { recommend: effect.recommend } : {}),
              },
        );
        break;
      case "member.remove":
        next.members = next.members
          .map((m) => (m.userId === effect.userId ? { ...m, groups: m.groups.filter((g) => g.groupId !== effect.groupId) } : m))
          .filter((m) => m.groups.length > 0);
        break;
      case "quest.create":
        next.quests.push({ ...effect.quest, createdAt: at, archivedAt: null, versions: [] });
        break;
      case "quest.update":
        next.quests = next.quests.map((q) =>
          q.id !== effect.questId
            ? q
            : {
                ...q,
                ...(effect.title !== undefined ? { title: effect.title } : {}),
                ...(effect.cefr !== undefined ? { cefr: effect.cefr } : {}),
                ...(effect.archived !== undefined ? { archivedAt: effect.archived ? at : null } : {}),
              },
        );
        break;
      case "version.saveDraft":
        next.quests = next.quests.map((q) => {
          if (q.id !== effect.questId) return q;
          const draft: QuestVersion = {
            version: effect.version,
            status: "draft",
            graph: effect.graph,
            keys: effect.keys,
            note: effect.note,
            updatedAt: at,
            publishedAt: null,
          };
          return {
            ...q,
            versions: [...q.versions.filter((v) => v.version !== effect.version), draft].sort((a, b) => a.version - b.version),
          };
        });
        break;
      case "version.publish":
        next.quests = next.quests.map((q) =>
          q.id !== effect.questId
            ? q
            : {
                ...q,
                versions: q.versions.map((v) =>
                  v.version === effect.version ? { ...v, status: "published", publishedAt: at, updatedAt: at } : v,
                ),
              },
        );
        break;
      case "assignment.set":
        next.assignments = [
          ...next.assignments.filter((a) => !(a.groupId === effect.assignment.groupId && a.campaign === effect.assignment.campaign)),
          { ...effect.assignment, startsAt: effect.assignment.startsAt ?? at },
        ];
        break;
      case "assignment.remove":
        next.assignments = next.assignments.filter((a) => a.id !== effect.assignmentId);
        break;
      case "daily.set":
        next.daily = [...next.daily.filter((d) => !(d.groupId === effect.entry.groupId && d.day === effect.entry.day)), effect.entry];
        break;
      case "daily.remove":
        next.daily = next.daily.filter((d) => d.id !== effect.entryId);
        break;
      case "message.send":
        next.messages.push({ ...effect.message, createdAt: at, readAt: null });
        break;
      case "audit":
        break;
    }
  }
  return next;
}
