"use client";

import { ArrowRight, CircleCheck, Clock } from "lucide-react";
import { useRef, useState } from "react";
import { errorText, useApp } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button, inputClass, Problem } from "@/components/ui/controls";
import { pairwise, simplifyAll, type Transfer } from "@/lib/balances/debts";
import { netsOf } from "@/lib/balances/net";
import { confirmedAtOnce, mayCancel, mayConfirm } from "@/lib/balances/settle";
import type { Group, Member, Settlement } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { formatMoney, parseAmount, toDecimalString } from "@/lib/money/amount";
import { cn } from "@/lib/utils";
import { formatDay } from "./parts";

/**
 * The concept's "debts and settling up": who should pay whom, simplified or
 * as it happened, and a way to say a debt was paid. A payment counts when
 * the person who was paid (or a manager) says so; until then it is shown as
 * waiting and changes no balance.
 */
export function DebtsTab({ group, me, onFailure }: { group: Group; me: Member | undefined; onFailure: (message: string | null) => void }) {
  const { t, store, locale, changed, notify } = useApp();
  const [view, setView] = useState<"simple" | "all">("simple");
  const [paying, setPaying] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [amountProblem, setAmountProblem] = useState(false);
  const [busy, setBusy] = useState(false);
  const submission = useRef<{ key: string; body: string } | null>(null);

  const people = new Map(group.members.map((member) => [member.id, member]));
  const order = group.members.map((member) => member.id);
  const current = new Set(group.members.filter((member) => !member.removedAt).map((member) => member.id));
  const transfers =
    view === "simple" ? simplifyAll(netsOf(group.expenses, group.settlements), order) : pairwise(group.expenses, group.settlements, order);
  const waiting = group.settlements.filter((settlement) => settlement.status === "proposed");
  const past = group.settlements.filter((settlement) => settlement.status !== "proposed").slice(0, 12);
  const money = (minor: number, currency: string) => formatMoney(minor, currency, { locale });
  const key = (transfer: Transfer) => `${transfer.from}|${transfer.to}|${transfer.currency}`;

  async function act(work: () => Promise<unknown>, done: string) {
    onFailure(null);
    setBusy(true);
    try {
      await work();
      changed();
      notify(done);
      setPaying(null);
    } catch (caught) {
      onFailure(errorText(t, caught));
    }
    setBusy(false);
  }

  function pay(transfer: Transfer) {
    const minor = parseAmount(amount, transfer.currency);
    if (minor === null || minor <= 0) return setAmountProblem(true);
    setAmountProblem(false);
    const input = { fromMemberId: transfer.from, toMemberId: transfer.to, currency: transfer.currency, amountMinor: minor };
    const body = JSON.stringify(input);
    if (submission.current?.body !== body) submission.current = { key: crypto.randomUUID(), body };
    const atOnce = !!me && confirmedAtOnce(me, transfer.to);
    void act(() => store.createSettlement(group.id, submission.current!.key, input), atOnce ? t.debts.recorded : t.debts.proposedDone);
  }

  const Pair = ({ from, to }: { from: string; to: string }) => (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5">
      <span className="font-medium break-words">{people.get(from)?.name ?? "?"}</span>
      <ArrowRight aria-label={t.scan.owesTo} className="text-ink-muted size-4 shrink-0" />
      <span className="font-medium break-words">{people.get(to)?.name ?? "?"}</span>
    </span>
  );

  return (
    <>
      <div role="radiogroup" aria-label={t.debts.view} className="bg-surface-2 rounded-control mt-5 grid grid-cols-2 gap-1 p-1">
        {(["simple", "all"] as const).map((option) => (
          <label
            key={option}
            className={cn(
              "type-small has-focus-visible:outline-primary flex h-11 cursor-pointer items-center justify-center rounded-[9px] px-2 text-center font-semibold transition-colors has-focus-visible:outline-2",
              view === option ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
            )}
          >
            <input type="radio" name="debts-view" className="sr-only" checked={view === option} onChange={() => setView(option)} />
            {t.debts.views[option]}
          </label>
        ))}
      </div>
      <p className="type-small text-ink-muted mt-2">{t.debts.viewHints[view]}</p>

      <section aria-label={t.debts.views[view]} className="mt-4">
        {transfers.length === 0 ? (
          <div className="card flex items-center gap-3 p-5">
            <CircleCheck aria-hidden="true" className="text-positive size-6 shrink-0" />
            <div>
              <p className="font-semibold">{t.debts.none}</p>
              <p className="type-small text-ink-muted">{t.debts.noneHint}</p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {transfers.map((transfer) => {
              const open = paying === key(transfer);
              // Anyone in the group may record a payment between two people still in it; whether it counts at once depends on who they are.
              const can = !!me && !group.archivedAt && current.has(transfer.from) && current.has(transfer.to);
              return (
                <li key={key(transfer)} className="card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={people.get(transfer.from)?.name ?? "?"}
                      seed={transfer.from}
                      photo={people.get(transfer.from)?.photoUrl}
                      className="size-10"
                    />
                    <span className="min-w-0 flex-1">
                      <Pair from={transfer.from} to={transfer.to} />
                      <span className="block text-[1.125rem] font-semibold tabular-nums">
                        {money(transfer.amountMinor, transfer.currency)}
                      </span>
                    </span>
                    {can && !open && (
                      <Button
                        small
                        onClick={() => {
                          setPaying(key(transfer));
                          setAmount(toDecimalString(transfer.amountMinor, transfer.currency));
                          setAmountProblem(false);
                        }}
                      >
                        {t.debts.settle}
                      </Button>
                    )}
                  </div>
                  {open && (
                    <div className="border-line mt-3 flex flex-col gap-2.5 border-t pt-3">
                      <label className="flex items-center justify-between gap-3">
                        <span className="type-small font-semibold">{fill(t.debts.amount, { currency: transfer.currency })}</span>
                        <input
                          className={cn(inputClass, "h-11 w-36 text-right font-semibold tabular-nums")}
                          inputMode="decimal"
                          autoComplete="off"
                          aria-invalid={amountProblem || undefined}
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                        />
                      </label>
                      <p className="type-small text-ink-muted">
                        {me && confirmedAtOnce(me, transfer.to)
                          ? t.debts.countsNow
                          : fill(t.debts.waitsFor, { name: people.get(transfer.to)?.name ?? "?" })}
                      </p>
                      {amountProblem && <Problem>{t.expense.problems.total}</Problem>}
                      <div className="flex flex-wrap gap-2">
                        <Button small busy={busy} onClick={() => pay(transfer)}>
                          {t.debts.markPaid}
                        </Button>
                        <Button variant="ghost" small onClick={() => setPaying(null)}>
                          {t.common.cancel}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {transfers.length > 0 && view === "simple" && <p className="type-small text-ink-muted mt-3 text-center">{t.debts.afterThese}</p>}
      </section>

      {waiting.length > 0 && (
        <section aria-labelledby="debts-waiting" className="mt-8">
          <h2 id="debts-waiting" className="type-heading mb-1">
            {t.debts.waiting}
          </h2>
          <p className="type-small text-ink-muted mb-3">{t.debts.waitingHint}</p>
          <ul className="flex flex-col gap-2.5">
            {waiting.map((settlement) => (
              <SettlementRow key={settlement.id} settlement={settlement} people={people}>
                {me && mayConfirm(me, settlement) && (
                  <Button small busy={busy} onClick={() => act(() => store.confirmSettlement(group.id, settlement.id), t.debts.confirmed)}>
                    {t.debts.confirm}
                  </Button>
                )}
                {me && mayCancel(me, settlement) && (
                  <Button
                    variant="ghost"
                    small
                    onClick={() => act(() => store.cancelSettlement(group.id, settlement.id), t.debts.cancelled)}
                  >
                    {t.debts.withdraw}
                  </Button>
                )}
              </SettlementRow>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section aria-labelledby="debts-past" className="mt-8">
          <h2 id="debts-past" className="type-heading mb-3">
            {t.debts.past}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {past.map((settlement) => (
              <SettlementRow key={settlement.id} settlement={settlement} people={people}>
                {me && settlement.status === "confirmed" && mayCancel(me, settlement) && (
                  <Button
                    variant="ghost"
                    small
                    onClick={() => act(() => store.cancelSettlement(group.id, settlement.id), t.debts.cancelled)}
                  >
                    {t.debts.takeBack}
                  </Button>
                )}
              </SettlementRow>
            ))}
          </ul>
        </section>
      )}
    </>
  );

  function SettlementRow({
    settlement,
    people: names,
    children,
  }: {
    settlement: Settlement;
    people: Map<string, Member>;
    children?: React.ReactNode;
  }) {
    const live = settlement.status !== "cancelled";
    return (
      <li className="card flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            settlement.status === "confirmed" ? "bg-positive/15 text-positive" : "bg-surface-2 text-ink-muted",
          )}
        >
          {settlement.status === "confirmed" ? (
            <CircleCheck aria-hidden="true" className="size-5" />
          ) : (
            <Clock aria-hidden="true" className="size-5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("flex flex-wrap items-center gap-x-1.5", !live && "text-ink-muted line-through")}>
            <span className="font-medium break-words">{names.get(settlement.fromMemberId)?.name ?? "?"}</span>
            <ArrowRight aria-label={t.debts.paidTo} className="text-ink-muted size-4 shrink-0" />
            <span className="font-medium break-words">{names.get(settlement.toMemberId)?.name ?? "?"}</span>
            <span className="font-semibold tabular-nums">{money(settlement.amountMinor, settlement.currency)}</span>
          </span>
          <span className="type-small text-ink-muted block">
            {t.debts.states[settlement.status]} · {formatDay(settlement.confirmedAt ?? settlement.createdAt, locale)}
          </span>
        </span>
        {/* On a phone the buttons go under the words, not beside them: there is no room for both. */}
        {children && <span className="flex w-full flex-wrap gap-2 sm:w-auto">{children}</span>}
      </li>
    );
  }
}
