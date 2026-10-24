import type { CharacterId } from "@/lib/content/characters";
import type { Slot } from "@/lib/content/items";
import type { Skill } from "@/lib/content/quick-quests";
import type { RunState } from "@/lib/story/run";

// A student's record: everything the game knows about them, as plain facts. Balances,
// levels, streaks and achievement progress are never stored: they are worked out from
// these facts (stats.ts), so they cannot drift from what actually happened.
//
// The server keeps each kind of fact in a table of its own (supabase/migrations) and hands
// the page the same shape; the demo keeps it in the browser. Actions (ops.ts) read facts and
// return effects: new facts to add. Both stores add them the same way, the server inside one
// transaction, where unique keys make a reward impossible to grant twice.

export type Currency = "xp" | "coins";

export type LedgerReason =
  | "quest"
  | "daily_bonus"
  | "daily_quiz"
  | "daily_claim"
  | "story_node"
  | "chapter"
  | "ending"
  | "achievement"
  | "chest"
  | "purchase"
  | "demo";

export type LedgerEntry = { currency: Currency; amount: number; key: string; reason: LedgerReason; at: string };

export type AnswerScope = "quest" | "story" | "daily";

/** One graded answer. `ref` names the run it belongs to: "letter@2026-10-24", "forgotten-academy", "whisper@2026-10-24". */
export type AnswerRecord = {
  scope: AnswerScope;
  ref: string;
  question: string;
  attempt: number;
  correct: boolean;
  /** What the question trains, for the profile's progress and the achievements. */
  skill: Skill;
  at: string;
};

export type CompletionKind =
  "quest" | "daily_quiz" | "daily_claim" | "daily_bonus" | "story_node" | "chapter" | "ending" | "help_request" | "achievement" | "chest";

export type Completion = { kind: CompletionKind; ref: string; at: string };

export type Saved = { kind: "word" | "fact"; ref: string; at: string };

export type Owned = { item: string; source: "starter" | "purchase" | "achievement" | "chest" | "demo"; at: string };

export type Facts = {
  profile: { heroName: string | null; characterId: CharacterId | null; joinedAt: string };
  ledger: LedgerEntry[];
  answers: AnswerRecord[];
  completions: Completion[];
  saved: Saved[];
  inventory: Owned[];
  equipped: Partial<Record<Slot, string>>;
  /** One run per campaign started: where the student is in its story (lib/story/run.ts). */
  runs: RunState[];
};

export type Effect =
  | { type: "profile"; heroName?: string | null; characterId?: CharacterId }
  | ({ type: "ledger" } & Omit<LedgerEntry, "at">)
  | ({ type: "answer" } & Omit<AnswerRecord, "at">)
  | ({ type: "completion" } & Omit<Completion, "at">)
  | { type: "save"; kind: Saved["kind"]; ref: string }
  | { type: "unsave"; kind: Saved["kind"]; ref: string }
  | { type: "own"; item: string; source: Owned["source"] }
  | { type: "equip"; slot: Slot; item: string | null }
  | { type: "run"; state: RunState };

export function emptyFacts(joinedAt: string): Facts {
  return {
    profile: { heroName: null, characterId: null, joinedAt },
    ledger: [],
    answers: [],
    completions: [],
    saved: [],
    inventory: [],
    equipped: {},
    runs: [],
  };
}

/** The facts with the effects added, in order. The demo store's whole write path; the server's mirror image. */
export function applyEffects(facts: Facts, effects: Effect[], at: string): Facts {
  const next: Facts = {
    profile: { ...facts.profile },
    ledger: [...facts.ledger],
    answers: [...facts.answers],
    completions: [...facts.completions],
    saved: [...facts.saved],
    inventory: [...facts.inventory],
    equipped: { ...facts.equipped },
    runs: [...facts.runs],
  };
  for (const effect of effects) {
    switch (effect.type) {
      case "profile":
        if (effect.heroName !== undefined) next.profile.heroName = effect.heroName;
        if (effect.characterId !== undefined) next.profile.characterId = effect.characterId;
        break;
      case "ledger":
        next.ledger.push({ currency: effect.currency, amount: effect.amount, key: effect.key, reason: effect.reason, at });
        break;
      case "answer":
        next.answers.push({
          scope: effect.scope,
          ref: effect.ref,
          question: effect.question,
          attempt: effect.attempt,
          correct: effect.correct,
          skill: effect.skill,
          at,
        });
        break;
      case "completion":
        next.completions.push({ kind: effect.kind, ref: effect.ref, at });
        break;
      case "save":
        if (!next.saved.some((s) => s.kind === effect.kind && s.ref === effect.ref))
          next.saved.push({ kind: effect.kind, ref: effect.ref, at });
        break;
      case "unsave":
        next.saved = next.saved.filter((s) => !(s.kind === effect.kind && s.ref === effect.ref));
        break;
      case "own":
        if (!next.inventory.some((o) => o.item === effect.item)) next.inventory.push({ item: effect.item, source: effect.source, at });
        break;
      case "equip":
        if (effect.item === null) delete next.equipped[effect.slot];
        else next.equipped[effect.slot] = effect.item;
        break;
      case "run":
        next.runs = [...next.runs.filter((r) => r.campaign !== effect.state.campaign), effect.state];
        break;
    }
  }
  return next;
}
