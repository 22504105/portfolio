import { describe, expect, it } from "vitest";
import { demoStudio } from "@/lib/studio/demo";
import { gradebook, groupCard, heatmap, kpis, pendingHelp, skills, studentRow, topics, weekActivity } from "@/lib/studio/views";
import { dayOf } from "@/lib/game/time";

// The demo studio's figures come from students who played through the real rules.
const now = new Date("2026-10-25T12:00:00Z");
const today = dayOf(now);
const facts = demoStudio(now);

describe("studio views on the demo classes", () => {
  it("has three groups of real records", () => {
    expect(facts.groups.map((g) => [g.name, facts.members.filter((m) => m.groups[0].groupId === g.id).length])).toEqual([
      ["Детективы A2", 7],
      ["Новички A1", 3],
      ["Искатели B1", 3],
    ]);
    for (const m of facts.members) expect(m.answers.length).toBeGreaterThan(0);
  });

  it("figures are computed, consistent and in range", () => {
    const k = kpis(facts, today);
    expect(k).toMatchObject({ groups: 3, students: 13, assignments: 3, builtIn: 3, own: 0 });
    expect(k.completion).toBeGreaterThan(0);
    expect(k.completion).toBeLessThanOrEqual(100);
    expect(k.pending).toBe(pendingHelp(facts, null).length);
    expect(k.pending).toBeGreaterThanOrEqual(3);
    const card = groupCard(facts, facts.groups[0], "ru");
    expect(card.members).toBe(7);
    expect(card.campaign).toBe("Забытая академия");
    expect(weekActivity(facts, null, today)).toHaveLength(7);
    const t = topics(facts, null, "ru");
    expect(t.length).toBeGreaterThan(0);
    for (const topic of t) expect(topic.errorRate).toBeGreaterThanOrEqual(0);
    expect(skills(facts, null).find((s) => s.skill === "reading")!.answers).toBeGreaterThan(0);
    const map = heatmap(facts, facts.groups[0].id, today);
    expect(map.rows).toHaveLength(7);
    expect(map.rows.some((r) => r.counts.some((c) => c > 0))).toBe(true);
  });

  it("a stuck student shows as needing help; the gradebook exports as CSV", () => {
    const group = facts.groups[0];
    const barsik = facts.members.find((m) => m.heroName === "Барсик")!;
    expect(studentRow(facts, barsik, group, "ru", today).status.kind).toBe("help");
    const book = gradebook(facts, group.id, "ru");
    expect(book.rows).toHaveLength(7);
    expect(book.csv.split("\n")[0]).toBe('"Student","Telegram","Забытая академия","Answers","Right"');
    expect(book.csv).toContain('"@barsik_magic"');
  });
});

describe("the mini-test from the errors", () => {
  it("is a sound campaign of the class's hardest questions, with their keys", async () => {
    const { practiceCampaign } = await import("@/lib/studio/practice");
    const { validateCampaign } = await import("@/lib/story/validate");
    const { parseAuthored } = await import("@/lib/story/schema");
    const { graph, keys } = practiceCampaign(facts, facts.groups[0].id, "t-mini-test-ab12", "Мини-тест", "A2");
    const graded = graph.chapters[0].scenes.filter((s) => s.kind === "question" || s.kind === "puzzle");
    expect(graded.length).toBeGreaterThan(0);
    expect(Object.keys(keys).sort()).toEqual(graded.map((s) => s.id).sort());
    expect(validateCampaign(graph, keys)).toEqual([]);
    expect(parseAuthored(JSON.parse(JSON.stringify(graph)), JSON.parse(JSON.stringify(keys))).ok).toBe(true);
  });
});

describe("every demo class has played its campaign", () => {
  it("each group has some progress in what it was assigned", async () => {
    const { groupCard } = await import("@/lib/studio/views");
    for (const group of facts.groups) expect(groupCard(facts, group, "ru").progress).toBeGreaterThan(0);
  });
});
