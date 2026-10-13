import { simplifyAll } from "@/lib/balances/debts";
import { netsOf } from "@/lib/balances/net";
import type { Group } from "@/lib/domain/types";
import { toDecimalString } from "@/lib/money/amount";

// A group's figures as tables, for the files a person can take away: a
// spreadsheet (XLSX or CSV) and a PDF. One function makes the tables, and
// every format is written from them, so the three files can never disagree.
//
// Nothing is converted: every amount stands in the currency of its expense
// or payment, as exact decimal text, with the currency in the next column.

export const SECTIONS = ["expenses", "debts", "payments"] as const;
export type Section = (typeof SECTIONS)[number];

export type ReportFilter = {
  /** Which tables to make. */
  sections: readonly Section[];
  /** First and last day, YYYY-MM-DD, both included; null for no limit. Debts are as they stand now, whatever the period. */
  from: string | null;
  to: string | null;
  /** One currency only, or null for all of them. */
  currency: string | null;
};

/** The words a report is written in: column headings and the names of states and categories, in the reader's language. */
export type ReportWords = {
  sections: Record<Section, string>;
  expenses: readonly string[];
  debts: readonly string[];
  payments: readonly string[];
  category: (key: string | null) => string;
  expenseState: (key: string) => string;
  paymentState: (key: string) => string;
  /** For a table with nothing in it. */
  empty: string;
};

export type Table = {
  section: Section;
  title: string;
  heading: string[];
  /** Columns that hold amounts: written as numbers in a spreadsheet, set to the right in a PDF. */
  numeric: number[];
  rows: string[][];
};

const inPeriod = (day: string, filter: ReportFilter) =>
  (!filter.from || day.slice(0, 10) >= filter.from) && (!filter.to || day.slice(0, 10) <= filter.to);

export function buildReport(group: Group, filter: ReportFilter, words: ReportWords): Table[] {
  const name = (id: string) => group.members.find((member) => member.id === id)?.name ?? "?";
  const wanted = (currency: string) => !filter.currency || currency === filter.currency;
  const people = (parts: readonly { memberId: string; amount: number }[], currency: string) =>
    parts.map((part) => `${name(part.memberId)}: ${toDecimalString(part.amount, currency)}`).join("; ");
  const tables: Table[] = [];

  if (filter.sections.includes("expenses")) {
    tables.push({
      section: "expenses",
      title: words.sections.expenses,
      heading: [...words.expenses],
      numeric: [3],
      rows: group.expenses
        .filter((expense) => wanted(expense.currency) && inPeriod(expense.date, filter))
        .map((expense) => [
          expense.date,
          expense.description,
          words.category(expense.category),
          toDecimalString(expense.totalMinor, expense.currency),
          expense.currency,
          words.expenseState(expense.status),
          people(
            expense.payers.map((payer) => ({ memberId: payer.memberId, amount: payer.paidMinor })),
            expense.currency,
          ),
          people(
            expense.splits.map((split) => ({ memberId: split.memberId, amount: split.owedMinor })),
            expense.currency,
          ),
        ]),
    });
  }

  if (filter.sections.includes("debts")) {
    // What is owed now: the fewest transfers that settle everything, as the Debts tab shows them.
    const order = group.members.map((member) => member.id);
    tables.push({
      section: "debts",
      title: words.sections.debts,
      heading: [...words.debts],
      numeric: [2],
      rows: simplifyAll(netsOf(group.expenses, group.settlements), order)
        .filter((transfer) => wanted(transfer.currency))
        .map((transfer) => [
          name(transfer.from),
          name(transfer.to),
          toDecimalString(transfer.amountMinor, transfer.currency),
          transfer.currency,
        ]),
    });
  }

  if (filter.sections.includes("payments")) {
    tables.push({
      section: "payments",
      title: words.sections.payments,
      heading: [...words.payments],
      numeric: [3],
      rows: group.settlements
        .filter((settlement) => wanted(settlement.currency) && inPeriod(settlement.confirmedAt ?? settlement.createdAt, filter))
        .map((settlement) => [
          (settlement.confirmedAt ?? settlement.createdAt).slice(0, 10),
          name(settlement.fromMemberId),
          name(settlement.toMemberId),
          toDecimalString(settlement.amountMinor, settlement.currency),
          settlement.currency,
          words.paymentState(settlement.status),
        ]),
    });
  }
  return tables;
}

/** A cell that a spreadsheet would run as a formula is made plain text. */
export const plain = (value: string) => (/^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value);

/**
 * The tables as one CSV file: each under its own title, a blank line between
 * them. With a single table the title is left out, so the file is a plain
 * table that any program reads.
 */
export function reportCsv(tables: readonly Table[]): string {
  const cell = (value: string) => {
    const safe = plain(value);
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const blocks = tables.map((table) =>
    [
      ...(tables.length > 1 ? [cell(table.title)] : []),
      table.heading.map(cell).join(","),
      ...table.rows.map((row) => row.map(cell).join(",")),
    ].join("\r\n"),
  );
  // Windows line ends and a byte-order mark: what spreadsheet programs expect, so that non-Latin names open correctly.
  return `﻿${blocks.join("\r\n\r\n")}\r\n`;
}

/** A name a file system will take, whatever the group is called. */
export function fileName(groupName: string, extension: string): string {
  const safe = groupName
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `splitly-${safe || "group"}.${extension}`;
}
