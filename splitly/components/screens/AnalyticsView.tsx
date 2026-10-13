"use client";

import { ChartColumn } from "lucide-react";
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

  const me = group.members.find((member) => member.self);
  const mine = me ? summary.byMember.find((row) => row.memberId === me.id) : undefined;
  const width = (share: number) => `${Math.min(100, Math.max(0, share / 100))}%`;

  return (
    <>
      <div className="mt-5 flex items-center justify-between gap-3">
        <h2 className="type-heading">{t.analytics.title}</h2>
        <select
          aria-label={t.analytics.period}
          className={cn(inputClass, "type-small h-11 w-auto rounded-full font-semibold")}
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

      <section aria-label={t.analytics.total} className="bg-hero text-on-hero rounded-card mt-3 p-5">
        <dl>
          <div>
            <dt className="type-small text-white/80">{t.analytics.total}</dt>
            <dd className="type-amount mt-1" data-testid="analytics-total">
              {money(summary.totalMinor)}
            </dd>
          </div>
          <div className="type-small mt-3 inline-flex flex-wrap items-center gap-x-1.5 rounded-full bg-white/10 px-3 py-1.5">
            <dt className="text-white/85">{t.analytics.average}:</dt>
            <dd className="font-semibold tabular-nums" data-testid="analytics-average">
              {summary.averageMinor === null ? "—" : money(summary.averageMinor)}
            </dd>
          </div>
        </dl>
        <p className="type-small mt-2 text-white/80">{fill(t.analytics.count, { n: summary.count })}</p>
        {me && mine && (
          <p className="mt-4 flex items-center gap-2.5 border-t border-white/15 pt-3.5">
            <Avatar name={me.name} seed={me.id} photo={me.photoUrl} className="size-8 shrink-0" />
            <span className="type-small min-w-0 flex-1">{t.analytics.yourShare}</span>
            <span className="shrink-0 font-semibold tabular-nums">{money(mine.owedMinor)}</span>
            <span className="type-small shrink-0 text-white/80 tabular-nums">{percent(mine.share)}</span>
          </p>
        )}
      </section>

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
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{t.analytics.byDay}</h3>
              <span aria-hidden="true" className="bg-accent-soft text-on-accent flex size-9 items-center justify-center rounded-full">
                <ChartColumn className="size-4.5" />
              </span>
            </div>
            <div aria-hidden="true" className="mt-3 flex h-32 items-end gap-1.5">
              {summary.byDay.map((day) => (
                <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch">
                  <div
                    className={cn(
                      "w-full max-w-12 rounded-[8px]",
                      day.totalMinor < 0 ? "bg-danger-fill" : Math.abs(day.totalMinor) === tallest ? "bg-primary" : "bg-accent",
                    )}
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

          <div role="radiogroup" aria-label={t.analytics.by} className="bg-surface-2 mt-4 grid grid-cols-2 gap-1 rounded-full p-1">
            {(["category", "member"] as const).map((option) => (
              <label
                key={option}
                className={cn(
                  "type-small has-focus-visible:outline-primary flex h-11 cursor-pointer items-center justify-center rounded-full px-2 font-semibold transition-colors has-focus-visible:outline-2",
                  by === option ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
                )}
              >
                <input type="radio" name="analytics-by" className="sr-only" checked={by === option} onChange={() => setBy(option)} />
                {t.analytics.bys[option]}
              </label>
            ))}
          </div>

          <ul aria-label={t.analytics.bys[by]} className="mt-3 flex flex-col gap-2.5">
            {by === "category"
              ? summary.byCategory.map((row) => (
                  <li key={row.category ?? "none"} className="card p-4">
                    <div className="flex items-center gap-3">
                      <CategoryIcon category={row.category} round />
                      <span className="min-w-0 flex-1 font-semibold break-words">
                        {row.category ? t.expense.categories[row.category] : t.expense.noCategory}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-bold tabular-nums">{money(row.totalMinor)}</span>
                        <span className="text-ink-muted block text-[0.75rem] leading-4 tabular-nums">{percent(row.share)}</span>
                      </span>
                    </div>
                    <div aria-hidden="true" className="bg-surface-2 mt-3 h-1.5 overflow-hidden rounded-full">
                      <div className="bg-primary h-full rounded-full" style={{ width: width(row.share) }} />
                    </div>
                  </li>
                ))
              : summary.byMember.map((row) => (
                  <li key={row.memberId} className="card p-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={people.get(row.memberId)?.name ?? "?"}
                        seed={row.memberId}
                        photo={people.get(row.memberId)?.photoUrl}
                        className="size-11 shrink-0"
                      />
                      <span className="min-w-0 flex-1 font-semibold break-words">{people.get(row.memberId)?.name ?? "?"}</span>
                      <span className="shrink-0 text-right">
                        <span className="block font-bold tabular-nums">{money(row.owedMinor)}</span>
                        <span className="text-ink-muted block text-[0.75rem] leading-4 tabular-nums">{percent(row.share)}</span>
                      </span>
                    </div>
                    <div aria-hidden="true" className="bg-surface-2 mt-3 h-1.5 overflow-hidden rounded-full">
                      <div className="bg-primary h-full rounded-full" style={{ width: width(row.share) }} />
                    </div>
                  </li>
                ))}
          </ul>
          {by === "member" && <p className="type-small text-ink-muted mt-2">{t.analytics.memberHint}</p>}
        </>
      )}
    </>
  );
}
