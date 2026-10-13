"use client";

import { ArrowDown, ArrowUp, ChevronRight, CircleCheck, Plus, ScanLine } from "lucide-react";
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
import { ExpenseRow, MyBalance } from "./parts";

/**
 * The first screen, after Stitch's "Home": a greeting, the groups as chips,
 * one group on the forest card with where you stand in it, its latest
 * expenses, and the other groups, each in its own currency.
 */
export function HomeScreen() {
  const { t, base, account } = useApp();
  const { data: groups, error } = useLoad((store) => store.listGroups(), "groups");
  const open = groups?.filter((group) => !group.archivedAt) ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const group = open.find((candidate) => candidate.id === picked) ?? open[0];
  const self = group?.members.find((member) => member.self);
  const name = account?.displayName.split(" ")[0] ?? self?.name;
  const others = open.filter((candidate) => candidate.id !== group?.id);

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar
          name={self?.name ?? name ?? "Splitly"}
          seed={self?.id}
          photo={self?.photoUrl ?? account?.photoUrl}
          className="ring-accent/50 size-11 ring-2"
        />
        <div className="min-w-0">
          <h1 className="text-[1.375rem] leading-7 font-semibold tracking-[-0.01em]">
            {name ? fill(t.home.greeting, { name }) : t.home.greetingPlain} <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-ink-muted text-[0.75rem] leading-4">{t.home.lead}</p>
        </div>
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
          {/* Which group the card shows: one chip a group, the chosen one filled. */}
          {open.length > 1 && (
            <div role="radiogroup" aria-label={t.home.pick} className="no-bar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
              {open.map((candidate) => (
                <label
                  key={candidate.id}
                  className={cn(
                    "has-focus-visible:outline-primary flex h-11 shrink-0 cursor-pointer items-center rounded-full px-4 text-[0.875rem] font-medium whitespace-nowrap transition-colors has-focus-visible:outline-2",
                    candidate.id === group.id ? "bg-[#173d35] text-white" : "bg-surface text-ink-muted hover:text-ink shadow-card",
                  )}
                >
                  <input
                    type="radio"
                    name="home-group"
                    className="sr-only"
                    checked={candidate.id === group.id}
                    onChange={() => setPicked(candidate.id)}
                  />
                  {candidate.name}
                </label>
              ))}
            </div>
          )}

          <GroupHero key={group.id} group={group} />

          {others.length > 0 && (
            <section aria-labelledby="home-others" className="mt-8">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 id="home-others" className="type-heading">
                    {t.home.otherGroups}
                  </h2>
                  <p className="text-ink-muted text-[0.75rem] leading-4">{t.home.separate}</p>
                </div>
                <Link
                  href={`${base}/groups`}
                  aria-label={t.groups.create}
                  className="bg-surface text-ink shadow-card inline-flex size-11 shrink-0 items-center justify-center rounded-full"
                >
                  <Plus aria-hidden="true" className="size-5" />
                </Link>
              </div>
              <ul className="grid grid-cols-2 gap-3">
                {others.map((other) => (
                  <li key={other.id}>
                    <Link
                      href={`${base}/groups/${other.id}`}
                      className="card hover:border-field flex h-full flex-col gap-2 p-4 transition-colors"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <AvatarStack people={other.members.filter((member) => !member.removedAt)} max={2} className="[&>*]:size-8" />
                        <span className="bg-surface-2 text-ink-muted rounded-full px-2 py-0.5 text-[0.75rem] font-medium">
                          {other.baseCurrency}
                        </span>
                      </span>
                      <span className="font-semibold break-words">{other.name}</span>
                      <span className="text-ink-muted text-[0.75rem] leading-4">
                        {fill(t.groups.people, { n: other.members.filter((member) => !member.removedAt).length })}
                      </span>
                      <span className="mt-auto [&_li]:justify-start">
                        <MyBalance net={other.myNet} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}

/** The forest card for one group, and under it the group's latest expenses. */
function GroupHero({ group }: { group: GroupSummary }) {
  const { t, base, locale } = useApp();
  const { data: full } = useLoad((store) => store.getGroup(group.id), `group:${group.id}`);
  const people = group.members.filter((member) => !member.removedAt);
  const names = new Map(group.members.map((member) => [member.id, member.name]));
  const photos = new Map(group.members.map((member) => [member.id, member.photoUrl]));
  // The group's own currency first, then the others: never added together.
  const spent = Object.entries(full ? spentOf(full.expenses) : {}).sort(
    ([a], [b]) => Number(b === group.baseCurrency) - Number(a === group.baseCurrency) || a.localeCompare(b),
  );
  const active = full?.expenses.filter((expense) => expense.status === "active") ?? [];
  const mine = Object.entries(group.myNet).sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <section
        aria-label={group.name}
        className="bg-hero text-on-hero mt-4 rounded-[24px] p-5 shadow-[0_12px_28px_-12px_rgb(23_61_53/0.45)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[1.125rem] leading-6 font-semibold break-words">{group.name}</h2>
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[0.75rem] leading-4 font-medium text-white/85">
              <span aria-hidden="true" className="bg-mint size-1.5 rounded-full" />
              {group.baseCurrency} • {fill(t.groups.people, { n: people.length })}
            </p>
          </div>
          <AvatarStack people={people} className="shrink-0" ring="ring-[#173d35]" />
        </div>

        <p className="mt-5 text-[0.75rem] leading-4 text-white/70">{t.home.groupSpent}</p>
        {spent.length === 0 ? (
          <p className="mt-1 text-[1.5rem] leading-8 font-bold">{full ? t.home.nothingSpent : "…"}</p>
        ) : (
          spent.map(([currency, amount], index) => (
            <p key={currency} className={cn("tabular-nums", index === 0 ? "type-amount mt-1" : "mt-0.5 font-semibold text-white/85")}>
              {formatMoney(amount, currency, { locale })}
            </p>
          ))
        )}

        {/* Where the viewer stands in this group, one chip a currency; the words say the direction, the arrow repeats it. */}
        <ul aria-label={t.balance.title} className="mt-3 flex flex-wrap gap-2">
          {mine.length === 0 && (
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[0.8125rem] font-medium">
              <CircleCheck aria-hidden="true" className="size-4" />
              {t.home.squareChip}
            </li>
          )}
          {mine.map(([currency, net]) => (
            <li
              key={currency}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold tabular-nums",
                net > 0 ? "text-mint bg-white/10" : "bg-white/10 text-white",
              )}
            >
              {net > 0 ? <ArrowDown aria-hidden="true" className="size-4" /> : <ArrowUp aria-hidden="true" className="size-4" />}
              {fill(net > 0 ? t.home.owedChip : t.home.oweChip, { amount: formatMoney(Math.abs(net), currency, { locale }) })}
            </li>
          ))}
        </ul>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href={`${base}/add?group=${group.id}`}
            aria-label={t.group.addExpense}
            className="bg-mint text-on-mint inline-flex h-13 items-center justify-center gap-2 rounded-[14px] font-semibold transition-opacity hover:opacity-90"
          >
            <Plus aria-hidden="true" className="size-5" />
            {t.home.expense}
          </Link>
          <Link
            href={`${base}/scan?group=${group.id}`}
            aria-label={t.home.scan}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-[14px] bg-white/10 font-semibold text-white transition-colors hover:bg-white/15"
          >
            <ScanLine aria-hidden="true" className="size-5" />
            {t.home.receipt}
          </Link>
        </div>
      </section>

      <section aria-labelledby="home-recent" className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="home-recent" className="type-heading">
            {t.home.recent}
          </h2>
          <Link
            href={`${base}/groups/${group.id}`}
            aria-label={t.home.allExpenses}
            className="text-primary inline-flex h-11 items-center gap-0.5 text-[0.875rem] font-semibold"
          >
            {fill(t.home.all, { n: active.length })}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        {!full ? (
          <Loading label={t.common.loading} />
        ) : active.length === 0 ? (
          <p className="text-ink-muted">{t.home.noExpenses}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.slice(0, 5).map((expense) => (
              <li key={expense.id}>
                <Link
                  href={`${base}/groups/${group.id}`}
                  className="bg-surface shadow-card block rounded-[18px] p-4 transition-shadow hover:shadow-md"
                >
                  <ExpenseRow expense={expense} names={names} photos={photos} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
