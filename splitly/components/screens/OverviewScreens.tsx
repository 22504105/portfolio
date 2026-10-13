"use client";

import { ArrowRight, Ban, CheckCheck, CircleCheck, Clock, Hourglass, Pencil, Plus, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { errorText, useApp } from "@/components/app/AppProvider";
import { useGroups } from "@/components/app/useGroups";
import { useActivitySeen } from "@/components/app/usePreferences";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClass, Field, inputClass, Loading, Problem } from "@/components/ui/controls";
import { countNew, eventsOf, isNew, type ActivityEvent } from "@/lib/activity";
import { simplifyAll } from "@/lib/balances/debts";
import { netsOf } from "@/lib/balances/net";
import { fill } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/amount";
import { cn } from "@/lib/utils";
import { AnalyticsView } from "./AnalyticsView";
import { MyBalance, totalNet } from "./parts";

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
    <div data-wide>
      <h1 className="type-title">{t.analytics.title}</h1>
      <p className="type-lead text-ink-muted mt-2">{t.analytics.lead}</p>
      {error && <Problem className="mt-6">{errorText(t, error)}</Problem>}
      {!groups && !error && <Loading label={t.common.loading} />}
      {groups && groups.length === 0 && <NoGroups />}
      {groups && group && (
        <>
          {groups.length > 1 && (
            <div role="radiogroup" aria-label={t.home.pick} className="bg-surface-2 mt-5 flex gap-1 overflow-x-auto rounded-full p-1">
              {groups.map((candidate) => (
                <label
                  key={candidate.id}
                  className={cn(
                    "type-small has-focus-visible:outline-primary flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full px-3 font-semibold whitespace-nowrap transition-colors has-focus-visible:outline-2",
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
    </div>
  );
}

const chip =
  "type-small has-focus-visible:outline-primary inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full border px-4 font-semibold whitespace-nowrap transition-colors has-focus-visible:outline-2";

/**
 * What happened lately, across groups, newest first, and at the same time
 * the notifications: what others did since this person last marked the list
 * read is flagged as new, and a payment waiting for them stays flagged until
 * it is answered.
 */
export function ActivityScreen() {
  const { t, base, locale } = useApp();
  const { data: groups, error } = useGroups();
  const [only, setOnly] = useState<string | null>(null);
  const { seen, markRead } = useActivitySeen(!!groups);

  const events = eventsOf(groups ?? []);
  const fresh = countNew(events, seen);
  const shown = events.filter((event) => only === null || event.groupId === only).slice(0, 60);
  const zone = locale === "ru" ? "ru-RU" : "en-GB";
  const time = (at: string) => new Intl.DateTimeFormat(zone, { hour: "2-digit", minute: "2-digit" }).format(new Date(at));
  // The person's own day, not the server's: an evening expense belongs to the evening it was added.
  const dayOf = (at: string) => {
    const date = new Date(at);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const dayName = (at: string) => new Intl.DateTimeFormat(zone, { day: "numeric", month: "long", weekday: "short" }).format(new Date(at));
  const days: { day: string; events: ActivityEvent[] }[] = [];
  for (const event of shown) {
    const day = dayOf(event.at);
    if (days[days.length - 1]?.day === day) days[days.length - 1].events.push(event);
    else days.push({ day, events: [event] });
  }
  const LOOK = {
    added: { icon: ReceiptText, tone: "bg-accent-soft text-on-accent" },
    cancelled: { icon: Ban, tone: "bg-surface-2 text-ink-muted" },
    changed: { icon: Pencil, tone: "bg-surface-2 text-ink-muted" },
    paid: { icon: CircleCheck, tone: "bg-primary text-on-primary" },
    proposed: { icon: Clock, tone: "bg-warning/15 text-warning" },
    withdrawn: { icon: Ban, tone: "bg-surface-2 text-ink-muted" },
  } as const;

  return (
    <>
      <h1 className="type-title">{t.activity.title}</h1>
      <p className="type-lead text-ink-muted mt-2">{t.activity.lead}</p>
      {error && <Problem className="mt-6">{errorText(t, error)}</Problem>}
      {!groups && !error && <Loading label={t.common.loading} />}
      {groups && groups.length === 0 && <NoGroups />}

      {fresh > 0 && (
        <section aria-label={fill(t.activity.unread, { n: fresh })} className="bg-accent-soft text-on-accent rounded-card mt-5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="flex items-center gap-2 font-semibold">
              <span aria-hidden="true" className="bg-primary size-2 rounded-full" />
              {fill(t.activity.unread, { n: fresh })}
            </p>
            <Button variant="secondary" small onClick={markRead}>
              <CheckCheck aria-hidden="true" className="size-4" />
              {t.activity.markRead}
            </Button>
          </div>
          <p className="mt-2 text-[0.8125rem] leading-5 opacity-85">{t.activity.readHint}</p>
        </section>
      )}

      {groups && groups.length > 1 && (
        <div role="radiogroup" aria-label={t.activity.filter} className="mt-5 flex flex-wrap gap-2">
          {[{ id: null, name: t.activity.all }, ...groups].map((option) => (
            <label
              key={option.id ?? "all"}
              className={cn(
                chip,
                only === option.id ? "bg-primary text-on-primary border-transparent" : "border-line bg-surface text-ink hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="activity-group"
                className="sr-only"
                checked={only === option.id}
                onChange={() => setOnly(option.id)}
              />
              {option.name}
            </label>
          ))}
        </div>
      )}
      {groups && groups.length > 0 && shown.length === 0 && <p className="card text-ink-muted mt-6 p-5">{t.activity.empty}</p>}
      {days.map(({ day, events: happened }) => (
        <section key={day} aria-labelledby={`day-${day}`} className="mt-6">
          <h2 id={`day-${day}`} className="type-label text-ink-muted">
            {dayName(happened[0].at)}
          </h2>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {happened.map((event) => {
              const { icon: Icon, tone } = LOOK[event.kind];
              const undone = event.kind === "cancelled" || event.kind === "changed" || event.kind === "withdrawn";
              const news = isNew(event, seen);
              return (
                <li key={`${event.kind}-${event.id}`}>
                  <Link
                    href={`${base}/groups/${event.groupId}${event.needsMe ? "?tab=debts" : ""}`}
                    className={cn("card hover:border-field flex items-center gap-3 p-4 transition-colors", news && "border-primary/50")}
                  >
                    <span aria-hidden="true" className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tone)}>
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium break-words">
                        {fill(t.activity.events[event.kind], { who: event.who, what: event.what })}
                      </span>
                      <span className="text-ink-muted mt-0.5 block text-[0.75rem] leading-4">
                        {event.groupName} • {time(event.at)}
                      </span>
                      {news && (
                        <span className="bg-accent text-on-accent mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.75rem] leading-4 font-semibold">
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                          {event.needsMe ? t.activity.needsYou : t.activity.fresh}
                        </span>
                      )}
                    </span>
                    <span className={cn("shrink-0 font-bold tabular-nums", undone && "text-ink-muted line-through")}>
                      {formatMoney(event.amountMinor, event.currency, { locale })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {shown.length > 0 && (
        <p className="text-ink-muted mt-8 flex flex-col items-center gap-2 text-center">
          <span aria-hidden="true" className="bg-surface-2 flex size-11 items-center justify-center rounded-full">
            <Hourglass className="size-5" />
          </span>
          <span className="type-small">{t.activity.end}</span>
        </p>
      )}
    </>
  );
}

/**
 * Every debt in every group on one screen: the fewest transfers that settle
 * each group, exactly as its Debts tab shows them, to be narrowed by group,
 * currency and person. Each debt stays in its own currency; nothing is added
 * across currencies or groups. Paying one off happens in its group.
 */
export function DebtsScreen() {
  const { t, base, locale } = useApp();
  const { data: groups, error } = useGroups();
  const [groupId, setGroupId] = useState("");
  const [currency, setCurrency] = useState("");
  const [person, setPerson] = useState("");

  const rows = (groups ?? []).flatMap((group) => {
    const people = new Map(group.members.map((member) => [member.id, member]));
    const me = group.members.find((member) => member.self);
    return simplifyAll(
      netsOf(group.expenses, group.settlements),
      group.members.map((member) => member.id),
    ).map((transfer) => ({
      amountMinor: transfer.amountMinor,
      currency: transfer.currency,
      group,
      from: people.get(transfer.from),
      to: people.get(transfer.to),
      mine: transfer.from === me?.id ? ("owe" as const) : transfer.to === me?.id ? ("owed" as const) : null,
    }));
  });
  const currencies = [...new Set(rows.map((row) => row.currency))].sort();
  // People are told apart by name: the same person is a different member in each group.
  const names = [...new Set(rows.flatMap((row) => [row.from?.name, row.to?.name]).filter((name): name is string => !!name))].sort((a, b) =>
    a.localeCompare(b, locale),
  );
  const shown = rows.filter(
    (row) =>
      (!groupId || row.group.id === groupId) &&
      (!currency || row.currency === currency) &&
      (!person || (person === "@me" ? row.mine !== null : row.from?.name === person || row.to?.name === person)),
  );

  return (
    <>
      <h1 className="type-title">{t.debtsAll.title}</h1>
      <p className="type-lead text-ink-muted mt-2">{t.debtsAll.lead}</p>
      {error && <Problem className="mt-6">{errorText(t, error)}</Problem>}
      {!groups && !error && <Loading label={t.common.loading} />}
      {groups && groups.length === 0 && <NoGroups />}
      {groups && groups.length > 0 && (
        <>
          <section aria-labelledby="debts-yours" className="card mt-5 p-5">
            <h2 id="debts-yours" className="type-label text-ink-muted mb-3">
              {t.debtsAll.yours}
            </h2>
            <MyBalance net={totalNet(groups)} large />
            {Object.keys(totalNet(groups)).length > 1 && <p className="type-small text-ink-muted mt-4">{t.balance.apart}</p>}
          </section>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={t.debtsAll.group}>
              {(control) => (
                <select {...control} className={inputClass} value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                  <option value="">{t.debtsAll.allGroups}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t.debtsAll.currency}>
              {(control) => (
                <select {...control} className={inputClass} value={currency} onChange={(event) => setCurrency(event.target.value)}>
                  <option value="">{t.debtsAll.allCurrencies}</option>
                  {currencies.map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t.debtsAll.person} className="col-span-2 sm:col-span-1">
              {(control) => (
                <select {...control} className={inputClass} value={person} onChange={(event) => setPerson(event.target.value)}>
                  <option value="">{t.debtsAll.everyone}</option>
                  <option value="@me">{t.debtsAll.mine}</option>
                  {names.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          <section aria-label={t.debtsAll.list} className="mt-4">
            {shown.length === 0 ? (
              <div role="status" className="card flex items-center gap-3 p-5">
                <CircleCheck aria-hidden="true" className="text-positive size-6 shrink-0" />
                <p className="font-semibold">{rows.length === 0 ? t.debts.none : t.debtsAll.none}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {shown.map((row) => (
                  <li key={`${row.group.id}|${row.from?.id}|${row.to?.id}|${row.currency}`} className="card p-4">
                    <div className="flex items-center gap-3">
                      <span className="relative shrink-0">
                        <Avatar name={row.from?.name ?? "?"} seed={row.from?.id} photo={row.from?.photoUrl} className="size-11" />
                        <Avatar
                          name={row.to?.name ?? "?"}
                          seed={row.to?.id}
                          photo={row.to?.photoUrl}
                          className="ring-surface absolute -right-1 -bottom-1 size-5 ring-2"
                        />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                          <span className="font-medium break-words">{row.from?.name ?? "?"}</span>
                          <ArrowRight aria-label={t.scan.owesTo} className="text-ink-muted size-4 shrink-0" />
                          <span className="font-medium break-words">{row.to?.name ?? "?"}</span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-3 py-1 font-bold tabular-nums",
                            row.mine === "owed"
                              ? "bg-accent-soft text-on-accent"
                              : row.mine === "owe"
                                ? "bg-danger/10 text-danger"
                                : "bg-surface-2",
                          )}
                        >
                          {formatMoney(row.amountMinor, row.currency, { locale })}
                        </span>
                      </span>
                    </div>
                    <p className="text-ink-muted mt-1.5 text-[0.75rem] leading-4">
                      {row.group.name}
                      {row.mine && ` • ${t.balance[row.mine]}`}
                    </p>
                    <Link
                      href={`${base}/groups/${row.group.id}?tab=debts`}
                      className={cn(buttonClass(row.mine === "owe" ? "primary" : "secondary"), "mt-3 w-full")}
                    >
                      {t.debtsAll.open}
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
