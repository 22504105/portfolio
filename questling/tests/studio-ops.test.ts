import { describe, expect, it } from "vitest";
import { applyStudioEffects, type StudioFacts } from "@/lib/studio/model";
import { studioRun, type StudioAction } from "@/lib/studio/ops";
import { starterCampaign } from "@/lib/studio/starter";
import { parseAuthored } from "@/lib/story/schema";
import { validateCampaign } from "@/lib/story/validate";

// Teacher Studio's rules (lib/studio/ops.ts), as the server and the demo studio both run them.

const now = new Date("2026-10-25T09:00:00Z");
let n = 0;
const ctx = {
  now,
  newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  newCode: () => `CODE${String(++n).padStart(4, "0")}`,
};

function teacher() {
  const state: { facts: StudioFacts } = {
    facts: {
      teacher: { userId: "t1", displayName: "Элеонора", email: "e@example.com" },
      groups: [],
      members: [],
      quests: [],
      assignments: [],
      daily: [],
      messages: [],
      media: [],
    },
  };
  const act = (action: StudioAction) => {
    const result = studioRun(state.facts, action, ctx);
    if (result.ok) state.facts = applyStudioEffects(state.facts, result.effects, now.toISOString());
    return result;
  };
  return { state, act };
}
const idOf = (r: ReturnType<typeof studioRun>) => (r.ok && r.outcome.kind === "ok" ? r.outcome.id! : "");

describe("teacher studio rules", () => {
  it("the starter campaign is a sound, publishable story", () => {
    const { graph, keys } = starterCampaign("t-new-quest-ab12", "New", "A2");
    expect(parseAuthored(JSON.parse(JSON.stringify(graph)), JSON.parse(JSON.stringify(keys))).ok).toBe(true);
    expect(validateCampaign(graph, keys)).toEqual([]);
  });

  it("groups: create, rename, change level, renew the invite, archive", () => {
    const s = teacher();
    expect(s.act({ type: "createGroup", name: "x", cefr: "A2" })).toEqual({ ok: false, refusal: "invalid" });
    expect(s.act({ type: "createGroup", name: "Детективы", cefr: "Z9" as never })).toEqual({ ok: false, refusal: "invalid" });
    const id = idOf(s.act({ type: "createGroup", name: "  Детективы   A2 ", cefr: "A2" }));
    expect(s.state.facts.groups[0]).toMatchObject({ id, name: "Детективы A2", cefr: "A2", archivedAt: null });
    const code = s.state.facts.groups[0].inviteCode;
    s.act({ type: "renewInvite", groupId: id });
    expect(s.state.facts.groups[0].inviteCode).not.toBe(code);
    s.act({ type: "updateGroup", groupId: id, cefr: "B1" });
    expect(s.state.facts.groups[0].cefr).toBe("B1");
    s.act({ type: "archiveGroup", groupId: id, archived: true });
    expect(s.act({ type: "updateGroup", groupId: id, name: "Новое имя" })).toEqual({ ok: false, refusal: "archived" });
    expect(s.act({ type: "updateGroup", groupId: "someone-elses", name: "Чужая" })).toEqual({ ok: false, refusal: "not_found" });
  });

  it("versions: a published version is frozen; editing makes the next draft; a broken graph is not published", () => {
    const s = teacher();
    const questId = idOf(s.act({ type: "createQuest", title: "Тайна часов", cefr: "A2" }));
    const quest = () => s.state.facts.quests.find((q) => q.id === questId)!;
    expect(quest().versions.map((v) => [v.version, v.status])).toEqual([[1, "draft"]]);
    expect(s.act({ type: "publish", questId }).ok).toBe(true);
    expect(s.act({ type: "publish", questId })).toEqual({ ok: false, refusal: "no_draft" });

    const v1 = quest().versions[0];
    const edited = structuredClone(v1.graph);
    edited.chapters[0].title = { ru: "Новое название", en: "A new title" };
    expect(s.act({ type: "saveDraft", questId, graph: edited, keys: v1.keys }).ok).toBe(true);
    expect(quest().versions.map((v) => [v.version, v.status])).toEqual([
      [1, "published"],
      [2, "draft"],
    ]);
    expect(quest().versions[0].graph.chapters[0].title.ru).toBe("Тайна часов");

    // A dead end: the question leads nowhere valid.
    const broken = structuredClone(edited);
    broken.chapters[0].scenes[1].next = "nowhere";
    expect(s.act({ type: "saveDraft", questId, graph: broken, keys: v1.keys }).ok).toBe(true);
    const refused = s.act({ type: "publish", questId });
    expect(refused).toMatchObject({ ok: false, refusal: "invalid_graph" });
    expect(!refused.ok && refused.problems?.join()).toMatch(/question-1 leads to unknown scene nowhere/);
    // Not shaped like a campaign at all: not even saved.
    expect(s.act({ type: "saveDraft", questId, graph: { id: "x" }, keys: {} })).toMatchObject({ ok: false, refusal: "invalid" });
  });

  it("assignments: a built-in campaign, or a published version of the teacher's own; dates in the future", () => {
    const s = teacher();
    const groupId = idOf(s.act({ type: "createGroup", name: "Искатели B1", cefr: "B1" }));
    expect(s.act({ type: "assign", groupId, campaign: "echo-tower", dueAt: "2026-11-01T18:00:00Z" }).ok).toBe(true);
    expect(s.act({ type: "assign", groupId, campaign: "echo-tower", dueAt: "2020-01-01T00:00:00Z" })).toEqual({
      ok: false,
      refusal: "invalid",
    });
    const questId = idOf(s.act({ type: "createQuest", title: "Мой квест", cefr: "B1" }));
    const slug = s.state.facts.quests.find((q) => q.id === questId)!.slug;
    expect(s.act({ type: "assign", groupId, campaign: slug })).toEqual({ ok: false, refusal: "not_published" });
    s.act({ type: "publish", questId });
    expect(s.act({ type: "assign", groupId, campaign: slug }).ok).toBe(true);
    expect(s.state.facts.assignments.map((a) => [a.campaign, a.version])).toEqual([
      ["echo-tower", null],
      [slug, 1],
    ]);
    expect(s.act({ type: "assign", groupId, campaign: "t-not-mine-1234" })).toEqual({ ok: false, refusal: "not_found" });
  });

  it("forks a built-in campaign into an editable draft of the teacher's own", () => {
    const s = teacher();
    const id = idOf(s.act({ type: "duplicateQuest", from: "forgotten-academy" }));
    const fork = s.state.facts.quests.find((q) => q.id === id)!;
    expect(fork.slug).toMatch(/^t-/);
    expect(fork.versions[0]).toMatchObject({ version: 1, status: "draft" });
    expect(fork.versions[0].graph.id).toBe(fork.slug);
    expect(s.act({ type: "publish", questId: id }).ok).toBe(true);
  });

  it("daily entries and help replies only for the teacher's own groups and students", () => {
    const s = teacher();
    const groupId = idOf(s.act({ type: "createGroup", name: "Новички A1", cefr: "A1" }));
    const content = {
      word: {
        text: "lantern",
        ipa: "LAN-tern",
        translation: { ru: "фонарь", en: "a lamp you carry" },
        example: "The ghost holds a lantern.",
      },
      fact: {
        title: "Fact",
        text: "Owls can turn their heads very far.",
        explanation: { ru: "Совы", en: "Owls" },
        source: "Encyclopaedia Britannica, Owl",
      },
      quiz: {
        question: "What does a ghost hold?",
        options: [
          { id: "a", text: "a lantern" },
          { id: "b", text: "a cake" },
        ],
        correct: "a",
      },
    };
    expect(s.act({ type: "setDaily", groupId, day: "2026-10-26", content }).ok).toBe(true);
    expect(s.act({ type: "setDaily", groupId, day: "tomorrow", content })).toEqual({ ok: false, refusal: "invalid" });
    expect(
      s.act({ type: "setDaily", groupId, day: "2026-10-26", content: { ...content, quiz: { ...content.quiz, correct: "z" } } }),
    ).toEqual({
      ok: false,
      refusal: "invalid",
    });
    expect(s.act({ type: "replyHelp", userId: "stranger", ref: "forgotten-academy/tower-2", body: "Подсказка" })).toEqual({
      ok: false,
      refusal: "not_found",
    });
    s.state.facts = {
      ...s.state.facts,
      members: [
        {
          userId: "u1",
          heroName: "Барсик",
          characterId: "cat",
          username: null,
          groups: [{ groupId, joinedAt: now.toISOString() }],
          xp: 0,
          answers: [],
          runs: [],
          completions: [{ kind: "help_request", ref: "forgotten-academy/tower-2", at: now.toISOString() }],
        },
      ],
    };
    expect(s.act({ type: "replyHelp", userId: "u1", ref: "forgotten-academy/tower-1", body: "Подсказка" })).toEqual({
      ok: false,
      refusal: "not_found",
    });
    expect(s.act({ type: "replyHelp", userId: "u1", ref: "forgotten-academy/tower-2", body: "Подумай, где нет окон." }).ok).toBe(true);
    expect(s.state.facts.messages).toHaveLength(1);
  });
});
