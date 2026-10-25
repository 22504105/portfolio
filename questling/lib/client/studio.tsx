"use client";

import { createContext, useContext } from "react";
import type { StudioDictionary } from "@/lib/i18n/studio";
import type { Locale } from "@/lib/i18n";
import type { StudioFacts, MediaItem } from "@/lib/studio/model";
import type { StudioAction, StudioOutcome, StudioRefusal } from "@/lib/studio/ops";

// What every Teacher Studio screen reads: the teacher's facts, the group in view, and a way to act.
// Two providers fill it, like the student app's: the demo studio (made-up classes in this browser,
// labelled "Демо") and the signed-in one (facts from the server, actions sent to it).

export type StudioActResult =
  | { ok: true; outcome: StudioOutcome }
  | { ok: false; refusal: StudioRefusal | "network" | "server" | "unauthenticated"; problems?: string[] };

export type StudioApi = {
  mode: "demo" | "live";
  locale: Locale;
  t: StudioDictionary;
  /** Where this mode's studio screens live: "/ru/demo/studio" or "/ru/studio". */
  base: string;
  /** The student app of the same mode, for "Режим ученика". */
  studentBase: string;
  facts: StudioFacts;
  act: (action: StudioAction) => Promise<StudioActResult>;
  /** The group the header's switch has chosen; null while the teacher has none. */
  groupId: string | null;
  setGroupId: (id: string) => void;
  signOut: () => void;
  /** The teacher's recordings: only the signed-in studio has them (the demo has no server to keep files). */
  media?: {
    upload: (file: File) => Promise<{ ok: true; item: MediaItem } | { ok: false; reason: MediaRefusal }>;
    remove: (id: string) => Promise<"deleted" | "in_use" | "not_found" | "network">;
  };
};

export type MediaRefusal = "type" | "too_large" | "too_long" | "too_short" | "unreadable" | "quota" | "not_teacher" | "network";

const StudioContext = createContext<StudioApi | null>(null);
export const StudioProvider = StudioContext.Provider;

export function useStudio(): StudioApi {
  const api = useContext(StudioContext);
  if (!api) throw new Error("useStudio outside a studio provider");
  return api;
}

/** The group in view: the one chosen, if it is still there, else the first active one. */
export function pickGroup(facts: StudioFacts, wanted: string | null): string | null {
  const active = facts.groups.filter((g) => !g.archivedAt);
  return (wanted && facts.groups.some((g) => g.id === wanted) ? wanted : (active[0] ?? facts.groups[0])?.id) ?? null;
}
