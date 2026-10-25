import { describe, expect, it } from "vitest";
import { campaigns } from "@/lib/content/campaigns";
import { keysOf } from "@/lib/content/campaigns/keys";
import { parseAuthored } from "@/lib/story/schema";

// A teacher's campaign arrives as JSON; the built-in ones, renamed as a teacher's, must pass the same checks.
describe("the authored campaign schema", () => {
  for (const campaign of campaigns)
    it(`accepts ${campaign.id} as a teacher's campaign`, () => {
      const authored = { ...campaign, id: `t-${campaign.id}`, requires: null, gate: undefined };
      const result = parseAuthored(JSON.parse(JSON.stringify(authored)), JSON.parse(JSON.stringify(keysOf(campaign))));
      expect(result.ok ? "ok" : result.problem).toBe("ok");
    });

  it("refuses outside pictures, markup-sized text and unknown kinds", () => {
    const base = JSON.parse(JSON.stringify({ ...campaigns[0], id: "t-test-quest", requires: null }));
    const outside = structuredClone(base);
    outside.chapters[0].scenes[0].image = "https://evil.example/x.png";
    expect(parseAuthored(outside, {}).ok).toBe(false);
    const huge = structuredClone(base);
    huge.chapters[0].scenes[0].text = "x".repeat(5000);
    expect(parseAuthored(huge, {}).ok).toBe(false);
    const strange = structuredClone(base);
    strange.chapters[0].scenes[0].kind = "script";
    expect(parseAuthored(strange, {}).ok).toBe(false);
    expect(parseAuthored({ ...base, id: "forgotten-academy" }, {}).ok).toBe(false);
  });
});
