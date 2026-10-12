"use client";

import { ArrowLeftRight, Ban, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { errorText, useApp, useLoad } from "@/components/app/AppProvider";
import { buttonClass, Loading, Problem } from "@/components/ui/controls";
import type { Group } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/amount";
import { cn } from "@/lib/utils";
import { AnalyticsView } from "./AnalyticsView";

/** The groups a person is in, read whole: for the screens that look across them. */
function useGroups() {
  return useLoad(async (store) => {
    const list = await store.listGroups();
    const groups = await Promise.all(list.filter((group) => !group.archivedAt).map((group) => store.getGroup(group.id)));
    return groups.filter((group): group is Group => group !== null);
  }, "groups:whole");
}

function NoGroups() {
  const { t, base } = useApp();
  return (
    <div className="card mt-6 flex flex-col items-start gap-4 p-5">
      <p className="text-ink-muted">{t.home.noGroups}</p>
      <Link href={`${base}/groups`} className={buttonClass("primary")}>
        <Plus aria-hidden="true" className="size-5" />
        {t.groups.create}
      </Link>
    </div>
  );
}

/** Analytics from the navigation: the same view as in a group, with a way to choose the group. */
export function AnalyticsScreen() {
  const { t } = useApp();
  const { data: groups, error } = useGroups();
  const [picked, setPicked] = useState<string | null>(null);
  const group = groups?.find((candidate) => candidate.id === picked) ?? groups?.[0];

  return (
    <>
      <h1 className="type-title">{t.analytics.title}</h1>
      <p className="type-lead text-ink-muted mt-2">{t.analytics.lead}</p>
      {error && <Problem className="mt-6">{errorText(t, error)}</Problem>}
      {!groups && !error && <Loading label={t.common.loading} />}
      {groups && groups.length === 0 && <NoGroups />}
      {groups && group && (
        <>
          {groups.length > 1 && (
            <div role="radiogroup" aria-label={t.home.pick} className="bg-surface-2 rounded-control mt-5 flex gap-1 overflow-x-auto p-1">
              {groups.map((candidate) => (
                <label
                  key={candidate.id}
                  className={cn(
                    "type-small has-focus-visible:outline-primary flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-[9px] px-3 font-semibold whitespace-nowrap transition-colors has-focus-visible:outline-2",
                    candidate.id === group.id ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
                  )}
                >
                  <input
                    type="radio"
                    name="analytics-group"
                    className="sr-only"
                    checked={candidate.id === group.id}
                    onChange={() => setPicked(candidate.id)}
                  />
                  <span className="truncate">{candidate.name}</span>
                </label>
              ))}
            </div>
          )}
          <AnalyticsView key={group.id} group={group} />
        </>
      )}
    </>
  );
}

type Event = {
  id: string;
  at: string;
  groupId: string;
  groupName: string;
  kind: "added" | "cancelled" | "changed" | "paid" | "proposed" | "withdrawn";
  who: string;
  what: string;
  amount: string;
};

/**
 * What happened lately, across groups, newest first: expenses added, changed
 * and cancelled, and payments made between people. It is read from the
 * expenses and payments themselves, so it can never say anything they do not.
 */
export function ActivityScreen() {
  const { t, base, locale } = useApp();
  const { data: groups, error } = useGroups();

  const events: Event[] = [];
  for (const group of groups ?? []) {
    const name = (id: string) => group.members.find((member) => member.id === id)?.name ?? "?";
    for (const expense of group.expenses) {
      events.push({
        id: expense.id,
        at: expense.createdAt,
        groupId: group.id,
        groupName: group.name,
        // A cancelled or replaced expense is still the record of having been added; its state says what became of it.
        kind: expense.status === "cancelled" ? "cancelled" : expense.status === "replaced" ? "changed" : "added",
        who: name(expense.createdBy),
        what: expense.description,
        amount: formatMoney(expense.totalMinor, expense.currency, { locale }),
      });
    }
    for (const settlement of group.settlements) {
      events.push({
        id: settlement.id,
        at: settlement.confirmedAt ?? settlement.createdAt,
        groupId: group.id,
        groupName: group.name,
        kind: settlement.status === "confirmed" ? "paid" : settlement.status === "proposed" ? "proposed" : "withdrawn",
        who: name(settlement.fromMemberId),
        what: name(settlement.toMemberId),
        amount: formatMoney(settlement.amountMinor, settlement.currency, { locale }),
      });
    }
  }
  events.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  const shown = events.slice(0, 60);
  const when = (at: string) =>
    new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(at));
  const ICON = { added: Plus, cancelled: Ban, changed: Pencil, paid: ArrowLeftRight, proposed: ArrowLeftRight, withdrawn: Ban } as const;

  return (
    <>
      <h1 className="type-title">{t.activity.title}</h1>
      <p className="type-lead text-ink-muted mt-2">{t.activity.lead}</p>
      {error && <Problem className="mt-6">{errorText(t, error)}</Problem>}
      {!groups && !error && <Loading label={t.common.loading} />}
      {groups && groups.length === 0 && <NoGroups />}
      {groups && groups.length > 0 && shown.length === 0 && <p className="card text-ink-muted mt-6 p-5">{t.activity.empty}</p>}
      {shown.length > 0 && (
        <ul className="card divide-line mt-6 divide-y">
          {shown.map((event) => {
            const Icon = ICON[event.kind];
            return (
              <li key={`${event.kind}-${event.id}`}>
                <Link
                  href={`${base}/groups/${event.groupId}`}
                  className="hover:bg-surface-2/60 flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      event.kind === "paid" ? "bg-positive/15 text-positive" : "bg-surface-2 text-ink-muted",
                    )}
                  >
                    <Icon className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">{fill(t.activity.events[event.kind], { who: event.who, what: event.what })}</span>
                    <span className="type-small text-ink-muted block">
                      {event.groupName} · {when(event.at)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-semibold tabular-nums",
                      (event.kind === "cancelled" || event.kind === "changed" || event.kind === "withdrawn") &&
                        "text-ink-muted line-through",
                    )}
                  >
                    {event.amount}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
