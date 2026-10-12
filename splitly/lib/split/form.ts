import type { Category, Expense, Member, SplitMode } from "@/lib/domain/types";
import { parseAmount, toDecimalString } from "@/lib/money/amount";

// The expense form as a person fills it in (text in boxes, ticks), and how
// that becomes an expense to be checked. Text that is not a number becomes
// NaN, which the check refuses with the right complaint: nothing typed is
// ever silently turned into a different number.

export type ExpenseForm = {
  description: string;
  amount: string;
  currency: string;
  date: string;
  category: Category | "";
  /** Money that came back: stored as a negative amount. */
  refund: boolean;
  /** More than one person paid; then `paid` says who paid what. */
  several: boolean;
  payerId: string;
  paid: Record<string, string>;
  mode: SplitMode;
  included: Record<string, boolean>;
  /** What was typed per person in each mode, kept apart so that switching modes loses nothing. */
  values: Record<Exclude<SplitMode, "equal">, Record<string, string>>;
};

/** Today, in the visitor's own time zone, as YYYY-MM-DD. */
export function today(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function emptyForm(members: readonly Member[], currency: string, now = new Date()): ExpenseForm {
  const current = members.filter((member) => !member.removedAt);
  return {
    description: "",
    amount: "",
    currency,
    date: today(now),
    category: "",
    refund: false,
    several: false,
    payerId: (current.find((member) => member.self) ?? current[0])?.id ?? "",
    paid: {},
    mode: "equal",
    included: Object.fromEntries(current.map((member) => [member.id, true])),
    values: { exact: {}, percent: {}, shares: {} },
  };
}

/** A stored expense back into the form it was entered with, to be changed. People who have left since are dropped. */
export function formOf(expense: Expense, members: readonly Member[]): ExpenseForm {
  const form = emptyForm(members, expense.currency);
  const current = new Set(members.filter((member) => !member.removedAt).map((member) => member.id));
  const money = (minor: number) => toDecimalString(Math.abs(minor), expense.currency);
  const payers = expense.payers.filter((payer) => current.has(payer.memberId));
  const parts = expense.split.parts.filter((part) => current.has(part.memberId));

  form.description = expense.description;
  form.amount = money(expense.totalMinor);
  form.date = expense.date;
  form.category = expense.category ?? "";
  form.refund = expense.totalMinor < 0;
  form.several = expense.payers.length > 1;
  form.payerId = payers[0]?.memberId ?? form.payerId;
  form.paid = Object.fromEntries(payers.map((payer) => [payer.memberId, money(payer.paidMinor)]));
  form.mode = expense.split.mode;
  form.included = Object.fromEntries([...current].map((id) => [id, parts.some((part) => part.memberId === id)]));
  if (expense.split.mode !== "equal") {
    form.values[expense.split.mode] = Object.fromEntries(
      parts.map((part) => [
        part.memberId,
        expense.split.mode === "exact"
          ? money(part.value)
          : expense.split.mode === "percent"
            ? String(part.value / 100)
            : String(part.value),
      ]),
    );
  }
  return form;
}

/** "25", "33,33" or "12.5" as hundredths of a percent; NaN for anything else. */
export function parsePercent(text: string): number {
  const clean = text.trim().replace(/%$/, "").trim();
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(clean)) return NaN;
  const [whole, fraction = ""] = clean.split(/[.,]/);
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

const parseShares = (text: string) => (/^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : NaN);

/** What the form amounts to, in the shape the expense check takes. `members` gives the order of people. */
export function compose(form: ExpenseForm, members: readonly Member[]) {
  const sign = form.refund ? -1 : 1;
  const amount = (text: string | undefined) => {
    const minor = parseAmount(text ?? "", form.currency);
    // A minus is never typed: the tick box says whether it is a refund.
    if (minor === null || minor < 0) return NaN;
    // Nothing stays plain nothing in a refund, not a negative zero.
    return minor === 0 ? 0 : sign * minor;
  };
  const current = members.filter((member) => !member.removedAt);
  const totalMinor = amount(form.amount);

  const payers = form.several
    ? current
        .filter((member) => (form.paid[member.id] ?? "").trim() !== "")
        .map((member) => ({ memberId: member.id, paidMinor: amount(form.paid[member.id]) }))
    : form.payerId
      ? [{ memberId: form.payerId, paidMinor: totalMinor }]
      : [];

  const parts = current
    .filter((member) => form.included[member.id])
    .map((member) => {
      const text = form.mode === "equal" ? "" : (form.values[form.mode][member.id] ?? "");
      const value =
        form.mode === "equal" ? 1 : form.mode === "exact" ? amount(text) : form.mode === "percent" ? parsePercent(text) : parseShares(text);
      return { memberId: member.id, value };
    });

  return {
    description: form.description,
    category: form.category || null,
    date: form.date,
    currency: form.currency,
    totalMinor,
    payers,
    split: { mode: form.mode, parts },
  };
}
