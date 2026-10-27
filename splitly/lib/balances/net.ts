import type { Expense, Settlement } from "@/lib/domain/types";

// Where everyone stands. A balance is never stored: it is added up from the
// expenses that count and the payments that were confirmed, every time it is
// needed.
//
// Sign: a member's net is what they PAID minus what they OWE, plus what they
// have paid others to settle up, minus what others have paid them. Positive
// means the group owes them; negative means they owe the group. In any
// currency the nets of all members add up to exactly zero.
//
// (The requirements word the last part the other way round, "plus incoming, minus
// outgoing". With net meaning "owed to me", as here, paying someone must
// bring my net UP towards zero and being paid must bring it down: the tests
// pin this.)

/** currency → member → net, in minor units. Only active expenses and confirmed payments count. */
export type Nets = Record<string, Record<string, number>>;

export function netsOf(expenses: readonly Expense[], settlements: readonly Settlement[] = []): Nets {
  const nets: Nets = {};
  for (const expense of expenses) {
    if (expense.status !== "active") continue;
    const currency = (nets[expense.currency] ??= {});
    for (const payer of expense.payers) currency[payer.memberId] = (currency[payer.memberId] ?? 0) + payer.paidMinor;
    for (const split of expense.splits) currency[split.memberId] = (currency[split.memberId] ?? 0) - split.owedMinor;
  }
  for (const settlement of settlements) {
    // A proposed payment is a claim, not a fact: it moves nothing until the other side confirms it.
    if (settlement.status !== "confirmed") continue;
    const currency = (nets[settlement.currency] ??= {});
    currency[settlement.fromMemberId] = (currency[settlement.fromMemberId] ?? 0) + settlement.amountMinor;
    currency[settlement.toMemberId] = (currency[settlement.toMemberId] ?? 0) - settlement.amountMinor;
  }
  return nets;
}

/** One member's net per currency, leaving out currencies in which they are square. */
export function netOfMember(nets: Nets, memberId: string | undefined): Record<string, number> {
  const mine: Record<string, number> = {};
  if (!memberId) return mine;
  for (const [currency, members] of Object.entries(nets)) {
    const net = members[memberId] ?? 0;
    if (net !== 0) mine[currency] = net;
  }
  return mine;
}

/** What was spent in a group, per currency: the totals of its active expenses, refunds taken off. */
export function spentOf(expenses: readonly Expense[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const expense of expenses)
    if (expense.status === "active") totals[expense.currency] = (totals[expense.currency] ?? 0) + expense.totalMinor;
  return totals;
}
