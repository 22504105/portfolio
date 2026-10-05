// Shared motion vocabulary. Durations (in seconds) mirror the --duration-*
// variables in app/globals.css — change both together.

export const EASE = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

export const DURATION = {
  fast: 0.2,
  base: 0.5,
  slow: 0.9,
} as const;

/** Delay between siblings that enter one after another. */
export const STAGGER = 0.08;

/** Vertical travel, in pixels, of an element entering the viewport. */
export const REVEAL_OFFSET = 24;
