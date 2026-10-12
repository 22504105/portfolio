"use client";

import { ChevronRight, UsersRound } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app/AppProvider";
import type { GroupSummary } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/amount";
import { cn } from "@/lib/utils";

/** A day (YYYY-MM-DD) for reading: "12 Oct" / "12 окт." */
export function formatDay(day: string, locale: string, withYear = false): string {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${day.slice(0, 10)}T00:00:00Z`));
}

/** Adds up what the viewer is owed or owes across groups, currency by currency. */
export function totalNet(groups: readonly GroupSummary[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const group of groups) {
    if (group.archivedAt) continue;
    for (const [currency, net] of Object.entries(group.myNet)) total[currency] = (total[currency] ?? 0) + net;
  }
  for (const currency of Object.keys(total)) if (total[currency] === 0) delete total[currency];
  return total;
}

/**
 * Where the viewer stands, one line per currency. The direction is said in
 * words ("You are owed" / "You owe"), and the colour only repeats it.
 */
export function MyBalance({ net, large = false }: { net: Record<string, number>; large?: boolean }) {
  const { t, locale } = useApp();
  const lines = Object.entries(net).sort(([a], [b]) => a.localeCompare(b));
  if (lines.length === 0) {
    return (
      <div>
        <p className={large ? "type-amount" : "font-semibold"}>{t.balance.square}</p>
        {large && <p className="type-small text-ink-muted mt-1.5">{t.balance.squareHint}</p>}
      </div>
    );
  }
  return (
    <ul className={cn("flex flex-col", large ? "gap-3" : "gap-0.5")}>
      {lines.map(([currency, amount]) => (
        <li key={currency} className={cn(large ? "flex flex-col" : "type-small flex flex-wrap items-baseline justify-end gap-x-1.5")}>
          <span className={cn(large ? "type-small text-ink-muted" : "text-ink-muted")}>{amount > 0 ? t.balance.owed : t.balance.owe}</span>
          <span className={cn("font-semibold tabular-nums", large && "type-amount", amount > 0 ? "text-positive" : "text-danger")}>
            {formatMoney(Math.abs(amount), currency, { locale })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A group in a list: its name, how many people and expenses, and where the viewer stands in it. */
export function GroupCard({ group }: { group: GroupSummary }) {
  const { t, base } = useApp();
  const people = group.members.filter((member) => !member.removedAt).length;
  return (
    <li>
      <Link href={`${base}/groups/${group.id}`} className="card hover:border-field flex items-center gap-3.5 p-4 transition-colors">
        <span aria-hidden="true" className="bg-accent-soft text-on-accent flex size-11 shrink-0 items-center justify-center rounded-full">
          <UsersRound className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{group.name}</span>
            {group.archivedAt && (
              <span className="type-small border-field text-ink-muted shrink-0 rounded-full border px-2 py-px">{t.groups.archived}</span>
            )}
          </span>
          <span className="type-small text-ink-muted block">
            {fill(t.groups.people, { n: people })} · {fill(t.groups.expenses, { n: group.expenseCount })} · {group.baseCurrency}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <MyBalance net={group.myNet} />
        </span>
        <ChevronRight aria-hidden="true" className="text-ink-muted size-5 shrink-0" />
      </Link>
    </li>
  );
}
