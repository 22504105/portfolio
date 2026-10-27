"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { saveFile, StudentProvider, type ActResult } from "@/lib/client/student";
import { demoFacts } from "@/lib/demo/seed";
import { applyEffects, type Facts } from "@/lib/game/facts";
import { run, type Action } from "@/lib/game/ops";
import { getDictionary, type Locale } from "@/lib/i18n";
import { AudioNotice } from "./line-audio";
import { demoMediaUrl, keepDemoTake } from "@/lib/client/demo-media";
import { demoWorld } from "@/lib/demo/dub";
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
    // A record saved before the word journal existed has none: start it empty.
    if (stored) {
      const parsed = JSON.parse(stored) as Facts;
      memory = { ...parsed, vocab: parsed.vocab ?? [] };
    }
  } catch {
    // Private mode or blocked storage: the demo still works, it just forgets on reload.
  }
  memory ??= demoFacts(new Date());
  // The demo's teacher material is not the visitor's record: always the current one.
  memory = { ...memory, world: demoWorld() };
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

  // The demo's data is this browser's record: downloading saves it, deleting starts the demo afresh.
  const downloadData = useCallback(async () => {
    saveFile("questling-demo-data.json", JSON.stringify(read(), null, 2));
    return "ok" as const;
  }, []);
  const deleteData = useCallback(async () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    write(demoFacts(new Date()));
    return "ok" as const;
  }, []);

  // Demo takes stay in this browser (lib/client/demo-media.ts); nothing is uploaded anywhere.
  const media = useMemo(
    () => ({
      link: async (id: string) => demoMediaUrl(id),
      uploadTake: async (exercise: string, line: string, take: { blob: Blob; mime: string }) => {
        const id = keepDemoTake(take.blob);
        const result = await act({ type: "demoTake", exercise, line, media: id });
        return result.ok ? ({ ok: true } as const) : ({ ok: false, reason: result.refusal } as const);
      },
    }),
    [act],
  );

  const api = useMemo(
    () =>
      facts
        ? {
            mode: "demo" as const,
            media,
            locale,
            t: getDictionary(locale),
            base: `/${locale}/demo`,
            facts,
            account: demoAccount(locale),
            act,
            downloadData,
            deleteData,
          }
        : null,
    [facts, locale, act, downloadData, deleteData, media],
  );

  if (!api) return <div className="bg-background min-h-dvh" aria-busy="true"></div>;
  return (
    <StudentProvider value={api}>
      <div data-student-ready>{children}</div>
      <AudioNotice />
    </StudentProvider>
  );
}
