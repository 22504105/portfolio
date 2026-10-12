"use client";

import { ArrowLeft, ArrowRight, Check, CircleCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { errorText, useApp } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClass, Field, inputClass, Problem } from "@/components/ui/controls";
import type { Group, Member } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/amount";
import { allocateLines, buildReceiptExpense, totalsByMember } from "@/lib/receipt/build";
import type { ImageType } from "@/lib/receipt/image";
import { today } from "@/lib/split/form";
import { StoreError } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { amountOf, rememberCorrections, toReceiptLines, type Draft } from "./draft";

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

  return (
    <>
      <div className="relative flex min-h-11 items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          aria-label={t.common.back}
          className="text-ink-muted hover:text-ink absolute top-0 left-0 inline-flex size-11 items-center justify-center rounded-full"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </button>
        <h1 className="type-heading px-12 text-center text-[1.25rem]">{t.scan.assignTitle}</h1>
      </div>
      <p className="text-ink-muted mt-2 text-center">{t.scan.assignLead}</p>

      <ul aria-label={t.scan.lines} className="mt-4 flex flex-col gap-2.5">
        {draft.lines.map((line) => {
          const amount = amountOf(line, currency) ?? 0;
          const chosen = members.filter((member) => line.assigned[member.id]);
          const all = chosen.length === members.length;
          const missing = tried && line.kind === "item" && chosen.length === 0;
          return (
            <li key={line.id} className={cn("card p-3.5", missing && "border-danger")}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 font-semibold break-words">{line.displayLabel}</span>
                <span className="shrink-0 font-semibold tabular-nums">{money(amount)}</span>
              </div>
              {line.kind !== "item" && chosen.length === 0 && <p className="type-small text-ink-muted mt-1">{t.scan.spread}</p>}
              <div
                role="group"
                aria-label={fill(t.scan.whoHad, { item: line.displayLabel })}
                className="mt-2.5 flex flex-wrap items-center gap-1.5"
              >
                <button
                  type="button"
                  aria-pressed={all}
                  onClick={() => everyone(line.id, !all)}
                  className={cn(
                    "type-small h-11 rounded-full border px-3.5 font-semibold transition-colors",
                    all ? "border-primary bg-primary text-on-primary" : "border-field bg-surface text-ink hover:bg-surface-2",
                  )}
                >
                  {fill(t.scan.everyone, { n: members.length })}
                </button>
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
              </div>
              {missing && <Problem className="mt-2">{t.scan.needsOwner}</Problem>}
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="scan-owed" className="card mt-4 p-4">
        <h2 id="scan-owed" className="type-small mb-2 font-semibold">
          {t.scan.perPerson}
        </h2>
        <ul className="flex flex-col gap-1.5">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar name={member.name} seed={member.id} photo={member.photoUrl} className="size-8" />
                <span className="truncate">{member.name}</span>
              </span>
              <span className="font-semibold tabular-nums" data-testid={`owed-${member.id}`}>
                {money(owed.get(member.id) ?? 0)}
              </span>
            </li>
          ))}
        </ul>
        {unassigned > 0 && <p className="type-small text-warning mt-3 font-semibold">{fill(t.scan.leftToAssign, { n: unassigned })}</p>}
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={t.scan.payer}>
          {(control) => (
            <select {...control} className={inputClass} value={payerId} onChange={(event) => setPayerId(event.target.value)}>
              {members.map((member: Member) => (
                <option key={member.id} value={member.id}>
                  {member.self ? `${member.name} (${t.common.you})` : member.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
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
      </div>

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
        <Button className="mt-4 h-14 w-full text-[1.0625rem]" busy={busy} onClick={() => create()}>
          {t.scan.create}
        </Button>
      )}
    </>
  );
}

/** The concept's result screen: the total, and who owes the payer what. */
export function ResultStep({ group, outcome, onAnother }: { group: Group; outcome: Outcome; onAnother: () => void }) {
  const { t, base, locale } = useApp();
  const people = new Map(group.members.map((member) => [member.id, member]));
  const payer = people.get(outcome.payerId);
  const debts = outcome.owed.filter((person) => person.memberId !== outcome.payerId && person.owedMinor !== 0);

  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <span className="bg-positive/15 text-positive flex size-16 items-center justify-center rounded-full">
        <CircleCheck aria-hidden="true" className="size-9" />
      </span>
      <h1 className="type-heading mt-5 text-[1.25rem]">{t.scan.done}</h1>
      <p className="type-amount mt-2">{formatMoney(outcome.totalMinor, outcome.currency, { locale })}</p>

      <ul aria-label={t.scan.whoOwes} className="card divide-line mt-6 w-full divide-y text-left">
        {debts.length === 0 && <li className="text-ink-muted p-4">{t.scan.nobodyOwes}</li>}
        {debts.map((person) => {
          const from = people.get(person.memberId);
          return (
            <li key={person.memberId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={from?.name ?? "?"} seed={person.memberId} photo={from?.photoUrl} className="size-10" />
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5">
                <span className="font-medium break-words">{from?.name}</span>
                <ArrowRight aria-label={t.scan.owesTo} className="text-ink-muted size-4 shrink-0" />
                <span className="font-medium break-words">{payer?.name}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatMoney(person.owedMinor, outcome.currency, { locale })}</span>
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
    </div>
  );
}
