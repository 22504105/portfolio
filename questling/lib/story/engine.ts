import type { GradeResult, QuestionNode } from "./types";

// The question node's state machine. The five Stitch story-player screens are
// its phases (docs/design-screen-map.md):
//   answering  — 05_story_player_2       (an option may be selected)
//   correct    — 05_story_player_50_xp   (reward granted, next clue)
//   incorrect  — 05_story_player_3       (attempts left, hint shown)
//   exhausted  — 05_story_player_4       (no attempts left, help paths)
//   grimoire   — 05_story_player_never_2 (study sheet; passing it restores an attempt)
// Pure functions only: the same code decides on the server once runs are stored.

export type Phase = "answering" | "correct" | "incorrect" | "exhausted" | "grimoire";

export type QuestionState = {
  nodeId: string;
  phase: Phase;
  selected: string | null;
  attemptsUsed: number;
  /** Options already answered wrongly: shown struck out, cannot be chosen again. */
  eliminated: string[];
  last: GradeResult | null;
  /** XP granted for this node; set once, on the first correct answer. */
  xpGranted: number;
};

export type QuestionAction =
  | { type: "select"; optionId: string }
  | { type: "graded"; result: GradeResult }
  | { type: "retry" }
  | { type: "openGrimoire" }
  | { type: "grimoirePassed" }
  | { type: "closeGrimoire" };

export function initialState(node: QuestionNode): QuestionState {
  return { nodeId: node.id, phase: "answering", selected: null, attemptsUsed: 0, eliminated: [], last: null, xpGranted: 0 };
}

export function attemptsLeft(node: QuestionNode, state: QuestionState): number {
  return Math.max(0, node.maxAttempts - state.attemptsUsed);
}

/** Whether "check" may be pressed: something chosen, while answering. */
export function canCheck(state: QuestionState): boolean {
  return state.phase === "answering" && state.selected !== null;
}

export function reduce(node: QuestionNode, state: QuestionState, action: QuestionAction): QuestionState {
  switch (action.type) {
    case "select": {
      const choosable =
        (state.phase === "answering" || state.phase === "incorrect") &&
        node.options.some((o) => o.id === action.optionId) &&
        !state.eliminated.includes(action.optionId);
      if (!choosable) return state;
      // Choosing again after a wrong answer starts the next attempt.
      return { ...state, phase: "answering", selected: action.optionId };
    }
    case "graded": {
      const { result } = action;
      if (state.phase !== "answering" || result.optionId !== state.selected) return state;
      const attemptsUsed = state.attemptsUsed + 1;
      if (result.correct) {
        return { ...state, phase: "correct", attemptsUsed, last: result, xpGranted: state.xpGranted || node.reward.xp };
      }
      return {
        ...state,
        phase: attemptsUsed >= node.maxAttempts ? "exhausted" : "incorrect",
        attemptsUsed,
        selected: null,
        eliminated: [...state.eliminated, result.optionId],
        last: result,
      };
    }
    case "retry":
      return state.phase === "incorrect" ? { ...state, phase: "answering", selected: null } : state;
    case "openGrimoire":
      return state.phase === "exhausted" ? { ...state, phase: "grimoire" } : state;
    case "closeGrimoire":
      return state.phase === "grimoire" ? { ...state, phase: "exhausted" } : state;
    case "grimoirePassed":
      // Studying the rule earns exactly one more attempt.
      return state.phase === "grimoire" ? { ...state, phase: "answering", selected: null, attemptsUsed: node.maxAttempts - 1 } : state;
  }
}
