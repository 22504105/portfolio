import { z } from "zod";
import { campaignById } from "@/lib/content/campaigns";
import { keysOf } from "@/lib/content/campaigns/keys";
import type { Campaign, CampaignKeys } from "@/lib/story/graph";
import { parseAuthored } from "@/lib/story/schema";
import { validateCampaign } from "@/lib/story/validate";
import { CEFR_LEVELS, type Cefr, type DailyContent, type StudioEffect, type StudioFacts } from "./model";
import { starterCampaign } from "./starter";

// What a teacher can do, as pure functions: (facts, action) → effects, or a refusal. Every action
// first checks that what it touches is this teacher's: a group, a quest, a student in their group.
// The server runs them on the facts it loaded for this teacher only, so another teacher's things are
// not even there to be found; the checks here are the second lock.

export type StudioAction =
  | { type: "createGroup"; name: string; cefr: Cefr }
  | { type: "updateGroup"; groupId: string; name?: string; cefr?: Cefr }
  | { type: "archiveGroup"; groupId: string; archived: boolean }
  | { type: "renewInvite"; groupId: string }
  | { type: "removeMember"; groupId: string; userId: string }
  | { type: "assign"; groupId: string; campaign: string; version?: number | null; dueAt?: string | null }
  | { type: "unassign"; assignmentId: string }
  | { type: "createQuest"; title: string; cefr: Cefr }
  | { type: "duplicateQuest"; from: string; title?: string }
  | { type: "updateQuest"; questId: string; title?: string; cefr?: Cefr }
  | { type: "archiveQuest"; questId: string; archived: boolean }
  | { type: "saveDraft"; questId: string; graph: unknown; keys: unknown; note?: string | null }
  | { type: "publish"; questId: string }
  | { type: "setDaily"; groupId: string; day: string; content: unknown }
  | { type: "clearDaily"; entryId: string }
  | { type: "replyHelp"; userId: string; ref: string; body: string };

export type StudioRefusal = "invalid" | "not_found" | "archived" | "no_draft" | "not_published" | "invalid_graph";

export type StudioOutcome = { kind: "ok"; id?: string } | { kind: "problems"; problems: string[] };

export type StudioResult =
  { ok: true; effects: StudioEffect[]; outcome: StudioOutcome } | { ok: false; refusal: StudioRefusal; problems?: string[] };

/** Ids and invite codes come from the context: the server draws them from a cryptographic source. */
export type StudioContext = { now: Date; newId: () => string; newCode: () => string };

const refuse = (refusal: StudioRefusal, problems?: string[]): StudioResult => ({ ok: false, refusal, problems });
const done = (effects: StudioEffect[], outcome: StudioOutcome = { kind: "ok" }): StudioResult => ({ ok: true, effects, outcome });

const name = (value: unknown, min = 2, max = 60) => {
  const clean = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return clean.length >= min && clean.length <= max && !/[<>{}]/.test(clean) ? clean : null;
};
const isCefr = (value: unknown): value is Cefr => (CEFR_LEVELS as unknown[]).includes(value);
const isDay = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

const dailySchema = z.object({
  word: z.object({
    text: z.string().trim().min(1).max(40),
    ipa: z.string().max(60),
    translation: z.object({ ru: z.string().trim().min(1).max(120), en: z.string().trim().min(1).max(120) }),
    example: z.string().trim().min(1).max(200),
    audio: z.string().uuid().optional(),
  }),
  fact: z.object({
    title: z.string().trim().min(1).max(100),
    text: z.string().trim().min(1).max(500),
    explanation: z.object({ ru: z.string().trim().min(1).max(400), en: z.string().trim().min(1).max(400) }),
    // An editor's note of where the fact comes from, for checking it; shown to nobody but teachers.
    source: z.string().trim().min(1).max(200),
  }),
  quiz: z.object({
    question: z.string().trim().min(1).max(200),
    options: z
      .array(z.object({ id: z.string().regex(/^[a-z]$/), text: z.string().trim().min(1).max(80) }))
      .min(2)
      .max(4),
    correct: z.string().regex(/^[a-z]$/),
  }),
});

function slugOf(title: string, code: string): string {
  const latin = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `t-${latin || "quest"}-${code.toLowerCase().slice(0, 6)}`;
}

export function studioRun(facts: StudioFacts, action: StudioAction, ctx: StudioContext): StudioResult {
  const group = (id: string) => facts.groups.find((g) => g.id === id) ?? null;
  const quest = (id: string) => facts.quests.find((q) => q.id === id) ?? null;
  const audit = (what: string, target: string | null): StudioEffect => ({ type: "audit", action: what, target });

  switch (action.type) {
    case "createGroup": {
      const groupName = name(action.name);
      if (!groupName || !isCefr(action.cefr)) return refuse("invalid");
      const id = ctx.newId();
      return done(
        [{ type: "group.create", group: { id, name: groupName, cefr: action.cefr, inviteCode: ctx.newCode() } }, audit("group.create", id)],
        { kind: "ok", id },
      );
    }
    case "updateGroup": {
      const found = group(action.groupId);
      if (!found) return refuse("not_found");
      if (found.archivedAt) return refuse("archived");
      const groupName = action.name === undefined ? undefined : name(action.name);
      if (groupName === null || (action.cefr !== undefined && !isCefr(action.cefr))) return refuse("invalid");
      return done([{ type: "group.update", groupId: found.id, name: groupName, cefr: action.cefr }, audit("group.update", found.id)]);
    }
    case "archiveGroup": {
      const found = group(action.groupId);
      if (!found) return refuse("not_found");
      return done([
        { type: "group.update", groupId: found.id, archived: !!action.archived },
        audit(action.archived ? "group.archive" : "group.restore", found.id),
      ]);
    }
    case "renewInvite": {
      const found = group(action.groupId);
      if (!found) return refuse("not_found");
      if (found.archivedAt) return refuse("archived");
      // The old code stops working at once: a code that leaked can be replaced.
      return done([{ type: "group.update", groupId: found.id, inviteCode: ctx.newCode() }, audit("group.invite", found.id)]);
    }
    case "removeMember": {
      const found = group(action.groupId);
      const member = facts.members.find((m) => m.userId === action.userId && m.groups.some((g) => g.groupId === action.groupId));
      if (!found || !member) return refuse("not_found");
      return done([{ type: "member.remove", groupId: found.id, userId: member.userId }, audit("member.remove", found.id)]);
    }
    case "assign": {
      const found = group(action.groupId);
      if (!found) return refuse("not_found");
      if (found.archivedAt) return refuse("archived");
      const due = action.dueAt ?? null;
      if (due !== null && (typeof due !== "string" || Number.isNaN(Date.parse(due)) || Date.parse(due) <= ctx.now.getTime()))
        return refuse("invalid");
      let version: number | null = null;
      if (!campaignById.has(action.campaign)) {
        // A teacher's own quest: a published version, the one named or the latest.
        const own = facts.quests.find((q) => q.slug === action.campaign);
        if (!own) return refuse("not_found");
        if (own.archivedAt) return refuse("archived");
        const published = own.versions.filter((v) => v.status === "published");
        const chosen = action.version ? published.find((v) => v.version === action.version) : published.at(-1);
        if (!chosen) return refuse("not_published");
        version = chosen.version;
      }
      const existing = facts.assignments.find((a) => a.groupId === found.id && a.campaign === action.campaign);
      const id = existing?.id ?? ctx.newId();
      return done(
        [
          {
            type: "assignment.set",
            assignment: { id, groupId: found.id, campaign: action.campaign, version, dueAt: due && new Date(due).toISOString() },
          },
          audit("assignment.set", id),
        ],
        { kind: "ok", id },
      );
    }
    case "unassign": {
      const found = facts.assignments.find((a) => a.id === action.assignmentId);
      if (!found) return refuse("not_found");
      return done([{ type: "assignment.remove", assignmentId: found.id }, audit("assignment.remove", found.id)]);
    }
    case "createQuest": {
      const title = name(action.title, 2, 120);
      if (!title || !isCefr(action.cefr)) return refuse("invalid");
      const id = ctx.newId();
      const slug = slugOf(title, ctx.newCode());
      const { graph, keys } = starterCampaign(slug, title, action.cefr);
      return done(
        [
          { type: "quest.create", quest: { id, slug, title, cefr: action.cefr } },
          { type: "version.saveDraft", questId: id, version: 1, graph, keys, note: null },
          audit("quest.create", id),
        ],
        { kind: "ok", id },
      );
    }
    case "duplicateQuest": {
      // A fork: of a built-in campaign, or of one of the teacher's own (its latest version).
      const builtIn = campaignById.get(action.from);
      const own = builtIn ? null : quest(action.from);
      const source: { graph: Campaign; keys: CampaignKeys; title: string; cefr: Cefr } | null = builtIn
        ? { graph: builtIn, keys: keysOf(builtIn), title: builtIn.title.ru, cefr: (builtIn.chapters[0].cefr as Cefr) ?? "A2" }
        : own && own.versions.length
          ? { graph: own.versions.at(-1)!.graph, keys: own.versions.at(-1)!.keys, title: own.title, cefr: own.cefr }
          : null;
      if (!source) return refuse("not_found");
      const title = name(action.title ?? `${source.title} (копия)`, 2, 120);
      if (!title) return refuse("invalid");
      const id = ctx.newId();
      const slug = slugOf(title, ctx.newCode());
      const graph: Campaign = { ...structuredClone(source.graph), id: slug, version: 1, requires: null, gate: undefined };
      return done(
        [
          { type: "quest.create", quest: { id, slug, title, cefr: source.cefr } },
          { type: "version.saveDraft", questId: id, version: 1, graph, keys: structuredClone(source.keys), note: null },
          audit("quest.duplicate", id),
        ],
        { kind: "ok", id },
      );
    }
    case "updateQuest": {
      const found = quest(action.questId);
      if (!found) return refuse("not_found");
      const title = action.title === undefined ? undefined : name(action.title, 2, 120);
      if (title === null || (action.cefr !== undefined && !isCefr(action.cefr))) return refuse("invalid");
      return done([{ type: "quest.update", questId: found.id, title, cefr: action.cefr }, audit("quest.update", found.id)]);
    }
    case "archiveQuest": {
      const found = quest(action.questId);
      if (!found) return refuse("not_found");
      return done([
        { type: "quest.update", questId: found.id, archived: !!action.archived },
        audit(action.archived ? "quest.archive" : "quest.restore", found.id),
      ]);
    }
    case "saveDraft": {
      const found = quest(action.questId);
      if (!found) return refuse("not_found");
      if (found.archivedAt) return refuse("archived");
      const parsed = parseAuthored(action.graph, action.keys);
      if (!parsed.ok) return refuse("invalid", [parsed.problem]);
      // The draft, if there is one; else a new version after the last published one. Published ones are never touched.
      const draft = found.versions.find((v) => v.status === "draft");
      const version = draft?.version ?? Math.max(0, ...found.versions.map((v) => v.version)) + 1;
      const graph: Campaign = { ...parsed.campaign, id: found.slug, version };
      const note = typeof action.note === "string" ? action.note.slice(0, 500) : (draft?.note ?? null);
      return done([
        { type: "version.saveDraft", questId: found.id, version, graph, keys: parsed.keys, note },
        audit("version.save", `${found.id}@${version}`),
      ]);
    }
    case "publish": {
      const found = quest(action.questId);
      if (!found) return refuse("not_found");
      if (found.archivedAt) return refuse("archived");
      const draft = found.versions.find((v) => v.status === "draft");
      if (!draft) return refuse("no_draft");
      const parsed = parseAuthored(draft.graph, draft.keys);
      if (!parsed.ok) return refuse("invalid_graph", [parsed.problem]);
      const problems = validateCampaign(parsed.campaign, parsed.keys);
      // A recording must be one of the teacher's own (an id from elsewhere would play nothing).
      for (const scene of parsed.campaign.chapters.flatMap((c) => c.scenes))
        if ("audio" in scene && scene.audio && !facts.media.some((m) => m.id === scene.audio))
          problems.push(`${scene.id}: its recording is not one of yours`);
      if (problems.length) return refuse("invalid_graph", problems);
      return done([
        { type: "version.publish", questId: found.id, version: draft.version },
        audit("version.publish", `${found.id}@${draft.version}`),
      ]);
    }
    case "setDaily": {
      const found = group(action.groupId);
      if (!found) return refuse("not_found");
      if (found.archivedAt) return refuse("archived");
      if (!isDay(action.day)) return refuse("invalid");
      const parsed = dailySchema.safeParse(action.content);
      if (!parsed.success || !parsed.data.quiz.options.some((o) => o.id === parsed.data.quiz.correct)) return refuse("invalid");
      if (parsed.data.word.audio && !facts.media.some((m) => m.id === parsed.data.word.audio)) return refuse("invalid");
      const existing = facts.daily.find((d) => d.groupId === found.id && d.day === action.day);
      const id = existing?.id ?? ctx.newId();
      return done(
        [
          { type: "daily.set", entry: { id, groupId: found.id, day: action.day, content: parsed.data as DailyContent } },
          audit("daily.set", id),
        ],
        { kind: "ok", id },
      );
    }
    case "clearDaily": {
      const found = facts.daily.find((d) => d.id === action.entryId);
      if (!found) return refuse("not_found");
      return done([{ type: "daily.remove", entryId: found.id }, audit("daily.remove", found.id)]);
    }
    case "replyHelp": {
      const member = facts.members.find((m) => m.userId === action.userId);
      const body = typeof action.body === "string" ? action.body.trim() : "";
      if (!member) return refuse("not_found");
      if (!member.completions.some((c) => c.kind === "help_request" && c.ref === action.ref)) return refuse("not_found");
      if (body.length < 1 || body.length > 1000) return refuse("invalid");
      const id = ctx.newId();
      return done(
        [{ type: "message.send", message: { id, userId: member.userId, ref: action.ref, body } }, audit("message.send", member.userId)],
        { kind: "ok", id },
      );
    }
  }
}
