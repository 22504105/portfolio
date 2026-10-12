import type { Group, GroupSummary, Invite } from "@/lib/domain/types";
import { StoreError, type InvitePreview, type Store, type StoreErrorCode } from "./types";

// The real thing: every read and every change goes to Splitly's server, with
// the session in the Authorization header. The server decides what this
// person may see and do; nothing here does.

const CODES: readonly string[] = [
  "not_found",
  "forbidden",
  "invalid",
  "limit",
  "conflict",
  "rate_limited",
  "unauthenticated",
  "server_error",
];

/**
 * `session` gives the current session token. `renew` is called once when the
 * server says the session is no longer good, and should return a fresh token
 * (or null if there is none to be had); the request is then tried again.
 */
export function createRemoteStore(session: () => string | null, renew: () => Promise<string | null>): Store {
  async function send(method: string, path: string, body?: unknown, retried = false): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(`/api/v1/${path}`, {
        method,
        headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${session() ?? ""}` },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      throw new StoreError("offline");
    }
    if (response.status === 401 && !retried && (await renew())) return send(method, path, body, true);

    const data = (await response.json().catch(() => ({}))) as { error?: string; details?: StoreError["details"] } & Record<string, unknown>;
    if (response.ok) return data;
    throw new StoreError((CODES.includes(data.error ?? "") ? data.error : "server_error") as StoreErrorCode, data.details);
  }

  return {
    kind: "account",

    listGroups: async () => (await send("GET", "groups")).groups as GroupSummary[],
    async getGroup(id) {
      try {
        return (await send("GET", `groups/${encodeURIComponent(id)}`)).group as Group;
      } catch (error) {
        if (error instanceof StoreError && error.code === "not_found") return null;
        throw error;
      }
    },
    createGroup: async (input) => (await send("POST", "groups", input)).id as string,
    async updateGroup(id, input) {
      await send("PATCH", `groups/${id}`, input);
    },
    async deleteGroup(id) {
      await send("DELETE", `groups/${id}`);
    },

    addGuest: async (groupId, name) => (await send("POST", `groups/${groupId}/members`, { name })).id as string,
    async removeMember(groupId, memberId) {
      await send("DELETE", `groups/${groupId}/members/${memberId}`);
    },
    async setRole(groupId, memberId, role) {
      await send("PATCH", `groups/${groupId}/members/${memberId}`, { role });
    },

    createInvite: async (groupId) => (await send("POST", `groups/${groupId}/invites`, {})).invite as Invite,
    revokeInvites: async (groupId) => (await send("DELETE", `groups/${groupId}/invites`)).revoked as number,
    previewInvite: async (token) => (await send("POST", "invites/preview", { token })) as unknown as InvitePreview,
    acceptInvite: async (token, claimMemberId) => (await send("POST", "invites/accept", { token, claimMemberId })).groupId as string,

    createExpense: async (groupId, key, input) =>
      (await send("POST", `groups/${groupId}/expenses`, { idempotencyKey: key, expense: input })).id as string,
    replaceExpense: async (groupId, expenseId, key, input) =>
      (await send("PUT", `groups/${groupId}/expenses/${expenseId}`, { idempotencyKey: key, expense: input })).id as string,
    async cancelExpense(groupId, expenseId) {
      await send("DELETE", `groups/${groupId}/expenses/${expenseId}`);
    },
  };
}
