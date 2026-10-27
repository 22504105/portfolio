import type { SearchSpot } from "./graph";

/** Slack around each spot, as a fraction of the picture: a finger is wider than a pixel. */
export const SPOT_PAD = 0.02;

/**
 * The spot under a tap at (x, y), given as fractions of the picture's size — so the same tap means the
 * same spot at any width. Spots may nest (a key on a table): the smallest one under the finger wins.
 */
export function spotAt(spots: SearchSpot[], x: number, y: number): SearchSpot | null {
  return (
    spots
      .filter((s) => x >= s.x - SPOT_PAD && x <= s.x + s.w + SPOT_PAD && y >= s.y - SPOT_PAD && y <= s.y + s.h + SPOT_PAD)
      .sort((a, b) => a.w * a.h - b.w * b.h)[0] ?? null
  );
}
