"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { pickGroup, StudioProvider, type MediaRefusal, type StudioActResult, type StudioApi } from "@/lib/client/studio";
import type { Locale } from "@/lib/i18n";
import { studioDictionary } from "@/lib/i18n/studio";
import { demoStudio } from "@/lib/studio/demo";
import { applyStudioEffects, type MediaItem, type StudioFacts } from "@/lib/studio/model";
import { studioRun, type StudioAction, type StudioOutcome, type StudioRefusal } from "@/lib/studio/ops";

// The two homes of Teacher Studio's facts. The demo studio keeps made-up classes in this browser
// (lib/studio/demo.ts) and runs the studio's rules here; nothing reaches the server. The signed-in
// studio holds the teacher's session in this tab (sessionStorage, sent as a header, like the student
// app's) and asks the server for everything.

const DEMO_KEY = "questling-studio-demo-v1";
const GROUP_KEY = "questling-studio-group";
export const SESSION_KEY = "questling-studio-session";

function rememberedGroup(): string | null {
  try {
    return window.localStorage.getItem(GROUP_KEY);
  } catch {
    return null;
  }
}

function useGroup(facts: StudioFacts | null) {
  // Read once on the client; on the server the providers render nothing that depends on it.
  const [wanted, setWanted] = useState<string | null>(() => (typeof window === "undefined" ? null : rememberedGroup()));
  const groupId = facts ? pickGroup(facts, wanted) : null;
  const setGroupId = useCallback((id: string) => {
    setWanted(id);
    try {
      window.localStorage.setItem(GROUP_KEY, id);
    } catch {}
  }, []);
  return { groupId, setGroupId };
}

const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
};

// ——— Demo ———

let memory: StudioFacts | null = null;
const listeners = new Set<() => void>();

function readDemo(): StudioFacts {
  if (memory) return memory;
  try {
    const stored = window.localStorage.getItem(DEMO_KEY);
    if (stored) memory = JSON.parse(stored) as StudioFacts;
  } catch {}
  memory ??= demoStudio(new Date());
  return memory;
}

function writeDemo(facts: StudioFacts) {
  memory = facts;
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(facts));
  } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function DemoStudioProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const facts = useSyncExternalStore(subscribe, readDemo, () => null);
  const { groupId, setGroupId } = useGroup(facts);
  const act = useCallback(async (action: StudioAction): Promise<StudioActResult> => {
    const now = new Date();
    const current = readDemo();
    const result = studioRun(current, action, { now, newId: () => crypto.randomUUID(), newCode: randomCode });
    if (!result.ok) return { ok: false, refusal: result.refusal, problems: result.problems };
    writeDemo(applyStudioEffects(current, result.effects, now.toISOString()));
    return { ok: true, outcome: result.outcome };
  }, []);
  const signOut = useCallback(() => {
    // Leaving the demo forgets what was changed in it.
    try {
      window.localStorage.removeItem(DEMO_KEY);
    } catch {}
    memory = null;
    router.push(`/${locale}/studio/login`);
  }, [locale, router]);
  const api = useMemo<StudioApi | null>(
    () =>
      facts
        ? {
            mode: "demo",
            locale,
            t: studioDictionary(locale),
            base: `/${locale}/demo/studio`,
            studentBase: `/${locale}/demo`,
            facts,
            act,
            groupId,
            setGroupId,
            signOut,
          }
        : null,
    [facts, locale, act, groupId, setGroupId, signOut],
  );
  if (!api) return <div className="bg-background min-h-dvh" aria-busy="true"></div>;
  return (
    <StudioProvider value={api}>
      <div data-studio-ready>{children}</div>
    </StudioProvider>
  );
}

// ——— Signed in ———

type Session = { token: string; expiresAt: number };

export function storedStudioSession(): Session | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
    return value && value.expiresAt * 1000 > Date.now() + 60_000 ? value : null;
  } catch {
    return null;
  }
}

export function keepStudioSession(session: Session) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

export function LiveStudioProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [facts, setFacts] = useState<StudioFacts | null>(null);
  const [session] = useState(() => (typeof window === "undefined" ? null : storedStudioSession()));
  const { groupId, setGroupId } = useGroup(facts);
  const login = `/${locale}/studio/login`;

  useEffect(() => {
    if (!session) {
      router.replace(login);
      return;
    }
    let cancelled = false;
    fetch("/api/v1/studio/state", { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401 || response.status === 403) return router.replace(login);
        if (response.ok) setFacts(((await response.json()) as { facts: StudioFacts }).facts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session, router, login]);

  const act = useCallback(
    async (action: StudioAction): Promise<StudioActResult> => {
      if (!session) return { ok: false, refusal: "unauthenticated" };
      const response = await fetch("/api/v1/studio/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ action }),
      }).catch(() => null);
      if (!response) return { ok: false, refusal: "network" };
      const data = (await response.json().catch(() => ({}))) as {
        outcome?: StudioOutcome;
        facts?: StudioFacts;
        error?: string;
        problems?: string[];
      };
      if (response.status === 401) {
        router.replace(login);
        return { ok: false, refusal: "unauthenticated" };
      }
      if (!response.ok || !data.outcome || !data.facts) {
        const refusal = response.status >= 500 ? "server" : ((data.error as StudioRefusal | undefined) ?? "server");
        return { ok: false, refusal, problems: data.problems };
      }
      setFacts(data.facts);
      return { ok: true, outcome: data.outcome };
    },
    [session, router, login],
  );

  // Recordings go up as raw bytes (the server checks what they really are) and come back with a link.
  const media = useMemo<StudioApi["media"]>(
    () =>
      session
        ? {
            upload: async (file) => {
              const response = await fetch("/api/v1/studio/media", {
                method: "POST",
                headers: {
                  "Content-Type": "application/octet-stream",
                  Authorization: `Bearer ${session.token}`,
                  "X-File-Name": encodeURIComponent(file.name),
                },
                body: file,
              }).catch(() => null);
              if (!response) return { ok: false, reason: "network" };
              const data = (await response.json().catch(() => ({}))) as { asset?: MediaItem; error?: string };
              if (!response.ok || !data.asset) {
                const reason = (data.error ?? "network") as MediaRefusal;
                return { ok: false, reason: response.status === 413 ? "too_large" : reason };
              }
              const item = data.asset;
              setFacts((f) => (f ? { ...f, media: [item, ...f.media] } : f));
              return { ok: true, item };
            },
            remove: async (id) => {
              const response = await fetch("/api/v1/studio/media/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
                body: JSON.stringify({ id }),
              }).catch(() => null);
              if (!response) return "network";
              if (response.ok) {
                setFacts((f) => (f ? { ...f, media: f.media.filter((m) => m.id !== id) } : f));
                return "deleted";
              }
              return response.status === 409 ? "in_use" : response.status === 404 ? "not_found" : "network";
            },
          }
        : undefined,
    [session],
  );

  const signOut = useCallback(() => {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {}
    router.push(login);
  }, [login, router]);

  const api = useMemo<StudioApi | null>(
    () =>
      facts
        ? {
            mode: "live",
            locale,
            t: studioDictionary(locale),
            base: `/${locale}/studio`,
            studentBase: `/${locale}/demo`,
            facts,
            act,
            groupId,
            setGroupId,
            signOut,
            media,
          }
        : null,
    [facts, locale, act, groupId, setGroupId, signOut, media],
  );
  if (!api) return <div className="bg-background min-h-dvh" aria-busy="true"></div>;
  return (
    <StudioProvider value={api}>
      <div data-studio-ready>{children}</div>
    </StudioProvider>
  );
}
