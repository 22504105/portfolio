import "server-only";
import { isCharacterId } from "@/lib/content/characters";
import type { Effect, Facts } from "@/lib/game/facts";
import type { RunState } from "@/lib/story/run";
import type { Db } from "./db";

// A student's facts as stored: loading them all (a student's record is small: a few hundred
// rows after months of play) and adding effects. Mirrors applyEffects (lib/game/facts.ts);
// the unique keys and checks of the schema make a second grant or a negative balance fail.

const iso = (value: Date | string) => new Date(value).toISOString();

export async function loadFacts(db: Db, userId: string): Promise<Facts | null> {
  const user = await db.query<{ hero_name: string | null; character_id: string | null; created_at: Date }>(
    "select hero_name, character_id, created_at from questling.users where id = $1",
    [userId],
  );
  if (user.rowCount === 0) return null;
  // One after another: a connection runs one query at a time anyway, and pg 9 will require it.
  const ledger = await db.query("select currency, amount, key, reason, at from questling.ledger where user_id = $1 order by id", [userId]);
  const answers = await db.query(
    "select scope, ref, question, attempt, correct, skill, at from questling.answers where user_id = $1 order by id",
    [userId],
  );
  const completions = await db.query("select kind, ref, at from questling.completions where user_id = $1 order by at", [userId]);
  const saved = await db.query("select kind, ref, at from questling.saved where user_id = $1 order by at", [userId]);
  const inventory = await db.query("select item, source, at from questling.inventory where user_id = $1 order by at", [userId]);
  const equipped = await db.query("select slot, item from questling.equipped where user_id = $1", [userId]);
  const runs = await db.query<{ state: RunState }>("select state from questling.story_runs where user_id = $1 order by started_at", [
    userId,
  ]);
  const vocab = await db.query(
    `select ref, term, ru, example, cefr, source, saved_at, favorite, known, to_char(due, 'YYYY-MM-DD') as due, interval_days, ease, reps, lapses
     from questling.vocab where user_id = $1 order by saved_at`,
    [userId],
  );
  const dubs = await db.query(
    `select s.id, e.slug, s.version, s.role, s.mode, s.status, s.attempts, s.submitted_at, s.reviewed_at, s.feedback, s.rubric
       from questling.dub_submissions s join questling.dub_exercises e on e.id = s.exercise_id where s.user_id = $1 order by s.created_at`,
    [userId],
  );
  const takes = await db.query(
    "select submission_id, line_id, media_id, created_at from questling.dub_takes where submission_id = any($1::uuid[]) order by created_at",
    [dubs.rows.map((d) => d.id)],
  );
  const profile = user.rows[0];
  return {
    profile: {
      heroName: profile.hero_name,
      characterId: isCharacterId(profile.character_id) ? profile.character_id : null,
      joinedAt: iso(profile.created_at),
    },
    ledger: ledger.rows.map((r) => ({ currency: r.currency, amount: r.amount, key: r.key, reason: r.reason, at: iso(r.at) })),
    answers: answers.rows.map((r) => ({
      scope: r.scope,
      ref: r.ref,
      question: r.question,
      attempt: r.attempt,
      correct: r.correct,
      skill: r.skill,
      at: iso(r.at),
    })),
    completions: completions.rows.map((r) => ({ kind: r.kind, ref: r.ref, at: iso(r.at) })),
    saved: saved.rows.map((r) => ({ kind: r.kind, ref: r.ref, at: iso(r.at) })),
    inventory: inventory.rows.map((r) => ({ item: r.item, source: r.source, at: iso(r.at) })),
    equipped: Object.fromEntries(equipped.rows.map((r) => [r.slot, r.item])),
    runs: runs.rows.map((r) => r.state),
    dubs: dubs.rows.map((r) => ({
      id: r.id,
      userId,
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
    vocab: vocab.rows.map((r) => ({
      ref: r.ref,
      term: r.term,
      ru: r.ru,
      ...(r.example ? { example: r.example } : {}),
      ...(r.cefr ? { cefr: r.cefr } : {}),
      source: r.source,
      savedAt: iso(r.saved_at),
      favorite: r.favorite,
      known: r.known,
      schedule: { due: r.due, interval: r.interval_days, ease: r.ease, reps: r.reps, lapses: r.lapses },
    })),
  };
}

/** Adds the effects, in order, as of `at`. Must run inside the transaction that computed them. */
export async function persist(db: Db, userId: string, effects: Effect[], at: Date): Promise<void> {
  for (const effect of effects) {
    switch (effect.type) {
      case "profile":
        if (effect.characterId !== undefined)
          await db.query("update questling.users set character_id = $2 where id = $1", [userId, effect.characterId]);
        if (effect.heroName !== undefined)
          await db.query("update questling.users set hero_name = $2 where id = $1", [userId, effect.heroName]);
        break;
      case "ledger":
        await db.query("insert into questling.ledger (user_id, currency, amount, key, reason, at) values ($1, $2, $3, $4, $5, $6)", [
          userId,
          effect.currency,
          effect.amount,
          effect.key,
          effect.reason,
          at,
        ]);
        break;
      case "answer":
        await db.query(
          "insert into questling.answers (user_id, scope, ref, question, attempt, correct, skill, at) values ($1, $2, $3, $4, $5, $6, $7, $8)",
          [userId, effect.scope, effect.ref, effect.question, effect.attempt, effect.correct, effect.skill, at],
        );
        break;
      case "completion":
        await db.query("insert into questling.completions (user_id, kind, ref, at) values ($1, $2, $3, $4)", [
          userId,
          effect.kind,
          effect.ref,
          at,
        ]);
        break;
      case "save":
        await db.query("insert into questling.saved (user_id, kind, ref, at) values ($1, $2, $3, $4) on conflict do nothing", [
          userId,
          effect.kind,
          effect.ref,
          at,
        ]);
        break;
      case "unsave":
        await db.query("delete from questling.saved where user_id = $1 and kind = $2 and ref = $3", [userId, effect.kind, effect.ref]);
        break;
      case "own":
        await db.query("insert into questling.inventory (user_id, item, source, at) values ($1, $2, $3, $4)", [
          userId,
          effect.item,
          effect.source,
          at,
        ]);
        break;
      case "equip":
        if (effect.item === null) await db.query("delete from questling.equipped where user_id = $1 and slot = $2", [userId, effect.slot]);
        else
          await db.query(
            "insert into questling.equipped (user_id, slot, item) values ($1, $2, $3) on conflict (user_id, slot) do update set item = excluded.item",
            [userId, effect.slot, effect.item],
          );
        break;
      case "run":
        await db.query(
          `insert into questling.story_runs (user_id, campaign, version, state, started_at, updated_at) values ($1, $2, $3, $4, $5, $5)
           on conflict (user_id, campaign) do update set state = excluded.state, updated_at = excluded.updated_at`,
          [userId, effect.state.campaign, effect.state.version, JSON.stringify(effect.state), at],
        );
        break;
      case "vocab": {
        const c = effect.card;
        await db.query(
          `insert into questling.vocab (user_id, ref, term, ru, example, cefr, source, saved_at, favorite, known, due, interval_days, ease, reps, lapses)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           on conflict (user_id, ref) do update set favorite = excluded.favorite, known = excluded.known, due = excluded.due,
             interval_days = excluded.interval_days, ease = excluded.ease, reps = excluded.reps, lapses = excluded.lapses`,
          [
            userId,
            c.ref,
            c.term,
            c.ru,
            c.example ?? null,
            c.cefr ?? null,
            c.source,
            c.savedAt,
            c.favorite,
            c.known,
            c.schedule.due,
            c.schedule.interval,
            c.schedule.ease,
            c.schedule.reps,
            c.schedule.lapses,
          ],
        );
        break;
      }
      case "dub": {
        const d = effect.submission;
        // Only to a scene assigned to one of the student's groups, in the assigned version.
        const saved = await db.query(
          `insert into questling.dub_submissions (id, user_id, exercise_id, version, role, mode, status, attempts, submitted_at, created_at)
             select $1, $2, e.id, $4, $5, $6, $7, $8, $9, $10 from questling.dub_exercises e
              where e.slug = $3 and exists (select 1 from questling.dub_assignments a join questling.group_members m on m.group_id = a.group_id
                                             where a.exercise_id = e.id and a.version = $4 and m.user_id = $2)
           on conflict (user_id, exercise_id, version) do update set role = excluded.role, mode = excluded.mode, status = excluded.status,
             attempts = excluded.attempts, submitted_at = excluded.submitted_at`,
          [d.id, userId, d.exercise, d.version, d.role, d.mode, d.status, d.attempts, d.submittedAt, at],
        );
        if (!saved.rowCount) throw new Error("scene not assigned");
        break;
      }
      case "dubTake":
        // Takes reach the database only through the upload route (lib/server/media-store.ts).
        throw new Error("takes are not stored from actions");
      case "unvocab":
        await db.query("delete from questling.vocab where user_id = $1 and ref = $2", [userId, effect.ref]);
        break;
    }
  }
}
