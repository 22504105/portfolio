import type { Expense, Settlement } from "@/lib/domain/types";
import { allocate } from "@/lib/money/allocate";

// Who should pay whom. Two honest answers to that, both worked out from the
// same expenses and the same confirmed payments, and both per currency:
//
// - "Simplified": the fewest-looking set of transfers that brings everyone to
//   zero. People who owe are matched with people who are owed, largest with
//   largest. It is not promised to be the mathematical minimum, only a small
//   and stable one; it may ask someone to pay a person they never shared an
//   expense with.
// - "As it happened": for each pair of people, what one owes the other from
//   the expenses they actually shared, with payments between them taken off.
//
// Only a confirmed payment counts. A proposed one changes nothing.

export type Transfer = { from: string; to: string; currency: string; amountMinor: number };

/**
 * The transfers that settle one currency's nets (member → net: positive is
 * owed, negative owes). `order` is the group's own order of members and
 * breaks ties, so the same balances always give the same transfers.
 */
export function simplify(nets: Readonly<Record<string, number>>, currency: string, order: readonly string[] = []): Transfer[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  const place = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER;
  const people = Object.entries(nets)
    .filter(([, net]) => net !== 0)
    .map(([id, net]) => ({ id, left: Math.abs(net), owes: net < 0 }));
  const biggestFirst = (a: { id: string; left: number }, b: { id: string; left: number }) =>
    b.left - a.left || place(a.id) - place(b.id) || a.id.localeCompare(b.id);
  const debtors = people.filter((person) => person.owes).sort(biggestFirst);
  const creditors = people.filter((person) => !person.owes).sort(biggestFirst);

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amountMinor = Math.min(debtors[d].left, creditors[c].left);
    transfers.push({ from: debtors[d].id, to: creditors[c].id, currency, amountMinor });
    debtors[d].left -= amountMinor;
    creditors[c].left -= amountMinor;
    if (debtors[d].left === 0) d++;
    if (creditors[c].left === 0) c++;
  }
  return transfers;
}

/** Every currency's simplified transfers, currencies in alphabetical order. */
export function simplifyAll(nets: Readonly<Record<string, Readonly<Record<string, number>>>>, order: readonly string[] = []): Transfer[] {
  return Object.keys(nets)
    .sort()
    .flatMap((currency) => simplify(nets[currency], currency, order));
}

/**
 * What each pair of people owes each other from the expenses they shared.
 * In one expense, what a person owes is owed to those who paid it, in
 * proportion to what each of them paid (leftover units to the first payers
 * listed), in such a way that every payer gets back exactly what they paid. Opposite debts between two people are set against each other, and
 * confirmed payments between them are taken off.
 */
export function pairwise(expenses: readonly Expense[], settlements: readonly Settlement[] = [], order: readonly string[] = []): Transfer[] {
  // currency → "debtor|creditor" → amount (may go negative before the two directions are set against each other)
  const owed = new Map<string, Map<string, number>>();
  const add = (currency: string, from: string, to: string, amount: number) => {
    if (from === to || amount === 0) return;
    const pairs = owed.get(currency) ?? new Map<string, number>();
    owed.set(currency, pairs);
    // One entry per pair, kept under the two names in a fixed order; the sign says the direction.
    const [first, second, signed] = from < to ? [from, to, amount] : [to, from, -amount];
    pairs.set(`${first}|${second}`, (pairs.get(`${first}|${second}`) ?? 0) + signed);
  };

  for (const expense of expenses) {
    if (expense.status !== "active") continue;
    // What each payer is still to be given back by the others, used up share by share. Each person's share goes to the
    // payers in proportion to what is still to be given back to each, so that every share is given out in full AND
    // every payer gets back exactly what they paid: dividing each share on its own would be a unit out here and there.
    const left = expense.payers.map((payer) => Math.abs(payer.paidMinor));
    for (const split of expense.splits) {
      if (split.owedMinor === 0) continue;
      const parts = allocate(split.owedMinor, left);
      expense.payers.forEach((payer, index) => {
        add(expense.currency, split.memberId, payer.memberId, parts[index]);
        left[index] -= Math.abs(parts[index]);
      });
    }
  }
  // A payment from A to B takes that much off what A owes B.
  for (const settlement of settlements)
    if (settlement.status === "confirmed") add(settlement.currency, settlement.toMemberId, settlement.fromMemberId, settlement.amountMinor);

  const rank = new Map(order.map((id, index) => [id, index]));
  const place = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER;
  const transfers: Transfer[] = [];
  for (const currency of [...owed.keys()].sort()) {
    for (const [pair, amount] of owed.get(currency)!) {
      if (amount === 0) continue;
      const [first, second] = pair.split("|");
      transfers.push(
        amount > 0
          ? { from: first, to: second, currency, amountMinor: amount }
          : { from: second, to: first, currency, amountMinor: -amount },
      );
    }
  }
  return transfers.sort(
    (a, b) =>
      a.currency.localeCompare(b.currency) ||
      place(a.from) - place(b.from) ||
      place(a.to) - place(b.to) ||
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to),
  );
}
