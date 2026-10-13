"use client";

import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, Plus, ReceiptText, ScanLine, Share2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { errorText, useApp, useLoad } from "@/components/app/AppProvider";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Button, buttonClass, Confirm, Field, inputClass, Loading, Problem } from "@/components/ui/controls";
import { netsOf, spentOf } from "@/lib/balances/net";
import type { Expense, Group, Invite, Member } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/amount";
import { cn } from "@/lib/utils";
import { AnalyticsView } from "./AnalyticsView";
import { DebtsTab } from "./DebtsTab";
import { ExpenseRow } from "./parts";
import { ExportPanel } from "./ExportPanel";
import { InviteSheet } from "./InviteSheet";
import { RatesSection } from "./RatesSection";

/** One group, after the concept: its people's faces, tabs, everyone's balance and what was spent. */
export function GroupScreen() {
  const { t, base } = useApp();
  const id = String(useParams<{ group: string }>().group);
  const { data: group, error } = useLoad((store) => store.getGroup(id), `group:${id}`);

  if (error) return <Problem>{errorText(t, error)}</Problem>;
  if (group === undefined) return <Loading label={t.common.loading} />;
  if (group === null) {
    return (
      <>
        <h1 className="type-title">{t.group.notFoundTitle}</h1>
        <p className="type-lead text-ink-muted mt-2">{t.group.notFoundBody}</p>
        <Link href={`${base}/groups`} className={cn(buttonClass("secondary"), "mt-6")}>
          {t.group.toGroups}
        </Link>
      </>
    );
  }
  return <GroupView group={group} />;
}

const TABS = ["expenses", "debts", "analytics", "settings"] as const;
type Tab = (typeof TABS)[number];

function GroupView({ group }: { group: Group }) {
  const { t, base } = useApp();
  const me = group.members.find((member) => member.self);
  const manages = me?.role === "owner" || me?.role === "admin";
  const people = group.members.filter((member) => !member.removedAt);
  // A link from another screen may ask for a tab ("?tab=debts"). This runs in the browser only: a group is never drawn before its data is there.
  const [tab, setTab] = useState<Tab>(() => {
    const asked = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab");
    return TABS.find((name) => name === asked) ?? "expenses";
  });
  // Payments someone says they made, waiting for the other side: shown as a count on the Debts tab.
  const waiting = group.settlements.filter((settlement) => settlement.status === "proposed").length;
  const [failure, setFailure] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const section = { group, me, manages, onFailure: setFailure };

  // On a wide screen, as in Stitch's browser version: the card with everyone's balance stands on the left and stays
  // in view, and the tabs with what they hold take the rest.
  return (
    <div data-wide className="xl:grid xl:grid-cols-[23rem_minmax(0,1fr)] xl:items-start xl:gap-x-8">
      <div className="xl:col-span-2">
        <div className="flex items-center gap-2">
          <Link
            href={`${base}/groups`}
            aria-label={t.group.toGroups}
            className="bg-surface text-ink shadow-card inline-flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.375rem] leading-7 font-semibold tracking-[-0.01em]">{group.name}</h1>
            <p className="text-ink-muted truncate text-[0.75rem] leading-4">
              {fill(t.groups.people, { n: people.length })} • {group.baseCurrency}
            </p>
          </div>
          {manages && !group.archivedAt && (
            <button
              type="button"
              onClick={() => setInviting(true)}
              className="bg-surface text-ink shadow-card inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.875rem] font-medium"
            >
              <Share2 aria-hidden="true" className="size-4" />
              {t.group.invite}
            </button>
          )}
        </div>

        {group.archivedAt && (
          <p className="type-small border-warning/40 bg-warning/10 text-warning rounded-control mt-4 border p-3.5 font-medium">
            {t.group.archivedNote}
          </p>
        )}
        {failure && <Problem className="mt-4">{failure}</Problem>}
      </div>

      <div className="xl:sticky xl:top-16">
        <Hero group={group} />
      </div>

      <div className="min-w-0">
        <div role="tablist" aria-label={group.name} className="bg-surface-2 mt-5 grid grid-cols-4 gap-1 rounded-[16px] p-1 xl:mt-4">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`tab-${name}`}
              aria-selected={tab === name}
              aria-controls={`panel-${name}`}
              onClick={() => setTab(name)}
              className={cn(
                "flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-[12px] px-1 text-[0.875rem] font-semibold transition-colors",
                tab === name ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
              )}
            >
              <span className="truncate">{t.group.tabs[name]}</span>
              {name === "debts" && waiting > 0 && (
                <span
                  className="bg-accent text-on-accent rounded-full px-1.5 text-[0.6875rem] leading-4 font-semibold"
                  title={t.debts.waiting}
                >
                  {waiting}
                </span>
              )}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "expenses" && (
            <>
              {!group.archivedAt && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Link
                    href={`${base}/scan?group=${group.id}`}
                    aria-label={t.home.scan}
                    className="bg-accent text-on-accent inline-flex h-13 items-center justify-center gap-2 rounded-[14px] font-semibold transition-opacity hover:opacity-90"
                  >
                    <ScanLine aria-hidden="true" className="size-5" />
                    {t.group.scanShort}
                  </Link>
                  <Link
                    href={`${base}/add?group=${group.id}`}
                    aria-label={t.group.addExpense}
                    className="bg-primary text-on-primary hover:bg-primary-hover inline-flex h-13 items-center justify-center gap-2 rounded-[14px] font-semibold transition-colors"
                  >
                    <Plus aria-hidden="true" className="size-5" />
                    {t.home.expense}
                  </Link>
                </div>
              )}
              <Expenses {...section} />
            </>
          )}
          {tab === "debts" && <DebtsTab group={group} me={me} onFailure={setFailure} />}
          {tab === "analytics" && <AnalyticsView group={group} />}
          {tab === "settings" && (
            <>
              <People {...section} onInvite={() => setInviting(true)} />
              <RatesSection group={group} onFailure={setFailure} />
              <Settings {...section} />
            </>
          )}
        </div>
      </div>

      <InviteSheet
        group={group}
        open={inviting}
        onClose={() => setInviting(false)}
        invite={invite}
        onInvite={setInvite}
        onGuest={() => {
          setInviting(false);
          setTab("settings");
        }}
      />
    </div>
  );
}

/**
 * The forest card of a group, after Stitch: what the group spent, where the
 * viewer stands (owed and owing, each currency on its own), and everyone's
 * balance with its sign. In the dark theme it is a raised surface.
 */
function Hero({ group }: { group: Group }) {
  const { t, locale } = useApp();
  const nets = netsOf(group.expenses, group.settlements);
  const spent = Object.entries(spentOf(group.expenses)).sort(
    ([x], [y]) => Number(y === group.baseCurrency) - Number(x === group.baseCurrency) || x.localeCompare(y),
  );
  const mine = Object.entries(group.myNet).sort(([x], [y]) => x.localeCompare(y));
  // Everyone still in the group, and anyone who left with something still owed either way.
  const standing = group.members.filter(
    (member) => !member.removedAt || Object.values(nets).some((byMember) => (byMember[member.id] ?? 0) !== 0),
  );
  const money = (minor: number, currency: string, sign = false) => formatMoney(minor, currency, { locale, sign });

  return (
    <div className="bg-hero text-on-hero mt-4 rounded-[24px] p-5 shadow-[0_12px_28px_-12px_rgb(23_61_53/0.45)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.6875rem] leading-4 font-semibold tracking-[0.08em] text-white/70 uppercase">{t.home.groupSpent}</p>
        <p className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[0.75rem] leading-4 font-medium text-white/85">
          <span aria-hidden="true" className="bg-mint size-1.5 rounded-full" />
          {group.baseCurrency}
        </p>
      </div>
      {spent.length === 0 ? (
        <p className="mt-1 text-[1.5rem] leading-8 font-bold">{t.home.nothingSpent}</p>
      ) : (
        spent.map(([currency, amount], index) => (
          <p key={currency} className={cn("tabular-nums", index === 0 ? "type-amount mt-1" : "mt-0.5 font-semibold text-white/85")}>
            {money(amount, currency)}
          </p>
        ))
      )}

      <section aria-labelledby="group-mine" className="mt-4 grid grid-cols-2 gap-2.5">
        <h2 id="group-mine" className="sr-only">
          {t.balance.title}
        </h2>
        {(["owed", "owe"] as const).map((side) => {
          const lines = mine.filter(([, net]) => (side === "owed" ? net > 0 : net < 0));
          return (
            <div key={side} className="rounded-[14px] bg-white/8 p-3">
              <p className="flex items-center gap-1.5 text-[0.75rem] leading-4 text-white/75">
                {side === "owed" ? (
                  <ArrowDown aria-hidden="true" className="size-3.5" />
                ) : (
                  <ArrowUp aria-hidden="true" className="size-3.5" />
                )}
                {side === "owed" ? t.balance.owed : t.balance.owe}
              </p>
              {lines.length === 0 ? (
                <p className="mt-1 font-semibold text-white/60">—</p>
              ) : (
                lines.map(([currency, net]) => (
                  <p key={currency} className={cn("mt-1 font-bold tabular-nums", side === "owed" ? "text-mint" : "text-white")}>
                    {money(Math.abs(net), currency)}
                  </p>
                ))
              )}
            </div>
          );
        })}
      </section>

      <section aria-labelledby="group-balances" className="mt-5">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 id="group-balances" className="text-[0.8125rem] leading-5 font-medium text-white/80">
            {t.group.balances}
          </h2>
          <p className="text-[0.75rem] leading-4 text-white/70">{standing.length}</p>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-2">
          {standing.map((member) => {
            const lines = Object.entries(nets)
              .sort(([x], [y]) => x.localeCompare(y))
              .map(([currency, byMember]) => [currency, byMember[member.id] ?? 0] as const)
              .filter(([, net]) => net !== 0);
            return (
              <li key={member.id} className="flex min-w-0 flex-col items-center gap-1 rounded-[14px] bg-white/8 px-1.5 py-2.5 text-center">
                <Avatar
                  name={member.name}
                  seed={member.id}
                  photo={member.photoUrl}
                  className={cn("size-12 ring-2 ring-white/20", member.removedAt && "opacity-60")}
                />
                <span className="w-full truncate text-[0.8125rem] leading-4 font-semibold">{member.name}</span>
                {(member.self || member.guest || member.removedAt) && (
                  <span className="w-full truncate text-[0.6875rem] leading-3 text-white/65">
                    {member.removedAt ? t.people.removed : member.self ? t.common.you : t.people.guest}
                  </span>
                )}
                {lines.length === 0 ? (
                  <span className="text-[0.75rem] leading-4 text-white/65">{t.balance.settled}</span>
                ) : (
                  lines.map(([currency, net]) => (
                    <span
                      key={currency}
                      className={cn("text-[0.75rem] leading-4 font-semibold tabular-nums", net > 0 ? "text-mint" : "text-[#ffc4bd]")}
                    >
                      {/* The sign says the direction; the words say it to a screen reader. */}
                      <span className="sr-only">{net > 0 ? t.balance.owedTo : t.balance.owedBy} </span>
                      {money(net, currency, true)}
                    </span>
                  ))
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function MemberName({ member, className }: { member: Member; className?: string }) {
  const { t } = useApp();
  return (
    <span className={cn("min-w-0", className)}>
      <span className={cn("font-medium break-words", member.removedAt && "text-ink-muted")}>{member.name}</span>
      {member.self && <span className="text-ink-muted"> ({t.common.you})</span>}
      {(member.guest || member.removedAt || member.role !== "member") && (
        <span className="type-small text-ink-muted">
          {" "}
          · {member.removedAt ? t.people.removed : member.guest ? t.people.guest : t.people.roles[member.role]}
        </span>
      )}
    </span>
  );
}

type SectionProps = { group: Group; me: Member | undefined; manages: boolean; onFailure: (message: string | null) => void };

function Expenses({ group, me, manages, onFailure }: SectionProps) {
  const { t, store, base, locale, changed, notify } = useApp();
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const names = new Map(group.members.map((member) => [member.id, member.name]));
  const photos = new Map(group.members.map((member) => [member.id, member.photoUrl]));
  const hidden = group.expenses.some((expense) => expense.status !== "active");
  const shown = group.expenses.filter((expense) => all || expense.status === "active");

  async function cancel(expense: Expense) {
    onFailure(null);
    try {
      await store.cancelExpense(group.id, expense.id);
      changed();
      notify(t.expense.cancelled);
    } catch (caught) {
      onFailure(errorText(t, caught));
    }
  }

  return (
    <section aria-labelledby="group-expenses" className="mt-8">
      <h2 id="group-expenses" className="type-heading mb-1">
        {t.group.expenses}
      </h2>
      {hidden && (
        <label className="type-small flex min-h-11 cursor-pointer items-center gap-2.5">
          <input type="checkbox" className="accent-primary size-5" checked={all} onChange={(event) => setAll(event.target.checked)} />
          {t.group.showAll}
        </label>
      )}
      {shown.length === 0 ? (
        <p className="text-ink-muted mt-2">{t.group.noExpenses}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {shown.map((expense) => {
            const mine = expense.splits.find((split) => split.memberId === me?.id);
            const live = expense.status === "active";
            const expanded = open === expense.id;
            const editable = live && !group.archivedAt && (manages || expense.createdBy === me?.id);
            return (
              <li key={expense.id} className="bg-surface shadow-card rounded-[18px] p-4">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`expense-${expense.id}`}
                  onClick={() => setOpen(expanded ? null : expense.id)}
                  className="block w-full"
                >
                  <ExpenseRow
                    expense={expense}
                    names={names}
                    photos={photos}
                    under={
                      <span className="type-small text-ink-muted block">
                        {mine
                          ? fill(t.expense.yourShare, { amount: formatMoney(mine.owedMinor, expense.currency, { locale }) })
                          : t.expense.notYours}
                      </span>
                    }
                    after={
                      <ChevronDown
                        aria-hidden="true"
                        className={cn("text-ink-muted size-5 shrink-0 transition-transform", expanded && "rotate-180")}
                      />
                    }
                  />
                </button>

                <div className="border-line mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
                  {expense.receipt && (
                    <span className="bg-surface-2 text-ink-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] leading-4 font-medium">
                      <ReceiptText aria-hidden="true" className="size-3.5" />
                      {fill(t.group.receiptLines, { n: expense.receipt.lines.length })}
                    </span>
                  )}
                  <span className="bg-accent-soft text-on-accent rounded-full px-2.5 py-1 text-[0.75rem] leading-4 font-medium">
                    {t.expense.modes[expense.split.mode]} • {expense.splits.length}
                  </span>
                  <AvatarStack
                    people={expense.splits.map((split) => ({
                      id: split.memberId,
                      name: names.get(split.memberId) ?? "?",
                      photoUrl: photos.get(split.memberId),
                    }))}
                    max={4}
                    className="ml-auto [&>*]:size-6"
                  />
                </div>

                {expanded && (
                  <div id={`expense-${expense.id}`} className="bg-surface-2/60 rounded-control mt-3 px-4 py-4">
                    <dl className="type-small grid gap-x-6 gap-y-4 sm:grid-cols-2">
                      <div>
                        <dt className="type-label text-ink-muted mb-1.5">{t.expense.paidOfIt}</dt>
                        {expense.payers.map((payer) => (
                          <dd key={payer.memberId} className="flex justify-between gap-3">
                            <span className="break-words">{names.get(payer.memberId)}</span>
                            <span className="tabular-nums">{formatMoney(payer.paidMinor, expense.currency, { locale })}</span>
                          </dd>
                        ))}
                      </div>
                      <div>
                        <dt className="type-label text-ink-muted mb-1.5">
                          {t.expense.owesOfIt} · {t.expense.modes[expense.split.mode]}
                        </dt>
                        {expense.splits.map((split) => (
                          <dd key={split.memberId} className="flex justify-between gap-3">
                            <span className="break-words">{names.get(split.memberId)}</span>
                            <span className="tabular-nums">{formatMoney(split.owedMinor, expense.currency, { locale })}</span>
                          </dd>
                        ))}
                      </div>
                    </dl>
                    {expense.receipt && (
                      <div className="mt-4">
                        <p className="type-label text-ink-muted mb-1.5">{t.scan.fromReceipt}</p>
                        <ul className="type-small flex flex-col gap-1">
                          {expense.receipt.lines.map((line, index) => (
                            <li key={index} className="flex justify-between gap-3">
                              <span className="min-w-0 break-words">
                                {line.displayLabel}
                                <span className="text-ink-muted">
                                  {" · "}
                                  {line.allocations.length === group.members.filter((member) => !member.removedAt).length
                                    ? fill(t.scan.everyone, { n: line.allocations.length })
                                    : line.allocations.map((share) => names.get(share.memberId)).join(", ")}
                                </span>
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {formatMoney(line.lineTotalMinor, expense.currency, { locale })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {expense.category && <p className="type-small text-ink-muted mt-3">{t.expense.categories[expense.category]}</p>}
                    {editable && (
                      <div className="mt-4 flex flex-wrap items-start gap-2">
                        <Link href={`${base}/add?group=${group.id}&expense=${expense.id}`} className={buttonClass("secondary", true)}>
                          {t.expense.edit}
                        </Link>
                        <Confirm
                          label={t.expense.cancelIt}
                          question={t.expense.cancelConfirm}
                          yes={t.common.yes}
                          no={t.common.no}
                          onConfirm={() => cancel(expense)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function People({ group, me, manages, onFailure, onInvite }: SectionProps & { onInvite: () => void }) {
  const { t, store, changed, notify } = useApp();
  const [guest, setGuest] = useState("");
  const [guestProblem, setGuestProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Does one change to the group's people, then says so, or says what went wrong. */
  async function act(work: () => Promise<unknown>, done: string) {
    onFailure(null);
    try {
      await work();
      changed();
      notify(done);
    } catch (caught) {
      onFailure(errorText(t, caught));
    }
  }

  async function addGuest(event: FormEvent) {
    event.preventDefault();
    const name = guest.trim();
    if (name.length < 1 || name.length > 80) return setGuestProblem(t.groups.nameProblem);
    setGuestProblem(null);
    setBusy(true);
    await act(() => store.addGuest(group.id, name), fill(t.people.added, { name }));
    setGuest("");
    setBusy(false);
  }

  return (
    <section aria-labelledby="group-people" className="mt-6">
      <h2 id="group-people" className="type-heading mb-3">
        {t.group.people}
      </h2>
      <ul className="card divide-line divide-y">
        {group.members
          .filter((member) => !member.removedAt)
          .map((member) => {
            // The owner sets roles; managers remove people (but not each other, and never the owner).
            const canRole = me?.role === "owner" && !member.guest && member.role !== "owner";
            const canRemove = manages && !member.self && member.role !== "owner" && (member.role !== "admin" || me?.role === "owner");
            return (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={member.name} seed={member.id} photo={member.photoUrl} className="size-9" />
                  <MemberName member={member} />
                </span>
                {(canRole || canRemove) && !group.archivedAt && (
                  <span className="flex flex-wrap items-start gap-2">
                    {canRole && (
                      <select
                        aria-label={fill(t.people.role, { name: member.name })}
                        className={cn(inputClass, "type-small h-11 w-auto")}
                        value={member.role}
                        onChange={(event) =>
                          act(() => store.setRole(group.id, member.id, event.target.value as "admin" | "member"), t.people.roleChanged)
                        }
                      >
                        <option value="member">{t.people.roles.member}</option>
                        <option value="admin">{t.people.roles.admin}</option>
                      </select>
                    )}
                    {canRemove && (
                      <Confirm
                        label={`${t.people.remove}: ${member.name}`}
                        question={fill(t.people.removeConfirm, { name: member.name })}
                        yes={t.common.yes}
                        no={t.common.no}
                        onConfirm={() =>
                          act(() => store.removeMember(group.id, member.id), fill(t.people.removedDone, { name: member.name }))
                        }
                      />
                    )}
                  </span>
                )}
              </li>
            );
          })}
      </ul>

      {manages && !group.archivedAt && (
        <>
          <form onSubmit={addGuest} noValidate className="card mt-3 flex flex-col gap-3 p-4 sm:p-5">
            <Field label={t.people.addGuest} hint={t.people.guestHint} error={guestProblem}>
              {(control) => (
                <div className="flex gap-2">
                  <input
                    {...control}
                    className={inputClass}
                    value={guest}
                    onChange={(event) => setGuest(event.target.value)}
                    placeholder={t.people.guestName}
                    maxLength={80}
                    autoComplete="off"
                  />
                  <Button type="submit" variant="secondary" busy={busy}>
                    {t.people.add}
                  </Button>
                </div>
              )}
            </Field>
          </form>

          <div className="card mt-3 flex flex-col items-start gap-3 p-4 sm:p-5">
            <h3 className="font-semibold">{t.people.invite}</h3>
            {store.kind === "demo" ? (
              <p className="type-small text-ink-muted">{t.people.inviteDemo}</p>
            ) : (
              <>
                <p className="type-small text-ink-muted">{t.people.inviteHint}</p>
                <Button variant="secondary" onClick={onInvite}>
                  <Share2 aria-hidden="true" className="size-4" />
                  {t.group.invite}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Settings({ group, me, manages, onFailure }: SectionProps) {
  const { t, store, base, changed, notify } = useApp();
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [nameProblem, setNameProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 1 || name.trim().length > 80) return setNameProblem(t.groups.nameProblem);
    setNameProblem(null);
    setBusy(true);
    onFailure(null);
    try {
      await store.updateGroup(group.id, { name });
      changed();
      notify(t.group.renamed);
    } catch (caught) {
      onFailure(errorText(t, caught));
    }
    setBusy(false);
  }

  /** Something after which this page no longer exists: do it, then go back to the list. */
  async function away(work: () => Promise<void>, done: string) {
    onFailure(null);
    try {
      await work();
      changed();
      notify(done);
      router.replace(`${base}/groups`);
    } catch (caught) {
      onFailure(errorText(t, caught));
    }
  }

  return (
    <section aria-labelledby="group-settings" className="mt-8">
      <h2 id="group-settings" className="type-heading mb-3">
        {t.group.settings}
      </h2>
      <div className="card flex flex-col gap-5 p-4 sm:p-5">
        {manages && (
          <form onSubmit={rename} noValidate>
            <Field label={t.groups.name} error={nameProblem}>
              {(control) => (
                <div className="flex gap-2">
                  <input
                    {...control}
                    className={inputClass}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    autoComplete="off"
                  />
                  <Button type="submit" variant="secondary" busy={busy} disabled={name.trim() === group.name}>
                    {t.group.rename}
                  </Button>
                </div>
              )}
            </Field>
          </form>
        )}
        {manages && (
          <div className="flex flex-col items-start gap-2">
            <Button
              variant="secondary"
              small
              onClick={async () => {
                onFailure(null);
                try {
                  await store.updateGroup(group.id, { archived: !group.archivedAt });
                  changed();
                } catch (caught) {
                  onFailure(errorText(t, caught));
                }
              }}
            >
              {group.archivedAt ? t.group.restore : t.group.archive}
            </Button>
            {!group.archivedAt && <p className="type-small text-ink-muted">{t.group.archiveHint}</p>}
          </div>
        )}
        <ExportPanel group={group} />
        {me.role === "owner" ? (
          <Confirm
            label={t.group.delete}
            question={t.group.deleteConfirm}
            yes={t.common.yes}
            no={t.common.no}
            onConfirm={() => away(() => store.deleteGroup(group.id), t.group.deleted)}
          />
        ) : (
          <Confirm
            label={t.group.leave}
            question={t.group.leaveConfirm}
            yes={t.common.yes}
            no={t.common.no}
            onConfirm={() => away(() => store.removeMember(group.id, me.id), t.group.left)}
          />
        )}
      </div>
    </section>
  );
}
