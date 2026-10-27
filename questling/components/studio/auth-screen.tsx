"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { fill, type Locale } from "@/lib/i18n";
import { studioDictionary } from "@/lib/i18n/studio";
import { keepStudioSession } from "./studio-providers";

// Signing in to Teacher Studio, registering, and resetting the password. The teacher exports have
// no sign-in screen, so (owner's rule: only the existing design) this is put together from the
// dashboard's parts: its hero card, its fields (the header's search field) and its gold button.
// The password goes to our server only, which checks it with Supabase Auth (lib/server/teacher-auth.ts).

type Mode = "signin" | "signup" | "recover" | "reset";

const errorKey = (code: string | undefined) => code ?? "unavailable";

export function AuthScreen({ locale, mode: initial }: { locale: Locale; mode: Mode }) {
  const t = studioDictionary(locale);
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    params.get("confirmed") ? { ok: true, text: t.auth.confirmed } : null,
  );
  const [pending, startTransition] = useTransition();

  // A reset link carries its one-time token in the #fragment, which never reaches a server log.
  const hash = useSyncExternalStore(
    () => () => {},
    () => window.location.hash,
    () => null,
  );
  const token = hash ? new URLSearchParams(hash.slice(1)).get("access_token") : null;
  const resetMissing = mode === "reset" && hash !== null && !token;

  async function post(path: string, body: unknown) {
    const response = await fetch(`/api/v1/studio/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = response ? ((await response.json().catch(() => ({}))) as Record<string, unknown>) : {};
    return { ok: !!response?.ok, data };
  }

  const failure = (data: Record<string, unknown>) => {
    const code = errorKey(data.error as string | undefined) as keyof typeof t.auth.errors;
    return { ok: false, text: t.auth.errors[code] ?? t.auth.errors.unavailable };
  };

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      if (mode === "signin") {
        const { ok, data } = await post("signin", { email, password });
        if (!ok) return setMessage(failure(data));
        keepStudioSession({ token: data.token as string, expiresAt: data.expiresAt as number });
        router.push(`/${locale}/studio`);
      } else if (mode === "signup") {
        const { ok, data } = await post("signup", { email, password, name, locale });
        if (ok && data.status === "signed_in") {
          keepStudioSession({ token: data.token as string, expiresAt: data.expiresAt as number });
          return router.push(`/${locale}/studio`);
        }
        setMessage(ok ? { ok: true, text: fill(t.auth.confirmEmail, { email }) } : failure(data));
        if (ok) setMode("signin");
      } else if (mode === "recover") {
        const { ok, data } = await post("recover", { email, locale });
        setMessage(ok ? { ok: true, text: t.auth.resetSent } : failure(data));
      } else {
        const { ok, data } = await post("password", { accessToken: token, password });
        if (!ok) return setMessage(failure(data));
        setMessage({ ok: true, text: t.auth.passwordSet });
        setMode("signin");
        window.history.replaceState(null, "", `/${locale}/studio/login`);
      }
    });
  }

  const title = mode === "signup" ? t.auth.signupTitle : mode === "reset" ? t.auth.resetTitle : t.auth.title;
  const field =
    "bg-surface-container-lowest text-text-ivory placeholder-text-muted font-body-md text-body-md px-space-md py-space-sm focus:ring-primary-container w-full rounded-lg focus:ring-1 focus:outline-none";

  return (
    <div className="bg-background font-body-md text-on-surface flex min-h-screen items-center justify-center p-6 antialiased">
      <div
        className="bg-surface p-space-xl gap-space-lg relative flex w-full max-w-[460px] flex-col overflow-hidden rounded-xl shadow-xl"
        data-auth={mode}
      >
        <div className="bg-secondary-container/20 pointer-events-none absolute -top-24 -right-20 h-80 w-80 rounded-full blur-3xl"></div>
        <div className="gap-space-md relative z-10 flex items-center">
          <div className="bg-surface-container text-primary flex h-9 w-9 items-center justify-center rounded-lg">
            <Icon name="explore" className="text-[22px]" />
          </div>
          <div className="flex flex-col">
            <span className="font-title-sm text-title-sm text-primary tracking-wider uppercase">Questling</span>
            <span className="font-caption text-caption text-text-muted tracking-widest uppercase">{t.shell.studio}</span>
          </div>
        </div>
        <div className="relative z-10 flex flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg text-text-ivory">{title}</h1>
          <p className="font-body-md text-body-md text-text-muted">{t.auth.lead}</p>
        </div>
        <form onSubmit={submit} className="gap-space-md relative z-10 flex flex-col">
          {mode === "signup" ? (
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-text-muted">{t.auth.name}</span>
              <input
                className={field}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.auth.namePlaceholder}
                maxLength={60}
                required
                name="name"
              />
            </label>
          ) : null}
          {mode !== "reset" ? (
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-text-muted">{t.auth.email}</span>
              <input
                className={field}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                name="email"
              />
            </label>
          ) : null}
          {mode !== "recover" ? (
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-text-muted">{mode === "reset" ? t.auth.newPassword : t.auth.password}</span>
              <input
                className={field}
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={mode === "signin" ? undefined : 8}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                name="password"
              />
            </label>
          ) : null}
          {resetMissing && !message ? (
            <p role="alert" className="font-body-md text-body-md text-status-error">
              {t.auth.resetMissing}
            </p>
          ) : null}
          {message ? (
            <p
              role={message.ok ? "status" : "alert"}
              className={`font-body-md text-body-md ${message.ok ? "text-status-success" : "text-status-error"}`}
            >
              {message.text}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending || (mode === "reset" && !token)}
            aria-busy={pending}
            className="gap-space-xs px-space-lg py-space-sm from-primary to-primary-container text-surface-container-lowest font-label-md text-label-md flex items-center justify-center rounded-lg bg-gradient-to-b shadow-[0_0_16px_rgba(185,154,97,0.3)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            <Icon name={mode === "signin" ? "login" : "magic_button"} className="text-[18px]" />
            <span>
              {mode === "signin"
                ? t.auth.signIn
                : mode === "signup"
                  ? t.auth.signUp
                  : mode === "recover"
                    ? t.auth.sendReset
                    : t.auth.setPassword}
            </span>
          </button>
        </form>
        <div className="font-label-sm text-label-sm relative z-10 flex flex-wrap justify-between gap-2">
          {mode === "signin" ? (
            <>
              <button type="button" className="text-primary hover:text-primary-fixed" onClick={() => setMode("signup")}>
                {t.auth.toSignUp}
              </button>
              <button type="button" className="text-text-muted hover:text-text-ivory" onClick={() => setMode("recover")}>
                {t.auth.forgot}
              </button>
            </>
          ) : (
            <button type="button" className="text-primary hover:text-primary-fixed" onClick={() => setMode("signin")}>
              {t.auth.toSignIn}
            </button>
          )}
        </div>
        <div className="bg-surface-container-low p-space-md relative z-10 flex flex-col gap-2 rounded-lg">
          <Link
            href={`/${locale}/demo/studio`}
            className="gap-space-xs py-space-sm px-space-md bg-surface-container-high hover:bg-surface-bright text-text-ivory font-label-sm text-label-sm flex items-center justify-center rounded-lg transition-all"
          >
            <Icon name="visibility" className="text-[16px]" />
            <span>{t.auth.demo}</span>
          </Link>
          <p className="font-caption text-caption text-text-muted text-center">{t.auth.demoNote}</p>
        </div>
      </div>
    </div>
  );
}
