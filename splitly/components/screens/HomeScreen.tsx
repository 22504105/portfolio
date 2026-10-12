"use client";

import { Plus, ScanLine } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { errorText, useApp, useLoad } from "@/components/app/AppProvider";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { buttonClass, Loading, Problem } from "@/components/ui/controls";
import { spentOf } from "@/lib/balances/net";
import type { GroupSummary } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/amount";
import { cn } from "@/lib/utils";
import { ExpenseRow, MyBalance, totalNet } from "./parts";

/** The first screen, after the concept: a greeting, one group on a deep green card, and what was spent lately. */
export function HomeScreen() {
  const { t, base, account } = useApp();
  const { data: groups, error } = useLoad((store) => store.listGroups(), "groups");
  const open = groups?.filter((group) => !group.archivedAt) ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const group = open.find((candidate) => candidate.id === picked) ?? open[0];
  const self = group?.members.find((member) => member.self);
  const name = account?.displayName.split(" ")[0] ?? self?.name;

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar name={self?.name ?? name ?? "Splitly"} seed={self?.id} photo={self?.photoUrl ?? account?.photoUrl} className="size-11" />
        <h1 className="type-heading text-[1.25rem]">
          {name ? fill(t.home.greeting, { name }) : t.home.greetingPlain} <span aria-hidden="true">👋</span>
        </h1>
      </div>

      {error && <Problem className="mt-6">{errorText(t, error)}</Problem>}
      {!groups && !error && <Loading label={t.common.loading} />}

      {groups && open.length === 0 && (
        <div className="card mt-6 flex flex-col items-start gap-4 p-5">
          <p className="text-ink-muted">{t.home.noGroups}</p>
          <Link href={`${base}/groups`} className={buttonClass("primary")}>
            <Plus aria-hidden="true" className="size-5" />
            {t.groups.create}
          </Link>
        </div>
      )}

      {group && (
        <>
          {/* Which group the card shows. */}
          <div className="mt-5 flex items-center gap-2">
            <div
              role="radiogroup"
              aria-label={t.home.pick}
              className="bg-surface-2 rounded-control flex min-w-0 flex-1 gap-1 overflow-x-auto p-1"
            >
              {open.map((candidate) => (
                <label
                  key={candidate.id}
                  className={cn(
                    "type-small has-focus-visible:outline-primary flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-[9px] px-3 font-semibold whitespace-nowrap transition-colors has-focus-visible:outline-2",
                    candidate.id === group.id ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
                  )}
                >
                  <input
                    type="radio"
                    name="home-group"
                    className="sr-only"
                    checked={candidate.id === group.id}
                    onChange={() => setPicked(candidate.id)}
                  />
                  <span className="truncate">{candidate.name}</span>
                </label>
              ))}
            </div>
          </div>

          <GroupHero key={group.id} group={group} />

          <section aria-labelledby="home-balance" className="card mt-8 p-5 sm:p-6">
            <h2 id="home-balance" className="type-label text-ink-muted mb-3">
              {t.balance.title}
            </h2>
            <MyBalance net={totalNet(groups ?? [])} large />
            {Object.keys(totalNet(groups ?? [])).length > 1 && <p className="type-small text-ink-muted mt-4">{t.balance.apart}</p>}
          </section>
        </>
      )}
    </>
  );
}

/** The deep green card for one group, and under it the group's latest expenses. */
function GroupHero({ group }: { group: GroupSummary }) {
  const { t, base, locale } = useApp();
  const { data: full } = useLoad((store) => store.getGroup(group.id), `group:${group.id}`);
  const people = group.members.filter((member) => !member.removedAt);
  const names = new Map(group.members.map((member) => [member.id, member.name]));
  const photos = new Map(group.members.map((member) => [member.id, member.photoUrl]));
  const spent = Object.entries(full ? spentOf(full.expenses) : {}).sort(
    ([a], [b]) => Number(b === group.baseCurrency) - Number(a === group.baseCurrency) || a.localeCompare(b),
  );
  const recent = full?.expenses.filter((expense) => expense.status === "active").slice(0, 5) ?? [];

  return (
    <>
      <section aria-label={group.name} className="bg-hero text-on-hero shadow-raised mt-4 rounded-[20px] p-5 sm:p-6">
        <h2 className="text-[1.0625rem] font-semibold">{group.name}</h2>
        <p className="type-small mt-3 text-white/75">{t.home.spent}</p>
        {spent.length === 0 ? (
          <p className="type-amount mt-1 text-[1.75rem]">{full ? t.home.nothingSpent : "…"}</p>
        ) : (
          spent.map(([currency, amount], index) => (
            <p key={currency} className={cn("tabular-nums", index === 0 ? "type-amount mt-1" : "mt-1 font-semibold text-white/85")}>
              {formatMoney(amount, currency, { locale })}
            </p>
          ))
        )}
        <AvatarStack people={people} className="mt-4" ring="ring-[#124436]" />
        <div className="mt-5 flex flex-col gap-2.5">
          <Link
            href={`${base}/add?group=${group.id}`}
            className="rounded-control inline-flex h-12 items-center justify-center gap-2 bg-white px-5 font-semibold text-[#0E3A2E] transition-colors hover:bg-white/90"
          >
            <Plus aria-hidden="true" className="size-5" />
            {t.group.addExpense}
          </Link>
          <Link
            href={`${base}/scan?group=${group.id}`}
            className="rounded-control inline-flex h-12 items-center justify-center gap-2 bg-white/14 px-5 font-semibold text-white transition-colors hover:bg-white/22"
          >
            <ScanLine aria-hidden="true" className="size-5" />
            {t.home.scan}
          </Link>
        </div>
      </section>

      <section aria-labelledby="home-recent" className="mt-8">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="home-recent" className="type-heading">
            {t.home.recent}
          </h2>
          <span className="flex shrink-0 items-center gap-4">
            <Link
              href={`${base}/activity`}
              className="type-small text-ink inline-flex h-11 items-center font-semibold underline underline-offset-4"
            >
              {t.activity.link}
            </Link>
            <Link
              href={`${base}/groups/${group.id}`}
              className="type-small text-ink inline-flex h-11 items-center font-semibold underline underline-offset-4"
            >
              {t.home.allExpenses}
            </Link>
          </span>
        </div>
        {!full ? (
          <Loading label={t.common.loading} />
        ) : recent.length === 0 ? (
          <p className="text-ink-muted">{t.home.noExpenses}</p>
        ) : (
          <ul className="divide-line divide-y">
            {recent.map((expense) => (
              <li key={expense.id}>
                <ExpenseRow expense={expense} names={names} photos={photos} face="payer" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
