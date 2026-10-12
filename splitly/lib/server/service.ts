import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { netOfMember, netsOf } from "@/lib/balances/net";
import {
  checkRate,
  checkSettlement,
  confirmedAtOnce,
  mayCancel,
  mayConfirm,
  RATES_PER_GROUP,
  type RateProblem,
  type SettlementProblem,
} from "@/lib/balances/settle";
import {
  LIMITS,
  type Expense,
  type Group,
  type GroupSummary,
  type Invite,
  type Member,
  type Role,
  type Settlement,
} from "@/lib/domain/types";
import { isCurrencyCode } from "@/lib/money/currency";
import { buildReceiptExpense, type ReceiptProblem } from "@/lib/receipt/build";
import { checkExpense, type ExpenseProblem } from "@/lib/split/expense";
import type { Rate } from "@/lib/money/fx";
import type { StoredReceiptLine } from "@/lib/receipt/types";
import type { Db } from "./db";
import type { TelegramUser } from "./telegram";

// Everything the application does to the database, and the one place where
// "may this person do this?" is decided. Every function takes the user from
// the session; none takes a user, a member or a role from the request. A
// group someone is not in is, to them, a group that does not exist.

export class ServiceError extends Error {
  constructor(
    public code: "not_found" | "forbidden" | "invalid" | "limit" | "conflict" | "duplicate_receipt",
    public details?: {
      problems?: (ExpenseProblem | ReceiptProblem | SettlementProblem | RateProblem)[];
      differences?: Record<string, number>;
      field?: string;
      lines?: number[];
    },
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
  if (known) {
    // The photo's address is whatever Telegram says now: a new one replaces the old, none clears it.
    await db.query("update splitly.users set photo_url = $2 where id = $1 and photo_url is distinct from $2", [
      known.user_id,
      telegram.photoUrl,
    ]);
    return known.user_id;
  }

  const display = [telegram.firstName, telegram.lastName].filter(Boolean).join(" ").slice(0, LIMITS.nameLength);
  const locale = telegram.languageCode?.toLowerCase().startsWith("ru") ? "ru" : "en";
  const userId = (
    await db.query("insert into splitly.users (display_name, locale, photo_url) values ($1, $2, $3) returning id", [
      display,
      locale,
      telegram.photoUrl,
    ])
  ).rows[0].id as string;
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

export async function profile(
  db: Db,
  userId: string,
): Promise<{ id: string; displayName: string; locale: string; photoUrl: string | null }> {
  const row = (await db.query("select id, display_name, locale, photo_url from splitly.users where id = $1", [userId])).rows[0];
  if (!row) throw new ServiceError("not_found");
  return { id: row.id, displayName: row.display_name, locale: row.locale, photoUrl: row.photo_url ?? null };
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
  select m.id, coalesce(m.guest_name, u.display_name) as name, m.user_id is null as guest, m.role, m.user_id = $2 as self, m.removed_at, u.photo_url
  from splitly.group_members m left join splitly.users u on u.id = m.user_id
  where m.group_id = $1
  order by m.joined_at, m.id`;

const toMember = (row: Record<string, unknown>): Member => ({
  id: row.id as string,
  name: row.name as string,
  guest: row.guest as boolean,
  role: row.role as Role,
  self: row.self === true,
  photoUrl: (row.photo_url as string | null) ?? null,
  removedAt: row.removed_at ? new Date(row.removed_at as string).toISOString() : null,
});

const EXPENSES_SQL = `
  select e.id, e.description, e.category, to_char(e.expense_date, 'YYYY-MM-DD') as date, e.currency, e.total_minor::text as total, e.status, e.split_mode,
         e.creator_member_id, e.created_at,
         (select json_agg(json_build_object(
                   'k', i.kind, 'o', i.original_label, 'd', i.display_label, 't', i.translation_source, 'q', i.quantity_decimal,
                   'a', i.line_total_minor::text, 'c', i.confidence, 'r', i.manual_reviewed,
                   'm', (select min(a.method) from splitly.receipt_item_allocations a where a.receipt_item_id = i.id),
                   's', (select coalesce(json_agg(json_build_object('m', a.member_id, 'a', a.share_minor::text) order by gm.joined_at, gm.id), '[]')
                         from splitly.receipt_item_allocations a join splitly.group_members gm on gm.id = a.member_id where a.receipt_item_id = i.id)
                 ) order by i.position)
          from splitly.receipt_items i where i.receipt_id = e.receipt_id) as receipt_lines,
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
  receipt: row.receipt_lines
    ? {
        lines: (row.receipt_lines as Record<string, unknown>[]).map((line) => ({
          kind: line.k as StoredReceiptLine["kind"],
          originalLabel: line.o as string,
          displayLabel: line.d as string,
          translationSource: line.t as StoredReceiptLine["translationSource"],
          quantity: line.q as string,
          lineTotalMinor: Number(line.a),
          confidence: (line.c as number | null) ?? null,
          manualReviewed: line.r === true,
          method: line.m === "equal" ? "equal" : "shares",
          allocations: (line.s as Part[]).map((share) => ({ memberId: share.m, shareMinor: Number(share.a) })),
        })),
      }
    : null,
});

const toSettlement = (row: Record<string, unknown>): Settlement => ({
  id: row.id as string,
  fromMemberId: row.from_member_id as string,
  toMemberId: row.to_member_id as string,
  currency: row.currency as string,
  amountMinor: Number(row.amount),
  status: row.status as Settlement["status"],
  createdBy: row.created_by_member_id as string,
  createdAt: new Date(row.created_at as string).toISOString(),
  confirmedAt: row.confirmed_at ? new Date(row.confirmed_at as string).toISOString() : null,
});

export async function getGroup(db: Db, userId: string, groupId: unknown): Promise<Group> {
  const me = await membership(db, userId, groupId);
  const group = (await db.query("select id, name, base_currency, archived_at from splitly.groups where id = $1", [groupId])).rows[0];
  const members = (await db.query(MEMBERS_SQL, [groupId, userId])).rows.map(toMember);
  const expenses = (await db.query(EXPENSES_SQL, [groupId])).rows.map(toExpense);
  const settlements = (
    await db.query(
      "select id, from_member_id, to_member_id, currency, amount_minor::text as amount, status, created_by_member_id, created_at, confirmed_at from splitly.settlements where group_id = $1 order by created_at desc, id",
      [groupId],
    )
  ).rows.map(toSettlement);
  const rates: Rate[] = (
    await db.query(
      "select id, from_currency, to_currency, decimal_rate, to_char(effective_at at time zone 'UTC', 'YYYY-MM-DD') as day, created_at from splitly.fx_rates where group_id = $1 order by effective_at desc, created_at desc",
      [groupId],
    )
  ).rows.map((row) => ({
    id: row.id,
    from: row.from_currency,
    to: row.to_currency,
    rate: row.decimal_rate,
    effectiveDate: row.day,
    createdAt: new Date(row.created_at).toISOString(),
  }));
  return {
    id: group.id,
    name: group.name,
    baseCurrency: group.base_currency,
    archivedAt: group.archived_at ? new Date(group.archived_at).toISOString() : null,
    members,
    expenses,
    settlements,
    rates,
    myNet: netOfMember(netsOf(expenses, settlements), me.memberId),
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
    const { expenses: _expenses, settlements: _settlements, rates: _rates, ...summary } = await getGroup(db, userId, id);
    void _expenses;
    void _settlements;
    void _rates;
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

async function insertExpense(
  db: Db,
  groupId: string,
  creatorMemberId: string,
  key: string,
  raw: unknown,
  receiptId: string | null = null,
): Promise<string> {
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
      `insert into splitly.expenses (group_id, creator_member_id, description, category, expense_date, currency, total_minor, split_mode, idempotency_key, receipt_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [
        groupId,
        creatorMemberId,
        input.description,
        input.category,
        input.date,
        input.currency,
        input.totalMinor,
        input.split.mode,
        key,
        receiptId,
      ],
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

/**
 * Turns an assigned receipt into an expense, with its lines and what each
 * person took of each, all in one transaction: either the whole receipt is
 * stored and balances, or none of it is. Everyone's share is worked out here
 * from who each line was given to. Only the photo's hash arrives, to notice
 * the same receipt scanned twice; the photo never leaves the person's device.
 */
export async function createReceiptExpense(
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

  const built = buildReceiptExpense(raw, await currentMemberIds(db, groupId as string));
  if (!built.ok) throw new ServiceError("invalid", { problems: built.problems, lines: built.lines });

  // The same photo, already an expense that still counts in this group.
  const hash = Buffer.from(built.contentHash, "hex");
  const duplicate = (
    await db.query(
      "select 1 from splitly.receipts r join splitly.expenses e on e.receipt_id = r.id where r.group_id = $1 and r.content_hash = $2 and e.status = 'active' limit 1",
      [groupId, hash],
    )
  ).rows[0];
  if (duplicate && (raw as { allowDuplicate?: unknown }).allowDuplicate !== true) throw new ServiceError("duplicate_receipt");

  const receiptId = (
    await db.query(
      "insert into splitly.receipts (group_id, uploader_member_id, content_hash, mime_type, status) values ($1, $2, $3, $4, 'confirmed') returning id",
      [groupId, me.memberId, hash, built.mimeType],
    )
  ).rows[0].id as string;
  const id = await insertExpense(db, groupId as string, me.memberId, key, built.expense, receiptId);

  for (const [index, line] of built.lines.entries()) {
    const itemId = (
      await db.query(
        `insert into splitly.receipt_items (receipt_id, group_id, position, kind, original_label, display_label, translation_source, quantity_decimal, line_total_minor, confidence, manual_reviewed)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
        [
          receiptId,
          groupId,
          index + 1,
          line.kind,
          line.originalLabel,
          line.displayLabel,
          line.translationSource,
          line.quantity,
          line.lineTotalMinor,
          line.confidence,
          line.manualReviewed,
        ],
      )
    ).rows[0].id as string;
    for (const share of line.allocations) {
      await db.query(
        "insert into splitly.receipt_item_allocations (receipt_item_id, group_id, member_id, share_minor, method) values ($1, $2, $3, $4, $5)",
        [itemId, groupId, share.memberId, share.shareMinor, line.method],
      );
    }
  }
  // Amounts and counts only in the log: never what was bought.
  await log(db, groupId as string, me.memberId, "receipt.confirmed", "expense", id, {
    totalMinor: String(built.expense.totalMinor),
    currency: built.expense.currency,
    lines: built.lines.length,
  });
  return { id, repeated: false };
}

// -------------------------------------------------------------- settling up

async function archived(db: Db, groupId: unknown): Promise<boolean> {
  return (
    (await db.query("select archived_at is not null as archived from splitly.groups where id = $1", [groupId])).rows[0]?.archived === true
  );
}

/**
 * Records a payment between two current members. Whether it counts at once
 * depends on who records it (lib/balances/settle.ts): the person paid, or a
 * manager, yes; the person paying, not until the other side confirms.
 */
export async function createSettlement(
  db: Db,
  userId: string,
  groupId: unknown,
  key: unknown,
  raw: unknown,
): Promise<{ id: string; repeated: boolean }> {
  const me = await membership(db, userId, groupId);
  if (!uuid(key)) throw new ServiceError("invalid", { field: "idempotencyKey" });
  const existing = (await db.query("select id from splitly.settlements where group_id = $1 and idempotency_key = $2", [groupId, key]))
    .rows[0];
  if (existing) return { id: existing.id, repeated: true };
  if (await archived(db, groupId)) throw new ServiceError("conflict");

  const checked = checkSettlement(raw, await currentMemberIds(db, groupId as string));
  if (!checked.ok) throw new ServiceError("invalid", { problems: checked.problems });
  const { fromMemberId, toMemberId, currency, amountMinor } = checked.input;
  const confirmed = confirmedAtOnce({ id: me.memberId, role: me.role }, toMemberId);
  const id = (
    await db.query(
      `insert into splitly.settlements (group_id, from_member_id, to_member_id, currency, amount_minor, status, idempotency_key, created_by_member_id, confirmed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, case when $6 = 'confirmed' then now() end) returning id`,
      [groupId, fromMemberId, toMemberId, currency, amountMinor, confirmed ? "confirmed" : "proposed", key, me.memberId],
    )
  ).rows[0].id as string;
  await log(db, groupId as string, me.memberId, confirmed ? "settlement.confirmed" : "settlement.proposed", "settlement", id, {
    amountMinor: String(amountMinor),
    currency,
  });
  return { id, repeated: false };
}

async function lockedSettlement(db: Db, groupId: unknown, settlementId: unknown) {
  if (!uuid(settlementId)) throw new ServiceError("not_found");
  const row = (
    await db.query(
      "select id, status, from_member_id, to_member_id, created_by_member_id from splitly.settlements where group_id = $1 and id = $2 for update",
      [groupId, settlementId],
    )
  ).rows[0];
  if (!row) throw new ServiceError("not_found");
  return {
    id: row.id as string,
    status: row.status as Settlement["status"],
    fromMemberId: row.from_member_id as string,
    toMemberId: row.to_member_id as string,
    createdBy: row.created_by_member_id as string,
  };
}

/** Says a proposed payment happened. Confirming twice is the same as once. */
export async function confirmSettlement(db: Db, userId: string, groupId: unknown, settlementId: unknown): Promise<void> {
  const me = await membership(db, userId, groupId);
  const settlement = await lockedSettlement(db, groupId, settlementId);
  if (settlement.status === "confirmed") return;
  if (settlement.status !== "proposed") throw new ServiceError("conflict");
  if (!mayConfirm({ id: me.memberId, role: me.role }, settlement)) throw new ServiceError("forbidden");
  await db.query("update splitly.settlements set status = 'confirmed', confirmed_at = now() where id = $1", [settlement.id]);
  await log(db, groupId as string, me.memberId, "settlement.confirmed", "settlement", settlement.id);
}

/** Withdraws a proposed payment or takes back a confirmed one. It stays on record. Cancelling twice is the same as once. */
export async function cancelSettlement(db: Db, userId: string, groupId: unknown, settlementId: unknown): Promise<void> {
  const me = await membership(db, userId, groupId);
  const settlement = await lockedSettlement(db, groupId, settlementId);
  if (settlement.status === "cancelled") return;
  if (!mayCancel({ id: me.memberId, role: me.role }, settlement)) throw new ServiceError("forbidden");
  await db.query("update splitly.settlements set status = 'cancelled', confirmed_at = null where id = $1", [settlement.id]);
  await log(db, groupId as string, me.memberId, "settlement.cancelled", "settlement", settlement.id);
}

/** Records an exchange rate for the group. Rates only change how totals are shown, never what anyone owes. */
export async function addRate(db: Db, userId: string, groupId: unknown, raw: unknown): Promise<string> {
  const me = await membership(db, userId, groupId);
  const checked = checkRate(raw);
  if (!checked.ok) throw new ServiceError("invalid", { problems: checked.problems });
  const count = (await db.query("select count(*)::int as n from splitly.fx_rates where group_id = $1", [groupId])).rows[0].n;
  if (count >= RATES_PER_GROUP) throw new ServiceError("limit");
  const { from, to, rate, effectiveDate } = checked.input;
  const id = (
    await db.query(
      "insert into splitly.fx_rates (group_id, from_currency, to_currency, decimal_rate, effective_at, created_by_member_id) values ($1, $2, $3, $4, ($5 || 'T00:00:00Z')::timestamptz, $6) returning id",
      [groupId, from, to, rate, effectiveDate, me.memberId],
    )
  ).rows[0].id as string;
  await log(db, groupId as string, me.memberId, "rate.added", "fx_rate", id, { from, to });
  return id;
}

// ------------------------------------------------------------------- limits

/** Counts one attempt and says whether it is within the limit. What is limited is named by `scope`; who, by `subject`. */
export async function allowed(db: Db, scope: string, subject: string, max: number, seconds: number): Promise<boolean> {
  const key = createHash("sha256").update(`${scope}:${subject}`).digest();
  return (await db.query("select splitly.allow($1, $2, $3) as ok", [key, max, seconds])).rows[0].ok === true;
}
