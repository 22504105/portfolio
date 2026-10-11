"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestReset, signIn, signUp, updatePassword, type AuthState } from "@/app/actions/auth";
import type { Messages } from "@/lib/i18n";

type Mode = "login" | "signup" | "reset" | "update";

const ACTIONS = { login: signIn, signup: signUp, reset: requestReset, update: updatePassword } as const;

export const fieldClass = "mt-1.5 h-11 w-full rounded-input border border-input bg-surface px-3.5 text-[0.9375rem] text-ink";
export const submitClass =
  "inline-flex h-11 w-full items-center justify-center rounded-input bg-brand px-5 text-[0.9375rem] font-medium text-white transition-colors hover:bg-brand-hover aria-disabled:opacity-60";

type AuthFormProps = { mode: Mode; labels: Messages["auth"]; next?: string; initialError?: keyof Messages["auth"]["errors"] };

/** The one form behind sign-in, sign-up, asking for a reset link and choosing a new password. */
export function AuthForm({ mode, labels, next, initialError }: AuthFormProps) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    ACTIONS[mode],
    initialError ? { error: initialError as AuthState["error"] } : {},
  );
  const error = state.error ?? (initialError && !state.notice ? initialError : undefined);
  const submit = { login: labels.signIn, signup: labels.signUp, reset: labels.sendReset, update: labels.savePassword }[mode];
  const link = "inline-flex min-h-8 items-center font-medium text-brand-hover underline-offset-4 hover:underline";

  if (state.notice) {
    return (
      <div role="status" className="card p-6">
        <p className="text-[0.9375rem]">{labels.notices[state.notice]}</p>
        <Link href={state.notice === "updated" ? "/app/overview" : "/login"} className={`${link} mt-4 inline-flex min-h-11 items-center`}>
          {state.notice === "updated" ? labels.continue : labels.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="card flex flex-col gap-4 p-6" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      {mode !== "update" && (
        <label className="font-medium">
          {labels.email}
          <input
            type="email"
            name="email"
            // React clears a form after its action; the address typed comes back with the answer.
            key={state.email ?? ""}
            defaultValue={state.email ?? ""}
            autoComplete="email"
            required
            maxLength={320}
            className={fieldClass}
            aria-describedby={error ? "auth-error" : undefined}
          />
        </label>
      )}

      {mode !== "reset" && (
        <label className="font-medium">
          {mode === "update" ? labels.newPassword : labels.password}
          <input
            type="password"
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "login" ? 1 : 8}
            maxLength={200}
            className={fieldClass}
            aria-describedby={mode === "login" ? undefined : "password-hint"}
          />
          {mode !== "login" && (
            <span id="password-hint" className="type-meta text-ink-muted mt-1.5 block font-normal">
              {labels.passwordHint}
            </span>
          )}
        </label>
      )}

      {mode === "update" && (
        <label className="font-medium">
          {labels.confirmPassword}
          <input type="password" name="confirm" autoComplete="new-password" required maxLength={200} className={fieldClass} />
        </label>
      )}

      {error && (
        <p id="auth-error" role="alert" className="rounded-input border-negative/30 bg-negative/8 text-negative border px-3.5 py-2.5">
          {labels.errors[error]}
        </p>
      )}

      <button
        type="submit"
        aria-disabled={pending || undefined}
        className={submitClass}
        onClick={(event) => pending && event.preventDefault()}
      >
        {pending ? labels.working : submit}
      </button>

      {mode === "signup" && <p className="type-meta text-ink-muted">{labels.verification}</p>}

      <p className="text-ink-muted flex flex-wrap gap-x-4 gap-y-1">
        {mode === "login" && (
          <>
            <Link href="/reset-password" className={link}>
              {labels.forgot}
            </Link>
            <span>
              {labels.noAccount}{" "}
              <Link href="/signup" className={link}>
                {labels.signUp}
              </Link>
            </span>
          </>
        )}
        {mode === "signup" && (
          <span>
            {labels.haveAccount}{" "}
            <Link href="/login" className={link}>
              {labels.signIn}
            </Link>
          </span>
        )}
        {mode === "reset" && (
          <Link href="/login" className={link}>
            {labels.backToSignIn}
          </Link>
        )}
      </p>
    </form>
  );
}
