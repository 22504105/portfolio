"use client";

/* eslint-disable @next/next/no-img-element -- illustrations are pre-sized WebP in public/images (scripts/import-images.mjs) */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { StudentProvider, type ActResult } from "@/lib/client/student";
import type { Facts } from "@/lib/game/facts";
import type { Action, Outcome, Refusal } from "@/lib/game/ops";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { Account } from "@/lib/student/profile";

// The signed-in student inside Telegram. Telegram hands the Mini App signed sign-in data
// (initData); the server checks its signature and answers with a session and the student's
// record. The page never decides who the student is: initDataUnsafe is not read at all.
// The session lives in this tab only (sessionStorage) and goes in the Authorization header.

type TelegramWebApp = { initData: string; ready: () => void; expand: () => void };
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const SESSION_KEY = "questling-session";
const SCRIPT = "https://telegram.org/js/telegram-web-app.js";

type Session = { token: string; expiresAt: number };
type Status = "loading" | "outside" | "unconfigured" | "failed" | "ready";

function loadScript(): Promise<TelegramWebApp | null> {
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve(window.Telegram?.WebApp ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

function storedSession(): Session | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
    return value && value.expiresAt * 1000 > Date.now() + 60_000 ? value : null;
  } catch {
    return null;
  }
}

export function LiveProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = getDictionary(locale);
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [account, setAccount] = useState<Account | null>(null);

  const signIn = useCallback(async (): Promise<Session | null> => {
    const webApp = await loadScript();
    const initData = webApp?.initData ?? "";
    if (!initData) {
      setStatus("outside");
      return null;
    }
    webApp?.ready();
    webApp?.expand();
    const response = await fetch("/api/v1/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    });
    if (response.status === 503) {
      setStatus("unconfigured");
      return null;
    }
    if (!response.ok) {
      setStatus("failed");
      return null;
    }
    const data = (await response.json()) as Session & { facts: Facts; account: Account };
    const next = { token: data.token, expiresAt: data.expiresAt };
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch {}
    setSession(next);
    setFacts(data.facts);
    setAccount(data.account);
    setStatus("ready");
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const kept = storedSession();
      if (kept) {
        const response = await fetch("/api/v1/state", { headers: { Authorization: `Bearer ${kept.token}` } }).catch(() => null);
        if (!cancelled && response?.ok) {
          const data = (await response.json()) as { facts: Facts; account: Account };
          setSession(kept);
          setFacts(data.facts);
          setAccount(data.account);
          setStatus("ready");
          // Telegram's own chrome still needs to be told the app is up.
          loadScript().then((webApp) => webApp?.ready());
          return;
        }
      }
      if (!cancelled) await signIn();
    })().catch(() => !cancelled && setStatus("failed"));
    return () => {
      cancelled = true;
    };
  }, [signIn]);

  const act = useCallback(
    async (action: Action): Promise<ActResult> => {
      const send = (current: Session) =>
        fetch("/api/v1/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${current.token}` },
          body: JSON.stringify({ action, locale }),
        });
      if (!session) return { ok: false, refusal: "network" };
      let response = await send(session).catch(() => null);
      // A session that ran out while the app was open: sign in again once, then retry.
      if (response?.status === 401) {
        const renewed = await signIn();
        response = renewed ? await send(renewed).catch(() => null) : null;
      }
      if (!response) return { ok: false, refusal: "network" };
      const data = (await response.json().catch(() => ({}))) as { outcome?: Outcome; facts?: Facts; error?: string };
      if (!response.ok || !data.outcome || !data.facts) {
        return { ok: false, refusal: response.status >= 500 ? "server" : ((data.error as Refusal | undefined) ?? "server") };
      }
      setFacts(data.facts);
      return { ok: true, outcome: data.outcome };
    },
    [session, locale, signIn],
  );

  const join = useCallback(
    async (code: string) => {
      if (!session) return "network" as const;
      const response = await fetch("/api/v1/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ code }),
      }).catch(() => null);
      if (!response) return "network" as const;
      if (response.status === 429) return "limited" as const;
      if (!response.ok) return response.status === 404 ? ("not_found" as const) : ("network" as const);
      const data = (await response.json()) as { facts: Facts; account: Account };
      setFacts(data.facts);
      setAccount(data.account);
      return "ok" as const;
    },
    [session],
  );

  const api = useMemo(
    () => (facts && account ? { mode: "live" as const, locale, t, base: `/${locale}/app`, facts, account, act, join } : null),
    [facts, account, locale, t, act, join],
  );

  if (status === "ready" && api)
    return (
      <StudentProvider value={api}>
        <div data-student-ready>{children}</div>
      </StudentProvider>
    );
  if (status === "loading" || status === "ready") return <div className="bg-background min-h-dvh" aria-busy="true"></div>;
  return <Gate status={status} locale={locale} />;
}

/** Why the app cannot open here, on the welcome screen's backdrop, with the way to the demo. */
function Gate({ status, locale }: { status: Exclude<Status, "loading" | "ready">; locale: Locale }) {
  const t = getDictionary(locale);
  const message = status === "outside" ? t.live.outside : status === "unconfigured" ? t.live.unconfigured : t.live.failed;
  return (
    <div className="bg-background font-body-md text-body-md text-on-surface flex min-h-dvh flex-col antialiased" data-live-gate={status}>
      <main className="pt-safe pb-safe px-margin mx-auto flex w-full max-w-[420px] flex-1 flex-col">
        <div className="-mx-margin relative h-72 overflow-hidden">
          <img alt="" className="h-full w-full object-cover object-top opacity-60 mix-blend-screen" src="/images/forgotten-tower.webp" />
          <div className="from-background via-background/70 absolute inset-0 bg-gradient-to-t to-transparent"></div>
        </div>
        <div className="relative z-10 -mt-16 flex flex-col items-center text-center">
          <h1 className="font-headline-xl-mobile text-headline-xl-mobile text-text-ivory tracking-wide">QUESTLING</h1>
          <p className="font-headline-md text-headline-md text-primary-fixed-dim -mt-1 italic">Learn English Through Adventure</p>
          <div className="via-primary-container my-space-sm h-[1px] w-24 bg-gradient-to-r from-transparent to-transparent"></div>
          <p
            role={status === "outside" ? undefined : "alert"}
            className="font-body-md text-body-md text-text-muted max-w-[320px] leading-relaxed"
          >
            {message}
          </p>
        </div>
        <div className="gap-space-md mt-auto mb-6 flex flex-col items-center">
          <Link
            href={`/${locale}/demo/welcome`}
            className="to-primary-container text-surface-container-lowest font-label-md text-label-md gap-space-sm flex h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-b from-[#D5B87E] tracking-wider uppercase shadow-[0_0_20px_rgba(185,154,97,0.35)] transition-all active:scale-[0.98]"
          >
            <span className="text-[15px] font-semibold">{t.live.openDemo}</span>
            <Icon name="arrow_forward" className="text-[20px]" />
          </Link>
        </div>
      </main>
    </div>
  );
}
