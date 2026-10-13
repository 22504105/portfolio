import { mayConfirm } from "@/lib/balances/settle";
import type { Group } from "@/lib/domain/types";

// What happened in a person's groups, newest first: expenses added, changed
// and cancelled, and payments made between people. It is read from the
// expenses and payments themselves, so it can never say anything they do not.
// The same list is the activity screen and the notifications: a notification
// is an event someone else caused since this person last looked.

export type ActivityEvent = {
  id: string;
  at: string;
  groupId: string;
  groupName: string;
  kind: "added" | "cancelled" | "changed" | "paid" | "proposed" | "withdrawn";
  /** Who did it, and what or whom it was done to: names, as the group knows them. */
  who: string;
  what: string;
  amountMinor: number;
  currency: string;
  /** The viewer did this themselves: never news to them. */
  mine: boolean;
  /** A payment waiting for this very person to confirm it. */
  needsMe: boolean;
};

export function eventsOf(groups: readonly Group[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const group of groups) {
    const me = group.members.find((member) => member.self);
    const name = (id: string) => group.members.find((member) => member.id === id)?.name ?? "?";
    for (const expense of group.expenses) {
      events.push({
        id: expense.id,
        at: expense.createdAt,
        groupId: group.id,
        groupName: group.name,
        // A cancelled or replaced expense is still the record of having been added; its state says what became of it.
        kind: expense.status === "cancelled" ? "cancelled" : expense.status === "replaced" ? "changed" : "added",
        who: name(expense.createdBy),
        what: expense.description,
        amountMinor: expense.totalMinor,
        currency: expense.currency,
        mine: expense.createdBy === me?.id,
        needsMe: false,
      });
    }
    for (const settlement of group.settlements) {
      events.push({
        id: settlement.id,
        at: settlement.confirmedAt ?? settlement.createdAt,
        groupId: group.id,
        groupName: group.name,
        kind: settlement.status === "confirmed" ? "paid" : settlement.status === "proposed" ? "proposed" : "withdrawn",
        who: name(settlement.fromMemberId),
        what: name(settlement.toMemberId),
        amountMinor: settlement.amountMinor,
        currency: settlement.currency,
        // A payment to this person that counts was confirmed by them (or for them): they know of it.
        mine: settlement.createdBy === me?.id || (settlement.status === "confirmed" && settlement.toMemberId === me?.id),
        needsMe: !!me && !group.archivedAt && mayConfirm(me, settlement),
      });
    }
  }
  return events.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

/** News to this person: what others did after `seen`, and any payment still waiting for them whenever it was made. */
export const isNew = (event: ActivityEvent, seen: string | null) => event.needsMe || (!event.mine && seen !== null && event.at > seen);

export const countNew = (events: readonly ActivityEvent[], seen: string | null) => events.filter((event) => isNew(event, seen)).length;
