"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { buttonClass, Loading } from "@/components/ui/controls";
import type { Dictionary, Locale } from "@/lib/i18n";
import { createRemoteStore } from "@/lib/store/remote";
import { AppProvider, type Account } from "./AppProvider";

// The door to a person's own groups. Inside Telegram it trades the sign-in
// data Telegram hands the page for a Splitly session, and opens. Anywhere
// else there is nothing to trade, and it says where to go instead.
//
// The session is kept for this tab only (sessionStorage), and sent in a
// header by this page's own code: never a cookie, so no other site can use it.

type TelegramWebApp = { initData?: string; initDataUnsafe?: { start_param?: string }; ready?: () => void; expand?: () => void };
type TelegramWindow = Window & { Telegram?: { WebApp?: TelegramWebApp } };

type Session = { token: string; expiresAt: number; displayName: string };
type Phase = "connecting" | "ready" | "outside" | "failed" | "unconfigured" | "offline";

const SESSION_KEY = "splitly-session";
const TELEGRAM_SCRIPT = "https://telegram.org/js/telegram-web-app.js";
const INVITE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

function storedSession(): Session | null {
  try {
    const session = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
    // With a minute to spare, so that it does not run out halfway through a request.
    return session && typeof session.token === "string" && session.expiresAt > Date.now() / 1000 + 60 ? session : null;
  } catch {
    return null;
  }
}

function keep(session: Session | null) {
  try {
    if (session) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // No storage here: the session lives as long as the page does.
  }
}

/** Whether Telegram opened this page: it says so in the address, and its script remembers it across reloads. */
function openedByTelegram(): boolean {
  try {
    return window.location.hash.includes("tgWebAppData") || window.sessionStorage.getItem("__telegram__initParams") !== null;
  } catch {
    return window.location.hash.includes("tgWebAppData");
  }
}

/** Telegram's own script, loaded only when Telegram opened the page. Null if it could not be loaded. */
function loadTelegram(): Promise<TelegramWebApp | null> {
  return new Promise((resolve) => {
    const ready = () => (window as TelegramWindow).Telegram?.WebApp ?? null;
    if (ready()) return resolve(ready());
    const script = document.createElement("script");
    script.src = TELEGRAM_SCRIPT;
    script.async = true;
    script.onload = () => resolve(ready());
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
}

// What this tab holds while it is open: its session, and Telegram's handle on the page. One gate per page.
const live: { session: Session | null; telegram: TelegramWebApp | null } = { session: null, telegram: null };

/** Takes up a session (or lets go of it, with null), in this page and in the tab's storage. */
function setTelegram(app: TelegramWebApp | null) {
  live.telegram = app;
}

function remember(session: Session | null) {
  live.session = session;
  keep(session);
}

type SignIn = { phase: Phase; session?: Session };

async function signIn(initData: string): Promise<SignIn> {
  let response: Response;
  try {
    response = await fetch("/api/v1/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
      cache: "no-store",
    });
  } catch {
    return { phase: "offline" };
  }
  if (response.status === 503) return { phase: "unconfigured" };
  if (!response.ok) return { phase: response.status >= 500 ? "offline" : "failed" };
  const data = (await response.json()) as { token: string; expiresAt: number; profile: { displayName: string } };
  return { phase: "ready", session: { token: data.token, expiresAt: data.expiresAt, displayName: data.profile.displayName } };
}

type GateProps = {
  locale: Locale;
  dictionary: Dictionary;
  /** The bot's @name without the @, if this deployment has one. */ bot: string | null;
  children: ReactNode;
};

export function TelegramGate({ locale, dictionary, bot, children }: GateProps) {
  const t = dictionary.gate;
  const base = `/${locale}/app`;
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("connecting");
  const [displayName, setDisplayName] = useState("");

  const open = useCallback((next: Session) => {
    remember(next);
    setDisplayName(next.displayName);
    setPhase("ready");
  }, []);

  useEffect(() => {
    let current = true;
    (async () => {
      const kept = storedSession();
      if (!openedByTelegram()) {
        if (kept) open(kept);
        else setPhase("outside");
        return;
      }
      const app = await loadTelegram();
      if (!current) return;
      setTelegram(app);
      app?.ready?.();
      app?.expand?.();
      if (kept) return open(kept);
      if (!app?.initData) return setPhase("outside");
      const result = await signIn(app.initData);
      if (!current) return;
      if (result.session) open(result.session);
      else setPhase(result.phase);
    })();
    return () => {
      current = false;
    };
  }, [open]);

  // An invitation link opens the app with the invitation in Telegram's start parameter: go and show it, once.
  useEffect(() => {
    if (phase !== "ready") return;
    const token = live.telegram?.initDataUnsafe?.start_param;
    if (!token || !INVITE_TOKEN.test(token) || pathname.endsWith("/join")) return;
    try {
      if (window.sessionStorage.getItem("splitly-invite-seen") === token) return;
      window.sessionStorage.setItem("splitly-invite-seen", token);
    } catch {
      return;
    }
    router.replace(`${base}/join?t=${token}`);
  }, [phase, pathname, router, base]);

  const store = useMemo(
    () =>
      createRemoteStore(
        () => live.session?.token ?? null,
        // The session ran out: ask for another with the sign-in data Telegram gave this page.
        async () => {
          const initData = live.telegram?.initData;
          const result = initData ? await signIn(initData) : { phase: "failed" as Phase };
          if (result.session) {
            remember(result.session);
            return result.session.token;
          }
          remember(null);
          setPhase(result.phase === "ready" ? "failed" : result.phase);
          return null;
        },
      ),
    [],
  );

  const account = useMemo<Account>(
    () => ({
      displayName,
      bot,
      async remove() {
        const response = await fetch("/api/v1/me", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${live.session?.token ?? ""}` },
        });
        if (!response.ok) throw new Error("delete failed");
        remember(null);
        setPhase("outside");
      },
    }),
    [displayName, bot],
  );

  if (phase === "ready") {
    return (
      <AppProvider store={store} base={base} locale={locale} dictionary={dictionary} account={account}>
        {children}
      </AppProvider>
    );
  }

  const [title, body] =
    phase === "outside"
      ? [t.outsideTitle, t.outsideBody]
      : phase === "failed"
        ? [t.failedTitle, t.failedBody]
        : phase === "unconfigured"
          ? [t.unconfiguredTitle, t.unconfiguredBody]
          : [t.offlineTitle, t.offlineBody];

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Link href={`/${locale}`} aria-label={dictionary.nav.toHome} className="mb-8 inline-flex h-11 items-center self-start">
        <Logo />
      </Link>
      {phase === "connecting" ? (
        <Loading label={t.connecting} />
      ) : (
        <>
          <h1 className="type-title">{title}</h1>
          <p className="text-ink-muted mt-3">{body}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {bot && phase !== "unconfigured" && (
              <a href={`https://t.me/${bot}`} className={buttonClass("primary")}>
                <Send aria-hidden="true" className="size-4" />
                {t.openTelegram}
              </a>
            )}
            <Link href={`/${locale}/demo`} className={buttonClass(bot && phase !== "unconfigured" ? "secondary" : "primary")}>
              {t.openDemo}
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
