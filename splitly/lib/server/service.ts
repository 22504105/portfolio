import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { netOfMember, netsOf } from "@/lib/balances/net";
import { LIMITS, type Expense, type Group, type GroupSummary, type Invite, type Member, type Role } from "@/lib/domain/types";
import { isCurrencyCode } from "@/lib/money/currency";
import { checkExpense, type ExpenseProblem } from "@/lib/split/expense";
import type { Db } from "./db";
import type { TelegramUser } from "./telegram";

// Everything the application does to the database, and the one place where
// "may this person do this?" is decided. Every function takes the user from
// the session; none takes a user, a member or a role from the request. A
// group someone is not in is, to them, a group that does not exist.

export class ServiceError extends Error {
  constructor(
    public code: "not_found" | "forbidden" | "invalid" | "limit" | "conflict",
    public details?: { problems?: ExpenseProblem[]; differences?: Record<string, number>; field?: string },
  ) {
    super(code);
  }
}

const uuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const name = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length >= 1 && value.trim().length <= LIMITS.nameLength ? value.trim() : null;
const hashToken = (token: string) => createHash("sha256").update(token).digest();

type Membership = { memberId: string; role: Role };

/** The caller's place in a group. Not being a current member and the group not existing look the same. */
async function membership(db: Db, userId: string, groupId: unknown): Promise<Membership> {
  if (!uuid(groupId)) throw new ServiceError("not_found");
  const row = (
    await db.query("select id, role from splitly.group_members where group_id = $1 and user_id = $2 and removed_at is null", [
      groupId,
      userId,
    ])
  ).rows[0];
  if (!row) throw new ServiceError("not_found");
  return { memberId: row.id, role: row.role };
}

function requireManager(member: Membership) {
  if (member.role !== "owner" && member.role !== "admin") throw new ServiceError("forbidden");
}

async function log(
  db: Db,
  groupId: string,
  actorMemberId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  // Amounts and kinds of things only: never receipt text, never contact details.
  await db.query(
    "insert into splitly.activity_log (group_id, actor_member_id, action, entity_type, entity_id, metadata_redacted) values ($1, $2, $3, $4, $5, $6)",
    [groupId, actorMemberId, action, entityType, entityId, JSON.stringify(metadata)],
  );
}

// ------------------------------------------------------------------- people

/** Finds the person behind a verified Telegram account, or creates them. The ID comes only from verified sign-in data. */
export async function signInWithTelegram(db: Db, telegram: TelegramUser): Promise<string> {
  const known = (await db.query("select user_id from splitly.telegram_identities where telegram_user_id = $1", [telegram.id])).rows[0];
  if (known) return known.user_id;

  const display = [telegram.firstName, telegram.lastName].filter(Boolean).join(" ").slice(0, LIMITS.nameLength);
  const locale = telegram.languageCode?.toLowerCase().startsWith("ru") ? "ru" : "en";
  const userId = (await db.query("insert into splitly.users (display_name, locale) values ($1, $2) returning id", [display, locale]))
    .rows[0].id as string;
  // Two requests at once for a new person: the second finds the first's row instead of making another.
  const identity = await db.query(
    "insert into splitly.telegram_identities (user_id, telegram_user_id) values ($1, $2) on conflict (telegram_user_id) do nothing returning user_id",
    [userId, telegram.id],
  );
  if (identity.rowCount === 1) {
    await db.query("insert into splitly.user_settings (user_id, locale) values ($1, $2)", [userId, locale]);
    return userId;
  }
  await db.query("delete from splitly.users where id = $1", [userId]);
  return (await db.query("select user_id from splitly.telegram_identities where telegram_user_id = $1", [telegram.id])).rows[0].user_id;
}

export async function profile(db: Db, userId: string): Promise<{ id: string; displayName: string; locale: string }> {
  const row = (await db.query("select id, display_name, locale from splitly.users where id = $1", [userId])).rows[0];
  if (!row) throw new ServiceError("not_found");
  return { id: row.id, displayName: row.display_name, locale: row.locale };
}

/**
 * Removes a person. Groups they own alone go with them; from groups they
 * share they are marked as having left (their expenses stay, so nobody else's
 * balances change) and, where they were the owner, ownership passes on.
 */
export async function deleteAccount(db: Db, userId: string): Promise<void> {
  const groups = (
    await db.query("select group_id, id, role from splitly.group_members where user_id = $1 and removed_at is null for update", [userId])
  ).rows;
  for (const row of groups) {
    const others = (
      await db.query(
        "select id, role from splitly.group_members where group_id = $1 and user_id is not null and removed_at is null and id <> $2 order by (role = 'admin') desc, joined_at",
        [row.group_id, row.id],
      )
    ).rows;
    if (others.length === 0) {
      await db.query("delete from splitly.groups where id = $1", [row.group_id]);
      continue;
    }
    await db.query("update splitly.group_members set removed_at = now(), role = 'member' where id = $1", [row.id]);
    if (row.role === "owner") {
      await db.query("update splitly.group_members set role = 'owner' where id = $1", [others[0].id]);
      await db.query("update splitly.groups set owner_id = (select user_id from splitly.group_members where id = $1) where id = $2", [
        others[0].id,
        row.group_id,
      ]);
    }
  }
  // What is left of them in shared groups keeps the member row (for the history) under a neutral name, with no link to the person.
  await db.query("update splitly.group_members set guest_name = 'Former member', user_id = null where user_id = $1", [userId]);
  await db.query("update splitly.group_members set claimed_by_user_id = null where claimed_by_user_id = $1", [userId]);
  await db.query("delete from splitly.invites where created_by = $1", [userId]);
  await db.query("delete from splitly.users where id = $1", [userId]);
}

// ------------------------------------------------------------------- groups

const MEMBERS_SQL = `
  select m.id, coalesce(m.guest_name, u.display_name) as name, m.user_id is null as guest, m.role, m.user_id = $2 as self, m.removed_at
  from splitly.group_members m left join splitly.users u on u.id = m.user_id
  where m.group_id = $1
  order by m.joined_at, m.id`;

const toMember = (row: Record<string, unknown>): Member => ({
  id: row.id as string,
  name: row.name as string,
  guest: row.guest as boolean,
  role: row.role as Role,
  self: row.self === true,
  removedAt: row.removed_at ? new Date(row.removed_at as string).toISOString() : null,
});

const EXPENSES_SQL = `
  select e.id, e.description, e.category, to_char(e.expense_date, 'YYYY-MM-DD') as date, e.currency, e.total_minor::text as total, e.status, e.split_mode,
         e.creator_member_id, e.created_at,
         (select coalesce(json_agg(json_build_object('m', p.member_id, 'a', p.paid_minor::text) order by p.position), '[]') from splitly.expense_payers p where p.expense_id = e.id) as payers,
         (select coalesce(json_agg(json_build_object('m', s.member_id, 'a', s.owed_minor::text, 'v', s.split_value::text) order by s.position), '[]') from splitly.expense_splits s where s.expense_id = e.id) as splits
  from splitly.expenses e
  where e.group_id = $1
  order by e.expense_date desc, e.created_at desc, e.id`;

type Part = { m: string; a: string; v?: string };

const toExpense = (row: Record<string, unknown>): Expense => ({
  id: row.id as string,
  description: row.description as string,
  category: (row.category as Expense["category"]) ?? null,
  date: row.date as string,
  currency: row.currency as string,
  // bigint crosses as text; the amounts are within what a number holds exactly (the schema caps them).
  totalMinor: Number(row.total),
  status: row.status as Expense["status"],
  payers: (row.payers as Part[]).map((part) => ({ memberId: part.m, paidMinor: Number(part.a) })),
  split: {
    mode: row.split_mode as Expense["split"]["mode"],
    parts: (row.splits as Part[]).map((part) => ({ memberId: part.m, value: Number(part.v) })),
  },
  splits: (row.splits as Part[]).map((part) => ({ memberId: part.m, owedMinor: Number(part.a) })),
  createdBy: row.creator_member_id as string,
  createdAt: new Date(row.created_at as string).toISOString(),
});

export async function getGroup(db: Db, userId: string, groupId: unknown): Promise<Group> {
  const me = await membership(db, userId, groupId);
  const group = (await db.query("select id, name, base_currency, archived_at from splitly.groups where id = $1", [groupId])).rows[0];
  const members = (await db.query(MEMBERS_SQL, [groupId, userId])).rows.map(toMember);
  const expenses = (await db.query(EXPENSES_SQL, [groupId])).rows.map(toExpense);
  return {
    id: group.id,
    name: group.name,
    baseCurrency: group.base_currency,
    archivedAt: group.archived_at ? new Date(group.archived_at).toISOString() : null,
    members,
    expenses,
    myNet: netOfMember(netsOf(expenses), me.memberId),
    expenseCount: expenses.filter((expense) => expense.status === "active").length,
  };
}

export async function listGroups(db: Db, userId: string): Promise<GroupSummary[]> {
  const ids = (
    await db.query(
      "select g.id from splitly.groups g join splitly.group_members m on m.group_id = g.id where m.user_id = $1 and m.removed_at is null order by g.archived_at is not null, g.created_at desc",
      [userId],
    )
  ).rows.map((row) => row.id as string);
  // Each group is read the same way as on its own page, so the list and the page cannot disagree.
  const groups: GroupSummary[] = [];
  for (const id of ids) {
    const { expenses: _expenses, ...summary } = await getGroup(db, userId, id);
    void _expenses;
    groups.push(summary);
  }
  return groups;
}

export async function createGroup(db: Db, userId: string, input: { name?: unknown; baseCurrency?: unknown }): Promise<string> {
  const groupName = name(input.name);
  if (!groupName) throw new ServiceError("invalid", { field: "name" });
  if (!isCurrencyCode(input.baseCurrency)) throw new ServiceError("invalid", { field: "baseCurrency" });

  const count = (await db.query("select count(*)::int as n from splitly.group_members where user_id = $1 and removed_at is null", [userId]))
    .rows[0].n;
  if (count >= LIMITS.groupsPerUser) throw new ServiceError("limit");

  const groupId = (
    await db.query("insert into splitly.groups (name, base_currency, owner_id) values ($1, $2, $3) returning id", [
      groupName,
      input.baseCurrency,
      userId,
    ])
  ).rows[0].id as string;
  const memberId = (
    await db.query("insert into splitly.group_members (group_id, user_id, role) values ($1, $2, 'owner') returning id", [groupId, userId])
  ).rows[0].id as string;
  await log(db, groupId, memberId, "group.created", "group", groupId);
  return groupId;
}

export async function updateGroup(db: Db, userId: string, groupId: unknown, input: { name?: unknown; archived?: unknown }): Promise<void> {
  const me = await membership(db, userId, groupId);
  requireManager(me);
  if (input.name !== undefined) {
    const groupName = name(input.name);
    if (!groupName) throw new ServiceError("invalid", { field: "name" });
    await db.query("update splitly.groups set name = $2 where id = $1", [groupId, groupName]);
    await log(db, groupId as string, me.memberId, "group.renamed", "group", groupId as string);
  }
  if (typeof input.archived === "boolean") {
    await db.query("update splitly.groups set archived_at = case when $2 then coalesce(archived_at, now()) end where id = $1", [
      groupId,
      input.archived,
    ]);
    await log(db, groupId as string, me.memberId, input.archived ? "group.archived" : "group.restored", "group", groupId as string);
  }
}

export async function deleteGroup(db: Db, userId: string, groupId: unknown): Promise<void> {
  const me = await membership(db, userId, groupId);
  if (me.role !== "owner") throw new ServiceError("forbidden");
  await db.query("delete from splitly.groups where id = $1", [groupId]);
}

// ------------------------------------------------------------------ members

async function memberCount(db: Db, groupId: string): Promise<number> {
  return (await db.query("select count(*)::int as n from splitly.group_members where group_id = $1 and removed_at is null", [groupId]))
    .rows[0].n;
}

export async function addGuest(db: Db, userId: string, groupId: unknown, guestName: unknown): Promise<string> {
  const me = await membership(db, userId, groupId);
  requireManager(me);
  const clean = name(guestName);
  if (!clean) throw new ServiceError("invalid", { field: "name" });
  if ((await memberCount(db, groupId as string)) >= LIMITS.membersPerGroup) throw new ServiceError("limit");
  const id = (await db.query("insert into splitly.group_members (group_id, guest_name) values ($1, $2) returning id", [groupId, clean]))
    .rows[0].id as string;
  await log(db, groupId as string, me.memberId, "member.added", "member", id);
  return id;
}

/** A manager removes someone, or anyone leaves by themselves. The owner cannot leave a group that still has other people. */
export async function removeMember(db: Db, userId: string, groupId: unknown, memberId: unknown): Promise<void> {
  const me = await membership(db, userId, groupId);
  if (!uuid(memberId)) throw new ServiceError("not_found");
  const target = (
    await db.query("select id, role from splitly.group_members where group_id = $1 and id = $2 and removed_at is null", [groupId, memberId])
  ).rows[0];
  if (!target) throw new ServiceError("not_found");
  const leaving = target.id === me.memberId;
  if (!leaving) requireManager(me);
  if (target.role === "owner") throw new ServiceError("forbidden");
  // An admin does not remove another admin; only the owner does.
  if (!leaving && target.role === "admin" && me.role !== "owner") throw new ServiceError("forbidden");
  await db.query("update splitly.group_members set removed_at = now(), role = 'member' where id = $1", [memberId]);
  await log(db, groupId as string, me.memberId, leaving ? "member.left" : "member.removed", "member", memberId);
}

export async function setRole(db: Db, userId: string, groupId: unknown, memberId: unknown, role: unknown): Promise<void> {
  const me = await membership(db, userId, groupId);
  if (me.role !== "owner") throw new ServiceError("forbidden");
  if (role !== "admin" && role !== "member") throw new ServiceError("invalid", { field: "role" });
  if (!uuid(memberId)) throw new ServiceError("not_found");
  // Only people with an account can manage a group, and the owner's own role is not changed this way.
  const changed = await db.query(
    "update splitly.group_members set role = $3 where group_id = $1 and id = $2 and removed_at is null and user_id is not null and role <> 'owner'",
    [groupId, memberId, role],
  );
  if (changed.rowCount !== 1) throw new ServiceError("not_found");
  await log(db, groupId as string, me.memberId, "member.role", "member", memberId, { role });
}

// -------------------------------------------------------------- invitations

export async function createInvite(
  db: Db,
  userId: string,
  groupId: unknown,
  input: { maxUses?: unknown; hours?: unknown } = {},
): Promise<Invite> {
  const me = await membership(db, userId, groupId);
  requireManager(me);
  const maxUses =
    Number.isInteger(input.maxUses) && (input.maxUses as number) >= 1 && (input.maxUses as number) <= 50 ? (input.maxUses as number) : 10;
  const hours =
    Number.isInteger(input.hours) && (input.hours as number) >= 1 && (input.hours as number) <= 24 * 14 ? (input.hours as number) : 72;

  // 32 random bytes. Only the hash is stored: the link exists where it was shared and nowhere else.
  const token = randomBytes(32).toString("base64url");
  const row = (
    await db.query(
      "insert into splitly.invites (group_id, token_hash, created_by, expires_at, max_uses) values ($1, $2, $3, now() + make_interval(hours => $4), $5) returning id, expires_at",
      [groupId, hashToken(token), userId, hours, maxUses],
    )
  ).rows[0];
  await log(db, groupId as string, me.memberId, "invite.created", "invite", row.id);
  return { token, expiresAt: new Date(row.expires_at).toISOString(), maxUses };
}

export async function revokeInvites(db: Db, userId: string, groupId: unknown): Promise<number> {
  const me = await membership(db, userId, groupId);
  requireManager(me);
  const revoked = await db.query(
    "update splitly.invites set revoked_at = now() where group_id = $1 and revoked_at is null and expires_at > now()",
    [groupId],
  );
  return revoked.rowCount ?? 0;
}

/**
 * Joins the group an invitation is for. One answer for every kind of bad
 * link (unknown, expired, revoked, used up), so a link cannot be probed.
 * Optionally the newcomer says which guest they are, and takes over that
 * guest's history.
 */
export async function acceptInvite(db: Db, userId: string, token: unknown, claimMemberId?: unknown): Promise<string> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ServiceError("not_found");
  const invite = (
    await db.query(
      "select id, group_id from splitly.invites where token_hash = $1 and revoked_at is null and expires_at > now() and uses < max_uses for update",
      [hashToken(token)],
    )
  ).rows[0];
  if (!invite) throw new ServiceError("not_found");
  const groupId = invite.group_id as string;

  const existing = (
    await db.query("select id, removed_at from splitly.group_members where group_id = $1 and user_id = $2", [groupId, userId])
  ).rows[0];
  if (existing && !existing.removed_at) return groupId; // Already in: the invitation is not spent.

  let memberId: string;
  if (existing) {
    // Someone who left comes back as the same member, with their history.
    await db.query("update splitly.group_members set removed_at = null, joined_at = now() where id = $1", [existing.id]);
    memberId = existing.id;
  } else if (uuid(claimMemberId)) {
    const claimed = await db.query(
      "update splitly.group_members set user_id = $3, claimed_by_user_id = null, guest_name = null where group_id = $1 and id = $2 and user_id is null and removed_at is null returning id",
      [groupId, claimMemberId, userId],
    );
    if (claimed.rowCount !== 1) throw new ServiceError("not_found");
    memberId = claimed.rows[0].id;
  } else {
    if ((await memberCount(db, groupId)) >= LIMITS.membersPerGroup) throw new ServiceError("limit");
    memberId = (await db.query("insert into splitly.group_members (group_id, user_id) values ($1, $2) returning id", [groupId, userId]))
      .rows[0].id;
  }
  await db.query("update splitly.invites set uses = uses + 1 where id = $1", [invite.id]);
  await log(db, groupId, memberId, "member.joined", "member", memberId);
  return groupId;
}

/** What someone holding an invitation may see before joining: the group's name and its guests, to say "that one is me". */
export async function previewInvite(db: Db, token: unknown): Promise<{ groupName: string; guests: { id: string; name: string }[] }> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ServiceError("not_found");
  const invite = (
    await db.query(
      "select g.id, g.name from splitly.invites i join splitly.groups g on g.id = i.group_id where i.token_hash = $1 and i.revoked_at is null and i.expires_at > now() and i.uses < i.max_uses",
      [hashToken(token)],
    )
  ).rows[0];
  if (!invite) throw new ServiceError("not_found");
  const guests = (
    await db.query(
      "select id, guest_name as name from splitly.group_members where group_id = $1 and user_id is null and removed_at is null order by joined_at",
      [invite.id],
    )
  ).rows;
  return { groupName: invite.name, guests };
}

// ----------------------------------------------------------------- expenses

async function currentMemberIds(db: Db, groupId: string): Promise<Set<string>> {
  return new Set(
    (await db.query("select id from splitly.group_members where group_id = $1 and removed_at is null", [groupId])).rows.map(
      (row) => row.id as string,
    ),
  );
}

async function insertExpense(db: Db, groupId: string, creatorMemberId: string, key: string, raw: unknown): Promise<string> {
  // An archived group is kept as it is.
  const archived = (await db.query("select archived_at is not null as archived from splitly.groups where id = $1", [groupId])).rows[0]
    ?.archived;
  if (archived) throw new ServiceError("conflict");
  const checked = checkExpense(raw, await currentMemberIds(db, groupId));
  if (!checked.ok)
    throw new ServiceError("invalid", { problems: checked.problems, differences: checked.differences as Record<string, number> });
  const { input, splits } = checked;

  const count = (await db.query("select count(*)::int as n from splitly.expenses where group_id = $1", [groupId])).rows[0].n;
  if (count >= LIMITS.expensesPerGroup) throw new ServiceError("limit");

  const id = (
    await db.query(
      `insert into splitly.expenses (group_id, creator_member_id, description, category, expense_date, currency, total_minor, split_mode, idempotency_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [groupId, creatorMemberId, input.description, input.category, input.date, input.currency, input.totalMinor, input.split.mode, key],
    )
  ).rows[0].id as string;

  for (const [index, payer] of input.payers.entries()) {
    await db.query(
      "insert into splitly.expense_payers (expense_id, group_id, member_id, paid_minor, position) values ($1, $2, $3, $4, $5)",
      [id, groupId, payer.memberId, payer.paidMinor, index + 1],
    );
  }
  for (const [index, split] of splits.entries()) {
    await db.query(
      "insert into splitly.expense_splits (expense_id, group_id, member_id, owed_minor, split_value, position) values ($1, $2, $3, $4, $5, $6)",
      [id, groupId, split.memberId, split.owedMinor, input.split.parts[index].value, index + 1],
    );
  }
  return id;
}

/**
 * Adds an expense. `key` is chosen by the client once per submission: sent
 * again (a double tap, a retry on a bad network) it returns the expense that
 * is already there instead of making a second one.
 */
export async function createExpense(
  db: Db,
  userId: string,
  groupId: unknown,
  key: unknown,
  raw: unknown,
): Promise<{ id: string; repeated: boolean }> {
  const me = await membership(db, userId, groupId);
  if (!uuid(key)) throw new ServiceError("invalid", { field: "idempotencyKey" });
  const existing = (await db.query("select id from splitly.expenses where group_id = $1 and idempotency_key = $2", [groupId, key])).rows[0];
  if (existing) return { id: existing.id, repeated: true };

  const id = await insertExpense(db, groupId as string, me.memberId, key, raw);
  const total = (raw as { totalMinor?: number }).totalMinor;
  await log(db, groupId as string, me.memberId, "expense.created", "expense", id, {
    totalMinor: String(total),
    currency: (raw as { currency?: string }).currency,
  });
  return { id, repeated: false };
}

/**
 * Changes an expense by writing a new one and marking the old one replaced:
 * what was recorded before stays on record. Only an active expense can be
 * changed, by whoever added it or by a manager.
 */
export async function replaceExpense(
  db: Db,
  userId: string,
  groupId: unknown,
  expenseId: unknown,
  key: unknown,
  raw: unknown,
): Promise<{ id: string; repeated: boolean }> {
  const me = await membership(db, userId, groupId);
  if (!uuid(expenseId)) throw new ServiceError("not_found");
  if (!uuid(key)) throw new ServiceError("invalid", { field: "idempotencyKey" });

  const existing = (await db.query("select id from splitly.expenses where group_id = $1 and idempotency_key = $2", [groupId, key])).rows[0];
  if (existing) return { id: existing.id, repeated: true };

  const old = (
    await db.query("select id, status, creator_member_id from splitly.expenses where group_id = $1 and id = $2 for update", [
      groupId,
      expenseId,
    ])
  ).rows[0];
  if (!old) throw new ServiceError("not_found");
  if (old.status !== "active") throw new ServiceError("conflict");
  if (old.creator_member_id !== me.memberId && me.role === "member") throw new ServiceError("forbidden");

  const id = await insertExpense(db, groupId as string, me.memberId, key, raw);
  await db.query("update splitly.expenses set status = 'replaced', replaced_by = $2 where id = $1", [expenseId, id]);
  await log(db, groupId as string, me.memberId, "expense.changed", "expense", id, { replaces: expenseId });
  return { id, repeated: false };
}

/** Cancels an expense: it stays on record and stops counting. Cancelling twice is the same as once. */
export async function cancelExpense(db: Db, userId: string, groupId: unknown, expenseId: unknown): Promise<void> {
  const me = await membership(db, userId, groupId);
  if (!uuid(expenseId)) throw new ServiceError("not_found");
  const old = (
    await db.query("select id, status, creator_member_id from splitly.expenses where group_id = $1 and id = $2 for update", [
      groupId,
      expenseId,
    ])
  ).rows[0];
  if (!old) throw new ServiceError("not_found");
  if (old.creator_member_id !== me.memberId && me.role === "member") throw new ServiceError("forbidden");
  if (old.status === "cancelled") return;
  if (old.status !== "active") throw new ServiceError("conflict");
  await db.query("update splitly.expenses set status = 'cancelled' where id = $1", [expenseId]);
  await log(db, groupId as string, me.memberId, "expense.cancelled", "expense", expenseId);
}

// ------------------------------------------------------------------- limits

/** Counts one attempt and says whether it is within the limit. What is limited is named by `scope`; who, by `subject`. */
export async function allowed(db: Db, scope: string, subject: string, max: number, seconds: number): Promise<boolean> {
  const key = createHash("sha256").update(`${scope}:${subject}`).digest();
  return (await db.query("select splitly.allow($1, $2, $3) as ok", [key, max, seconds])).rows[0].ok === true;
}
