import { addDays } from "@/lib/game/time";

// Spaced repetition for the student's word journal: a plain, explainable SM-2-style schedule.
// A card answered right comes back after 1 day, then 3, then the last gap times its ease; a card
// answered wrong comes back tomorrow and its ease drops a little. Nothing is lost for a wrong
// answer: no XP is taken, the card simply returns sooner.

export type Schedule = {
  /** The day (YYYY-MM-DD, the student's calendar as lib/game/time.ts counts it) the card is due. */
  due: string;
  /** Days until the next review after the last one. */
  interval: number;
  /** Growth of the gap, in hundredths: 250 = ×2.5. */
  ease: number;
  /** Right answers in a row. */
  reps: number;
  lapses: number;
};

export const START_EASE = 250;
const MIN_EASE = 130;
const MAX_EASE = 300;
const MAX_INTERVAL = 180;

/** A new card: first due the day after it was saved. */
export function newSchedule(today: string): Schedule {
  return { due: addDays(today, 1), interval: 0, ease: START_EASE, reps: 0, lapses: 0 };
}

export const isDue = (schedule: Schedule, today: string) => schedule.due <= today;

/** The schedule after a review on `today`. */
export function review(schedule: Schedule, correct: boolean, today: string): Schedule {
  if (!correct) {
    return { due: addDays(today, 1), interval: 1, ease: Math.max(MIN_EASE, schedule.ease - 20), reps: 0, lapses: schedule.lapses + 1 };
  }
  const reps = schedule.reps + 1;
  const interval =
    reps === 1 ? 1 : reps === 2 ? 3 : Math.min(MAX_INTERVAL, Math.round((Math.max(1, schedule.interval) * schedule.ease) / 100));
  return { due: addDays(today, interval), interval, ease: Math.min(MAX_EASE, schedule.ease + 5), reps, lapses: schedule.lapses };
}
