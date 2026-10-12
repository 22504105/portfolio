"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { errorText, useApp, useLoad } from "@/components/app/AppProvider";
import { Button, buttonClass, Field, inputClass, Loading, Problem } from "@/components/ui/controls";
import { CATEGORIES, SPLIT_MODES, type Category, type Expense, type Group, type SplitMode } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/amount";
import { CURRENCIES } from "@/lib/money/currency";
import { buildSplits, checkExpense, type ExpenseProblem } from "@/lib/split/expense";
import { compose, emptyForm, formOf, type ExpenseForm } from "@/lib/split/form";
import { StoreError } from "@/lib/store/types";
import { cn } from "@/lib/utils";

/**
 * Adding an expense, or changing one (?group=…&expense=…). The group is
 * chosen first, because who can pay and take part depends on it.
 */
export function AddScreen() {
  const { t, base } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const expenseId = params.get("expense");
  const { data: groups, error } = useLoad((store) => store.listGroups(), "groups");

  const open = groups?.filter((group) => !group.archivedAt) ?? [];
  const groupId = params.get("group") ?? open[0]?.id ?? null;
  const { data: group, error: groupError } = useLoad(async (store) => (groupId ? store.getGroup(groupId) : null), `group:${groupId}`);
  const editing = expenseId ? group?.expenses.find((expense) => expense.id === expenseId && expense.status === "active") : undefined;

  return (
    <>
      <h1 className="type-title">{expenseId ? t.expense.editTitle : t.add.title}</h1>
      <p className="type-lead text-ink-muted mt-2">{expenseId ? t.expense.editLead : t.add.lead}</p>

      {(error || groupError) && <Problem className="mt-6">{errorText(t, error ?? groupError)}</Problem>}
      {!groups && !error && <Loading label={t.common.loading} />}

      {groups && open.length === 0 && (
        <div className="card mt-6 flex flex-col items-start gap-4 p-5">
          <p className="text-ink-muted">{t.expense.noGroups}</p>
          <Link href={`${base}/groups`} className={buttonClass("primary")}>
            {t.groups.create}
          </Link>
        </div>
      )}

      {groups && open.length > 0 && (
        <>
          {!expenseId && (
            <Field label={t.expense.group} className="mt-6">
              {(control) => (
                <select
                  {...control}
                  className={inputClass}
                  value={groupId ?? ""}
                  onChange={(event) => router.replace(`${base}/add?group=${event.target.value}`)}
                >
                  {open.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          {group === undefined && !groupError && <Loading label={t.common.loading} />}
          {(group === null || (group && expenseId && !editing) || group?.archivedAt) && (
            <Problem className="mt-6">{group?.archivedAt ? t.group.archivedNote : t.errors.not_found}</Problem>
          )}
          {group && !group.archivedAt && (!expenseId || editing) && (
            <Editor key={`${group.id}:${expenseId ?? "new"}`} group={group} editing={editing} />
          )}
        </>
      )}
    </>
  );
}

const FIELD_OF: Partial<Record<ExpenseProblem, "description" | "total" | "date" | "payers" | "split">> = {
  description: "description",
  total: "total",
  date: "date",
  currency: "total",
  no_payers: "payers",
  payer_unknown: "payers",
  payer_repeated: "payers",
  payers_sum: "payers",
  payer_sign: "payers",
  no_participants: "split",
  participant_unknown: "split",
  participant_repeated: "split",
  split_values: "split",
  split_sum: "split",
  percent_sum: "split",
};

function Editor({ group, editing }: { group: Group; editing: Expense | undefined }) {
  const { t, store, base, locale, changed, notify } = useApp();
  const router = useRouter();
  const members = useMemo(() => group.members.filter((member) => !member.removedAt), [group.members]);
  const [form, setForm] = useState<ExpenseForm>(() =>
    editing ? formOf(editing, group.members) : emptyForm(group.members, group.baseCurrency),
  );
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // One key per distinct submission: a second tap sends the same one, a corrected form a new one.
  const submission = useRef<{ key: string; body: string } | null>(null);

  const set = <Key extends keyof ExpenseForm>(key: Key, value: ExpenseForm[Key]) => setForm((current) => ({ ...current, [key]: value }));

  const input = compose(form, group.members);
  const checked = checkExpense(input, new Set(members.map((member) => member.id)));
  const problems = checked.ok ? [] : checked.problems;
  const differences = checked.ok ? {} : checked.differences;
  const totalOk = Number.isSafeInteger(input.totalMinor) && input.totalMinor !== 0;
  // What each person would owe, shown as it is typed, whenever the division itself makes sense.
  const preview = checked.ok
    ? checked.splits
    : totalOk && input.split.parts.every((part) => Number.isSafeInteger(part.value))
      ? buildSplits(input.totalMinor, input.split)
      : null;
  const owed = new Map(preview?.map((split) => [split.memberId, split.owedMinor]));

  const money = (minor: number) => formatMoney(Math.abs(minor), form.currency, { locale });
  const complaints = (field: (typeof FIELD_OF)[ExpenseProblem]) =>
    tried ? [...new Set(problems.filter((problem) => FIELD_OF[problem] === field).map((problem) => t.expense.problems[problem]))] : [];
  /** "12.00 TRY still to assign" or "… too much", for a sum that is off; shown as soon as it is known. */
  const offBy = (difference: number | undefined, percent = false) => {
    if (!difference) return null;
    const left = percent ? difference > 0 : Math.sign(difference) === Math.sign(input.totalMinor);
    const what: Record<string, string> = percent ? { n: String(Math.abs(difference) / 100) } : { amount: money(difference) };
    return fill(
      percent ? (left ? t.expense.leftPercent : t.expense.overPercent) : left ? t.expense.leftAmount : t.expense.overAmount,
      what,
    );
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    setFailure(null);
    if (!checked.ok) {
      // Take the person to the first thing that needs fixing.
      requestAnimationFrame(() => event.currentTarget?.querySelector<HTMLElement>("[role=alert]")?.scrollIntoView({ block: "center" }));
      return;
    }
    const body = JSON.stringify(checked.input);
    if (submission.current?.body !== body) submission.current = { key: crypto.randomUUID(), body };
    setBusy(true);
    try {
      if (editing) await store.replaceExpense(group.id, editing.id, submission.current.key, checked.input);
      else await store.createExpense(group.id, submission.current.key, checked.input);
      changed();
      notify(editing ? t.expense.changed : t.expense.saved);
      router.push(`${base}/groups/${group.id}`);
    } catch (caught) {
      const listed = caught instanceof StoreError ? (caught.details.problems ?? []) : [];
      setFailure(listed.length > 0 ? listed.map((problem) => t.expense.problems[problem]).join(" ") : errorText(t, caught));
      setBusy(false);
    }
  }

  const splitHintId = "split-hint";
  const unit = form.mode === "percent" ? "%" : form.mode === "exact" ? form.currency : "";

  return (
    <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-4 sm:p-5">
        <Field label={t.expense.description} error={complaints("description")[0]}>
          {(control) => (
            <input
              {...control}
              className={inputClass}
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder={t.expense.descriptionPlaceholder}
              maxLength={200}
              autoComplete="off"
            />
          )}
        </Field>

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label={t.expense.amount} error={complaints("total")[0]}>
            {(control) => (
              <input
                {...control}
                className={cn(inputClass, "text-lg font-semibold tabular-nums")}
                inputMode="decimal"
                value={form.amount}
                onChange={(event) => set("amount", event.target.value)}
                placeholder="0"
                autoComplete="off"
              />
            )}
          </Field>
          <Field label={t.expense.currency}>
            {(control) => (
              <select {...control} className={inputClass} value={form.currency} onChange={(event) => set("currency", event.target.value)}>
                {[...new Set([form.currency, group.baseCurrency, ...CURRENCIES])].map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <label className="type-small flex min-h-11 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="accent-primary size-5 shrink-0"
            checked={form.refund}
            onChange={(event) => set("refund", event.target.checked)}
          />
          {t.expense.refund}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.expense.date} error={complaints("date")[0]}>
            {(control) => (
              <input
                {...control}
                type="date"
                className={inputClass}
                value={form.date}
                onChange={(event) => set("date", event.target.value)}
              />
            )}
          </Field>
          <Field label={t.expense.category}>
            {(control) => (
              <select
                {...control}
                className={inputClass}
                value={form.category}
                onChange={(event) => set("category", event.target.value as Category | "")}
              >
                <option value="">{t.expense.noCategory}</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t.expense.categories[category]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </div>

      <fieldset className="card flex min-w-0 flex-col gap-3 p-4 sm:p-5">
        <legend className="type-heading float-left mb-1 w-full">{t.expense.paidBy}</legend>
        {!form.several ? (
          <select
            aria-label={t.expense.paidBy}
            className={inputClass}
            value={form.payerId}
            onChange={(event) => set("payerId", event.target.value)}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.id} className="grid grid-cols-[1fr_8.5rem] items-center gap-3">
                <span className="min-w-0 font-medium break-words">{member.name}</span>
                <input
                  aria-label={fill(t.expense.paidAmount, { name: member.name })}
                  className={cn(inputClass, "text-right tabular-nums")}
                  inputMode="decimal"
                  placeholder="0"
                  autoComplete="off"
                  value={form.paid[member.id] ?? ""}
                  onChange={(event) => set("paid", { ...form.paid, [member.id]: event.target.value })}
                />
              </li>
            ))}
          </ul>
        )}
        <label className="type-small flex min-h-11 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="accent-primary size-5 shrink-0"
            checked={form.several}
            onChange={(event) => set("several", event.target.checked)}
          />
          {t.expense.severalPaid}
        </label>
        {form.several && totalOk && offBy(differences.payers_sum) && (
          <p role="status" className="type-small text-warning font-semibold">
            {offBy(differences.payers_sum)}
          </p>
        )}
        {complaints("payers").map((text) => (
          <Problem key={text}>{text}</Problem>
        ))}
      </fieldset>

      <fieldset className="card flex min-w-0 flex-col gap-3 p-4 sm:p-5" aria-describedby={splitHintId}>
        <legend className="type-heading float-left mb-1 w-full">{t.expense.split}</legend>
        <div role="radiogroup" aria-label={t.expense.split} className="bg-surface-2 rounded-control grid grid-cols-4 gap-1 p-1">
          {SPLIT_MODES.map((mode: SplitMode) => (
            <label
              key={mode}
              className={cn(
                "type-small has-focus-visible:outline-primary flex h-11 cursor-pointer items-center justify-center rounded-[9px] px-1 text-center font-semibold transition-colors has-focus-visible:outline-2",
                form.mode === mode ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
              )}
            >
              <input type="radio" name="split-mode" className="sr-only" checked={form.mode === mode} onChange={() => set("mode", mode)} />
              {t.expense.modes[mode]}
            </label>
          ))}
        </div>
        <p id={splitHintId} className="type-small text-ink-muted">
          {t.expense.modeHints[form.mode]}
        </p>

        <ul className="flex flex-col gap-2">
          {members.map((member) => {
            const included = !!form.included[member.id];
            const share = owed.get(member.id);
            return (
              <li key={member.id} className="flex min-h-12 items-center gap-3">
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    aria-label={fill(t.expense.participant, { name: member.name })}
                    className="accent-primary size-5 shrink-0"
                    checked={included}
                    onChange={(event) => set("included", { ...form.included, [member.id]: event.target.checked })}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className={cn("font-medium break-words", !included && "text-ink-muted")}>{member.name}</span>
                    {included && form.mode !== "exact" && form.mode !== "equal" && share !== undefined && (
                      <span className="type-small text-ink-muted tabular-nums" data-testid={`share-${member.id}`}>
                        {formatMoney(share, form.currency, { locale })}
                      </span>
                    )}
                  </span>
                </label>
                {included && form.mode === "equal" && (
                  <span className="type-small text-ink-muted shrink-0 text-right tabular-nums" data-testid={`share-${member.id}`}>
                    {share === undefined ? "—" : formatMoney(share, form.currency, { locale })}
                  </span>
                )}
                {included && form.mode !== "equal" && (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <input
                      aria-label={fill(t.expense.valueOf, { name: member.name, what: t.expense.modes[form.mode] })}
                      className={cn(inputClass, "w-24 text-right tabular-nums")}
                      inputMode={form.mode === "shares" ? "numeric" : "decimal"}
                      placeholder={form.mode === "shares" ? "1" : "0"}
                      autoComplete="off"
                      value={form.values[form.mode][member.id] ?? ""}
                      onChange={(event) =>
                        set("values", {
                          ...form.values,
                          [form.mode]: { ...form.values[form.mode as Exclude<SplitMode, "equal">], [member.id]: event.target.value },
                        })
                      }
                    />
                    {unit && <span className="type-small text-ink-muted w-8">{unit}</span>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {totalOk && (offBy(differences.split_sum) || offBy(differences.percent_sum, true)) && (
          <p role="status" className="type-small text-warning font-semibold">
            {offBy(differences.split_sum) ?? offBy(differences.percent_sum, true)}
          </p>
        )}
        {complaints("split").map((text) => (
          <Problem key={text}>{text}</Problem>
        ))}
      </fieldset>

      {failure && <Problem>{failure}</Problem>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={busy} className="flex-1 sm:flex-none">
          {busy ? t.expense.saving : editing ? t.expense.saveChanges : t.expense.save}
        </Button>
        <Link href={`${base}/groups/${group.id}`} className={buttonClass("ghost")}>
          {t.common.cancel}
        </Link>
      </div>
    </form>
  );
}
