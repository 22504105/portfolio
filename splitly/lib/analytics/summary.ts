import type { Category, Expense } from "@/lib/domain/types";
import { convert, rateOn, type Rate } from "@/lib/money/fx";

// What a group spent, looked at several ways. Only expenses that count
// (active ones) are looked at; refunds take off. Figures are shown in one
// currency, the group's own: an expense in another currency is converted at
// the rate recorded for its day, and if there is none it is NOT included in
// the figures and is counted as left out instead. Nothing is ever converted
// at a guessed rate, and old figures do not move when a new rate is added
// for a later day.

export type Period = { from: string; to: string };

export type Summary = {
  currency: string;
  /** Expenses in the period that are in the figures. */
  count: number;
  totalMinor: number;
  /** The total divided by the count, rounded to a unit; null with nothing to average. */
  averageMinor: number | null;
  byCategory: { category: Category | null; totalMinor: number; /** Hundredths of a percent of the total. */ share: number }[];
  /** What each person's shares of those expenses add up to. */
  byMember: { memberId: string; owedMinor: number; share: number }[];
  /** One entry per day of the period that had spending, oldest first. */
  byDay: { day: string; totalMinor: number }[];
  /** Spending in the period in each original currency, before any conversion. */
  native: Record<string, number>;
  /** Expenses that could not be converted, per currency: how many and how much, in that currency. */
  leftOut: { currency: string; count: number; totalMinor: number }[];
};

/** The first and last day of the month a day is in, and of the month before. */
export function monthOf(day: string, offset = 0): Period {
  const [year, month] = day.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + offset, 1));
  const last = new Date(Date.UTC(year, month + offset, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

const shareOf = (part: number, whole: number) => (whole > 0 ? Math.round((Math.max(0, part) / whole) * 10_000) : 0);

export function summarise(expenses: readonly Expense[], currency: string, rates: readonly Rate[], period: Period | null): Summary {
  const categories = new Map<Category | null, number>();
  const members = new Map<string, number>();
  const days = new Map<string, number>();
  const native: Record<string, number> = {};
  const leftOut = new Map<string, { count: number; totalMinor: number }>();
  let totalMinor = 0;
  let count = 0;

  for (const expense of expenses) {
    if (expense.status !== "active") continue;
    if (period && (expense.date < period.from || expense.date > period.to)) continue;
    native[expense.currency] = (native[expense.currency] ?? 0) + expense.totalMinor;

    const applied = rateOn(rates, expense.currency, currency, expense.date);
    if (!applied) {
      const missing = leftOut.get(expense.currency) ?? { count: 0, totalMinor: 0 };
      leftOut.set(expense.currency, { count: missing.count + 1, totalMinor: missing.totalMinor + expense.totalMinor });
      continue;
    }
    const total = convert(expense.totalMinor, expense.currency, currency, applied.rate);
    count++;
    totalMinor += total;
    categories.set(expense.category, (categories.get(expense.category) ?? 0) + total);
    days.set(expense.date, (days.get(expense.date) ?? 0) + total);
    for (const split of expense.splits)
      members.set(split.memberId, (members.get(split.memberId) ?? 0) + convert(split.owedMinor, expense.currency, currency, applied.rate));
  }

  return {
    currency,
    count,
    totalMinor,
    averageMinor: count > 0 ? Math.round(totalMinor / count) : null,
    byCategory: [...categories]
      .map(([category, total]) => ({ category, totalMinor: total, share: shareOf(total, totalMinor) }))
      .sort((a, b) => b.totalMinor - a.totalMinor || String(a.category).localeCompare(String(b.category))),
    byMember: [...members]
      .map(([memberId, owedMinor]) => ({ memberId, owedMinor, share: shareOf(owedMinor, totalMinor) }))
      .sort((a, b) => b.owedMinor - a.owedMinor || a.memberId.localeCompare(b.memberId)),
    byDay: [...days].map(([day, total]) => ({ day, totalMinor: total })).sort((a, b) => a.day.localeCompare(b.day)),
    native,
    leftOut: [...leftOut].map(([code, missing]) => ({ currency: code, ...missing })).sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}

/**
 * A group's expenses as a spreadsheet file (CSV): one row per expense, in
 * its own currency, exact amounts as decimal text. A cell that starts with
 * a character a spreadsheet would run as a formula is made plain text.
 */
export function toCsv(
  expenses: readonly Expense[],
  names: ReadonlyMap<string, string>,
  heading: readonly string[],
  amount: (minor: number, currency: string) => string,
): string {
  const cell = (value: string) => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const people = (parts: readonly { memberId: string; amount: number }[], currency: string) =>
    parts.map((part) => `${names.get(part.memberId) ?? "?"}: ${amount(part.amount, currency)}`).join("; ");
  const rows = expenses.map((expense) =>
    [
      expense.date,
      expense.description,
      expense.category ?? "",
      amount(expense.totalMinor, expense.currency),
      expense.currency,
      expense.status,
      people(
        expense.payers.map((payer) => ({ memberId: payer.memberId, amount: payer.paidMinor })),
        expense.currency,
      ),
      people(
        expense.splits.map((split) => ({ memberId: split.memberId, amount: split.owedMinor })),
        expense.currency,
      ),
    ]
      .map(cell)
      .join(","),
  );
  // Windows line ends and a byte-order mark: what spreadsheet programs expect, so that non-Latin names open correctly.
  return `﻿${[heading.map(cell).join(","), ...rows].join("\r\n")}\r\n`;
}
