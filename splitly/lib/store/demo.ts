import { netOfMember, netsOf } from "@/lib/balances/net";
import { checkRate, checkSettlement, confirmedAtOnce, mayCancel, mayConfirm, RATES_PER_GROUP } from "@/lib/balances/settle";
import { LIMITS, type Expense, type Group, type GroupSummary, type Member, type Role, type Settlement } from "@/lib/domain/types";
import type { Rate } from "@/lib/money/fx";
import { isCurrencyCode } from "@/lib/money/currency";
import { buildReceiptExpense } from "@/lib/receipt/build";
import { checkExpense } from "@/lib/split/expense";
import { seedGroups } from "./seed";
import { StoreError, type Store } from "./types";

// The demo's data: invented groups kept in this browser's own storage and
// nowhere else. Nothing is sent anywhere; another visitor, or the same one in
// another browser, starts from the same invented groups. It applies the same
// rules as the server (the same expense check, the same roles), so what the
// demo lets you do is what the real thing lets you do.

export type DemoGroup = {
  id: string;
  name: string;
  baseCurrency: string;
  archivedAt: string | null;
  members: Member[];
  /** Newest first. */
  expenses: Expense[];
  /** Submission keys already used → the expense each made. */
  keys: Record<string, string>;
  /** Payments between members, newest first. */
  settlements?: Settlement[];
  /** Exchange rates recorded for the group, newest first. */
  rates?: Rate[];
  /** Photos already turned into expenses: the photo's hash → the expense. Only the hash is kept, never the photo. */
  receipts?: Record<string, string>;
};

type DemoState = { version: 1; groups: DemoGroup[] };

export const DEMO_STORAGE_KEY = "splitly-demo-v1";

/** Somewhere to keep a string. The browser's localStorage in the app; a plain object in tests. */
export type Shelf = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };

const cleanName = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length >= 1 && value.trim().length <= LIMITS.nameLength ? value.trim() : null;

export function createDemoStore(shelf: Shelf, locale: string, newId: () => string = () => crypto.randomUUID()): Store & { reset(): void } {
  function load(): DemoState {
    try {
      const stored = JSON.parse(shelf.getItem(DEMO_STORAGE_KEY) ?? "null") as DemoState | null;
      if (stored?.version === 1 && Array.isArray(stored.groups)) return stored;
    } catch {
      // Unreadable (edited by hand, or cut short): start again from the invented groups.
    }
    return { version: 1, groups: seedGroups(locale) };
  }

  function save(state: DemoState) {
    try {
      shelf.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage is full or switched off (private windows): the demo still works until the page is closed.
      memory = state;
    }
  }

  // Used only when the browser refuses to store anything.
  let memory: DemoState | null = null;
  const read = () => memory ?? load();

  /** Reads the state, lets `change` alter one group, and stores the result. */
  function inGroup<T>(groupId: string, change: (group: DemoGroup, me: Member, state: DemoState) => T): T {
    const state = read();
    const group = state.groups.find((candidate) => candidate.id === groupId);
    const me = group?.members.find((member) => member.self && !member.removedAt);
    if (!group || !me) throw new StoreError("not_found");
    const result = change(group, me, state);
    save(state);
    return result;
  }

  const manager = (me: Member) => {
    if (me.role !== "owner" && me.role !== "admin") throw new StoreError("forbidden");
  };

  const view = (group: DemoGroup): Group => {
    const me = group.members.find((member) => member.self);
    // Newest first by the day it happened, then by when it was entered.
    const expenses = [...group.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    return {
      id: group.id,
      name: group.name,
      baseCurrency: group.baseCurrency,
      archivedAt: group.archivedAt,
      members: group.members,
      expenses,
      settlements: group.settlements ?? [],
      rates: group.rates ?? [],
      myNet: netOfMember(netsOf(expenses, group.settlements ?? []), me?.id),
      expenseCount: expenses.filter((expense) => expense.status === "active").length,
    };
  };

  function store(group: DemoGroup, me: Member, key: string, input: unknown): string {
    if (typeof key !== "string" || key.length < 8) throw new StoreError("invalid", { field: "idempotencyKey" });
    // An archived group is kept as it is.
    if (group.archivedAt) throw new StoreError("conflict");
    const current = new Set(group.members.filter((member) => !member.removedAt).map((member) => member.id));
    const checked = checkExpense(input, current);
    if (!checked.ok) throw new StoreError("invalid", { problems: checked.problems, differences: checked.differences });
    if (group.expenses.length >= LIMITS.expensesPerGroup) throw new StoreError("limit");
    const expense: Expense = {
      ...checked.input,
      id: newId(),
      status: "active",
      splits: checked.splits,
      createdBy: me.id,
      createdAt: new Date().toISOString(),
    };
    group.expenses.unshift(expense);
    group.keys[key] = expense.id;
    return expense.id;
  }

  const editable = (group: DemoGroup, me: Member, expenseId: string): Expense => {
    const expense = group.expenses.find((candidate) => candidate.id === expenseId);
    if (!expense) throw new StoreError("not_found");
    if (expense.createdBy !== me.id && me.role === "member") throw new StoreError("forbidden");
    return expense;
  };

  return {
    kind: "demo",

    async listGroups(): Promise<GroupSummary[]> {
      return read()
        .groups.map(view)
        .map(({ expenses, settlements, rates, ...summary }) => (void expenses, void settlements, void rates, summary))
        .sort((a, b) => Number(a.archivedAt !== null) - Number(b.archivedAt !== null));
    },

    async getGroup(id) {
      const group = read().groups.find((candidate) => candidate.id === id);
      return group ? view(group) : null;
    },

    async createGroup(input) {
      const name = cleanName(input.name);
      if (!name) throw new StoreError("invalid", { field: "name" });
      if (!isCurrencyCode(input.baseCurrency)) throw new StoreError("invalid", { field: "baseCurrency" });
      const state = read();
      if (state.groups.length >= LIMITS.groupsPerUser) throw new StoreError("limit");
      const self = seedGroups(locale)[0].members.find((member) => member.self)!;
      const group: DemoGroup = {
        id: newId(),
        name,
        baseCurrency: input.baseCurrency,
        archivedAt: null,
        members: [{ ...self, id: newId(), role: "owner" }],
        expenses: [],
        keys: {},
      };
      state.groups.unshift(group);
      save(state);
      return group.id;
    },

    async updateGroup(id, input) {
      inGroup(id, (group, me) => {
        manager(me);
        if (input.name !== undefined) {
          const name = cleanName(input.name);
          if (!name) throw new StoreError("invalid", { field: "name" });
          group.name = name;
        }
        if (typeof input.archived === "boolean") group.archivedAt = input.archived ? (group.archivedAt ?? new Date().toISOString()) : null;
      });
    },

    async deleteGroup(id) {
      inGroup(id, (group, me, state) => {
        if (me.role !== "owner") throw new StoreError("forbidden");
        state.groups = state.groups.filter((candidate) => candidate.id !== group.id);
      });
    },

    async addGuest(groupId, guestName) {
      return inGroup(groupId, (group, me) => {
        manager(me);
        const name = cleanName(guestName);
        if (!name) throw new StoreError("invalid", { field: "name" });
        if (group.members.filter((member) => !member.removedAt).length >= LIMITS.membersPerGroup) throw new StoreError("limit");
        const id = newId();
        group.members.push({ id, name, guest: true, role: "member", self: false, removedAt: null });
        return id;
      });
    },

    async removeMember(groupId, memberId) {
      inGroup(groupId, (group, me) => {
        const target = group.members.find((member) => member.id === memberId && !member.removedAt);
        if (!target) throw new StoreError("not_found");
        const leaving = target.id === me.id;
        if (!leaving) manager(me);
        if (target.role === "owner") throw new StoreError("forbidden");
        if (!leaving && target.role === "admin" && me.role !== "owner") throw new StoreError("forbidden");
        // Marked, not erased: what they paid and owed stays in the history.
        target.removedAt = new Date().toISOString();
        target.role = "member";
      });
    },

    async setRole(groupId, memberId, role: Exclude<Role, "owner">) {
      inGroup(groupId, (group, me) => {
        if (me.role !== "owner") throw new StoreError("forbidden");
        if (role !== "admin" && role !== "member") throw new StoreError("invalid", { field: "role" });
        const target = group.members.find(
          (member) => member.id === memberId && !member.removedAt && !member.guest && member.role !== "owner",
        );
        if (!target) throw new StoreError("not_found");
        target.role = role;
      });
    },

    // Invitations bring in other people's accounts, and the demo has none: these say so rather than pretend.
    async createInvite() {
      throw new StoreError("forbidden");
    },
    async revokeInvites() {
      return 0;
    },
    async previewInvite() {
      throw new StoreError("not_found");
    },
    async acceptInvite() {
      throw new StoreError("not_found");
    },

    async createExpense(groupId, key, input) {
      return inGroup(groupId, (group, me) => group.keys[key] ?? store(group, me, key, input));
    },

    async replaceExpense(groupId, expenseId, key, input) {
      return inGroup(groupId, (group, me) => {
        if (group.keys[key]) return group.keys[key];
        const old = editable(group, me, expenseId);
        if (old.status !== "active") throw new StoreError("conflict");
        const id = store(group, me, key, input);
        old.status = "replaced";
        return id;
      });
    },

    async cancelExpense(groupId, expenseId) {
      inGroup(groupId, (group, me) => {
        const expense = editable(group, me, expenseId);
        if (expense.status === "cancelled") return;
        if (expense.status !== "active") throw new StoreError("conflict");
        expense.status = "cancelled";
      });
    },

    async createSettlement(groupId, key, input) {
      return inGroup(groupId, (group, me) => {
        if (group.keys[key]) return group.keys[key];
        if (typeof key !== "string" || key.length < 8) throw new StoreError("invalid", { field: "idempotencyKey" });
        if (group.archivedAt) throw new StoreError("conflict");
        const current = new Set(group.members.filter((member) => !member.removedAt).map((member) => member.id));
        const checked = checkSettlement(input, current);
        if (!checked.ok) throw new StoreError("invalid", { problems: checked.problems });
        const now = new Date().toISOString();
        const confirmed = confirmedAtOnce(me, checked.input.toMemberId);
        const settlement: Settlement = {
          ...checked.input,
          id: newId(),
          status: confirmed ? "confirmed" : "proposed",
          createdBy: me.id,
          createdAt: now,
          confirmedAt: confirmed ? now : null,
        };
        group.settlements = [settlement, ...(group.settlements ?? [])];
        group.keys[key] = settlement.id;
        return settlement.id;
      });
    },

    async confirmSettlement(groupId, settlementId) {
      inGroup(groupId, (group, me) => {
        const settlement = group.settlements?.find((candidate) => candidate.id === settlementId);
        if (!settlement) throw new StoreError("not_found");
        if (settlement.status === "confirmed") return;
        if (settlement.status !== "proposed") throw new StoreError("conflict");
        if (!mayConfirm(me, settlement)) throw new StoreError("forbidden");
        settlement.status = "confirmed";
        settlement.confirmedAt = new Date().toISOString();
      });
    },

    async cancelSettlement(groupId, settlementId) {
      inGroup(groupId, (group, me) => {
        const settlement = group.settlements?.find((candidate) => candidate.id === settlementId);
        if (!settlement) throw new StoreError("not_found");
        if (settlement.status === "cancelled") return;
        if (!mayCancel(me, settlement)) throw new StoreError("forbidden");
        settlement.status = "cancelled";
        settlement.confirmedAt = null;
      });
    },

    async addRate(groupId, input) {
      return inGroup(groupId, (group) => {
        const checked = checkRate(input);
        if (!checked.ok) throw new StoreError("invalid", { problems: checked.problems });
        if ((group.rates ?? []).length >= RATES_PER_GROUP) throw new StoreError("limit");
        const rate: Rate = { ...checked.input, id: newId(), createdAt: new Date().toISOString() };
        group.rates = [rate, ...(group.rates ?? [])];
        return rate.id;
      });
    },

    async createReceiptExpense(groupId, key, input) {
      return inGroup(groupId, (group, me) => {
        if (group.keys[key]) return group.keys[key];
        const current = new Set(group.members.filter((member) => !member.removedAt).map((member) => member.id));
        const built = buildReceiptExpense(input, current);
        if (!built.ok) throw new StoreError("invalid", { problems: built.problems, lines: built.lines });
        const earlier = group.receipts?.[built.contentHash];
        const stillCounts = group.expenses.some((expense) => expense.id === earlier && expense.status === "active");
        if (stillCounts && (input as { allowDuplicate?: unknown }).allowDuplicate !== true) throw new StoreError("duplicate_receipt");
        const id = store(group, me, key, built.expense);
        group.expenses.find((expense) => expense.id === id)!.receipt = { lines: built.lines };
        group.receipts = { ...group.receipts, [built.contentHash]: id };
        return id;
      });
    },

    /** Back to the invented groups, as on a first visit. */
    reset() {
      memory = null;
      try {
        shelf.removeItem(DEMO_STORAGE_KEY);
      } catch {
        // Nothing was stored, so there is nothing to remove.
      }
    },
  };
}
