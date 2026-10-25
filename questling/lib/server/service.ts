import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { applyEffects, type Facts } from "@/lib/game/facts";
import { run, type Action, type Outcome, type Refusal } from "@/lib/game/ops";
import { isLocale, type Locale } from "@/lib/i18n";
import type { Account } from "@/lib/student/profile";
import type { Db } from "./db";
import { loadFacts, persist } from "./store";
import { joinGroup, loadWorld } from "./world-store";
import type { TelegramUser } from "./telegram";

// What a signed-in student can ask of the server. Every action runs the same rules as the demo
// (lib/game/ops.ts) on the facts stored for this student, under a lock on the student's row, and
// stores the result in the same transaction: two taps at once cannot both spend the same coins
// or both collect the same reward. The answer keys are read here, never sent to the page.

export class ServiceError extends Error {
  constructor(
    public code: "not_found" | "invalid" | "forbidden" | Refusal,
    public status: number,
  ) {
    super(code);
  }
}

const REFUSAL_STATUS: Record<Refusal, number> = {
  invalid: 422,
  no_character: 409,
  not_available: 409,
  already_done: 409,
  not_owned: 409,
  already_owned: 409,
  not_enough_coins: 409,
  level_too_low: 409,
  not_ready: 409,
  exhausted: 409,
  not_exhausted: 409,
  wrong_species: 409,
  conflict: 409,
};

/** Finds or creates the student a Telegram account belongs to. */
export async function signInWithTelegram(db: Db, user: TelegramUser): Promise<string> {
  const subject = String(user.id);
  const known = await db.query<{ user_id: string }>(
    "update questling.auth_identities set username = $2, last_seen_at = now() where provider = 'telegram' and subject = $1 returning user_id",
    [subject, user.username],
  );
  if (known.rowCount) return known.rows[0].user_id;
  const locale = user.languageCode === "ru" || user.languageCode === "uk" || user.languageCode === "be" ? "ru" : "en";
  const created = await db.query<{ id: string }>("insert into questling.users (ui_locale) values ($1) returning id", [locale]);
  const userId = created.rows[0].id;
  // Two first sign-ins at once: the second finds the first one's identity and uses it.
  const identity = await db.query<{ user_id: string }>(
    `insert into questling.auth_identities (provider, subject, user_id, username) values ('telegram', $1, $2, $3)
     on conflict (provider, subject) do update set last_seen_at = now() returning user_id`,
    [subject, userId, user.username],
  );
  return identity.rows[0].user_id;
}

export async function account(db: Db, userId: string, firstGroup?: { name: string; mentor: string }): Promise<Account> {
  const identity = await db.query<{ subject: string; username: string | null }>(
    "select subject, username from questling.auth_identities where user_id = $1 and provider = 'telegram' limit 1",
    [userId],
  );
  const row = identity.rows[0];
  return {
    telegram: row ? { username: row.username, id: Number(row.subject) } : null,
    group: firstGroup ? { name: firstGroup.name, mentor: firstGroup.mentor } : null,
  };
}

export async function state(db: Db, userId: string): Promise<{ facts: Facts; account: Account }> {
  const facts = await loadFacts(db, userId);
  if (!facts) throw new ServiceError("not_found", 404);
  const { world } = await loadWorld(db, userId);
  return { facts: { ...facts, world }, account: await account(db, userId, world.groups[0]) };
}

/** Joins a group by its invite code (from the settings screen, or the Telegram link the app was opened with). */
export async function join(db: Db, userId: string, code: unknown): Promise<{ facts: Facts; account: Account }> {
  if (typeof code !== "string" || !(await joinGroup(db, userId, code))) throw new ServiceError("not_found", 404);
  return state(db, userId);
}

// What an action may look like on the way in. The rules (lib/game/ops.ts) check the rest.
const slot = z.enum(["headwear", "face", "neck", "outerwear", "outfit", "back", "handheld", "companion"]);
const id = z.string().min(1).max(60);
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chooseCharacter"), characterId: id }),
  z.object({ type: z.literal("renameHero"), name: z.string().max(60) }),
  z.object({ type: z.literal("answerQuest"), questId: id, questionId: id, answer: z.unknown() }),
  z.object({ type: z.literal("answerDailyQuiz"), option: id }),
  z.object({ type: z.literal("claimDaily") }),
  z.object({ type: z.literal("toggleSavedFact") }),
  z.object({
    type: z.literal("story"),
    campaign: id,
    move: z.discriminatedUnion("type", [
      z.object({ type: z.literal("advance"), scene: id }),
      z.object({ type: z.literal("choose"), scene: id, option: id }),
      z.object({ type: z.literal("answer"), scene: id, answer: z.union([id, z.array(z.string().max(40)).max(12)]) }),
      z.object({ type: z.literal("grimoire"), scene: id, word: z.string().min(1).max(40) }),
    ]),
  }),
  z.object({ type: z.literal("askMentor"), campaign: id, scene: id }),
  z.object({ type: z.literal("buy"), itemId: id }),
  z.object({ type: z.literal("saveLook"), equipped: z.partialRecord(slot, id.nullable()) }),
  z.object({ type: z.literal("openChest") }),
]);

export async function act(
  db: Db,
  userId: string,
  input: { action?: unknown; locale?: unknown },
  now = new Date(),
): Promise<{ outcome: Outcome; facts: Facts }> {
  const parsed = actionSchema.safeParse(input.action);
  if (!parsed.success) throw new ServiceError("invalid", 422);
  const locale: Locale = isLocale(input.locale) ? input.locale : "ru";

  // One action at a time per student: the row lock holds until the transaction ends.
  const locked = await db.query("select id from questling.users where id = $1 for update", [userId]);
  if (locked.rowCount === 0) throw new ServiceError("not_found", 404);
  const loaded = await loadFacts(db, userId);
  if (!loaded) throw new ServiceError("not_found", 404);
  const { world, keys, dailyKeys } = await loadWorld(db, userId, now);
  const facts: Facts = { ...loaded, world };

  const result = run(facts, parsed.data as Action, {
    now,
    locale,
    demo: false,
    random: () => randomInt(1_000_000) / 1_000_000,
    // A teacher's campaign has its keys in the database; the built-in ones have their own.
    keys: (campaign) => keys.get(`${campaign.id}@${campaign.version}`) ?? null,
    dailyKeys: (id) => dailyKeys.get(id) ?? null,
  });
  if (!result.ok) throw new ServiceError(result.refusal, REFUSAL_STATUS[result.refusal]);
  await persist(db, userId, result.effects, now);
  return { outcome: result.outcome, facts: applyEffects(facts, result.effects, now.toISOString()) };
}

// What is stored about a student, table by table: the "download my data" file holds all of it. Group
// membership and mentors' replies are theirs too; the groups and the teachers themselves are not.
const STUDENT_TABLES = [
  "auth_identities",
  "ledger",
  "answers",
  "completions",
  "saved",
  "inventory",
  "equipped",
  "story_runs",
  "group_members",
  "mentor_messages",
] as const;

/** Everything stored about a student, as rows, for them to keep (the settings screen's download). */
export async function exportData(db: Db, userId: string): Promise<Record<string, unknown>> {
  const users = await db.query("select * from questling.users where id = $1", [userId]);
  if (users.rowCount === 0) throw new ServiceError("not_found", 404);
  const data: Record<string, unknown> = { format: "questling-export-1", exportedAt: new Date().toISOString(), users: users.rows };
  for (const table of STUDENT_TABLES) {
    const rows = await db.query(`select * from questling.${table} where user_id = $1`, [userId]);
    data[table === "auth_identities" ? "identities" : table] = rows.rows;
  }
  return data;
}

/**
 * Deletes a student and, by the schema's cascades, everything about them (progress, ledger, items,
 * runs, memberships, replies); the audit log keeps its rows with the actor cleared. A teacher's
 * account is not deleted here: that would take their groups and campaigns with it.
 */
export async function deleteStudent(db: Db, userId: string): Promise<void> {
  const teacher = await db.query("select 1 from questling.teachers where user_id = $1", [userId]);
  if (teacher.rowCount) throw new ServiceError("forbidden", 403);
  const deleted = await db.query("delete from questling.users where id = $1", [userId]);
  if (deleted.rowCount === 0) throw new ServiceError("not_found", 404);
}

/** Counts an attempt in a time window and says whether it is still within the limit. */
export async function allowed(db: Db, scope: string, subject: string, max: number, seconds: number): Promise<boolean> {
  const window = new Date(Math.floor(Date.now() / (seconds * 1000)) * seconds * 1000);
  const result = await db.query<{ count: number }>(
    `insert into questling.rate_limits (scope, subject, window_start, count) values ($1, $2, $3, 1)
     on conflict (scope, subject, window_start) do update set count = questling.rate_limits.count + 1
     returning count`,
    [scope, subject.slice(0, 80), window],
  );
  // Old windows are cleared now and then, so the table stays small.
  if (Math.random() < 0.01) await db.query("delete from questling.rate_limits where window_start < now() - interval '1 day'");
  return result.rows[0].count <= max;
}
