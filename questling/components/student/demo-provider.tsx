"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { StudentProvider, type ActResult } from "@/lib/client/student";
import { demoFacts } from "@/lib/demo/seed";
import { applyEffects, type Facts } from "@/lib/game/facts";
import { run, type Action } from "@/lib/game/ops";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { Account } from "@/lib/student/profile";

// The demo student lives in this browser only: made-up history (lib/demo/seed.ts), actions
// run here with the same rules as on the server, progress kept in localStorage so the demo
// remembers what the visitor did. Nothing reaches the server; the screens say "Демо".

// v2: Gate 3 keeps the story as runs; a v1 record (Gate 2) is left behind and the demo starts afresh.
const STORAGE_KEY = "questling-demo-v2";

// The demo student's made-up Telegram account and group, as on the approved profile screen.
const demoAccount = (locale: Locale): Account => ({
  telegram: { username: "barsik_magic", id: 89214 },
  group: locale === "ru" ? { name: "Детективы A2", mentor: "Архимаг Элеонора" } : { name: "A2 Detectives", mentor: "Archmage Eleanor" },
});

let memory: Facts | null = null;
const listeners = new Set<() => void>();

function read(): Facts {
  if (memory) return memory;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) memory = JSON.parse(stored) as Facts;
  } catch {
    // Private mode or blocked storage: the demo still works, it just forgets on reload.
  }
  memory ??= demoFacts(new Date());
  return memory;
}

function write(facts: Facts) {
  memory = facts;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(facts));
  } catch {}
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function DemoProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  // On the server there is no demo student yet: the screens render once the browser has one.
  const facts = useSyncExternalStore(subscribe, read, () => null);

  const act = useCallback(
    async (action: Action): Promise<ActResult> => {
      const now = new Date();
      const current = read();
      const result = run(current, action, { now, locale, demo: true });
      if (!result.ok) return result;
      write(applyEffects(current, result.effects, now.toISOString()));
      return { ok: true, outcome: result.outcome };
    },
    [locale],
  );

  const api = useMemo(
    () =>
      facts
        ? { mode: "demo" as const, locale, t: getDictionary(locale), base: `/${locale}/demo`, facts, account: demoAccount(locale), act }
        : null,
    [facts, locale, act],
  );

  if (!api) return <div className="bg-background min-h-dvh" aria-busy="true"></div>;
  return (
    <StudentProvider value={api}>
      <div data-student-ready>{children}</div>
    </StudentProvider>
  );
}
