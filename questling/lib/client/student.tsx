"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Facts } from "@/lib/game/facts";
import type { Action, Outcome, Refusal } from "@/lib/game/ops";
import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n";
import type { Account } from "@/lib/student/profile";

// What every student screen reads: the student's facts, the clock, and a way to act.
// Two providers fill it: the demo one (facts in this browser, actions run here, labelled
// "Демо") and the live one (facts from the server, actions sent to it). Screens do not know
// which one they are under, so the demo shows exactly what a student would see.

export type ActResult = { ok: true; outcome: Outcome } | { ok: false; refusal: Refusal | "network" | "server" };

export type StudentApi = {
  mode: "demo" | "live";
  locale: Locale;
  t: Dictionary;
  /** Where this mode's screens live: "/ru/demo" or "/ru/app". */
  base: string;
  facts: Facts;
  /** The Telegram account and group, for the profile and settings. */
  account: Account;
  act: (action: Action) => Promise<ActResult>;
  /** Joins a teacher's group by its invite code (signed-in app only; the demo has no teachers). */
  join?: (code: string) => Promise<"ok" | "not_found" | "limited" | "network">;
  /** Hands the student a file of everything kept about them (live: the server's; demo: this browser's). */
  downloadData?: () => Promise<"ok" | "limited" | "network">;
  /** Deletes the student and everything about them (live: on the server; demo: starts the demo afresh). */
  deleteData?: () => Promise<"ok" | "network">;
  /**
   * Large media (lib/server/media-store.ts): a short-lived link to a scene's video or a take, and a
   * take sent up for a line. Live: signed links from the server; demo: files kept in this browser.
   */
  media: {
    link: (id: string) => Promise<string | null>;
    uploadTake: (
      exercise: string,
      line: string,
      take: { blob: Blob; mime: string },
    ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  };
};

/** Saves text as a file through the browser (outside Telegram, and for the demo). */
export function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const StudentContext = createContext<StudentApi | null>(null);

/** The link to a teacher's recording this student may hear (from their world), or null. */
export function useMediaLink(id: string | undefined | null): string | null {
  const { facts } = useStudent();
  return id ? (facts.world?.media?.[id] ?? null) : null;
}

export const StudentProvider = StudentContext.Provider;

export function useStudent(): StudentApi {
  const api = useContext(StudentContext);
  if (!api) throw new Error("useStudent outside a student provider");
  return api;
}

/** The current time, moving on every minute: for countdowns and for the day turning over. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function dictionaryFor(locale: Locale): Dictionary {
  return getDictionary(locale);
}
