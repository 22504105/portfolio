import type { DubLine } from "./model";

// The arithmetic of playing a voice-acting scene (components/dub/use-scene.ts), kept apart from the
// media elements so it can be tested: which lines are spoken at a moment, and what a take or the
// background track must do to stay in step with the video.

/** How far a take or the background may drift from the video before it is put back, in seconds. */
export const DRIFT_S = 0.15;

/** The lines being spoken at scene time `t` (ms): from their start, up to (not including) their end. */
export const linesAt = (lines: DubLine[], t: number) => lines.filter((l) => t >= l.start && t < l.end);

/** A track as the browser reports it. */
export type TrackState = { paused: boolean; currentTime: number };

/** What a track must do now: start at a position, jump to one, stop, or nothing. */
export type TrackStep = { play: number } | { seek: number } | { pause: true } | null;

/**
 * Keeps a track in step: while it should sound (`on`), it should be at `want` seconds — started there
 * when paused, moved there when it drifted by more than DRIFT_S (after a seek or a stall); otherwise it
 * should be paused.
 */
export function follow(track: TrackState, on: boolean, want: number): TrackStep {
  if (!on) return track.paused ? null : { pause: true };
  if (track.paused) return { play: want };
  return Math.abs(track.currentTime - want) > DRIFT_S ? { seek: want } : null;
}

/** Where the take of `line` should be at scene time `t` (ms), and whether it should sound. */
export const takeAt = (line: DubLine, t: number) => ({ on: t >= line.start && t < line.end, want: (t - line.start) / 1000 });
