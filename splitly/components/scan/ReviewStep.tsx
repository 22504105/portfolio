"use client";

import { ArrowLeft, CircleCheck, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Button, inputClass, Problem } from "@/components/ui/controls";
import type { Group } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { formatMoney, toDecimalString } from "@/lib/money/amount";
import { likelyDuplicates } from "@/lib/receipt/parse";
import type { LineKind } from "@/lib/receipt/types";
import { cn } from "@/lib/utils";
import { amountOf, emptyLine, needsLook, totals, type Draft, type DraftLine } from "./draft";

type ReviewProps = {
  group: Group;
  draft: Draft;
  /** False when the lines are being typed in from nothing. */ fromPhoto: boolean;
  onChange: (draft: Draft) => void;
  onBack: () => void;
  onContinue: () => void;
};

const ADJUSTMENTS: readonly LineKind[] = ["discount", "service", "tip", "tax", "adjustment"];

/**
 * The concept's "receipt recognised" screen: every line as it was read, to be
 * checked and corrected. Nothing goes further until each line has a name and
 * an amount, and the lines add up to what the receipt says (or the person
 * has said, with a line of its own, what the difference is).
 */
export function ReviewStep({ group, draft, fromPhoto, onChange, onBack, onContinue }: ReviewProps) {
  const { t, locale } = useApp();
  const currency = group.baseCurrency;
  const [tried, setTried] = useState(false);
  const money = (minor: number) => formatMoney(minor, currency, { locale });

  const sums = totals(draft, currency);
  const duplicates = new Set(
    likelyDuplicates(
      draft.lines.map((line) => ({ displayLabel: line.originalLabel || line.displayLabel, lineTotalMinor: amountOf(line, currency) ?? 0 })),
    ),
  );
  const nameless = draft.lines.filter((line) => line.displayLabel.trim() === "").length;
  const bought = draft.lines.some((line) => line.kind === "item");
  const printedBad = draft.printedTotal.trim() !== "" && sums.printedMinor === null;
  const off = sums.differenceMinor !== null && sums.differenceMinor !== 0;
  const ready = bought && nameless === 0 && sums.unreadable === 0 && !printedBad && !off && sums.sumMinor > 0;

  const edit = (id: string, change: Partial<DraftLine>) =>
    onChange({ ...draft, lines: draft.lines.map((line) => (line.id === id ? { ...line, ...change, reviewed: true } : line)) });
  const add = (kind: LineKind, change: Partial<DraftLine> = {}) =>
    onChange({
      ...draft,
      lines: [...draft.lines, { ...emptyLine(kind), displayLabel: kind === "item" ? "" : t.scan.kinds[kind], ...change }],
    });

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
        <h1 className="type-heading px-12 text-center text-[1.25rem]">{t.scan.reviewTitle}</h1>
      </div>

      <div className={cn("rounded-control mt-4 flex items-start gap-3 p-4", fromPhoto ? "bg-accent-soft text-on-accent" : "bg-surface-2")}>
        {fromPhoto && <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />}
        <div>
          <p className="font-semibold">{fromPhoto ? t.scan.recognised : t.scan.manualBanner}</p>
          <p className="type-small mt-0.5 opacity-85">{fromPhoto ? t.scan.recognisedHint : t.scan.manualHint}</p>
        </div>
      </div>

      <ul aria-label={t.scan.lines} className="mt-4 flex flex-col gap-2.5">
        {draft.lines.map((line, index) => {
          const amount = amountOf(line, currency);
          const low = needsLook(line);
          const noName = tried && line.displayLabel.trim() === "";
          const noAmount = (tried || line.amount.trim() !== "") && amount === null;
          const name = line.displayLabel.trim() || `${t.scan.kinds[line.kind]} ${index + 1}`;
          return (
            <li key={line.id} className={cn("card p-3.5", (low || duplicates.has(index)) && "border-warning/60")}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    aria-label={fill(t.scan.nameOf, { n: index + 1 })}
                    aria-invalid={noName || undefined}
                    className={cn(inputClass, "h-11 font-semibold")}
                    value={line.displayLabel}
                    placeholder={t.scan.namePlaceholder}
                    maxLength={200}
                    autoComplete="off"
                    onChange={(event) => edit(line.id, { displayLabel: event.target.value, source: line.originalLabel ? "user" : "none" })}
                  />
                  {line.kind === "item" && line.originalLabel && line.originalLabel !== line.displayLabel && (
                    <p className="type-small text-ink-muted mt-1 break-words" lang="und">
                      {fill(t.scan.original, { text: line.originalLabel })}
                    </p>
                  )}
                  {line.kind === "item" && line.source === "none" && line.originalLabel && (
                    <p className="type-small text-ink-muted mt-1">{t.scan.untranslated}</p>
                  )}
                  {line.kind !== "item" && <p className="type-small text-ink-muted mt-1">{t.scan.kinds[line.kind]}</p>}
                </div>
                <div className="flex w-30 shrink-0 items-center gap-1.5">
                  {(line.kind === "discount" || (line.kind === "adjustment" && /^[-−]/.test(line.amount.trim()))) && (
                    <span aria-hidden="true" className="text-ink-muted font-semibold">
                      −
                    </span>
                  )}
                  <input
                    aria-label={fill(t.scan.amountOf, { name })}
                    aria-invalid={noAmount || undefined}
                    className={cn(inputClass, "h-11 text-right font-semibold tabular-nums")}
                    inputMode="decimal"
                    value={line.amount}
                    placeholder="0.00"
                    autoComplete="off"
                    onChange={(event) => edit(line.id, { amount: event.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onChange({ ...draft, lines: draft.lines.filter((other) => other.id !== line.id) })}
                  aria-label={fill(t.scan.remove, { name })}
                  className="text-ink-muted hover:text-danger inline-flex size-11 shrink-0 items-center justify-center rounded-full"
                >
                  <Trash2 aria-hidden="true" className="size-4.5" />
                </button>
              </div>
              {line.kind === "item" && line.quantity !== "1" && (
                <p className="type-small text-ink-muted mt-1.5 tabular-nums">× {line.quantity}</p>
              )}
              {(low || duplicates.has(index)) && (
                <p className="type-small text-warning mt-2 flex items-start gap-1.5 font-medium">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {low ? t.scan.lowConfidence : t.scan.duplicate}
                </p>
              )}
              {noName && <Problem className="mt-2">{t.scan.needsName}</Problem>}
              {noAmount && <Problem className="mt-2">{t.scan.needsAmount}</Problem>}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" small onClick={() => add("item")}>
          <Plus aria-hidden="true" className="size-4" />
          {t.scan.addItem}
        </Button>
        {ADJUSTMENTS.map((kind) => (
          <Button key={kind} variant="ghost" small onClick={() => add(kind)}>
            <Plus aria-hidden="true" className="size-4" />
            {t.scan.kinds[kind]}
          </Button>
        ))}
      </div>

      {draft.unmatched.length > 0 && (
        <details className="card mt-4 p-4">
          <summary className="type-small flex min-h-11 cursor-pointer items-center font-semibold">
            {fill(t.scan.unmatched, { n: draft.unmatched.length })}
          </summary>
          <p className="type-small text-ink-muted mb-2">{t.scan.unmatchedHint}</p>
          <ul className="type-small flex flex-col gap-1 font-mono break-words" lang="und">
            {draft.unmatched.map((text, index) => (
              <li key={`${index}-${text}`}>{text}</li>
            ))}
          </ul>
        </details>
      )}

      <section aria-labelledby="scan-totals" className="card mt-4 flex flex-col gap-3 p-4">
        <h2 id="scan-totals" className="sr-only">
          {t.scan.totals}
        </h2>
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-ink-muted">{t.scan.sum}</span>
          <span className="font-semibold tabular-nums" data-testid="scan-sum">
            {money(sums.sumMinor)}
          </span>
        </p>
        <label className="flex items-center justify-between gap-3">
          <span className="text-ink-muted">{t.scan.printedTotal}</span>
          <input
            className={cn(inputClass, "h-11 w-36 text-right font-semibold tabular-nums")}
            aria-invalid={printedBad || undefined}
            inputMode="decimal"
            placeholder="—"
            autoComplete="off"
            value={draft.printedTotal}
            onChange={(event) => onChange({ ...draft, printedTotal: event.target.value })}
          />
        </label>
        {draft.includedTaxMinor !== null && (
          <p className="type-small text-ink-muted">{fill(t.scan.includedTax, { amount: money(draft.includedTaxMinor) })}</p>
        )}
        {sums.printedMinor === null && !printedBad && <p className="type-small text-ink-muted">{t.scan.noPrinted}</p>}
        {printedBad && <Problem>{t.scan.needsAmount}</Problem>}
        {sums.differenceMinor === 0 && (
          <p role="status" className="type-small text-positive flex items-center gap-1.5 font-semibold">
            <CircleCheck aria-hidden="true" className="size-4" />
            {t.scan.matches}
          </p>
        )}
        {off && sums.differenceMinor !== null && (
          <div role="status" className="border-warning/50 bg-warning/10 rounded-control flex flex-col items-start gap-2.5 border p-3.5">
            <p className="type-small text-warning font-semibold">
              {fill(sums.differenceMinor > 0 ? t.scan.short : t.scan.over, { amount: money(Math.abs(sums.differenceMinor)) })}
            </p>
            <p className="type-small text-ink-muted">{t.scan.differenceHint}</p>
            <Button
              variant="secondary"
              small
              onClick={() =>
                add("adjustment", {
                  displayLabel: t.scan.differenceLine,
                  amount: `${sums.differenceMinor! < 0 ? "-" : ""}${toDecimalString(Math.abs(sums.differenceMinor!), currency)}`,
                })
              }
            >
              {fill(t.scan.fixDifference, { amount: money(sums.differenceMinor) })}
            </Button>
          </div>
        )}
      </section>

      {tried && !ready && <Problem className="mt-4">{!bought ? t.scan.needsItem : off ? t.scan.needsMatch : t.scan.needsFix}</Problem>}
      <Button className="mt-4 h-14 w-full text-[1.0625rem]" onClick={() => (ready ? onContinue() : setTried(true))}>
        {t.scan.continue}
      </Button>
    </>
  );
}
