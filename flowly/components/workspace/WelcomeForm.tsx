"use client";

import { useActionState, useSyncExternalStore } from "react";
import { createWorkspace, type WorkspaceState } from "@/app/actions/workspace";
import { fieldClass, submitClass } from "@/components/auth/AuthForm";
import type { Messages } from "@/lib/i18n";

type WelcomeFormProps = {
  labels: Messages["welcome"];
  working: string;
  currencies: readonly { code: string; name: string }[];
  timezones: string[];
};

const noop = () => () => {};

/** The first thing a new account sees: a name, a currency and a time zone for the workspace. */
export function WelcomeForm({ labels, working, currencies, timezones }: WelcomeFormProps) {
  const [state, action, pending] = useActionState<WorkspaceState, FormData>(createWorkspace, {});
  // The browser knows where the user is; offered as the starting choice, never applied silently.
  const local = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );

  return (
    <form action={action} className="card flex flex-col gap-5 p-6" noValidate>
      <label className="font-medium">
        {labels.name}
        <input
          type="text"
          name="name"
          required
          maxLength={80}
          placeholder={labels.namePlaceholder}
          autoComplete="organization"
          className={fieldClass}
        />
      </label>

      <label className="font-medium">
        {labels.currency}
        <select name="currency" defaultValue="USD" className={fieldClass} aria-describedby="currency-hint">
          {currencies.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} — {currency.name}
            </option>
          ))}
        </select>
        <span id="currency-hint" className="type-meta text-ink-muted mt-1.5 block font-normal">
          {labels.currencyHint}
        </span>
      </label>

      <label className="font-medium">
        {labels.timezone}
        <select
          name="timezone"
          key={local}
          defaultValue={timezones.includes(local) ? local : "UTC"}
          className={fieldClass}
          aria-describedby="timezone-hint"
        >
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <span id="timezone-hint" className="type-meta text-ink-muted mt-1.5 block font-normal">
          {labels.timezoneHint}
        </span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-input border-negative/30 bg-negative/8 text-negative border px-3.5 py-2.5">
          {labels.errors[state.error === "invalid" ? "invalid" : "unavailable"]}
        </p>
      )}

      <button
        type="submit"
        aria-disabled={pending || undefined}
        className={submitClass}
        onClick={(event) => pending && event.preventDefault()}
      >
        {pending ? working : labels.create}
      </button>
    </form>
  );
}
