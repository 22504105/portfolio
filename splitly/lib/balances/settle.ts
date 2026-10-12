import type { Member, Settlement, SettlementInput } from "@/lib/domain/types";
import { isCurrencyCode, MAX_MINOR } from "@/lib/money/currency";
import { parseRate, type RateInput } from "@/lib/money/fx";

// The rules for payments between members and for recording exchange rates:
// what is a valid one, and who may do what with it. One set of rules, used
// by the screens (to show only what a person can do), by the demo and by the
// server (to refuse the rest).
//
// A payment is a claim until the person who was paid, or someone who manages
// the group, says it happened:
// - Recorded by the person who was paid, or by a manager: confirmed at once.
// - Recorded by the person who paid: proposed, until the receiver or a
//   manager confirms it. A proposed payment changes no balance.
// - While proposed, anyone involved (who recorded it, who paid, who was to be
//   paid) or a manager can cancel it. Once confirmed, only the receiver or a
//   manager can take it back. Cancelled is final: a new payment is recorded.

export type SettlementProblem = "from" | "to" | "same" | "currency" | "amount";

export function checkSettlement(
  raw: unknown,
  memberIds: ReadonlySet<string>,
): { ok: true; input: SettlementInput } | { ok: false; problems: SettlementProblem[] } {
  const value = (raw ?? {}) as Record<string, unknown>;
  const problems: SettlementProblem[] = [];
  if (typeof value.fromMemberId !== "string" || !memberIds.has(value.fromMemberId)) problems.push("from");
  if (typeof value.toMemberId !== "string" || !memberIds.has(value.toMemberId)) problems.push("to");
  if (problems.length === 0 && value.fromMemberId === value.toMemberId) problems.push("same");
  if (!isCurrencyCode(value.currency)) problems.push("currency");
  if (
    typeof value.amountMinor !== "number" ||
    !Number.isSafeInteger(value.amountMinor) ||
    value.amountMinor <= 0 ||
    value.amountMinor > MAX_MINOR
  )
    problems.push("amount");
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    input: {
      fromMemberId: value.fromMemberId as string,
      toMemberId: value.toMemberId as string,
      currency: value.currency as string,
      amountMinor: value.amountMinor as number,
    },
  };
}

type Actor = Pick<Member, "id" | "role">;
const manages = (actor: Actor) => actor.role === "owner" || actor.role === "admin";

/** Whether a payment recorded by this person counts straight away. */
export const confirmedAtOnce = (actor: Actor, toMemberId: string) => manages(actor) || actor.id === toMemberId;

export const mayConfirm = (actor: Actor, settlement: Pick<Settlement, "status" | "toMemberId">) =>
  settlement.status === "proposed" && (manages(actor) || actor.id === settlement.toMemberId);

export const mayCancel = (actor: Actor, settlement: Pick<Settlement, "status" | "toMemberId" | "fromMemberId" | "createdBy">) =>
  settlement.status === "proposed"
    ? manages(actor) || [settlement.toMemberId, settlement.fromMemberId, settlement.createdBy].includes(actor.id)
    : settlement.status === "confirmed" && (manages(actor) || actor.id === settlement.toMemberId);

export type RateProblem = "from" | "to" | "same" | "rate" | "date";

export const RATES_PER_GROUP = 200;

/** A rate as someone typed it, checked and put into the exact form it is kept in. */
export function checkRate(raw: unknown): { ok: true; input: RateInput } | { ok: false; problems: RateProblem[] } {
  const value = (raw ?? {}) as Record<string, unknown>;
  const problems: RateProblem[] = [];
  if (!isCurrencyCode(value.from)) problems.push("from");
  if (!isCurrencyCode(value.to)) problems.push("to");
  if (problems.length === 0 && value.from === value.to) problems.push("same");
  const rate = parseRate(value.rate);
  if (!rate) problems.push("rate");
  const day = value.effectiveDate;
  const real =
    typeof day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day &&
    day >= "2000-01-01" &&
    day <= "2100-12-31";
  if (!real) problems.push("date");
  if (problems.length > 0 || !rate) return { ok: false, problems };
  return { ok: true, input: { from: value.from as string, to: value.to as string, rate, effectiveDate: day as string } };
}
