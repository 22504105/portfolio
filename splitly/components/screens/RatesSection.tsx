"use client";

import { Download } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorText, useApp } from "@/components/app/AppProvider";
import { Button, Field, inputClass, Problem } from "@/components/ui/controls";
import { toCsv } from "@/lib/analytics/summary";
import type { Group } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { toDecimalString } from "@/lib/money/amount";
import { CURRENCIES } from "@/lib/money/currency";
import { parseRate } from "@/lib/money/fx";
import { today } from "@/lib/split/form";
import { StoreError } from "@/lib/store/types";
import { formatDay } from "./parts";

/**
 * Exchange rates for a group, typed in by its people. A rate only changes
 * how totals are shown in the group's own currency; nobody's debt is ever
 * converted. A rate is never edited: a new one, with its day, is added
 * beside the old, so that what was shown last month can still be explained.
 */
export function RatesSection({ group, onFailure }: { group: Group; onFailure: (message: string | null) => void }) {
  const { t, store, locale, changed, notify } = useApp();
  const others = CURRENCIES.filter((code) => code !== group.baseCurrency);
  // The currency most likely wanted: one the group already has expenses in.
  const used = group.expenses.map((expense) => expense.currency).find((code) => code !== group.baseCurrency);
  const [from, setFrom] = useState<string>(used ?? others[0]);
  const [rate, setRate] = useState("");
  const [day, setDay] = useState(today());
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!parseRate(rate)) return setProblem(t.rates.rateProblem);
    setProblem(null);
    setBusy(true);
    onFailure(null);
    try {
      await store.addRate(group.id, { from, to: group.baseCurrency, rate, effectiveDate: day });
      changed();
      notify(t.rates.added);
      setRate("");
    } catch (caught) {
      if (caught instanceof StoreError && caught.code === "invalid")
        setProblem(caught.details.problems?.includes("date") ? t.expense.problems.date : t.rates.rateProblem);
      else onFailure(errorText(t, caught));
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="group-rates" className="mt-8">
      <h2 id="group-rates" className="type-heading mb-1">
        {t.rates.title}
      </h2>
      <p className="type-small text-ink-muted mb-3">{fill(t.rates.lead, { currency: group.baseCurrency })}</p>

      {group.rates.length > 0 && (
        <ul className="card divide-line mb-3 divide-y">
          {group.rates.map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-3">
              <span className="font-medium tabular-nums">
                1 {item.from} = {item.rate} {item.to}
              </span>
              <span className="type-small text-ink-muted">
                {fill(t.rates.since, { date: formatDay(item.effectiveDate, locale, true) })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!group.archivedAt && (
        <form onSubmit={add} noValidate className="card flex flex-col gap-3 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.rates.from}>
              {(control) => (
                <select {...control} className={inputClass} value={from} onChange={(event) => setFrom(event.target.value)}>
                  {others.map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={fill(t.rates.rate, { from, to: group.baseCurrency })}>
              {(control) => (
                <input
                  {...control}
                  className={inputClass}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  aria-invalid={problem ? true : undefined}
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                />
              )}
            </Field>
          </div>
          <Field label={t.rates.day} hint={t.rates.dayHint}>
            {(control) => (
              <input {...control} type="date" className={inputClass} value={day} onChange={(event) => setDay(event.target.value)} />
            )}
          </Field>
          {problem && <Problem>{problem}</Problem>}
          <Button type="submit" variant="secondary" busy={busy} className="self-start">
            {t.rates.add}
          </Button>
        </form>
      )}
    </section>
  );
}

/** The group's expenses as a spreadsheet file, made in the browser from what is already on screen. */
export function ExportButton({ group }: { group: Group }) {
  const { t } = useApp();
  function download() {
    const names = new Map(group.members.map((member) => [member.id, member.name]));
    const csv = toCsv(group.expenses, names, [...t.export.columns], toDecimalString);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    // A name a file system will take, whatever the group is called.
    link.download = `splitly-${
      group.name
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "group"
    }.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" small onClick={download} disabled={group.expenses.length === 0}>
        <Download aria-hidden="true" className="size-4" />
        {t.export.button}
      </Button>
      <p className="type-small text-ink-muted">{t.export.hint}</p>
    </div>
  );
}
