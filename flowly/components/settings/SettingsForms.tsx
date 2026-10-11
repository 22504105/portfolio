"use client";

import { useActionState, useState } from "react";
import { deleteAccount, deleteWorkspaceData, updateWorkspace, type SettingsState } from "@/app/actions/settings";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const field =
  "mt-1.5 h-11 w-full rounded-input border border-input bg-surface px-3.5 text-[0.9375rem] text-ink disabled:bg-surface-2 disabled:text-ink-muted";
const button = "inline-flex h-11 items-center justify-center rounded-input px-5 font-medium transition-colors aria-disabled:opacity-60";
const hint = "type-meta mt-1.5 block font-normal text-ink-muted";

type Labels = Messages["settings"];

function Problem({ state, labels }: { state: SettingsState; labels: Labels }) {
  return state.error ? (
    <p role="alert" className="rounded-input border-negative/30 bg-negative/8 text-negative border px-3.5 py-2.5">
      {labels.errors[state.error]}
    </p>
  ) : null;
}

type WorkspaceFormProps = {
  labels: Labels;
  workspace: { name: string; currency: string; timezone: string };
  /** With orders in the workspace the currency is fixed. */
  hasOrders: boolean;
  currencies: readonly { code: string; name: string }[];
  timezones: string[];
};

export function WorkspaceForm({ labels, workspace, hasOrders, currencies, timezones }: WorkspaceFormProps) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateWorkspace, {});
  // A currency the workspace has but the menu does not offer is still shown.
  const offered = currencies.some((currency) => currency.code === workspace.currency)
    ? currencies
    : [{ code: workspace.currency, name: workspace.currency }, ...currencies];

  return (
    // The key puts the saved values back into the fields after React clears the form.
    <form action={action} key={`${workspace.name}|${workspace.currency}|${workspace.timezone}`} className="flex flex-col gap-5" noValidate>
      <label className="font-medium">
        {labels.name}
        <input
          type="text"
          name="name"
          defaultValue={workspace.name}
          required
          maxLength={80}
          autoComplete="organization"
          className={field}
        />
      </label>

      <label className="font-medium">
        {labels.currency}
        {/* A disabled field is not submitted, so the value travels in a hidden one. */}
        {hasOrders && <input type="hidden" name="currency" value={workspace.currency} />}
        <select
          name={hasOrders ? undefined : "currency"}
          defaultValue={workspace.currency}
          disabled={hasOrders}
          aria-describedby="currency-note"
          className={field}
        >
          {offered.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} — {currency.name}
            </option>
          ))}
        </select>
        <span id="currency-note" className={hint}>
          {hasOrders ? labels.currencyLocked : labels.currencyFree}
        </span>
      </label>

      <label className="font-medium">
        {labels.timezone}
        <select name="timezone" defaultValue={workspace.timezone} aria-describedby="timezone-note" className={field}>
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <span id="timezone-note" className={hint}>
          {labels.timezoneHint}
        </span>
      </label>

      <Problem state={state} labels={labels} />

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          aria-disabled={pending || undefined}
          onClick={(event) => pending && event.preventDefault()}
          className={cn(button, "bg-brand hover:bg-brand-strong text-white")}
        >
          {pending ? labels.saving : labels.save}
        </button>
        {state.done === "saved" && !pending && (
          <p role="status" className="text-positive font-medium">
            {labels.saved}
          </p>
        )}
      </div>
    </form>
  );
}

type DangerFormProps = {
  labels: Labels;
  kind: "data" | "account";
  /** What must be typed to confirm: the workspace name, or the account's email. */
  expected: string;
  /** Nothing to delete: the form is not offered. It stays mounted, so that the message saying it worked can still be read. */
  nothingToDelete?: boolean;
};

/** Something that cannot be undone: it opens on request and wants the name typed out before it acts. */
export function DangerForm({ labels, kind, expected, nothingToDelete = false }: DangerFormProps) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SettingsState, FormData>(kind === "data" ? deleteWorkspaceData : deleteAccount, {});
  const title = kind === "data" ? labels.deleteData : labels.deleteAccount;
  const prompt = kind === "data" ? labels.deleteDataConfirm : labels.deleteAccountConfirm;
  const danger = cn(button, "bg-negative-fill text-white");

  if (state.done === "data_deleted") {
    return (
      <p role="status" className="text-positive font-medium">
        {labels.deleteDataDone}
      </p>
    );
  }

  if (nothingToDelete) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(button, "border-negative/40 bg-surface text-negative hover:bg-negative/8 border")}
      >
        {title}
      </button>
    );
  }

  return (
    <form action={action} className="rounded-input border-negative/30 bg-negative/8 flex max-w-md flex-col gap-4 border p-4" noValidate>
      <label className="font-medium">
        {prompt}
        <span className="type-meta text-ink mt-1 block font-mono font-normal break-all">{expected}</span>
        <input type="text" name="confirm" autoComplete="off" autoCapitalize="none" spellCheck={false} required className={field} />
      </label>
      <Problem state={state} labels={labels} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          aria-disabled={pending || undefined}
          onClick={(event) => pending && event.preventDefault()}
          className={danger}
        >
          {pending ? labels.deleting : title}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={cn(button, "border-input bg-surface border")}>
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
