import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { studioEn, studioRu } from "@/lib/i18n/studio";

// The interface is bilingual (owner's rule). TypeScript already makes both languages have the same
// keys; this checks what it cannot: no text is left empty, and both say the same {placeholders},
// so a figure filled in Russian is never missing in English.

type Tree = string | readonly unknown[] | { [key: string]: unknown };

function leaves(tree: unknown, path = ""): [string, string][] {
  if (typeof tree === "string") return [[path, tree]];
  if (Array.isArray(tree)) return tree.flatMap((item, i) => leaves(item, `${path}[${i}]`));
  if (tree && typeof tree === "object") return Object.entries(tree as Tree).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// Texts that may be empty on purpose: a palette kind with no second line.
const MAY_BE_EMPTY = /^builder\.kinds\.\w+\[1\]$/;

describe.each([
  ["student app", getDictionary("ru"), getDictionary("en")],
  ["Teacher Studio", studioRu, studioEn],
])("the %s dictionary", (_, ru, en) => {
  const ruLeaves = new Map(leaves(ru));
  const enLeaves = new Map(leaves(en));

  it("has the same texts in both languages", () => {
    expect([...enLeaves.keys()].sort()).toEqual([...ruLeaves.keys()].sort());
  });

  it("leaves no text empty", () => {
    const empty = [...ruLeaves, ...enLeaves].filter(([path, text]) => !text.trim() && !MAY_BE_EMPTY.test(path)).map(([path]) => path);
    expect(empty).toEqual([]);
  });

  it("uses the same placeholders in both languages", () => {
    const mismatched = [...ruLeaves]
      .filter(([path, text]) => placeholders(text).join() !== placeholders(enLeaves.get(path) ?? "").join())
      .map(([path]) => path);
    expect(mismatched).toEqual([]);
  });
});
