import { describe, expect, it } from "vitest";
import { addScene, edges, moveScene, positions, problemsOf, removeScene, type PaletteKind } from "@/lib/studio/builder";
import { starterCampaign } from "@/lib/studio/starter";
import { parseAuthored } from "@/lib/story/schema";
import { validateCampaign } from "@/lib/story/validate";

const starter = () => starterCampaign("t-test-campaign", "Test", "A2");
const sound = (d: ReturnType<typeof starter>) => {
  const parsed = parseAuthored(d.graph, d.keys);
  if (!parsed.ok) return [parsed.problem];
  return validateCampaign(parsed.campaign, parsed.keys);
};

describe("builder edits", () => {
  it("every palette kind added after the start scene keeps the story sound and schema-valid", () => {
    const kinds: PaletteKind[] = [
      "narration",
      "dialogue",
      "clue",
      "question",
      "fill",
      "puzzle",
      "listen",
      "evidence",
      "choice",
      "condition",
    ];
    for (const kind of kinds) {
      const { draft, id } = addScene(starter(), kind, "start");
      expect(draft.graph.chapters[0].scenes[1].id, kind).toBe(id);
      // Evidence right after the start, in a campaign of one clue, cannot stand: the checks must say so.
      if (kind === "evidence") expect(sound(draft).length).toBeGreaterThan(0);
      else expect(sound(draft), kind).toEqual([]);
    }
  });

  it("an ending added after an ending goes before it, and the old one is then flagged unreachable", () => {
    const { draft } = addScene(starter(), "ending", "ending");
    const ids = draft.graph.chapters[0].scenes.map((s) => s.id);
    expect(ids.at(-1)).toBe("ending");
    expect(sound(draft)).toEqual(["t-test-campaign@1: ending can never be reached"]);
  });

  it("removing a scene drops its key and re-points what led to it", () => {
    const d = starter();
    d.graph.chapters[0].scenes[0].next = "question-1";
    const next = removeScene(d, "question-1")!;
    expect(next.keys["question-1"]).toBeUndefined();
    expect(next.graph.chapters[0].scenes[0].next).toBe("ending");
    expect(sound(next)).toEqual([]);
  });

  it("refuses to remove a chapter's last scene", () => {
    const d = starter();
    d.graph.chapters[0].scenes = d.graph.chapters[0].scenes.slice(0, 1);
    expect(removeScene(d, "start")).toBeNull();
  });

  it("moving a scene changes play order, and the canvas follows it", () => {
    const moved = moveScene(starter(), "question-1", 1);
    expect(moved.graph.chapters[0].scenes.map((s) => s.id)).toEqual(["start", "ending", "question-1"]);
    expect(edges(moved.graph).map((e) => `${e.from}>${e.to}`)).toEqual(["start>ending"]);
    const at = positions(moved.graph);
    expect(at["ending"].x).toBeGreaterThan(at["start"].x);
  });

  it("names the scenes a validator problem is about", () => {
    const problems = ["t-x@1: question-1 leads to unknown scene nowhere", "t-x@1: no ending"];
    expect(problemsOf(problems, "question-1")).toHaveLength(1);
    expect(problemsOf(problems, "question")).toHaveLength(0);
  });
});
