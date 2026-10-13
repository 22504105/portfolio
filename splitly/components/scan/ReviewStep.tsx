"use client";

import { ArrowRight, BadgeCheck, CheckCheck, CircleCheck, CirclePlus, Keyboard, Plus, Trash2, TriangleAlert } from "lucide-react";
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
import { ScanHeader } from "./ScanHeader";

type ReviewProps = {
  group: Group;
  draft: Draft;
  /** False when the lines are being typed in from nothing. */ fromPhoto: boolean;
  /** Whether names are being translated, and the way to change that. */
  translate: boolean;
  onTranslate: (on: boolean) => void;
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
export function ReviewStep({ group, draft, fromPhoto, translate, onTranslate, onChange, onBack, onContinue }: ReviewProps) {
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
      <ScanHeader title={t.scan.reviewTitle} stage="review" back={onBack} />

      <div className={cn("rounded-card mt-4 flex items-start gap-3 p-4", fromPhoto ? "bg-accent-soft text-on-accent" : "bg-surface-2")}>
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            fromPhoto ? "bg-primary text-on-primary" : "bg-surface text-ink-muted",
          )}
        >
          {fromPhoto ? <BadgeCheck className="size-5" /> : <Keyboard className="size-5" />}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{fromPhoto ? t.scan.recognised : t.scan.manualBanner}</p>
          <p className="type-small mt-0.5 opacity-85">{fromPhoto ? t.scan.recognisedHint : t.scan.manualHint}</p>
        </div>
      </div>

      {fromPhoto && (
        <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-2.5 py-1.5">
          <input
            type="checkbox"
            className="accent-primary mt-0.5 size-5 shrink-0"
            checked={translate}
            onChange={(event) => onTranslate(event.target.checked)}
          />
          <span>
            <span className="type-small block font-semibold">{t.scan.translate}</span>
            <span className="type-small text-ink-muted block">{t.scan.translateHint}</span>
          </span>
        </label>
      )}

      <h2 id="scan-lines" className="type-heading mt-5 flex items-center gap-2">
        {t.scan.lines}
        <span className="bg-surface-2 text-ink-muted rounded-full px-2 py-0.5 text-[0.75rem] leading-4 font-semibold tabular-nums">
          {draft.lines.length}
        </span>
      </h2>
      <ul aria-labelledby="scan-lines" className="mt-3 flex flex-col gap-2.5">
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
                  {translate && line.kind === "item" && line.source === "none" && line.originalLabel && (
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
              {fromPhoto && line.reviewed && !duplicates.has(index) && (
                <p className="bg-accent-soft text-on-accent mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] leading-4 font-medium">
                  <CheckCheck aria-hidden="true" className="size-3.5" />
                  {t.scan.checked}
                </p>
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

      <button
        type="button"
        onClick={() => add("item")}
        className="bg-accent-soft text-on-accent rounded-card hover:bg-accent mt-3 flex h-14 w-full items-center justify-center gap-2 font-semibold transition-colors"
      >
        <CirclePlus aria-hidden="true" className="size-5" />
        {t.scan.addItem}
      </button>
      <div className="mt-2 flex flex-wrap gap-2">
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
        <p className="border-line flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t pt-3">
          <span className="type-label text-ink">{t.scan.sum}</span>
          <span className="type-amount text-primary" data-testid="scan-sum">
            {money(sums.sumMinor)}
          </span>
        </p>
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
      <Button className="mt-4 h-14 w-full justify-between pr-2.5 text-[1.0625rem]" onClick={() => (ready ? onContinue() : setTried(true))}>
        <span className="flex items-center gap-2">
          {t.scan.continue}
          <ArrowRight aria-hidden="true" className="size-5" />
        </span>
        <span aria-hidden="true" className="bg-on-primary/15 rounded-full px-3 py-1.5 text-[0.875rem] leading-5 tabular-nums">
          {money(sums.sumMinor)}
        </span>
      </Button>
    </>
  );
}
