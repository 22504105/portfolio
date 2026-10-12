import { CATEGORIES, type ExpenseInput } from "@/lib/domain/types";
import { allocate } from "@/lib/money/allocate";
import { MAX_MINOR } from "@/lib/money/currency";
import { checkExpense, type ExpenseProblem } from "@/lib/split/expense";
import { LINE_KINDS, RECEIPT_LIMITS, type ReceiptExpenseInput, type ReceiptLine, type StoredReceiptLine } from "./types";

// From an assigned receipt to an expense that balances, or to what is wrong
// with it. The screen uses this to show each person's total as lines are
// given out; the demo and the server run the very same function before they
// store anything. Nobody's share is ever accepted from a client.
//
// The rules:
// - A line that was bought is divided among the people it is assigned to, by
//   their weights (1 each for "equally"), leftover units going to the first
//   listed: the same rule as everywhere else in Splitly.
// - An adjustment (discount, tax, service charge, tip, correction) with nobody
//   assigned is spread over everyone in proportion to what they took of the
//   bought lines. With people assigned, it is divided like a bought line.
// - The expense's total is the sum of the lines. Each person owes the sum of
//   their shares of the lines. So lines, shares and total cannot disagree.

export type ReceiptProblem =
  | ExpenseProblem
  | "no_lines"
  | "too_many_lines"
  | "line_kind"
  | "line_label"
  | "line_amount"
  | "line_quantity"
  | "line_unassigned"
  | "assignee_unknown"
  | "assignee_repeated"
  | "assignee_weight"
  | "nothing_bought"
  | "receipt_hash";

export type BuiltReceipt =
  | {
      ok: true;
      expense: ExpenseInput;
      splits: { memberId: string; owedMinor: number }[];
      lines: StoredReceiptLine[];
      contentHash: string;
      mimeType: ReceiptExpenseInput["receipt"]["mimeType"];
    }
  | { ok: false; problems: ReceiptProblem[]; /** Positions (from 0) of the lines that are wrong. */ lines: number[] };

const isAmount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && Math.abs(value) <= MAX_MINOR;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** What each person takes of each line. Null if the lines cannot be divided as asked. */
export function allocateLines(lines: readonly ReceiptLine[]): { memberId: string; shareMinor: number }[][] | null {
  const taken: Record<string, number> = {};
  const order: string[] = [];
  const result: ({ memberId: string; shareMinor: number }[] | null)[] = lines.map(() => null);

  const divide = (line: ReceiptLine, among: { memberId: string; weight: number }[]) => {
    const shares = allocate(
      line.lineTotalMinor,
      among.map((person) => person.weight),
    );
    return among.map((person, index) => ({ memberId: person.memberId, shareMinor: shares[index] }));
  };

  // Bought lines, and adjustments given to particular people, first: they decide the proportions.
  lines.forEach((line, index) => {
    if (line.assigned.length === 0) return;
    const shares = divide(line, line.assigned);
    result[index] = shares;
    if (line.kind !== "item") return;
    for (const share of shares) {
      if (!(share.memberId in taken)) order.push(share.memberId);
      taken[share.memberId] = (taken[share.memberId] ?? 0) + share.shareMinor;
    }
  });

  // Then what is spread over everyone, in proportion to what they took.
  const everyone = order.filter((memberId) => taken[memberId] > 0).map((memberId) => ({ memberId, weight: taken[memberId] }));
  for (const [index, line] of lines.entries()) {
    if (result[index]) continue;
    if (line.kind === "item" || everyone.length === 0) return null;
    result[index] = divide(line, everyone);
  }
  return result as { memberId: string; shareMinor: number }[][];
}

/** Each person's total over all lines, in the order people first appear. */
export function totalsByMember(
  allocations: readonly { memberId: string; shareMinor: number }[][],
): { memberId: string; owedMinor: number }[] {
  const totals = new Map<string, number>();
  for (const line of allocations)
    for (const share of line) totals.set(share.memberId, (totals.get(share.memberId) ?? 0) + share.shareMinor);
  return [...totals].map(([memberId, owedMinor]) => ({ memberId, owedMinor }));
}

/** Checks a receipt against the group's current members. `raw` may be anything at all: it is what arrived. */
export function buildReceiptExpense(raw: unknown, memberIds: ReadonlySet<string>): BuiltReceipt {
  const problems = new Set<ReceiptProblem>();
  const wrong = new Set<number>();
  const value = (raw ?? {}) as Record<string, unknown>;
  const receipt = (value.receipt ?? {}) as Record<string, unknown>;
  const rawLines = Array.isArray(receipt.lines) ? (receipt.lines as Record<string, unknown>[]) : [];

  if (typeof receipt.contentHash !== "string" || !/^[0-9a-f]{64}$/.test(receipt.contentHash)) problems.add("receipt_hash");
  const mimeType = receipt.mimeType === "image/png" || receipt.mimeType === "image/webp" ? receipt.mimeType : "image/jpeg";
  if (rawLines.length === 0) problems.add("no_lines");
  if (rawLines.length > RECEIPT_LIMITS.lines) problems.add("too_many_lines");

  const lines: ReceiptLine[] = rawLines.slice(0, RECEIPT_LIMITS.lines).map((line, index) => {
    const flag = (problem: ReceiptProblem) => {
      problems.add(problem);
      wrong.add(index);
    };
    const kind = (LINE_KINDS as readonly unknown[]).includes(line?.kind) ? (line.kind as ReceiptLine["kind"]) : "item";
    if (!(LINE_KINDS as readonly unknown[]).includes(line?.kind)) flag("line_kind");

    const originalLabel = text(line?.originalLabel).slice(0, RECEIPT_LIMITS.labelLength);
    const displayLabel = text(line?.displayLabel).slice(0, RECEIPT_LIMITS.labelLength);
    if (!displayLabel || text(line?.displayLabel).length > RECEIPT_LIMITS.labelLength) flag("line_label");

    const amount = line?.lineTotalMinor;
    // Something bought costs something; a discount takes off; a correction may go either way; nothing is ever zero.
    const amountOk = isAmount(amount) && amount !== 0 && (kind === "adjustment" || (kind === "discount" ? amount < 0 : amount > 0));
    if (!amountOk) flag("line_amount");

    const quantity = typeof line?.quantity === "string" && /^\d{1,6}(\.\d{1,3})?$/.test(line.quantity) ? line.quantity : "1";
    if (line?.quantity !== undefined && quantity !== line.quantity) flag("line_quantity");

    const seen = new Set<string>();
    const assigned: ReceiptLine["assigned"] = [];
    for (const person of Array.isArray(line?.assigned) ? (line.assigned as Record<string, unknown>[]) : []) {
      const memberId = person?.memberId;
      if (typeof memberId !== "string" || !memberIds.has(memberId)) flag("assignee_unknown");
      else if (seen.has(memberId)) flag("assignee_repeated");
      else if (typeof person.weight !== "number" || !Number.isSafeInteger(person.weight) || person.weight < 1 || person.weight > 1000)
        flag("assignee_weight");
      else {
        seen.add(memberId);
        assigned.push({ memberId, weight: person.weight });
      }
    }
    if (kind === "item" && assigned.length === 0) flag("line_unassigned");

    const confidence =
      typeof line?.confidence === "number" && line.confidence >= 0 && line.confidence <= 100 ? Math.round(line.confidence) : null;
    const source = line?.translationSource === "glossary" || line?.translationSource === "user" ? line.translationSource : "none";
    return {
      kind,
      originalLabel: originalLabel || displayLabel,
      displayLabel,
      translationSource: source,
      quantity,
      lineTotalMinor: amountOk ? amount : 0,
      confidence,
      manualReviewed: line?.manualReviewed === true,
      assigned,
    };
  });

  if (lines.length > 0 && !lines.some((line) => line.kind === "item")) problems.add("nothing_bought");
  const category = value.category === null || value.category === undefined || value.category === "" ? null : value.category;
  if (category !== null && !(CATEGORIES as readonly unknown[]).includes(category)) problems.add("category");
  if (problems.size > 0) return { ok: false, problems: [...problems], lines: [...wrong] };

  const allocations = allocateLines(lines);
  if (!allocations) return { ok: false, problems: ["line_unassigned"], lines: [] };
  const owed = totalsByMember(allocations);
  const totalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);

  // The expense the receipt amounts to: each person owes exactly the sum of their shares of its lines.
  const checked = checkExpense(
    {
      description: value.description,
      category,
      date: value.date,
      currency: value.currency,
      totalMinor,
      payers: value.payers,
      split: { mode: "exact", parts: owed.map((person) => ({ memberId: person.memberId, value: person.owedMinor })) },
    },
    memberIds,
  );
  if (!checked.ok) return { ok: false, problems: checked.problems, lines: [] };

  return {
    ok: true,
    expense: checked.input,
    splits: checked.splits,
    lines: lines.map(({ assigned, ...line }, index) => ({
      ...line,
      allocations: allocations[index],
      method:
        assigned.length > 0 && assigned.every((person) => person.weight === assigned[0].weight) ? ("equal" as const) : ("shares" as const),
    })),
    contentHash: receipt.contentHash as string,
    mimeType,
  };
}
