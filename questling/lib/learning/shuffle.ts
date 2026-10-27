// The order answer options are shown in. Correctness is always by an option's stable id, never by
// where it stands, so the order is free to change: a fair (Fisher–Yates) shuffle, seeded by the
// attempt. The seed is worked out from what the store already keeps (when the student joined, and
// which attempt this is), so the same attempt shows the same order after a reload, on the server
// and in the browser alike, and a new attempt (another day's quest, a new version of a campaign)
// is shuffled afresh. Nothing about the order is secret: it only keeps "the first one is right"
// from being a pattern.

/** cyrb53: a 53-bit string hash (the same as the audio clips' names use). */
export function hash53(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32: a small seeded generator of numbers in [0, 1). */
function generator(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The items in an order drawn by Fisher–Yates from the seed: every order equally likely, the same seed always the same order. */
export function shuffled<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const random = generator(hash53(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The seed of one attempt: the student (when they joined) and what the attempt is ("letter@2026-10-26", a run). */
export const attemptSeed = (joinedAt: string, attempt: string) => `${joinedAt}|${attempt}`;
