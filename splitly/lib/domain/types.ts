import type { Rate } from "@/lib/money/fx";
import type { StoredReceiptLine } from "@/lib/receipt/types";

// The shapes the whole application works with. The browser demo and the
// server both produce exactly these, so no screen knows or cares where a
// group's data lives. Amounts are whole minor units of the stated currency.

export type Role = "owner" | "admin" | "member";

export type Member = {
  id: string;
  /** What the person is called in this group. */
  name: string;
  /** Added by name by someone else, without an account of their own. */
  guest: boolean;
  role: Role;
  /** This member is the person looking at the screen. */
  self: boolean;
  /** Their Telegram photo's address, if they signed in through Telegram and have one. Never set in the demo. */
  photoUrl?: string | null;
  /** Set when they left or were removed. Their history stays; they take no part in new expenses. */
  removedAt: string | null;
};

export const SPLIT_MODES = ["equal", "exact", "percent", "shares"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export const CATEGORIES = ["food", "groceries", "transport", "lodging", "fun", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

/** How an expense was divided, as the person entered it, so it can be shown and edited the same way. */
export type SplitInput = {
  mode: SplitMode;
  /**
   * Who takes part and with what value: nothing for "equal", an amount in
   * minor units for "exact", hundredths of a percent for "percent" (25% is
   * 2500), a whole number of shares for "shares".
   */
  parts: { memberId: string; value: number }[];
};

/** What a person submits to add or change an expense. Shares are worked out from it, never taken on trust. */
export type ExpenseInput = {
  description: string;
  category: Category | null;
  /** The day it happened, YYYY-MM-DD. */
  date: string;
  currency: string;
  /** Positive for a purchase, negative for a refund. */
  totalMinor: number;
  payers: { memberId: string; paidMinor: number }[];
  split: SplitInput;
};

export type ExpenseStatus = "active" | "cancelled" | "replaced";

export type Expense = ExpenseInput & {
  id: string;
  /** The lines of the receipt this expense was made from, with what each person took. Absent for an expense typed in by hand. */
  receipt?: { lines: StoredReceiptLine[] } | null;
  status: ExpenseStatus;
  /** What each person owes of it. Always adds up to the total. */
  splits: { memberId: string; owedMinor: number }[];
  createdBy: string;
  createdAt: string;
};

export type SettlementStatus = "proposed" | "confirmed" | "cancelled";

/**
 * A payment from one member to another, outside any expense: how a debt is
 * paid off. It counts only once it is confirmed; a proposed one is a claim
 * ("I paid you") waiting for the other side, and a cancelled one never
 * counted or no longer does.
 */
export type Settlement = {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  currency: string;
  amountMinor: number;
  status: SettlementStatus;
  createdBy: string;
  createdAt: string;
  confirmedAt: string | null;
};

export type SettlementInput = { fromMemberId: string; toMemberId: string; currency: string; amountMinor: number };

export type GroupSummary = {
  id: string;
  name: string;
  baseCurrency: string;
  archivedAt: string | null;
  members: Member[];
  /** What the viewer is owed (positive) or owes (negative), per currency. Empty when square. */
  myNet: Record<string, number>;
  expenseCount: number;
};

export type Group = GroupSummary & {
  /** Every expense, newest first, cancelled and replaced ones included. */
  expenses: Expense[];
  /** Every payment between members, newest first, whatever its state. */
  settlements: Settlement[];
  /** The exchange rates recorded for this group, newest first. Never changed once recorded. */
  rates: Rate[];
};

export type Invite = {
  /** The secret part of the link. Shown once, when the invitation is made. */
  token: string;
  expiresAt: string;
  maxUses: number;
};

export const LIMITS = {
  nameLength: 80,
  descriptionLength: 200,
  membersPerGroup: 50,
  groupsPerUser: 50,
  /** Expenses kept per group. */
  expensesPerGroup: 5000,
} as const;
