import "server-only";
import type { Text } from "@/lib/content/text";
import { dayFromNumber, dayNumber, dayOf } from "@/lib/game/time";
import type { World } from "@/lib/game/world";
import { studentDaily, teacherDailyId, teacherDailyKey } from "@/lib/studio/daily";
import type { DailyContent } from "@/lib/studio/model";
import type { Campaign, CampaignKeys } from "@/lib/story/graph";
import type { Db } from "./db";

// What surrounds a signed-in student (lib/game/world.ts): their groups and teachers, what the groups
// were assigned, the teachers' campaigns they may play (the pinned version of each assignment, and
// any version one of their runs is bound to), and the mentors' replies. The campaigns' answer keys
// are returned beside, for the rules on the server; the page only ever gets the graphs.

export async function loadWorld(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<{ world: World; keys: Map<string, CampaignKeys>; dailyKeys: Map<string, { correct: string; explanation: Text }> }> {
  const groups = await db.query<{ id: string; name: string; cefr: string; mentor: string }>(
    `select g.id, g.name, g.cefr, t.display_name as mentor
       from questling.group_members m join questling.groups g on g.id = m.group_id join questling.teachers t on t.user_id = g.teacher_id
      where m.user_id = $1 and g.archived_at is null order by m.joined_at`,
    [userId],
  );
  const groupIds = groups.rows.map((g) => g.id);
  const assignments = await db.query<{ group_id: string; campaign: string; version: number | null; due_at: Date | null }>(
    "select group_id, campaign, version, due_at from questling.assignments where group_id = any($1::uuid[]) and starts_at <= $2 order by created_at",
    [groupIds, now],
  );
  // The teachers' campaign versions needed: the assigned ones, and those the student's runs are bound to.
  const wanted = await db.query<{ graph: Campaign; keys: CampaignKeys }>(
    `select v.graph, v.keys from questling.quest_versions v join questling.quests q on q.id = v.quest_id
      where v.status = 'published' and (
        (q.slug, v.version) in (select campaign, version from questling.assignments where group_id = any($1::uuid[]) and starts_at <= $3 and version is not null)
        or (q.slug, v.version) in (select state->>'campaign', (state->>'version')::int from questling.story_runs where user_id = $2 and campaign like 't-%')
      )`,
    [groupIds, userId, now],
  );
  const messages = await db.query<{ id: string; ref: string; body: string; mentor: string; created_at: Date }>(
    `select m.id, m.ref, m.body, t.display_name as mentor, m.created_at from questling.mentor_messages m
       join questling.teachers t on t.user_id = m.teacher_id where m.user_id = $1 order by m.created_at desc limit 30`,
    [userId],
  );
  // The groups' words of the day around today (the last weeks, for what the student answered then).
  // With two groups planning the same day, the one joined first wins.
  const today = dayOf(now);
  const planned = await db.query<{ id: string; day: string; content: DailyContent; cefr: string; mentor: string; joined_at: Date }>(
    `select d.id, d.day::text as day, d.content, g.cefr, t.display_name as mentor, m.joined_at
       from questling.daily_entries d join questling.groups g on g.id = d.group_id
       join questling.group_members m on m.group_id = g.id and m.user_id = $1 join questling.teachers t on t.user_id = g.teacher_id
      where g.archived_at is null and d.day between $2::date and $3::date order by d.day, m.joined_at`,
    [userId, dayFromNumber(dayNumber(today) - 45), today],
  );
  const daily: NonNullable<World["daily"]> = [];
  const dailyKeys = new Map<string, { correct: string; explanation: Text }>();
  for (const row of planned.rows) {
    if (daily.some((d) => d.day === row.day)) continue;
    daily.push({ day: row.day, entry: studentDaily(row.id, row.day, row.content, row.cefr, row.mentor) });
    dailyKeys.set(teacherDailyId(row.id), teacherDailyKey(row.content));
  }
  const keys = new Map(wanted.rows.map((row) => [`${row.graph.id}@${row.graph.version}`, row.keys]));
  return {
    world: {
      groups: groups.rows,
      assignments: assignments.rows.map((a) => ({
        groupId: a.group_id,
        campaign: a.campaign,
        version: a.version,
        dueAt: a.due_at && a.due_at.toISOString(),
      })),
      campaigns: wanted.rows.map((row) => row.graph),
      messages: messages.rows.map((m) => ({ id: m.id, ref: m.ref, body: m.body, mentor: m.mentor, createdAt: m.created_at.toISOString() })),
      daily,
    },
    keys,
    dailyKeys,
  };
}

/** Joins the group an invite code belongs to. False when no open group has that code. */
export async function joinGroup(db: Db, userId: string, code: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(normalized)) return false;
  const group = await db.query<{ id: string }>("select id from questling.groups where invite_code = $1 and archived_at is null", [
    normalized,
  ]);
  if (group.rowCount === 0) return false;
  await db.query("insert into questling.group_members (group_id, user_id) values ($1, $2) on conflict do nothing", [
    group.rows[0].id,
    userId,
  ]);
  return true;
}
