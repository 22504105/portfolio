import { CATEGORIES, LIMITS, SPLIT_MODES, type ExpenseInput, type SplitInput } from "@/lib/domain/types";
import { allocate } from "@/lib/money/allocate";
import { isCurrencyCode, MAX_MINOR } from "@/lib/money/currency";

// Turning what a person entered into an expense that balances, or into a
// list of what is wrong with it. The form uses this to show problems as they
// are typed; the demo and the server use the very same function before they
// store anything, so nothing is stored that the form would have refused, and
// the shares are always worked out here, never accepted from a client.

export type ExpenseProblem =
  | "description"
  | "date"
  | "currency"
  | "total"
  | "category"
  | "no_payers"
  | "payer_unknown"
  | "payer_repeated"
  | "payers_sum"
  | "payer_sign"
  | "no_participants"
  | "participant_unknown"
  | "participant_repeated"
  | "split_values"
  | "split_sum"
  | "percent_sum";

export type Checked =
  | { ok: true; input: ExpenseInput; splits: { memberId: string; owedMinor: number }[] }
  | {
      ok: false;
      problems: ExpenseProblem[];
      /** For sums that are off: by how much, in minor units or hundredths of a percent. */ differences: Partial<
        Record<ExpenseProblem, number>
      >;
    };

const isDay = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "2000-01-01" && value <= "2100-12-31";
};

const isAmount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && Math.abs(value) <= MAX_MINOR;

/** What each person owes, from how the expense was divided. Null when the division itself is not valid. */
export function buildSplits(totalMinor: number, split: SplitInput): { memberId: string; owedMinor: number }[] | null {
  const { mode, parts } = split;
  if (parts.length === 0) return null;
  const values = parts.map((part) => part.value);
  let owed: number[];

  if (mode === "equal") {
    owed = allocate(
      totalMinor,
      parts.map(() => 1),
    );
  } else if (mode === "exact") {
    // Typed amounts are checked, never adjusted. For a refund they are negative, like its total.
    if (!values.every(isAmount) || values.reduce((a, b) => a + b, 0) !== totalMinor) return null;
    if (values.some((value) => value !== 0 && Math.sign(value) !== Math.sign(totalMinor))) return null;
    owed = values;
  } else if (mode === "percent") {
    if (
      !values.every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 10_000) ||
      values.reduce((a, b) => a + b, 0) !== 10_000
    )
      return null;
    owed = allocate(totalMinor, values);
  } else {
    if (!values.every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 1000) || values.every((value) => value === 0))
      return null;
    owed = allocate(totalMinor, values);
  }
  return parts.map((part, index) => ({ memberId: part.memberId, owedMinor: owed[index] }));
}

/**
 * Checks an expense against the people who can take part in it (the group's
 * current members). `input` may be anything at all: it is what arrived.
 */
export function checkExpense(raw: unknown, memberIds: ReadonlySet<string>): Checked {
  const problems = new Set<ExpenseProblem>();
  const differences: Partial<Record<ExpenseProblem, number>> = {};
  const value = (raw ?? {}) as Record<string, unknown>;

  const description = typeof value.description === "string" ? value.description.trim() : "";
  if (description.length < 1 || description.length > LIMITS.descriptionLength) problems.add("description");

  const category = value.category === null || value.category === undefined || value.category === "" ? null : value.category;
  if (category !== null && !(CATEGORIES as readonly unknown[]).includes(category)) problems.add("category");

  if (!isDay(value.date)) problems.add("date");
  if (!isCurrencyCode(value.currency)) problems.add("currency");

  const total = value.totalMinor;
  const totalOk = isAmount(total) && total !== 0;
  if (!totalOk) problems.add("total");

  // Payers
  const payers = Array.isArray(value.payers) ? (value.payers as { memberId?: unknown; paidMinor?: unknown }[]) : [];
  const payerIds = new Set<string>();
  if (payers.length === 0) problems.add("no_payers");
  for (const payer of payers) {
    if (typeof payer?.memberId !== "string" || !memberIds.has(payer.memberId)) problems.add("payer_unknown");
    else if (payerIds.has(payer.memberId)) problems.add("payer_repeated");
    else payerIds.add(payer.memberId);
    if (!isAmount(payer?.paidMinor) || payer.paidMinor === 0) problems.add("payers_sum");
    else if (totalOk && Math.sign(payer.paidMinor) !== Math.sign(total)) problems.add("payer_sign");
  }
  if (totalOk && payers.length > 0 && payers.every((payer) => isAmount(payer?.paidMinor))) {
    const paid = payers.reduce((sum, payer) => sum + (payer.paidMinor as number), 0);
    if (paid !== total) {
      problems.add("payers_sum");
      differences.payers_sum = total - paid;
    }
  }

  // Participants
  const split = (value.split ?? {}) as { mode?: unknown; parts?: unknown };
  const mode = (SPLIT_MODES as readonly unknown[]).includes(split.mode) ? (split.mode as SplitInput["mode"]) : null;
  const parts = Array.isArray(split.parts) ? (split.parts as { memberId?: unknown; value?: unknown }[]) : [];
  const partIds = new Set<string>();
  if (!mode) problems.add("split_values");
  if (parts.length === 0) problems.add("no_participants");
  for (const part of parts) {
    if (typeof part?.memberId !== "string" || !memberIds.has(part.memberId)) problems.add("participant_unknown");
    else if (partIds.has(part.memberId)) problems.add("participant_repeated");
    else partIds.add(part.memberId);
    if (typeof part?.value !== "number" || !Number.isSafeInteger(part.value)) problems.add("split_values");
  }

  let splits: { memberId: string; owedMinor: number }[] | null = null;
  const cleanParts = parts.map((part) => ({ memberId: String(part?.memberId), value: mode === "equal" ? 1 : Number(part?.value) }));
  if (totalOk && mode && parts.length > 0 && !problems.has("split_values")) {
    splits = buildSplits(total, { mode, parts: cleanParts });
    if (!splits) {
      const sum = cleanParts.reduce((a, b) => a + b.value, 0);
      if (mode === "exact") {
        problems.add("split_sum");
        if (sum !== total) differences.split_sum = total - sum;
      } else if (mode === "percent") {
        problems.add("percent_sum");
        differences.percent_sum = 10_000 - sum;
      } else problems.add("split_values");
    }
  }

  if (problems.size > 0 || !splits || !mode || !totalOk) return { ok: false, problems: [...problems], differences };

  return {
    ok: true,
    input: {
      description,
      category: category as ExpenseInput["category"],
      date: value.date as string,
      currency: value.currency as string,
      totalMinor: total,
      payers: payers.map((payer) => ({ memberId: payer.memberId as string, paidMinor: payer.paidMinor as number })),
      split: { mode, parts: cleanParts },
    },
    splits,
  };
}
