"use client";

import { useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { inputClass } from "@/components/ui/controls";
import { monthOf, summarise, type Period } from "@/lib/analytics/summary";
import type { Group } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/amount";
import { today } from "@/lib/split/form";
import { cn } from "@/lib/utils";
import { formatDay } from "./parts";

const PERIODS = ["month", "last", "all"] as const;

/**
 * The concept's analytics: what the group spent in a period, the average
 * expense, spending day by day, and the split by category or by person. All
 * in the group's own currency; an expense in another currency is converted
 * at the rate recorded for its day, and left out (and said to be) if there
 * is none.
 */
export function AnalyticsView({ group }: { group: Group }) {
  const { t, locale } = useApp();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("month");
  const [by, setBy] = useState<"category" | "member">("category");
  const range: Period | null = period === "all" ? null : monthOf(today(), period === "last" ? -1 : 0);
  const summary = summarise(group.expenses, group.baseCurrency, group.rates, range);
  const people = new Map(group.members.map((member) => [member.id, member]));
  const money = (minor: number, currency = group.baseCurrency) => formatMoney(minor, currency, { locale });
  const percent = (share: number) =>
    `${new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: 0 }).format(share / 100)}%`;
  const tallest = Math.max(1, ...summary.byDay.map((day) => day.totalMinor));
  const converted = Object.keys(summary.native).some((currency) => currency !== group.baseCurrency) && summary.count > 0;

  return (
    <>
      <div className="mt-5 flex items-center justify-between gap-3">
        <h2 className="type-heading">{t.analytics.title}</h2>
        <select
          aria-label={t.analytics.period}
          className={cn(inputClass, "type-small h-11 w-auto font-semibold")}
          value={period}
          onChange={(event) => setPeriod(event.target.value as (typeof PERIODS)[number])}
        >
          {PERIODS.map((option) => (
            <option key={option} value={option}>
              {t.analytics.periods[option]}
            </option>
          ))}
        </select>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <dt className="type-small text-ink-muted">{t.analytics.total}</dt>
          <dd className="mt-1 text-[1.375rem] font-semibold tabular-nums" data-testid="analytics-total">
            {money(summary.totalMinor)}
          </dd>
        </div>
        <div className="card p-4">
          <dt className="type-small text-ink-muted">{t.analytics.average}</dt>
          <dd className="mt-1 text-[1.375rem] font-semibold tabular-nums" data-testid="analytics-average">
            {summary.averageMinor === null ? "—" : money(summary.averageMinor)}
          </dd>
        </div>
      </dl>

      {converted && <p className="type-small text-ink-muted mt-3">{fill(t.analytics.converted, { currency: group.baseCurrency })}</p>}
      {summary.leftOut.length > 0 && (
        <p role="status" className="type-small border-warning/50 bg-warning/10 rounded-control mt-3 border p-3.5">
          <span className="text-warning font-semibold">{t.analytics.leftOut} </span>
          {summary.leftOut
            .map((row) => fill(t.analytics.leftOutRow, { n: row.count, amount: money(row.totalMinor, row.currency) }))
            .join("; ")}
          . {fill(t.analytics.leftOutHint, { currency: group.baseCurrency })}
        </p>
      )}

      {summary.count === 0 ? (
        <p className="card text-ink-muted mt-4 p-5">{t.analytics.empty}</p>
      ) : (
        <>
          {/* Spending day by day: bars to look at, and the same figures as a list for whoever cannot see them. */}
          <div className="card mt-4 p-4">
            <div aria-hidden="true" className="flex h-32 items-end gap-1.5">
              {summary.byDay.map((day) => (
                <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch">
                  <div
                    className={cn("w-full max-w-9 rounded-t-[6px]", day.totalMinor >= 0 ? "bg-primary" : "bg-danger-fill")}
                    style={{ height: `${Math.max(3, Math.round((Math.abs(day.totalMinor) / tallest) * 100))}%` }}
                  />
                </div>
              ))}
            </div>
            <ul className="sr-only">
              {summary.byDay.map((day) => (
                <li key={day.day}>
                  {formatDay(day.day, locale)}: {money(day.totalMinor)}
                </li>
              ))}
            </ul>
            <div aria-hidden="true" className="type-small text-ink-muted mt-2 flex justify-between">
              <span>{formatDay(summary.byDay[0].day, locale)}</span>
              {summary.byDay.length > 1 && <span>{formatDay(summary.byDay[summary.byDay.length - 1].day, locale)}</span>}
            </div>
          </div>

          <div role="radiogroup" aria-label={t.analytics.by} className="bg-surface-2 rounded-control mt-4 grid grid-cols-2 gap-1 p-1">
            {(["category", "member"] as const).map((option) => (
              <label
                key={option}
                className={cn(
                  "type-small has-focus-visible:outline-primary flex h-11 cursor-pointer items-center justify-center rounded-[9px] px-2 font-semibold transition-colors has-focus-visible:outline-2",
                  by === option ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
                )}
              >
                <input type="radio" name="analytics-by" className="sr-only" checked={by === option} onChange={() => setBy(option)} />
                {t.analytics.bys[option]}
              </label>
            ))}
          </div>

          <ul aria-label={t.analytics.bys[by]} className="card divide-line mt-3 divide-y">
            {by === "category"
              ? summary.byCategory.map((row) => (
                  <li key={row.category ?? "none"} className="flex items-center gap-3 px-4 py-3">
                    <CategoryIcon category={row.category} round />
                    <span className="min-w-0 flex-1 font-medium">
                      {row.category ? t.expense.categories[row.category] : t.expense.noCategory}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{money(row.totalMinor)}</span>
                    <span className="type-small text-ink-muted w-11 shrink-0 text-right tabular-nums">{percent(row.share)}</span>
                  </li>
                ))
              : summary.byMember.map((row) => (
                  <li key={row.memberId} className="flex items-center gap-3 px-4 py-3">
                    <Avatar
                      name={people.get(row.memberId)?.name ?? "?"}
                      seed={row.memberId}
                      photo={people.get(row.memberId)?.photoUrl}
                      className="size-10"
                    />
                    <span className="min-w-0 flex-1 font-medium break-words">{people.get(row.memberId)?.name ?? "?"}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{money(row.owedMinor)}</span>
                    <span className="type-small text-ink-muted w-11 shrink-0 text-right tabular-nums">{percent(row.share)}</span>
                  </li>
                ))}
          </ul>
          {by === "member" && <p className="type-small text-ink-muted mt-2">{t.analytics.memberHint}</p>}
        </>
      )}
    </>
  );
}
