import type { Group, GroupSummary, Invite, Role } from "@/lib/domain/types";
import type { RateProblem, SettlementProblem } from "@/lib/balances/settle";
import type { ReceiptProblem } from "@/lib/receipt/build";
import type { ExpenseProblem } from "@/lib/split/expense";

// Where a screen gets its data and sends its changes. There are two of these:
// the demo, which keeps invented groups in the visitor's own browser, and the
// real one, which talks to the server. Screens are written against this and
// cannot tell which they have.

export type StoreErrorCode =
  | "duplicate_receipt"
  | "not_found"
  | "forbidden"
  | "invalid"
  | "limit"
  | "conflict"
  | "rate_limited"
  | "unauthenticated"
  | "offline"
  | "server_error";

export class StoreError extends Error {
  constructor(
    public code: StoreErrorCode,
    public details: {
      problems?: (ExpenseProblem | ReceiptProblem | SettlementProblem | RateProblem)[];
      differences?: Partial<Record<ExpenseProblem, number>>;
      field?: string;
      lines?: number[];
    } = {},
  ) {
    super(code);
  }
}

export type InvitePreview = { groupName: string; guests: { id: string; name: string }[] };

export interface Store {
  /** The demo has no other people to invite, and no account to delete. */
  readonly kind: "demo" | "account";

  listGroups(): Promise<GroupSummary[]>;
  /** Null when there is no such group, or none that this person may see. */
  getGroup(id: string): Promise<Group | null>;
  createGroup(input: { name: string; baseCurrency: string }): Promise<string>;
  updateGroup(id: string, input: { name?: string; archived?: boolean }): Promise<void>;
  deleteGroup(id: string): Promise<void>;

  addGuest(groupId: string, name: string): Promise<string>;
  removeMember(groupId: string, memberId: string): Promise<void>;
  setRole(groupId: string, memberId: string, role: Exclude<Role, "owner">): Promise<void>;

  createInvite(groupId: string): Promise<Invite>;
  revokeInvites(groupId: string): Promise<number>;
  previewInvite(token: string): Promise<InvitePreview>;
  acceptInvite(token: string, claimMemberId?: string): Promise<string>;

  /**
   * `key` is made once per filled-in form and sent with every attempt to
   * submit it, so that a second tap or a retry cannot add the expense twice.
   * `input` is what was entered; the shares are worked out by the store.
   */
  createExpense(groupId: string, key: string, input: unknown): Promise<string>;
  /** Writes a new expense in place of an old one, which stays on record as replaced. */
  replaceExpense(groupId: string, expenseId: string, key: string, input: unknown): Promise<string>;
  cancelExpense(groupId: string, expenseId: string): Promise<void>;

  /**
   * Turns an assigned receipt into an expense with its lines. Everyone's share is worked out by the store from who
   * each line was given to. The same photo twice in one group is refused with "duplicate_receipt", unless the
   * input says the person has been told and wants it anyway.
   */
  createReceiptExpense(groupId: string, key: string, input: unknown): Promise<string>;

  /**
   * Records a payment from one member to another. It counts at once if the person recording it is the one who was
   * paid, or manages the group; otherwise it waits, changing nothing, until one of them confirms it.
   */
  createSettlement(groupId: string, key: string, input: unknown): Promise<string>;
  /** Says a proposed payment did happen. For the person who was paid, or a manager. */
  confirmSettlement(groupId: string, settlementId: string): Promise<void>;
  /** Withdraws a proposed payment, or takes a confirmed one back. It stays on record as cancelled. */
  cancelSettlement(groupId: string, settlementId: string): Promise<void>;
  /** Records an exchange rate for the group, from a day on. A rate is never changed afterwards: a new one is added. */
  addRate(groupId: string, input: unknown): Promise<string>;

  /**
   * An address the file asked for can be fetched from, for a few minutes, without a session. Only where the data
   * lives on the server: inside Telegram a page cannot save a file it made itself, so Telegram fetches it instead.
   * The demo has no such thing and makes its files on the page.
   */
  downloadLink?(ask: unknown): Promise<{ url: string; name: string }>;
}
