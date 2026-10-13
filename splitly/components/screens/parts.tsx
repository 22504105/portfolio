"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import type { Expense, GroupSummary } from "@/lib/domain/types";
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

/** A group in a list: its people's faces, its name, and where the viewer stands in it. */
export function GroupCard({ group }: { group: GroupSummary }) {
  const { t, base } = useApp();
  const people = group.members.filter((member) => !member.removedAt);
  return (
    <li>
      {/* Two rows, so a long name and a balance in two currencies never fight for one line. */}
      <Link href={`${base}/groups/${group.id}`} className="card hover:border-field block p-4 transition-colors">
        <span className="flex items-center gap-3">
          <AvatarStack people={people} max={2} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-semibold">{group.name}</span>
              {group.archivedAt && (
                <span className="type-small border-field text-ink-muted shrink-0 rounded-full border px-2 py-px">{t.groups.archived}</span>
              )}
            </span>
            <span className="text-ink-muted block truncate text-[0.75rem] leading-4">
              {fill(t.groups.people, { n: people.length })} • {fill(t.groups.expenses, { n: group.expenseCount })}
            </span>
          </span>
          <span className="bg-surface-2 text-ink-muted shrink-0 rounded-full px-2 py-0.5 text-[0.75rem] font-medium">
            {group.baseCurrency}
          </span>
          <ChevronRight aria-hidden="true" className="text-ink-muted size-5 shrink-0" />
        </span>
        <span className="border-line mt-3 block border-t pt-3 [&_li]:justify-start">
          <MyBalance net={group.myNet} />
        </span>
      </Link>
    </li>
  );
}

type ExpenseRowProps = {
  expense: Expense;
  names: ReadonlyMap<string, string>;
  /** Members' Telegram photos, for the payer's face. */
  photos?: ReadonlyMap<string, string | null | undefined>;
  /** A second line under the amount, and anything after it (a chevron). */
  under?: ReactNode;
  after?: ReactNode;
};

/**
 * One expense as Stitch draws it: the category's picture on a tinted square
 * with the payer's face on its corner, what it was, who paid and when, and
 * the amount. Words only inside: it goes into a link or a button.
 */
export function ExpenseRow({ expense, names, photos, under, after }: ExpenseRowProps) {
  const { t, locale } = useApp();
  const live = expense.status === "active";
  const payer = expense.payers[0];
  const payerName = names.get(payer?.memberId ?? "") ?? "?";
  const paid = expense.payers.length === 1 ? payerName : fill(t.expense.paidSeveral, { n: expense.payers.length });
  return (
    <span className="flex items-center gap-3">
      <span className="relative shrink-0">
        <CategoryIcon category={expense.category} className="size-12 rounded-2xl" />
        {expense.payers.length === 1 && (
          <Avatar
            name={payerName}
            seed={payer?.memberId}
            photo={photos?.get(payer?.memberId ?? "")}
            className="ring-surface absolute -right-1 -bottom-1 size-5 ring-2"
          />
        )}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className={cn("line-clamp-2 font-semibold break-words", !live && "text-ink-muted line-through")}>{expense.description}</span>
        <span className="text-ink-muted mt-0.5 block truncate text-[0.75rem] leading-4">
          {paid} • {formatDay(expense.date, locale)}
          {!live && <span className="text-warning font-semibold"> • {t.expense.status[expense.status as "cancelled" | "replaced"]}</span>}
          {expense.totalMinor < 0 && <span className="font-semibold"> • {t.expense.refundTag}</span>}
        </span>
      </span>
      <span className="shrink-0 pl-1 text-right">
        <span className={cn("block font-bold tabular-nums", !live && "text-ink-muted line-through")}>
          {formatMoney(expense.totalMinor, expense.currency, { locale })}
        </span>
        {under}
      </span>
      {after}
    </span>
  );
}
