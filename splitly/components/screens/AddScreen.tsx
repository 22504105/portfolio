"use client";

import { ArrowLeft, Check, Equal, Hash, Percent, PieChart, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { errorText, useApp, useLoad } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
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

const LEGEND = "type-small mb-2.5 font-semibold";

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

  return (
    <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-6">
      {/* What kind of expense: tap one, tap it again to take it back. */}
      <div role="group" aria-label={t.expense.category} className="grid grid-cols-3 gap-x-1 gap-y-2 sm:grid-cols-6">
        {CATEGORIES.map((category) => {
          const chosen = form.category === category;
          return (
            <button
              key={category}
              type="button"
              aria-pressed={chosen}
              onClick={() => set("category", chosen ? "" : category)}
              className="flex min-h-11 min-w-0 flex-col items-center gap-1.5 rounded-[14px] px-1 py-1.5"
            >
              <CategoryIcon
                category={category}
                round
                className={cn("size-12 transition-shadow", chosen && "ring-primary ring-offset-canvas ring-2 ring-offset-2")}
              />
              <span className={cn("text-center text-[0.75rem] leading-tight", chosen ? "text-ink font-semibold" : "text-ink-muted")}>
                {t.expense.categories[category]}
              </span>
            </button>
          );
        })}
      </div>

      <Field label={t.expense.amount} error={complaints("total")[0]}>
        {(control) => (
          <div className="flex gap-2">
            <input
              {...control}
              className={cn(inputClass, "h-14 text-[1.375rem] font-semibold tabular-nums")}
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => set("amount", event.target.value)}
              placeholder="0.00"
              autoComplete="off"
            />
            <select
              aria-label={t.expense.currency}
              className={cn(inputClass, "h-14 w-28 shrink-0 font-semibold")}
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

      <div className="grid items-end gap-x-3 gap-y-2 sm:grid-cols-2">
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
        <label className="type-small flex min-h-12 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="accent-primary size-5 shrink-0"
            checked={form.refund}
            onChange={(event) => set("refund", event.target.checked)}
          />
          {t.expense.refund}
        </label>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className={LEGEND}>{t.expense.paidBy}</legend>
        {!form.several ? (
          <div className="relative">
            {payer && (
              <Avatar
                name={payer.name}
                seed={payer.id}
                photo={payer.photoUrl}
                className="pointer-events-none absolute top-1/2 left-2.5 size-8 -translate-y-1/2"
              />
            )}
            <select
              aria-label={t.expense.paidBy}
              className={cn(inputClass, "pl-13 font-medium")}
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
          <ul className="flex flex-col gap-2">
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

      <fieldset className="min-w-0">
        <legend className={LEGEND}>{t.expense.participants}</legend>
        <ul className="grid grid-cols-4 gap-x-1 gap-y-3 sm:grid-cols-6">
          {members.map((member) => {
            const on = !!form.included[member.id];
            return (
              <li key={member.id} className="min-w-0">
                <label className="has-focus-visible:outline-primary flex min-h-11 cursor-pointer flex-col items-center gap-1.5 rounded-[12px] py-1 has-focus-visible:outline-2">
                  <input
                    type="checkbox"
                    aria-label={fill(t.expense.participant, { name: member.name })}
                    className="sr-only"
                    checked={on}
                    onChange={(event) => set("included", { ...form.included, [member.id]: event.target.checked })}
                  />
                  <span className="relative">
                    <Avatar
                      name={member.name}
                      seed={member.id}
                      photo={member.photoUrl}
                      className={cn(
                        "size-12 transition",
                        on ? "ring-primary ring-offset-canvas ring-2 ring-offset-2" : "opacity-45 grayscale",
                      )}
                    />
                    {on && (
                      <span
                        aria-hidden="true"
                        className="bg-primary text-on-primary ring-canvas absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full ring-2"
                      >
                        <Check className="size-3" strokeWidth={3.5} />
                      </span>
                    )}
                  </span>
                  <span className={cn("w-full truncate text-center text-[0.75rem]", on ? "text-ink font-medium" : "text-ink-muted")}>
                    {member.name}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className={LEGEND}>{t.expense.split}</legend>
        <div role="radiogroup" aria-label={t.expense.split} className="grid grid-cols-2 gap-2">
          {SPLIT_MODES.map((mode: SplitMode) => {
            const Icon = MODE_ICON[mode];
            const on = form.mode === mode;
            return (
              <label
                key={mode}
                className={cn(
                  "rounded-control has-focus-visible:outline-primary flex min-h-13 cursor-pointer items-center gap-2.5 border px-3 py-2 transition-colors has-focus-visible:outline-2",
                  on ? "border-primary bg-accent-soft text-ink" : "border-field bg-surface text-ink-muted hover:text-ink",
                )}
              >
                <input type="radio" name="split-mode" className="sr-only" checked={on} onChange={() => set("mode", mode)} />
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    on ? "bg-primary text-on-primary" : "bg-surface-2",
                  )}
                >
                  <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.6} />
                </span>
                <span className="type-small font-semibold">{t.expense.modes[mode]}</span>
              </label>
            );
          })}
        </div>
        <p className="type-small text-ink-muted">{t.expense.modeHints[form.mode]}</p>

        {included.length > 0 && (
          <ul className="card divide-line divide-y px-3.5">
            {included.map((member) => {
              const share = owed.get(member.id);
              return (
                <li key={member.id} className="flex min-h-14 items-center gap-3 py-1.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium break-words">{member.name}</span>
                    {form.mode !== "exact" && form.mode !== "equal" && share !== undefined && (
                      <span className="type-small text-ink-muted tabular-nums" data-testid={`share-${member.id}`}>
                        {formatMoney(share, form.currency, { locale })}
                      </span>
                    )}
                  </span>
                  {form.mode === "equal" ? (
                    <span className="type-small text-ink shrink-0 text-right font-medium tabular-nums" data-testid={`share-${member.id}`}>
                      {share === undefined ? "—" : formatMoney(share, form.currency, { locale })}
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <input
                        aria-label={fill(t.expense.valueOf, { name: member.name, what: t.expense.modes[form.mode] })}
                        className={cn(inputClass, "h-11 w-24 text-right tabular-nums")}
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
