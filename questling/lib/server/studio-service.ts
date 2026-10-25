import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { applyStudioEffects, type StudioFacts } from "@/lib/studio/model";
import { studioRun, type StudioAction, type StudioOutcome, type StudioRefusal } from "@/lib/studio/ops";
import type { Db } from "./db";
import { loadStudio, persistStudio } from "./studio-store";
import type { AuthAccount } from "./teacher-auth";

// What a signed-in teacher can ask of the server: their studio's facts, and actions on them. Each
// action runs the studio's rules (lib/studio/ops.ts) on this teacher's facts only, under a lock on the
// teacher's row, and stores the effects in the same transaction.

export class StudioError extends Error {
  constructor(
    public code: "not_found" | "not_teacher" | "invalid" | StudioRefusal,
    public status: number,
    public problems?: string[],
  ) {
    super(code);
  }
}

const REFUSAL_STATUS: Record<StudioRefusal, number> = {
  invalid: 422,
  not_found: 404,
  archived: 409,
  no_draft: 409,
  not_published: 409,
  invalid_graph: 422,
};

/** Readable invite codes: no 0/O or 1/I to mistake when typing one in. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newInviteCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

/** Finds or creates the teacher a Supabase account belongs to. Only a confirmed account gets here. */
export async function signInTeacher(db: Db, account: AuthAccount): Promise<string> {
  const known = await db.query<{ user_id: string }>(
    "update questling.auth_identities set last_seen_at = now() where provider = 'supabase' and subject = $1 returning user_id",
    [account.id],
  );
  let userId = known.rows[0]?.user_id;
  if (!userId) {
    const created = await db.query<{ id: string }>("insert into questling.users (ui_locale) values ('ru') returning id");
    const identity = await db.query<{ user_id: string }>(
      `insert into questling.auth_identities (provider, subject, user_id, username) values ('supabase', $1, $2, null)
       on conflict (provider, subject) do update set last_seen_at = now() returning user_id`,
      [account.id, created.rows[0].id],
    );
    userId = identity.rows[0].user_id;
  }
  const name = (account.displayName ?? account.email.split("@")[0]).trim().slice(0, 60).padEnd(2, ".");
  await db.query(
    `insert into questling.teachers (user_id, display_name, email) values ($1, $2, $3)
     on conflict (user_id) do update set email = excluded.email`,
    [userId, name, account.email],
  );
  return userId;
}

export async function studioState(db: Db, teacherId: string): Promise<StudioFacts> {
  const facts = await loadStudio(db, teacherId);
  if (!facts) throw new StudioError("not_teacher", 403);
  return facts;
}

// What an action may look like on the way in; the rules check the rest (graphs by their own schema).
const uuid = z.string().uuid();
const cefr = z.enum(["A1", "A2", "B1", "B2", "C1"]);
const short = z.string().max(200);
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("createGroup"), name: short, cefr }),
  z.object({ type: z.literal("updateGroup"), groupId: uuid, name: short.optional(), cefr: cefr.optional() }),
  z.object({ type: z.literal("archiveGroup"), groupId: uuid, archived: z.boolean() }),
  z.object({ type: z.literal("renewInvite"), groupId: uuid }),
  z.object({ type: z.literal("removeMember"), groupId: uuid, userId: uuid }),
  z.object({
    type: z.literal("assign"),
    groupId: uuid,
    campaign: z.string().max(64),
    version: z.number().int().positive().nullable().optional(),
    dueAt: z.string().max(40).nullable().optional(),
  }),
  z.object({ type: z.literal("unassign"), assignmentId: uuid }),
  z.object({ type: z.literal("createQuest"), title: short, cefr }),
  z.object({ type: z.literal("duplicateQuest"), from: z.string().max(64), title: short.optional() }),
  z.object({ type: z.literal("updateQuest"), questId: uuid, title: short.optional(), cefr: cefr.optional() }),
  z.object({ type: z.literal("archiveQuest"), questId: uuid, archived: z.boolean() }),
  z.object({
    type: z.literal("saveDraft"),
    questId: uuid,
    graph: z.unknown(),
    keys: z.unknown(),
    note: z.string().max(500).nullable().optional(),
  }),
  z.object({ type: z.literal("publish"), questId: uuid }),
  z.object({ type: z.literal("setDaily"), groupId: uuid, day: z.string().max(10), content: z.unknown() }),
  z.object({ type: z.literal("clearDaily"), entryId: uuid }),
  z.object({ type: z.literal("replyHelp"), userId: uuid, ref: z.string().max(120), body: z.string().max(1000) }),
]);

export async function studioAct(
  db: Db,
  teacherId: string,
  input: { action?: unknown },
  now = new Date(),
): Promise<{ outcome: StudioOutcome; facts: StudioFacts }> {
  const parsed = actionSchema.safeParse(input.action);
  if (!parsed.success) throw new StudioError("invalid", 422);
  // One action at a time per teacher.
  const locked = await db.query("select user_id from questling.teachers where user_id = $1 for update", [teacherId]);
  if (locked.rowCount === 0) throw new StudioError("not_teacher", 403);
  const facts = await studioState(db, teacherId);
  const result = studioRun(facts, parsed.data as StudioAction, { now, newId: randomUUID, newCode: newInviteCode });
  if (!result.ok) throw new StudioError(result.refusal, REFUSAL_STATUS[result.refusal], result.problems);
  await persistStudio(db, teacherId, result.effects, now);
  return { outcome: result.outcome, facts: applyStudioEffects(facts, result.effects, now.toISOString()) };
}
