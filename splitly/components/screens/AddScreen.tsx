"use client";

import { ArrowLeft, Camera, Check, Equal, Hash, Percent, PieChart, ScanLine, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { errorText, useApp, useLoad } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { CATEGORY_LOOK } from "@/components/ui/CategoryIcon";
import { Button, buttonClass, Field, inputClass, Loading, Problem } from "@/components/ui/controls";
import { CATEGORIES, SPLIT_MODES, type Expense, type Group, type SplitMode } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/amount";
import { CURRENCIES } from "@/lib/money/currency";
import { buildSplits, checkExpense, type ExpenseProblem } from "@/lib/split/expense";
import { compose, emptyForm, formOf, type ExpenseForm } from "@/lib/split/form";
import { StoreError } from "@/lib/store/types";
import { cn } from "@/lib/utils";

/**
 * Adding an expense, or changing one (?group=…&expense=…), after the
 * concept's "New expense" screen. The group is chosen first, because who can
 * pay and take part depends on it.
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
      <div className="relative flex min-h-11 items-center justify-center">
        <Link
          href={groupId ? `${base}/groups/${groupId}` : base}
          aria-label={t.common.back}
          className="text-ink-muted hover:text-ink absolute top-0 left-0 inline-flex size-11 items-center justify-center rounded-full"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="type-heading px-12 text-center text-[1.25rem]">{expenseId ? t.expense.editTitle : t.expense.newTitle}</h1>
      </div>
      {expenseId && <p className="type-small text-ink-muted mt-1 text-center">{t.expense.editLead}</p>}

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
          {!expenseId && open.length > 1 && (
            <Field label={t.expense.group} className="mt-4">
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

const MODE_ICON: Record<SplitMode, LucideIcon> = { equal: Equal, exact: Hash, percent: Percent, shares: PieChart };

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
  const included = members.filter((member) => form.included[member.id]);
  const payer = members.find((member) => member.id === form.payerId);

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
    const formElement = event.currentTarget;
    setTried(true);
    setFailure(null);
    if (!checked.ok) {
      // Take the person to the first thing that needs fixing.
      requestAnimationFrame(() => formElement.querySelector<HTMLElement>("[role=alert]")?.scrollIntoView({ block: "center" }));
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
      setFailure(
        listed.length > 0
          ? listed.map((problem) => (t.expense.problems as Record<string, string>)[problem] ?? t.errors.invalid).join(" ")
          : errorText(t, caught),
      );
      setBusy(false);
    }
  }

  const unit = form.mode === "percent" ? "%" : form.mode === "exact" ? form.currency : "";
  const label = "text-ink-muted text-[0.6875rem] leading-4 font-semibold tracking-[0.08em] uppercase";

  // After Stitch's "New expense": the amount as the headline, then what it was, who paid, who takes part, how to split.
  return (
    <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
      <div className="card flex flex-col gap-3 p-5">
        <Field
          label={t.expense.amount}
          error={complaints("total")[0]}
          className="[&>label]:text-ink-muted [&>label]:text-[0.6875rem] [&>label]:tracking-[0.08em] [&>label]:uppercase"
        >
          {(control) => (
            <div className="flex items-center gap-2">
              <input
                {...control}
                className="text-ink placeholder:text-ink-muted/60 h-14 min-w-0 flex-1 bg-transparent text-[2rem] leading-10 font-bold tracking-[-0.02em] tabular-nums outline-none"
                inputMode="decimal"
                value={form.amount}
                onChange={(event) => set("amount", event.target.value)}
                placeholder="0.00"
                autoComplete="off"
              />
              <select
                aria-label={t.expense.currency}
                className="bg-surface-2 text-ink h-11 shrink-0 rounded-full px-3 text-[0.875rem] font-semibold"
                value={form.currency}
                onChange={(event) => set("currency", event.target.value)}
              >
                {[...new Set([form.currency, group.baseCurrency, ...CURRENCIES])].map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </div>
          )}
        </Field>
        <Field label={t.expense.description} error={complaints("description")[0]} className="[&>label]:sr-only">
          {(control) => (
            <input
              {...control}
              className="bg-surface-2 text-ink placeholder:text-ink-muted aria-[invalid=true]:outline-danger h-12 w-full min-w-0 rounded-[14px] px-4 aria-[invalid=true]:outline-2"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder={t.expense.descriptionPlaceholder}
              maxLength={200}
              autoComplete="off"
            />
          )}
        </Field>
        <div className="grid items-center gap-x-3 gap-y-1 sm:grid-cols-2">
          <Field label={t.expense.date} error={complaints("date")[0]} className="[&>label]:sr-only">
            {(control) => (
              <input
                {...control}
                type="date"
                className="text-ink h-11 w-full bg-transparent text-[0.875rem] font-medium"
                value={form.date}
                onChange={(event) => set("date", event.target.value)}
              />
            )}
          </Field>
          <label className="type-small flex min-h-11 cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              className="accent-primary size-5 shrink-0"
              checked={form.refund}
              onChange={(event) => set("refund", event.target.checked)}
            />
            {t.expense.refund}
          </label>
        </div>
      </div>

      {/* A paper receipt? The scanner reads it and gives each line to whoever had it. */}
      {!editing && (
        <Link href={`${base}/scan?group=${group.id}`} className="bg-accent-soft text-on-accent flex items-center gap-3 rounded-[20px] p-4">
          <span aria-hidden="true" className="bg-surface flex size-11 shrink-0 items-center justify-center rounded-[14px]">
            <ScanLine className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t.expense.haveReceipt}</span>
            <span className="block text-[0.75rem] leading-4 opacity-80">{t.expense.haveReceiptHint}</span>
          </span>
          <span className="bg-primary text-on-primary inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[12px] px-3.5 text-[0.875rem] font-semibold">
            <Camera aria-hidden="true" className="size-4" />
            {t.expense.scan}
          </span>
        </Link>
      )}

      {/* What kind of expense: tap one, tap it again to take it back. */}
      <div>
        <p className="type-heading mb-3">{t.expense.category}</p>
        <div
          role="group"
          aria-label={t.expense.category}
          className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0"
        >
          {CATEGORIES.map((category) => {
            const chosen = form.category === category;
            const Icon = CATEGORY_LOOK[category].icon;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={chosen}
                onClick={() => set("category", chosen ? "" : category)}
                className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "flex size-14 items-center justify-center rounded-2xl transition-colors",
                    chosen ? "bg-primary text-on-primary shadow-[0_6px_16px_rgb(7_95_74/0.24)]" : "bg-surface text-ink-muted shadow-card",
                  )}
                >
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <span className={cn("w-full text-center text-[0.75rem] leading-4", chosen ? "text-ink font-semibold" : "text-ink-muted")}>
                  {t.expense.categories[category]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <fieldset className="card flex min-w-0 flex-col gap-3 p-5">
        <legend className={cn(label, "float-left w-full")}>{t.expense.paidBy}</legend>
        {!form.several ? (
          <div className="bg-surface-2 relative clear-both rounded-[14px]">
            {payer && (
              <Avatar
                name={payer.name}
                seed={payer.id}
                photo={payer.photoUrl}
                className="pointer-events-none absolute top-1/2 left-3 size-9 -translate-y-1/2"
              />
            )}
            <select
              aria-label={t.expense.paidBy}
              className="text-ink h-14 w-full bg-transparent pr-3 pl-15 font-semibold"
              value={form.payerId}
              onChange={(event) => set("payerId", event.target.value)}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.self ? `${member.name} (${t.common.you})` : member.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <ul className="clear-both flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3">
                <Avatar name={member.name} seed={member.id} photo={member.photoUrl} className="size-9" />
                <span className="min-w-0 flex-1 font-medium break-words">{member.name}</span>
                <input
                  aria-label={fill(t.expense.paidAmount, { name: member.name })}
                  className={cn(inputClass, "w-32 shrink-0 text-right tabular-nums")}
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

      <fieldset className="card min-w-0 p-5">
        <legend className="type-heading float-left mb-3 w-full">{t.expense.participants}</legend>
        <ul className="clear-both grid grid-cols-2 gap-2.5">
          {members.map((member) => {
            const on = !!form.included[member.id];
            const share = owed.get(member.id);
            return (
              <li key={member.id} className="min-w-0">
                <label
                  className={cn(
                    "has-focus-visible:outline-primary flex min-h-16 cursor-pointer items-center gap-2.5 rounded-[14px] p-2.5 transition-colors has-focus-visible:outline-2",
                    on ? "bg-surface-2" : "bg-surface-2/40",
                  )}
                >
                  <input
                    type="checkbox"
                    aria-label={fill(t.expense.participant, { name: member.name })}
                    className="sr-only"
                    checked={on}
                    onChange={(event) => set("included", { ...form.included, [member.id]: event.target.checked })}
                  />
                  <Avatar
                    name={member.name}
                    seed={member.id}
                    photo={member.photoUrl}
                    className={cn("size-10 transition", !on && "opacity-45 grayscale")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[0.875rem] font-semibold", !on && "text-ink-muted")}>{member.name}</span>
                    {on && (
                      <span className="text-ink-muted block text-[0.75rem] leading-4 tabular-nums" data-testid={`share-${member.id}`}>
                        {share === undefined ? "—" : formatMoney(share, form.currency, { locale })}
                      </span>
                    )}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full",
                      on ? "bg-primary text-on-primary" : "border-field border",
                    )}
                  >
                    {on && <Check className="size-3.5" strokeWidth={3.5} />}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="card flex min-w-0 flex-col gap-3 p-5">
        <legend className="type-heading float-left w-full">{t.expense.split}</legend>
        <div
          role="radiogroup"
          aria-label={t.expense.split}
          className="bg-surface-2 clear-both grid grid-cols-2 gap-1 rounded-[14px] p-1 sm:grid-cols-4"
        >
          {SPLIT_MODES.map((mode: SplitMode) => {
            const Icon = MODE_ICON[mode];
            const on = form.mode === mode;
            return (
              <label
                key={mode}
                className={cn(
                  "has-focus-visible:outline-primary flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] px-2 text-[0.875rem] font-semibold transition-colors has-focus-visible:outline-2",
                  on ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
                )}
              >
                <input type="radio" name="split-mode" className="sr-only" checked={on} onChange={() => set("mode", mode)} />
                <Icon aria-hidden="true" className="size-4" strokeWidth={2.4} />
                {t.expense.modes[mode]}
              </label>
            );
          })}
        </div>
        <p className="type-small text-ink-muted">{t.expense.modeHints[form.mode]}</p>

        {form.mode !== "equal" && included.length > 0 && (
          <ul className="flex flex-col gap-2">
            {included.map((member) => (
              <li key={member.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 font-medium break-words">{member.name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <input
                    aria-label={fill(t.expense.valueOf, { name: member.name, what: t.expense.modes[form.mode] })}
                    className={cn(inputClass, "h-11 w-24 text-right tabular-nums")}
                    inputMode={form.mode === "shares" ? "numeric" : "decimal"}
                    placeholder={form.mode === "shares" ? "1" : "0"}
                    autoComplete="off"
                    value={form.values[form.mode as Exclude<SplitMode, "equal">][member.id] ?? ""}
                    onChange={(event) =>
                      set("values", {
                        ...form.values,
                        [form.mode]: { ...form.values[form.mode as Exclude<SplitMode, "equal">], [member.id]: event.target.value },
                      })
                    }
                  />
                  {unit && <span className="type-small text-ink-muted w-8">{unit}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
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
      <Button type="submit" busy={busy} className="h-14 w-full text-[1.0625rem]">
        {busy ? t.expense.saving : editing ? t.expense.saveChanges : t.expense.save}
      </Button>
    </form>
  );
}
