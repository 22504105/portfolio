"use client";

import { CloudDownload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorText, useApp } from "@/components/app/AppProvider";
import { Button, Field, inputClass, Problem } from "@/components/ui/controls";
import type { Group } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { CURRENCIES } from "@/lib/money/currency";
import type { OfferedRate } from "@/lib/money/auto-rate";
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
  const [fetching, setFetching] = useState(false);
  /** What came of asking the source: a rate with its day, or that there is none to be had. */
  const [offer, setOffer] = useState<OfferedRate | "unavailable" | null>(null);

  /** Asks for the bank's latest rate and puts it in the form. Nothing is recorded until the person adds it. */
  async function fetchRate() {
    setFetching(true);
    setOffer(null);
    setProblem(null);
    try {
      const response = await fetch(`/api/rates?from=${from}&to=${group.baseCurrency}`);
      const body = (await response.json()) as OfferedRate | { error: string };
      if (!response.ok || "error" in body) setOffer("unavailable");
      else {
        setOffer(body);
        setRate(body.rate);
        // From the day it was published: the days before keep the rate they had.
        setDay(body.date);
      }
    } catch {
      setOffer("unavailable");
    }
    setFetching(false);
  }

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
      setOffer(null);
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
                <select
                  {...control}
                  className={inputClass}
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setOffer(null);
                  }}
                >
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
          {offer && offer !== "unavailable" && (
            <p role="status" className="bg-accent-soft text-on-accent rounded-control type-small p-3">
              {fill(t.rates.fetched, { date: formatDay(offer.date, locale, true) })}
            </p>
          )}
          {offer === "unavailable" && <Problem>{t.rates.unavailable}</Problem>}
          {problem && <Problem>{problem}</Problem>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" busy={busy}>
              {t.rates.add}
            </Button>
            <Button variant="ghost" busy={fetching} onClick={fetchRate}>
              <CloudDownload aria-hidden="true" className="size-4" />
              {t.rates.fetch}
            </Button>
          </div>
          <p className="text-ink-muted text-[0.75rem] leading-4">{t.rates.source}</p>
        </form>
      )}
    </section>
  );
}
