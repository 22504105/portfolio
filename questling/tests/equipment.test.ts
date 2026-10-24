import { afterEach, describe, expect, it } from "vitest";
import { figureOf } from "@/lib/content/figure";
import { itemById } from "@/lib/content/items";
import layers from "@/lib/content/layers.json";
import rig from "@/lib/content/rig.json";
import { applyEffects, emptyFacts, type Facts } from "@/lib/game/facts";
import { run, type Action } from "@/lib/game/ops";

// Gate 4: the layered hero and the equipment rules.

const now = new Date("2026-10-24T09:00:00Z");
const ctx = { now, locale: "ru" as const, demo: false };
const names = (layered: ReturnType<typeof figureOf>) =>
  layered.kind === "layered" ? layered.layers.map((l) => l.src.replace(/^.*\/|\.webp$/g, "")) : [];

describe("the layered figure", () => {
  const slice = { headwear: "wizard-hat", outerwear: "sunset-cloak", neck: "star-amulet" } as const;

  it("draws the cat's eight looks in the brief's order: cape back, body, cape front, amulet, hat", () => {
    const all = figureOf("cat", slice);
    expect(names(all)).toEqual([
      "ceremonial-cape-back",
      "star-amulet-back",
      "witch-hat-back",
      "cat-base",
      "ceremonial-cape-front",
      "star-amulet-front",
      "witch-hat-front",
    ]);
    // Every combination draws two layers per item plus the body, and nothing it does not wear.
    const keys = Object.keys(slice) as (keyof typeof slice)[];
    for (let mask = 0; mask < 8; mask++) {
      const worn = Object.fromEntries(keys.filter((_, i) => mask & (1 << i)).map((k) => [k, slice[k]]));
      const figure = figureOf("cat", worn);
      expect(figure.kind).toBe("layered");
      expect(names(figure)).toHaveLength(1 + 2 * Object.keys(worn).length);
      if (figure.kind === "layered") expect(figure.pending).toEqual([]);
    }
  });

  it("places every layer from its master's box and the species' fit, inside the rig", () => {
    const figure = figureOf("cat", slice);
    if (figure.kind !== "layered") throw new Error("cat is layered");
    const [W, H] = rig.canvas;
    const cape = rig.fits.cat["ceremonial-cape"];
    const front = figure.layers.find((l) => l.src.endsWith("ceremonial-cape-front.webp"))!;
    expect(front.left).toBeCloseTo(((cape.x + layers["ceremonial-cape-front"].box[0] * cape.scale) / W) * 100, 5);
    expect(front.top).toBeCloseTo(((cape.y + layers["ceremonial-cape-front"].box[1] * cape.scale) / H) * 100, 5);
    for (const layer of figure.layers) {
      expect(layer.left).toBeGreaterThanOrEqual(0);
      expect(layer.top).toBeGreaterThanOrEqual(0);
      expect(layer.left + layer.width).toBeLessThanOrEqual(100.01);
      expect(layer.top + layer.height).toBeLessThanOrEqual(100.01);
    }
  });

  it("names worn items it cannot draw, and draws heroes without fitted art plainly", () => {
    const glasses = figureOf("cat", { headwear: "wizard-hat", face: "round-glasses" });
    expect(glasses.kind === "layered" && glasses.drawn).toEqual(["wizard-hat"]);
    expect(glasses.pending).toEqual(["round-glasses"]);
    const owl = figureOf("owl", { headwear: "wizard-hat" });
    expect(owl).toEqual({ kind: "plain", image: "/images/characters/owl.webp", pending: ["wizard-hat"] });
  });
});

describe("equipment rules", () => {
  const original = itemById.get("round-glasses")!.species;
  afterEach(() => {
    (itemById.get("round-glasses") as { species: readonly string[] }).species = original;
  });

  function hero(characterId: string): { facts: Facts; act: (a: Action) => ReturnType<typeof run> } {
    let facts = emptyFacts(now.toISOString());
    const act = (action: Action) => {
      const result = run(facts, action, ctx);
      if (result.ok) facts = applyEffects(facts, result.effects, now.toISOString());
      return result;
    };
    act({ type: "chooseCharacter", characterId });
    facts = applyEffects(
      facts,
      [
        { type: "ledger", currency: "coins", amount: 2000, key: "test", reason: "demo" },
        { type: "ledger", currency: "xp", amount: 5000, key: "test", reason: "demo" },
      ],
      now.toISOString(),
    );
    return {
      get facts() {
        return facts;
      },
      act,
    } as never;
  }

  it("refuses an item the hero's species cannot wear", () => {
    (itemById.get("round-glasses") as { species: readonly string[] }).species = ["cat"];
    const owl = hero("owl");
    expect(owl.act({ type: "buy", itemId: "round-glasses" }).ok).toBe(true);
    expect(owl.act({ type: "saveLook", equipped: { face: "round-glasses" } })).toEqual({ ok: false, refusal: "wrong_species" });
    const cat = hero("cat");
    cat.act({ type: "buy", itemId: "round-glasses" });
    expect(cat.act({ type: "saveLook", equipped: { face: "round-glasses" } }).ok).toBe(true);
  });

  it("refuses a look with a slot conflict: the ceremonial cape and something on the back", () => {
    const cat = hero("cat");
    cat.act({ type: "buy", itemId: "sunset-cloak" });
    cat.act({ type: "buy", itemId: "satchel" });
    expect(cat.act({ type: "saveLook", equipped: { outerwear: "sunset-cloak", back: "satchel" } })).toEqual({
      ok: false,
      refusal: "conflict",
    });
    expect(cat.act({ type: "saveLook", equipped: { back: "satchel" } }).ok).toBe(true);
    // Putting the cape on over the satchel already worn is refused too, unless the satchel comes off.
    expect(cat.act({ type: "saveLook", equipped: { outerwear: "sunset-cloak" } })).toEqual({ ok: false, refusal: "conflict" });
    expect(cat.act({ type: "saveLook", equipped: { outerwear: "sunset-cloak", back: null } }).ok).toBe(true);
    expect(cat.facts.equipped).toMatchObject({ outerwear: "sunset-cloak" });
    expect(cat.facts.equipped.back).toBeUndefined();
  });
});
