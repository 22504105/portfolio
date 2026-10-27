import "server-only";
import { campaignById } from "@/lib/content/campaigns";
import { isCharacterId } from "@/lib/content/characters";
import type { Cefr, Member, Quest, StudioEffect, StudioFacts } from "@/lib/studio/model";
import type { Campaign, CampaignKeys } from "@/lib/story/graph";
import type { RunState } from "@/lib/story/run";
import type { Db } from "./db";
import { mediaUrl, teacherMedia } from "./media";

// A teacher's facts as stored, and the effects of their actions written back (mirrors
// applyStudioEffects in lib/studio/model.ts). Every query is scoped to the teacher: the members are
// only the students who joined one of this teacher's groups, and only what the teacher's screens need
// of them (no Telegram id, no ledger history).

const iso = (value: Date | string) => new Date(value).toISOString();

export async function loadStudio(db: Db, teacherId: string): Promise<StudioFacts | null> {
  const teacher = await db.query<{ display_name: string; email: string }>(
    "select display_name, email from questling.teachers where user_id = $1",
    [teacherId],
  );
  if (teacher.rowCount === 0) return null;
  const groups = await db.query(
    "select id, name, cefr, invite_code, created_at, archived_at, recommend from questling.groups where teacher_id = $1 order by created_at",
    [teacherId],
  );
  const groupIds = groups.rows.map((g) => g.id as string);
  const memberships = await db.query<{ group_id: string; user_id: string; joined_at: Date }>(
    "select group_id, user_id, joined_at from questling.group_members where group_id = any($1::uuid[]) order by joined_at",
    [groupIds],
  );
  const userIds = [...new Set(memberships.rows.map((m) => m.user_id))];
  const people = await db.query(
    `select u.id, u.hero_name, u.character_id, (select username from questling.auth_identities a where a.user_id = u.id and a.provider = 'telegram' limit 1) as username,
            coalesce((select sum(amount) from questling.ledger l where l.user_id = u.id and l.currency = 'xp'), 0)::int as xp
       from questling.users u where u.id = any($1::uuid[])`,
    [userIds],
  );
  const answers = await db.query(
    "select user_id, scope, ref, question, attempt, correct, skill, at from questling.answers where user_id = any($1::uuid[]) order by id",
    [userIds],
  );
  const completions = await db.query(
    "select user_id, kind, ref, at from questling.completions where user_id = any($1::uuid[]) order by at",
    [userIds],
  );
  const runs = await db.query<{ user_id: string; state: RunState }>(
    "select user_id, state from questling.story_runs where user_id = any($1::uuid[])",
    [userIds],
  );

  // A student may be in another teacher's group too: of their story work this teacher sees the built-in
  // campaigns and their own, never another teacher's (the brief: teacher access scoped to the class).
  const ownSlugs = await db.query<{ slug: string }>("select slug from questling.quests where teacher_id = $1", [teacherId]);
  const visible = new Set([...campaignById.keys(), ...ownSlugs.rows.map((q) => q.slug)]);
  const STORY_KINDS = new Set(["story_node", "chapter", "ending", "help_request"]);
  const campaignOfRef = (ref: string) => ref.split("/")[0];

  const members: Member[] = people.rows.map((p) => ({
    userId: p.id,
    heroName: p.hero_name,
    characterId: isCharacterId(p.character_id) ? p.character_id : null,
    username: p.username,
    groups: memberships.rows.filter((m) => m.user_id === p.id).map((m) => ({ groupId: m.group_id, joinedAt: iso(m.joined_at) })),
    xp: p.xp,
    answers: answers.rows
      .filter((a) => a.user_id === p.id && (a.scope !== "story" || visible.has(a.ref)))
      .map((a) => ({
        scope: a.scope,
        ref: a.ref,
        question: a.question,
        attempt: a.attempt,
        correct: a.correct,
        skill: a.skill,
        at: iso(a.at),
      })),
    completions: completions.rows
      .filter((c) => c.user_id === p.id && (!STORY_KINDS.has(c.kind) || visible.has(campaignOfRef(c.ref))))
      .map((c) => ({ kind: c.kind, ref: c.ref, at: iso(c.at) })),
    runs: runs.rows.filter((r) => r.user_id === p.id && visible.has(r.state.campaign)).map((r) => r.state),
  }));

  const quests = await db.query(
    "select id, slug, title, cefr, created_at, archived_at from questling.quests where teacher_id = $1 order by created_at",
    [teacherId],
  );
  const versions = await db.query<{
    quest_id: string;
    version: number;
    status: "draft" | "published";
    graph: Campaign;
    keys: CampaignKeys;
    note: string | null;
    updated_at: Date;
    published_at: Date | null;
  }>(
    "select quest_id, version, status, graph, keys, note, updated_at, published_at from questling.quest_versions where quest_id = any($1::uuid[]) order by version",
    [quests.rows.map((q) => q.id)],
  );
  const assignments = await db.query(
    "select id, group_id, campaign, version, starts_at, due_at from questling.assignments where group_id = any($1::uuid[]) order by created_at",
    [groupIds],
  );
  const daily = await db.query(
    "select id, group_id, day::text as day, content from questling.daily_entries where teacher_id = $1 order by day",
    [teacherId],
  );
  const messages = await db.query(
    "select id, user_id, ref, body, created_at, read_at from questling.mentor_messages where teacher_id = $1 order by created_at",
    [teacherId],
  );

  const dubs = await loadDubs(db, teacherId, groupIds);

  return {
    ...dubs,
    teacher: { userId: teacherId, displayName: teacher.rows[0].display_name, email: teacher.rows[0].email },
    groups: groups.rows.map((g) => ({
      id: g.id,
      name: g.name,
      cefr: g.cefr as Cefr,
      inviteCode: g.invite_code,
      createdAt: iso(g.created_at),
      archivedAt: g.archived_at && iso(g.archived_at),
      recommend: g.recommend,
    })),
    members,
    quests: quests.rows.map((q): Quest => ({
      id: q.id,
      slug: q.slug,
      title: q.title,
      cefr: q.cefr,
      createdAt: iso(q.created_at),
      archivedAt: q.archived_at && iso(q.archived_at),
      versions: versions.rows
        .filter((v) => v.quest_id === q.id)
        .map((v) => ({
          version: v.version,
          status: v.status,
          graph: v.graph,
          keys: v.keys,
          note: v.note,
          updatedAt: iso(v.updated_at),
          publishedAt: v.published_at && iso(v.published_at),
        })),
    })),
    assignments: assignments.rows.map((a) => ({
      id: a.id,
      groupId: a.group_id,
      campaign: a.campaign,
      version: a.version,
      startsAt: iso(a.starts_at),
      dueAt: a.due_at && iso(a.due_at),
    })),
    daily: daily.rows.map((d) => ({ id: d.id, groupId: d.group_id, day: d.day, content: d.content })),
    media: (await teacherMedia(db, teacherId)).map((m) => ({ ...m, url: mediaUrl(teacherId, m.id) })),
    messages: messages.rows.map((m) => ({
      id: m.id,
      userId: m.user_id,
      ref: m.ref,
      body: m.body,
      createdAt: iso(m.created_at),
      readAt: m.read_at && iso(m.read_at),
    })),
  };
}

/** Adds the effects, in order, as of `at`, for this teacher. Must run inside the transaction that computed them. */
export async function persistStudio(db: Db, teacherId: string, effects: StudioEffect[], at: Date): Promise<void> {
  // Each write names the teacher, so no effect can reach another teacher's rows even if one were forged.
  for (const effect of effects) {
    switch (effect.type) {
      case "group.create":
        await db.query(
          "insert into questling.groups (id, teacher_id, name, cefr, invite_code, created_at) values ($1, $2, $3, $4, $5, $6)",
          [effect.group.id, teacherId, effect.group.name, effect.group.cefr, effect.group.inviteCode, at],
        );
        break;
      case "group.update":
        await db.query(
          `update questling.groups set name = coalesce($3, name), cefr = coalesce($4, cefr), invite_code = coalesce($5, invite_code),
             archived_at = case when $6::boolean is null then archived_at when $6 then $7 else null end,
             recommend = coalesce($8, recommend)
           where id = $1 and teacher_id = $2`,
          [
            effect.groupId,
            teacherId,
            effect.name ?? null,
            effect.cefr ?? null,
            effect.inviteCode ?? null,
            effect.archived ?? null,
            at,
            effect.recommend ?? null,
          ],
        );
        break;
      case "member.remove":
        await db.query(
          "delete from questling.group_members m using questling.groups g where m.group_id = g.id and g.teacher_id = $1 and m.group_id = $2 and m.user_id = $3",
          [teacherId, effect.groupId, effect.userId],
        );
        break;
      case "quest.create":
        await db.query("insert into questling.quests (id, teacher_id, slug, title, cefr, created_at) values ($1, $2, $3, $4, $5, $6)", [
          effect.quest.id,
          teacherId,
          effect.quest.slug,
          effect.quest.title,
          effect.quest.cefr,
          at,
        ]);
        break;
      case "quest.update":
        await db.query(
          `update questling.quests set title = coalesce($3, title), cefr = coalesce($4, cefr),
             archived_at = case when $5::boolean is null then archived_at when $5 then $6 else null end
           where id = $1 and teacher_id = $2`,
          [effect.questId, teacherId, effect.title ?? null, effect.cefr ?? null, effect.archived ?? null, at],
        );
        break;
      case "version.saveDraft": {
        const owned = await db.query("select 1 from questling.quests where id = $1 and teacher_id = $2", [effect.questId, teacherId]);
        if (owned.rowCount === 0) throw Object.assign(new Error("not the teacher's quest"), { code: "42501" });
        await db.query(
          `insert into questling.quest_versions (quest_id, version, status, graph, keys, note, updated_at) values ($1, $2, 'draft', $3, $4, $5, $6)
           on conflict (quest_id, version) do update set graph = excluded.graph, keys = excluded.keys, note = excluded.note, updated_at = excluded.updated_at`,
          [effect.questId, effect.version, JSON.stringify(effect.graph), JSON.stringify(effect.keys), effect.note, at],
        );
        break;
      }
      case "version.publish":
        await db.query(
          `update questling.quest_versions v set status = 'published', published_at = $4, updated_at = $4
           from questling.quests q where v.quest_id = q.id and q.teacher_id = $1 and v.quest_id = $2 and v.version = $3 and v.status = 'draft'`,
          [teacherId, effect.questId, effect.version, at],
        );
        break;
      case "assignment.set":
        await db.query(
          `insert into questling.assignments (id, group_id, campaign, version, starts_at, due_at, created_at)
           select $1, g.id, $3, $4, coalesce($5::timestamptz, $7::timestamptz), $6::timestamptz, $7::timestamptz from questling.groups g where g.id = $2 and g.teacher_id = $8
           on conflict (group_id, campaign) do update set version = excluded.version, due_at = excluded.due_at`,
          [
            effect.assignment.id,
            effect.assignment.groupId,
            effect.assignment.campaign,
            effect.assignment.version,
            effect.assignment.startsAt ?? null,
            effect.assignment.dueAt,
            at,
            teacherId,
          ],
        );
        break;
      case "assignment.remove":
        await db.query(
          "delete from questling.assignments a using questling.groups g where a.group_id = g.id and g.teacher_id = $1 and a.id = $2",
          [teacherId, effect.assignmentId],
        );
        break;
      case "daily.set":
        await db.query(
          `insert into questling.daily_entries (id, teacher_id, group_id, day, content, created_at)
           select $1, $2, g.id, $4, $5, $6 from questling.groups g where g.id = $3 and g.teacher_id = $2
           on conflict (group_id, day) do update set content = excluded.content`,
          [effect.entry.id, teacherId, effect.entry.groupId, effect.entry.day, JSON.stringify(effect.entry.content), at],
        );
        break;
      case "daily.remove":
        await db.query("delete from questling.daily_entries where id = $1 and teacher_id = $2", [effect.entryId, teacherId]);
        break;
      case "dub.create":
        await db.query(
          "insert into questling.dub_exercises (id, teacher_id, slug, title, cefr, created_at) values ($1, $2, $3, $4, $5, $6)",
          [effect.exercise.id, teacherId, effect.exercise.slug, effect.exercise.title, effect.exercise.cefr, at],
        );
        break;
      case "dub.update":
        await db.query(
          `update questling.dub_exercises set title = coalesce($3, title), cefr = coalesce($4, cefr),
             archived_at = case when $5::boolean is null then archived_at when $5 then $6 else null end
           where id = $1 and teacher_id = $2`,
          [effect.exerciseId, teacherId, effect.title ?? null, effect.cefr ?? null, effect.archived ?? null, at],
        );
        break;
      case "dub.saveDraft": {
        const own = await db.query("update questling.dub_exercises set title = $3, cefr = $4 where id = $1 and teacher_id = $2", [
          effect.exerciseId,
          teacherId,
          effect.content.title,
          effect.content.cefr,
        ]);
        if (!own.rowCount) throw new Error("not this teacher's scene");
        await db.query(
          `insert into questling.dub_versions (exercise_id, version, status, content, updated_at) values ($1, $2, 'draft', $3, $4)
           on conflict (exercise_id, version) do update set content = excluded.content, updated_at = excluded.updated_at`,
          [effect.exerciseId, effect.version, JSON.stringify(effect.content), at],
        );
        break;
      }
      case "dub.publish":
        await db.query(
          `update questling.dub_versions v set status = 'published', published_at = $3, updated_at = $3
             from questling.dub_exercises e where e.id = v.exercise_id and e.teacher_id = $2 and v.exercise_id = $1 and v.version = $4`,
          [effect.exerciseId, teacherId, at, effect.version],
        );
        break;
      case "dub.assign":
        await db.query(
          `insert into questling.dub_assignments (id, group_id, exercise_id, version, due_at, created_at)
             select $1, g.id, e.id, $5, $6, $7 from questling.groups g, questling.dub_exercises e
              where g.id = $2 and g.teacher_id = $3 and e.slug = $4 and e.teacher_id = $3
           on conflict (group_id, exercise_id) do update set version = excluded.version, due_at = excluded.due_at`,
          [
            effect.assignment.id,
            effect.assignment.groupId,
            teacherId,
            effect.assignment.exercise,
            effect.assignment.version,
            effect.assignment.dueAt,
            at,
          ],
        );
        break;
      case "dub.unassign":
        await db.query(
          "delete from questling.dub_assignments a using questling.groups g where a.group_id = g.id and g.teacher_id = $2 and a.id = $1",
          [effect.assignmentId, teacherId],
        );
        break;
      case "dub.review": {
        const reviewed = await db.query(
          `update questling.dub_submissions s set status = $3, feedback = $4, rubric = $5, reviewed_at = $6, reviewer = $2
             from questling.dub_exercises e where e.id = s.exercise_id and e.teacher_id = $2 and s.id = $1 and s.status = 'submitted'`,
          [effect.submissionId, teacherId, effect.status, effect.feedback, effect.rubric ? JSON.stringify(effect.rubric) : null, at],
        );
        if (!reviewed.rowCount) throw new Error("submission not reviewable");
        // The XP the scene promises, once: the ledger's unique key refuses a second grant.
        if (effect.grant) {
          await db.query(
            "insert into questling.ledger (user_id, currency, amount, key, reason, at) values ($1, 'xp', $2, $3, 'dub', $4) on conflict do nothing",
            [effect.grant.userId, effect.grant.xp, effect.grant.key, at],
          );
          await db.query("insert into questling.completions (user_id, kind, ref, at) values ($1, 'dub', $2, $3) on conflict do nothing", [
            effect.grant.userId,
            effect.grant.key.slice(4),
            at,
          ]);
        }
        break;
      }
      case "object.remove":
        break;
      case "message.send":
        await db.query(
          "insert into questling.mentor_messages (id, teacher_id, user_id, ref, body, created_at) values ($1, $2, $3, $4, $5, $6)",
          [effect.message.id, teacherId, effect.message.userId, effect.message.ref, effect.message.body, at],
        );
        break;
      case "audit":
        await db.query("insert into questling.audit_log (actor, action, target, at) values ($1, $2, $3, $4)", [
          teacherId,
          effect.action,
          effect.target,
          at,
        ]);
        break;
    }
  }
}

/** The teacher's voice-acting scenes, their assignments, the submissions of students in their groups, and their stored media. */
async function loadDubs(db: Db, teacherId: string, groupIds: string[]) {
  const exercises = await db.query(
    "select id, slug, title, cefr, created_at, archived_at from questling.dub_exercises where teacher_id = $1 order by created_at",
    [teacherId],
  );
  const ids = exercises.rows.map((e) => e.id as string);
  const versions = await db.query(
    "select exercise_id, version, status, content, updated_at, published_at from questling.dub_versions where exercise_id = any($1::uuid[]) order by version",
    [ids],
  );
  const assignments = await db.query(
    "select a.id, a.group_id, e.slug, a.version, a.due_at, a.created_at from questling.dub_assignments a join questling.dub_exercises e on e.id = a.exercise_id where a.group_id = any($1::uuid[]) and e.teacher_id = $2 order by a.created_at",
    [groupIds, teacherId],
  );
  // Only students who are in one of this teacher's groups, for this teacher's scenes.
  const submissions = await db.query(
    `select s.id, s.user_id, e.slug, s.version, s.role, s.mode, s.status, s.attempts, s.submitted_at, s.reviewed_at, s.feedback, s.rubric
       from questling.dub_submissions s join questling.dub_exercises e on e.id = s.exercise_id and e.teacher_id = $1
      where exists (select 1 from questling.group_members m where m.user_id = s.user_id and m.group_id = any($2::uuid[]))
      order by s.submitted_at nulls last`,
    [teacherId, groupIds],
  );
  const takes = await db.query(
    "select submission_id, line_id, media_id, created_at from questling.dub_takes where submission_id = any($1::uuid[]) order by created_at",
    [submissions.rows.map((r) => r.id)],
  );
  const objects = await db.query(
    "select id, kind, mime, size, duration_ms, width, height, created_at from questling.media_objects where teacher_id = $1 and status = 'ready' order by created_at desc",
    [teacherId],
  );
  return {
    dubs: exercises.rows.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      cefr: e.cefr,
      createdAt: iso(e.created_at),
      archivedAt: e.archived_at && iso(e.archived_at),
      versions: versions.rows
        .filter((v) => v.exercise_id === e.id)
        .map((v) => ({
          version: v.version,
          status: v.status,
          content: v.content,
          updatedAt: iso(v.updated_at),
          publishedAt: v.published_at && iso(v.published_at),
        })),
    })),
    dubAssignments: assignments.rows.map((a) => ({
      id: a.id,
      groupId: a.group_id,
      exercise: a.slug,
      version: a.version,
      dueAt: a.due_at && iso(a.due_at),
      createdAt: iso(a.created_at),
    })),
    dubSubmissions: submissions.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      exercise: r.slug,
      version: r.version,
      role: r.role,
      mode: r.mode,
      status: r.status,
      attempts: r.attempts,
      submittedAt: r.submitted_at && iso(r.submitted_at),
      reviewedAt: r.reviewed_at && iso(r.reviewed_at),
      feedback: r.feedback,
      rubric: r.rubric,
      takes: takes.rows
        .filter((t) => t.submission_id === r.id)
        .map((t) => ({ lineId: t.line_id, mediaId: t.media_id, createdAt: iso(t.created_at) })),
    })),
    objects: objects.rows.map((o) => ({
      id: o.id,
      kind: o.kind,
      mime: o.mime,
      size: Number(o.size),
      durationMs: o.duration_ms,
      width: o.width,
      height: o.height,
      createdAt: iso(o.created_at),
    })),
  };
}
