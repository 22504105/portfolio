"use client";

import {
  ArrowRight,
  BadgePercent,
  Calculator,
  Check,
  CircleCheck,
  ConciergeBell,
  HandCoins,
  Landmark,
  Scale,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { errorText, useApp } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClass, Field, inputClass, Problem } from "@/components/ui/controls";
import { ProductIcon } from "@/components/ui/ProductIcon";
import type { Group, Member } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/amount";
import { allocateLines, buildReceiptExpense, totalsByMember } from "@/lib/receipt/build";
import type { LineKind } from "@/lib/receipt/types";
import type { ImageType } from "@/lib/receipt/image";
import { today } from "@/lib/split/form";
import { StoreError } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { amountOf, rememberCorrections, toReceiptLines, type Draft } from "./draft";
import { ScanHeader } from "./ScanHeader";

export type Outcome = {
  groupId: string;
  totalMinor: number;
  currency: string;
  payerId: string;
  owed: { memberId: string; owedMinor: number }[];
};

type AssignProps = {
  group: Group;
  draft: Draft;
  contentHash: string;
  mimeType: ImageType;
  onChange: (draft: Draft) => void;
  onBack: () => void;
  onDone: (outcome: Outcome) => void;
};

/**
 * The concept's "assigning the purchases" screen: for each thing bought, who
 * had it. Nobody is assumed: a line belongs to no one until someone is
 * chosen. What each person will owe is worked out as it is done, by the same
 * code that the store runs before it keeps anything.
 */
export function AssignStep({ group, draft, contentHash, mimeType, onChange, onBack, onDone }: AssignProps) {
  const { t, store, locale, changed, notify } = useApp();
  const members = useMemo(() => group.members.filter((member) => !member.removedAt), [group.members]);
  const currency = group.baseCurrency;
  const [description, setDescription] = useState(t.scan.descriptionDefault);
  const [payerId, setPayerId] = useState((members.find((member) => member.self) ?? members[0])?.id ?? "");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const submission = useRef<{ key: string; body: string } | null>(null);
  const payerField = useId();
  const money = (minor: number) => formatMoney(minor, currency, { locale });

  const lines = toReceiptLines(draft, currency, group.members);
  const totalMinor = lines.reduce((sum, line) => sum + (Number.isFinite(line.lineTotalMinor) ? line.lineTotalMinor : 0), 0);
  const unassigned = draft.lines.filter((line) => line.kind === "item" && Object.values(line.assigned).every((weight) => !weight)).length;
  // What each person owes so far, from the lines already given out.
  const given = lines.filter((line) => line.kind !== "item" || line.assigned.length > 0);
  const shares = unassigned === draft.lines.filter((line) => line.kind === "item").length ? null : allocateLines(given);
  const owed = new Map((shares ? totalsByMember(shares) : []).map((person) => [person.memberId, person.owedMinor]));

  const input = (allowDuplicate: boolean) => ({
    description,
    category: null,
    date: today(),
    currency,
    payers: [{ memberId: payerId, paidMinor: totalMinor }],
    receipt: { contentHash, mimeType, lines },
    ...(allowDuplicate ? { allowDuplicate: true } : {}),
  });
  const built = buildReceiptExpense(input(false), new Set(members.map((member) => member.id)));

  const toggle = (lineId: string, memberId: string) =>
    onChange({
      ...draft,
      lines: draft.lines.map((line) =>
        line.id === lineId ? { ...line, assigned: { ...line.assigned, [memberId]: line.assigned[memberId] ? 0 : 1 } } : line,
      ),
    });
  const everyone = (lineId: string, on: boolean) =>
    onChange({
      ...draft,
      lines: draft.lines.map((line) =>
        line.id === lineId ? { ...line, assigned: on ? Object.fromEntries(members.map((member) => [member.id, 1])) : {} } : line,
      ),
    });

  async function create(allowDuplicate = false) {
    setTried(true);
    setFailure(null);
    if (!built.ok) return;
    const body = JSON.stringify(input(allowDuplicate));
    if (submission.current?.body !== body) submission.current = { key: crypto.randomUUID(), body };
    setBusy(true);
    try {
      await store.createReceiptExpense(group.id, submission.current.key, input(allowDuplicate));
      rememberCorrections(draft.lines);
      changed();
      notify(t.expense.saved);
      onDone({ groupId: group.id, totalMinor: built.expense.totalMinor, currency, payerId, owed: built.splits });
    } catch (caught) {
      if (caught instanceof StoreError && caught.code === "duplicate_receipt") setDuplicate(true);
      else {
        const listed = caught instanceof StoreError ? (caught.details.problems ?? []) : [];
        setFailure(
          listed.length > 0
            ? listed
                .map(
                  (problem) =>
                    (t.scan.problems as Record<string, string>)[problem] ??
                    (t.expense.problems as Record<string, string>)[problem] ??
                    t.errors.invalid,
                )
                .join(" ")
            : errorText(t, caught),
        );
      }
      setBusy(false);
    }
  }

  const payer = members.find((member) => member.id === payerId);

  return (
    <>
      <ScanHeader title={t.scan.assignTitle} stage="assign" back={onBack} />

      <section className="bg-hero text-on-hero rounded-card mt-4 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={payer?.name ?? "?"} seed={payerId} photo={payer?.photoUrl} className="size-12 shrink-0 ring-2 ring-white/30" />
          <label htmlFor={payerField} className="type-label min-w-0 flex-1 text-white/85">
            {t.scan.payer}
          </label>
          <p className="shrink-0 text-right">
            <span className="block text-[0.75rem] leading-4 text-white/80">{t.scan.total}</span>
            <span className="text-[1.25rem] leading-7 font-bold tabular-nums">{money(totalMinor)}</span>
          </p>
        </div>
        <select id={payerField} className={cn(inputClass, "mt-3")} value={payerId} onChange={(event) => setPayerId(event.target.value)}>
          {members.map((member: Member) => (
            <option key={member.id} value={member.id}>
              {member.self ? `${member.name} (${t.common.you})` : member.name}
            </option>
          ))}
        </select>
      </section>
      <p className="type-small text-ink-muted mt-3">{t.scan.assignLead}</p>

      <ul aria-label={t.scan.lines} className="mt-3 flex flex-col gap-2.5">
        {draft.lines.map((line) => {
          const amount = amountOf(line, currency) ?? 0;
          const chosen = members.filter((member) => line.assigned[member.id]);
          const all = chosen.length === members.length;
          const missing = tried && line.kind === "item" && chosen.length === 0;
          const Icon = line.kind === "item" ? null : KIND_ICON[line.kind];
          return (
            <li key={line.id} className={cn("card p-4", missing && "border-danger")}>
              <div className="flex items-start gap-3">
                {line.kind === "item" ? (
                  // A picture of the kind of thing it is, by its printed name first: that is the one in a known language.
                  <ProductIcon label={`${line.originalLabel} ${line.displayLabel}`} />
                ) : (
                  <span
                    aria-hidden="true"
                    className="bg-surface-2 text-ink-muted flex size-11 shrink-0 items-center justify-center rounded-[12px]"
                  >
                    {Icon && <Icon className="size-5" />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">{line.displayLabel}</p>
                  {line.kind !== "item" && <p className="text-ink-muted text-[0.75rem] leading-4">{t.scan.kinds[line.kind]}</p>}
                  {line.kind === "item" && line.originalLabel && line.originalLabel !== line.displayLabel && (
                    <p className="text-ink-muted text-[0.75rem] leading-4 break-words" lang="und">
                      {line.originalLabel}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-bold tabular-nums">{money(amount)}</span>
              </div>
              {line.kind !== "item" && chosen.length === 0 && <p className="type-small text-ink-muted mt-2">{t.scan.spread}</p>}
              <div
                role="group"
                aria-label={fill(t.scan.whoHad, { item: line.displayLabel })}
                className="mt-2.5 flex flex-wrap items-center gap-1.5"
              >
                {members.map((member) => {
                  const on = !!line.assigned[member.id];
                  return (
                    <button
                      key={member.id}
                      type="button"
                      aria-pressed={on}
                      aria-label={fill(t.scan.takes, { name: member.name, item: line.displayLabel })}
                      title={member.name}
                      onClick={() => toggle(line.id, member.id)}
                      className="relative inline-flex size-11 items-center justify-center rounded-full"
                    >
                      <Avatar
                        name={member.name}
                        seed={member.id}
                        photo={member.photoUrl}
                        className={cn(
                          "size-10 transition",
                          on ? "ring-primary ring-offset-surface ring-2 ring-offset-2" : "opacity-40 grayscale",
                        )}
                      />
                      {on && (
                        <span
                          aria-hidden="true"
                          className="bg-primary text-on-primary ring-surface absolute right-0 bottom-0 flex size-4.5 items-center justify-center rounded-full ring-2"
                        >
                          <Check className="size-2.5" strokeWidth={4} />
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={all}
                  onClick={() => everyone(line.id, !all)}
                  className={cn(
                    "type-small ml-auto inline-flex h-11 items-center gap-1.5 rounded-full border px-4 font-semibold transition-colors",
                    all ? "bg-accent text-on-accent border-transparent" : "border-field bg-surface text-ink hover:bg-surface-2",
                  )}
                >
                  {fill(t.scan.everyone, { n: members.length })}
                  {all && <Check aria-hidden="true" className="size-4" />}
                </button>
              </div>
              {missing && <Problem className="mt-2">{t.scan.needsOwner}</Problem>}
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="scan-owed" className="card mt-4 p-4">
        <h2 id="scan-owed" className="type-heading flex items-center gap-2">
          <Calculator aria-hidden="true" className="text-ink-muted size-5 shrink-0" />
          {t.scan.perPerson}
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className={cn("rounded-control min-w-0 p-3", member.id === payerId ? "bg-accent-soft text-on-accent" : "bg-surface-2")}
            >
              <span className="flex items-center gap-1.5">
                <Avatar name={member.name} seed={member.id} photo={member.photoUrl} className="size-5 shrink-0" />
                <span className="truncate text-[0.8125rem] leading-5 font-medium">{member.name}</span>
              </span>
              <span className="mt-1 block text-[1.0625rem] leading-6 font-bold tabular-nums" data-testid={`owed-${member.id}`}>
                {money(owed.get(member.id) ?? 0)}
              </span>
              {member.id === payerId && <span className="block text-[0.75rem] leading-4 font-medium">{t.scan.payerTag}</span>}
            </li>
          ))}
        </ul>
        <ShareBar parts={members.map((member) => owed.get(member.id) ?? 0)} className="mt-3" />
        {unassigned > 0 && <p className="type-small text-warning mt-3 font-semibold">{fill(t.scan.leftToAssign, { n: unassigned })}</p>}
      </section>

      <Field
        className="mt-4"
        label={t.expense.description}
        error={tried && !built.ok && built.problems.includes("description") ? t.expense.problems.description : null}
      >
        {(control) => (
          <input
            {...control}
            className={inputClass}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={200}
            autoComplete="off"
          />
        )}
      </Field>

      {failure && <Problem className="mt-4">{failure}</Problem>}
      {duplicate ? (
        <div
          role="alertdialog"
          aria-labelledby="scan-duplicate"
          className="border-warning/50 bg-warning/10 rounded-control mt-4 flex flex-col items-start gap-3 border p-4"
        >
          <p id="scan-duplicate" className="font-semibold">
            {t.scan.duplicateTitle}
          </p>
          <p className="type-small text-ink-muted">{t.scan.duplicateBody}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" small busy={busy} onClick={() => create(true)}>
              {t.scan.addAnyway}
            </Button>
            <Button variant="ghost" small onClick={() => setDuplicate(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button className="mt-4 h-14 w-full justify-between pr-2.5 text-[1.0625rem]" busy={busy} onClick={() => create()}>
          <span className="flex items-center gap-2">
            {t.scan.create}
            <ArrowRight aria-hidden="true" className="size-5" />
          </span>
          <span aria-hidden="true" className="bg-on-primary/15 rounded-full px-3 py-1.5 text-[0.875rem] leading-5 tabular-nums">
            {money(totalMinor)}
          </span>
        </Button>
      )}
      <Button variant="ghost" className="text-ink-muted mt-1 w-full" onClick={onBack}>
        {t.scan.backToLines}
      </Button>
    </>
  );
}

const KIND_ICON: Record<Exclude<LineKind, "item">, LucideIcon> = {
  discount: BadgePercent,
  tax: Landmark,
  tip: HandCoins,
  service: ConciergeBell,
  adjustment: Scale,
};

const BAR_TONES = ["opacity-100", "opacity-70", "opacity-45", "opacity-25"];

/** How the total divides, drawn as one bar. A picture of the amounts written beside it, and nothing more. */
function ShareBar({ parts, className }: { parts: readonly number[]; className?: string }) {
  const shown = parts.map((part) => Math.max(0, part));
  const whole = shown.reduce((sum, part) => sum + part, 0);
  if (whole <= 0) return null;
  return (
    <div aria-hidden="true" className={cn("bg-surface-2 flex h-2 gap-0.5 overflow-hidden rounded-full", className)}>
      {shown.map((part, index) => (
        <span
          key={index}
          className={cn("bg-primary h-full", BAR_TONES[index % BAR_TONES.length])}
          style={{ width: `${(part / whole) * 100}%` }}
        />
      ))}
    </div>
  );
}

/** The concept's result screen: the total, each person's share of it, and who owes the payer what. */
export function ResultStep({ group, outcome, onAnother }: { group: Group; outcome: Outcome; onAnother: () => void }) {
  const { t, base, locale } = useApp();
  const people = new Map(group.members.map((member) => [member.id, member]));
  const payer = people.get(outcome.payerId);
  const debts = outcome.owed.filter((person) => person.memberId !== outcome.payerId && person.owedMinor !== 0);
  const money = (minor: number) => formatMoney(minor, outcome.currency, { locale });
  const percent = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", { style: "percent", maximumFractionDigits: 1 });

  return (
    <>
      <section className="bg-hero text-on-hero rounded-card p-5">
        <div className="flex items-center gap-3">
          <span className="bg-mint text-on-mint flex size-11 shrink-0 items-center justify-center rounded-full">
            <CircleCheck aria-hidden="true" className="size-6" />
          </span>
          <h1 className="type-heading">{t.scan.done}</h1>
        </div>
        <p className="type-label mt-5 text-white/80">{t.scan.total}</p>
        <p className="type-amount mt-1">{money(outcome.totalMinor)}</p>
        {payer && (
          <p className="rounded-control mt-4 flex items-center gap-2.5 bg-white/10 p-3 font-medium">
            <Avatar name={payer.name} seed={payer.id} photo={payer.photoUrl} className="size-8 shrink-0" />
            <span className="min-w-0 break-words">{fill(t.scan.paidBy, { name: payer.name })}</span>
          </p>
        )}
      </section>

      <h2 id="scan-shares" className="type-heading mt-6">
        {t.scan.shares}
      </h2>
      <ShareBar parts={outcome.owed.map((person) => person.owedMinor)} className="mt-3" />
      <ul aria-labelledby="scan-shares" className="card mt-3 flex flex-col gap-1 p-2">
        {outcome.owed.map((person) => {
          const member = people.get(person.memberId);
          const paid = person.memberId === outcome.payerId;
          return (
            <li
              key={person.memberId}
              className={cn("rounded-control flex items-center gap-3 px-2.5 py-2.5", paid && "bg-accent-soft text-on-accent")}
            >
              <Avatar name={member?.name ?? "?"} seed={person.memberId} photo={member?.photoUrl} className="size-10 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium break-words">{member?.name}</span>
                {paid && <span className="block text-[0.75rem] leading-4 font-medium">{t.scan.payerTag}</span>}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-bold tabular-nums">{money(person.owedMinor)}</span>
                {outcome.totalMinor > 0 && (
                  <span className={cn("block text-[0.75rem] leading-4 tabular-nums", !paid && "text-ink-muted")}>
                    {percent.format(person.owedMinor / outcome.totalMinor)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <h2 id="scan-debts" className="type-heading mt-6 flex items-center gap-2">
        {t.scan.whoOwes}
        {debts.length > 0 && (
          <span className="bg-accent-soft text-on-accent rounded-full px-2 py-0.5 text-[0.75rem] leading-4 font-semibold tabular-nums">
            {debts.length}
          </span>
        )}
      </h2>
      <ul aria-label={t.scan.whoOwes} className="mt-3 flex flex-col gap-2.5">
        {debts.length === 0 && <li className="card text-ink-muted p-4">{t.scan.nobodyOwes}</li>}
        {debts.map((person) => {
          const from = people.get(person.memberId);
          return (
            <li key={person.memberId} className="card flex items-center gap-3 p-4">
              <Avatar name={from?.name ?? "?"} seed={person.memberId} photo={from?.photoUrl} className="size-10 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5">
                <span className="font-medium break-words">{from?.name}</span>
                <ArrowRight aria-label={t.scan.owesTo} className="text-ink-muted size-4 shrink-0" />
                <span className="font-medium break-words">{payer?.name}</span>
              </span>
              <span className="shrink-0 font-bold tabular-nums">{money(person.owedMinor)}</span>
            </li>
          );
        })}
      </ul>

      <Link href={`${base}/groups/${outcome.groupId}`} className={cn(buttonClass("primary"), "mt-6 h-14 w-full text-[1.0625rem]")}>
        {t.scan.details}
      </Link>
      <Button variant="secondary" className="mt-2.5 h-14 w-full text-[1.0625rem]" onClick={onAnother}>
        {t.scan.another}
      </Button>
    </>
  );
}
