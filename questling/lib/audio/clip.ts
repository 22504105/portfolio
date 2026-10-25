// The built-in recordings: English lines read by an offline voice (Piper, scripts/build-audio.ts) and
// shipped as files in public/audio. A line's file is named by a hash of its text, so the screens find
// it from the text they already show, and the build never records the same line twice.

import manifest from "./manifest.json";

/** The same line, however it was typed: trimmed, inner spaces folded, typographic quotes made plain. */
export function normalizeLine(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

/** cyrb53: a fast 53-bit string hash, plenty for a few hundred lines. */
function cyrb53(text: string): number {
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

/** The file name (without extension) a line's recording has. */
export function clipKey(text: string): string {
  return cyrb53(normalizeLine(text).toLowerCase()).toString(36);
}

const recorded = new Set<string>(manifest.clips.map((clip) => clip.key));

/** The address of a line's built-in recording, or null when it has none. */
export function clipUrl(text: string): string | null {
  const key = clipKey(text);
  return recorded.has(key) ? `/audio/${key}.mp3` : null;
}

/** Which voice recorded the built-in lines (credited in docs/audio.md). */
export const CLIP_VOICE = manifest.voice;
