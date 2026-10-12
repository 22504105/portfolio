"use client";

import { ArrowLeft, ChevronDown, Copy, Plus, ScanLine, Send } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { errorText, useApp, useLoad } from "@/components/app/AppProvider";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { QrCode } from "@/components/ui/QrCode";
import { Button, buttonClass, Confirm, Field, inputClass, Loading, Problem } from "@/components/ui/controls";
import { netsOf } from "@/lib/balances/net";
import type { Expense, Group, Invite, Member } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { formatMoney } from "@/lib/money/amount";
import { cn } from "@/lib/utils";
import { AnalyticsView } from "./AnalyticsView";
import { DebtsTab } from "./DebtsTab";
import { ExpenseRow, formatDay, MyBalance } from "./parts";
import { ExportButton, RatesSection } from "./RatesSection";

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
  const [tab, setTab] = useState<Tab>("expenses");
  const [failure, setFailure] = useState<string | null>(null);
  const section = { group, me, manages, onFailure: setFailure };

  return (
    <>
      <div className="relative flex flex-col items-center text-center">
        <Link
          href={`${base}/groups`}
          aria-label={t.group.toGroups}
          className="text-ink-muted hover:text-ink absolute top-0 left-0 inline-flex size-11 items-center justify-center rounded-full"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="type-heading max-w-full px-12 pt-2 text-[1.25rem] break-words">{group.name}</h1>
        <p className="type-small text-ink-muted mt-0.5">
          {fill(t.groups.people, { n: people.length })} · {group.baseCurrency}
        </p>
        <AvatarStack people={people} max={3} className="mt-4 [&>*]:size-11" ring="ring-canvas" />
      </div>

      {group.archivedAt && (
        <p className="type-small border-warning/40 bg-warning/10 text-warning rounded-control mt-4 border p-3.5 font-medium">
          {t.group.archivedNote}
        </p>
      )}
      {failure && <Problem className="mt-4">{failure}</Problem>}

      <div role="tablist" aria-label={group.name} className="bg-surface-2 rounded-control mt-5 grid grid-cols-4 gap-1 p-1">
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
              "type-small h-11 min-w-0 truncate rounded-[9px] px-1 font-semibold transition-colors",
              tab === name ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
            )}
          >
            {t.group.tabs[name]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "expenses" && (
          <>
            <section
              aria-labelledby="group-mine"
              className="card mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
            >
              <div>
                <h2 id="group-mine" className="type-label text-ink-muted mb-3">
                  {t.balance.title}
                </h2>
                <MyBalance net={group.myNet} large />
              </div>
              {!group.archivedAt && (
                <div className="flex flex-col gap-2 sm:w-56">
                  <Link href={`${base}/add?group=${group.id}`} className={buttonClass("primary")}>
                    <Plus aria-hidden="true" className="size-5" />
                    {t.group.addExpense}
                  </Link>
                  <Link href={`${base}/scan?group=${group.id}`} className={buttonClass("secondary")}>
                    <ScanLine aria-hidden="true" className="size-5" />
                    {t.home.scan}
                  </Link>
                </div>
              )}
            </section>
            <Balances group={group} />
            <Expenses {...section} />
          </>
        )}
        {tab === "debts" && <DebtsTab group={group} me={me} onFailure={setFailure} />}
        {tab === "analytics" && <AnalyticsView group={group} />}
        {tab === "settings" && (
          <>
            <People {...section} />
            <RatesSection group={group} onFailure={setFailure} />
            <Settings {...section} />
          </>
        )}
      </div>
    </>
  );
}

function Balances({ group }: { group: Group }) {
  const { t, locale } = useApp();
  const nets = netsOf(group.expenses, group.settlements);
  // Everyone still in the group, and anyone who left with something still owed either way.
  const standing = group.members.filter(
    (member) => !member.removedAt || Object.values(nets).some((byMember) => (byMember[member.id] ?? 0) !== 0),
  );

  return (
    <section aria-labelledby="group-balances" className="mt-8">
      <h2 id="group-balances" className="type-heading mb-1">
        {t.group.balances}
      </h2>
      <ul className="divide-line divide-y">
        {standing.map((member) => {
          const lines = Object.entries(nets)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([currency, byMember]) => [currency, byMember[member.id] ?? 0] as const)
            .filter(([, net]) => net !== 0);
          return (
            <li key={member.id} className="flex items-center gap-3 py-2.5">
              <Avatar
                name={member.name}
                seed={member.id}
                photo={member.photoUrl}
                className={cn("size-10", member.removedAt && "opacity-60")}
              />
              <MemberName member={member} className="flex-1" />
              <span className="shrink-0 text-right">
                {lines.length === 0 ? (
                  <span className="type-small text-ink-muted">{t.balance.settled}</span>
                ) : (
                  lines.map(([currency, net]) => (
                    <span key={currency} className={cn("block font-semibold tabular-nums", net > 0 ? "text-positive" : "text-danger")}>
                      {/* The sign says the direction; the words say it to a screen reader. */}
                      <span className="sr-only">{net > 0 ? t.balance.owedTo : t.balance.owedBy} </span>
                      {formatMoney(net, currency, { locale, sign: true })}
                    </span>
                  ))
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
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
        <ul className="divide-line divide-y">
          {shown.map((expense) => {
            const mine = expense.splits.find((split) => split.memberId === me?.id);
            const live = expense.status === "active";
            const expanded = open === expense.id;
            const editable = live && !group.archivedAt && (manages || expense.createdBy === me?.id);
            return (
              <li key={expense.id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`expense-${expense.id}`}
                  onClick={() => setOpen(expanded ? null : expense.id)}
                  className="hover:bg-surface-2/60 rounded-control -mx-2 block w-[calc(100%+1rem)] px-2 transition-colors"
                >
                  <ExpenseRow
                    expense={expense}
                    names={names}
                    face="category"
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

                {expanded && (
                  <div id={`expense-${expense.id}`} className="bg-surface-2/60 rounded-control mb-3 px-4 py-4">
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

function People({ group, me, manages, onFailure }: SectionProps) {
  const { t, store, base, locale, account, changed, notify } = useApp();
  const [guest, setGuest] = useState("");
  const [guestProblem, setGuestProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);

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

  const link =
    invite &&
    (account?.bot ? `https://t.me/${account.bot}?startapp=${invite.token}` : `${window.location.origin}${base}/join?t=${invite.token}`);

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

          <div className="card mt-3 flex flex-col gap-3 p-4 sm:p-5">
            <h3 className="type-small font-semibold">{t.people.invite}</h3>
            {store.kind === "demo" ? (
              <p className="type-small text-ink-muted">{t.people.inviteDemo}</p>
            ) : (
              <>
                <p className="type-small text-ink-muted">{t.people.inviteHint}</p>
                {invite && link && (
                  <div className="flex flex-col gap-2">
                    <QrCode value={link} label={t.people.inviteQr} className="border-line mx-auto size-48 rounded-[14px] border" />
                    <input
                      readOnly
                      aria-label={t.people.inviteLink}
                      className={cn(inputClass, "type-small")}
                      value={link}
                      onFocus={(event) => event.target.select()}
                    />
                    <p className="type-small text-ink-muted">
                      {fill(t.people.inviteExpires, { date: formatDay(invite.expiresAt, locale, true), n: invite.maxUses })}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {invite && link && (
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(fill(t.people.inviteText, { group: group.name }))}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonClass("primary", true)}
                    >
                      <Send aria-hidden="true" className="size-4" />
                      {t.people.inviteShare}
                    </a>
                  )}
                  {invite && link ? (
                    <Button
                      variant="secondary"
                      small
                      onClick={() =>
                        navigator.clipboard.writeText(link).then(
                          () => notify(t.people.inviteCopied),
                          () => onFailure(link),
                        )
                      }
                    >
                      <Copy aria-hidden="true" className="size-4" />
                      {t.people.inviteCopy}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      small
                      onClick={async () => {
                        onFailure(null);
                        try {
                          setInvite(await store.createInvite(group.id));
                        } catch (caught) {
                          onFailure(errorText(t, caught));
                        }
                      }}
                    >
                      {t.people.inviteCreate}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    small
                    onClick={async () => {
                      onFailure(null);
                      try {
                        const revoked = await store.revokeInvites(group.id);
                        setInvite(null);
                        notify(fill(t.people.inviteRevoked, { n: revoked }));
                      } catch (caught) {
                        onFailure(errorText(t, caught));
                      }
                    }}
                  >
                    {t.people.inviteRevoke}
                  </Button>
                </div>
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
        <ExportButton group={group} />
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
