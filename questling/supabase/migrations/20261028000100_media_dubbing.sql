-- Large media in S3-compatible object storage (Backblaze B2; lib/server/storage.ts) and voice-acting
-- exercises (lib/dub/model.ts). The bytes never enter the database: media_objects holds what each
-- object is, who owns it, and when it goes. The teachers' existing recordings (media_assets, bytea)
-- stay where they are; nothing is moved.
--   * media_objects: one row per stored object; 'pending' until the server has read it back and
--     checked its content; voice recordings carry delete_after (180 days).
--   * dub_exercises / dub_versions: a teacher's scenes, versioned; a published version never changes.
--   * dub_assignments: a version given to a group.
--   * dub_submissions / dub_takes: a student's recording of a scene, line by line (two takes kept a line),
--     and the teacher's review (approve or ask to retry, with a written note and a rubric without numbers).
--   * media_ops: operations per day, for the usage page and the daily guard.
--   * ledger reason and completion kind 'dub': XP once, when the teacher approves.
-- Like every questling table: row level security on, nothing granted to Supabase's API roles.
-- Non-destructive: new tables, and two check constraints widened by one value each.
-- Rollback: drop table questling.dub_takes, questling.dub_submissions, questling.dub_assignments,
--   questling.dub_versions, questling.dub_exercises, questling.media_objects, questling.media_ops;
--   delete the 'dub' ledger rows and completions if any must go, and restore the two checks as in
--   20261027000100_vocab_journal.sql and 20261024000300_story_runs.sql. Objects in the bucket are
--   deleted separately (keys are in media_objects.storage_key; list them before dropping).

create table questling.media_objects (
  id uuid primary key,
  teacher_id uuid references questling.teachers (user_id) on delete cascade,
  user_id uuid references questling.users (id) on delete cascade,
  kind text not null check (kind in ('video', 'voice', 'image', 'background')),
  storage_key text not null unique check (storage_key ~ '^(video|voice|image|background)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm|m4a|png|jpg|webp|mp3)$'),
  mime text not null check (char_length(mime) <= 40),
  size bigint not null check (size between 1 and 26214400),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 61000),
  width integer check (width is null or width between 1 and 8192),
  height integer check (height is null or height between 1 and 8192),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  rights_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  delete_after timestamptz,
  -- Exactly one owner: a teacher's video, image or background, or a student's voice.
  check ((teacher_id is not null) <> (user_id is not null)),
  check ((kind = 'voice') = (user_id is not null))
);
create index media_objects_teacher on questling.media_objects (teacher_id) where teacher_id is not null;
create index media_objects_user on questling.media_objects (user_id) where user_id is not null;
create index media_objects_expiry on questling.media_objects (delete_after) where delete_after is not null;
create index media_objects_pending on questling.media_objects (created_at) where status = 'pending';

create table questling.dub_exercises (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references questling.teachers (user_id) on delete cascade,
  slug text not null unique check (slug ~ '^d-[a-z0-9-]{4,60}$'),
  title text not null check (char_length(title) between 2 and 80),
  cefr text not null check (cefr in ('A1', 'A2', 'B1', 'B2', 'C1')),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index dub_exercises_teacher on questling.dub_exercises (teacher_id);

create table questling.dub_versions (
  exercise_id uuid not null references questling.dub_exercises (id) on delete cascade,
  version integer not null check (version between 1 and 1000),
  status text not null check (status in ('draft', 'published')),
  content jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 65536),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  primary key (exercise_id, version)
);

-- A published version is frozen: students' submissions refer to its exact lines.
create function questling.dub_version_frozen() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'published' then
    raise exception 'a published version cannot change' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger dub_versions_frozen before update on questling.dub_versions for each row execute function questling.dub_version_frozen();

create table questling.dub_assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references questling.groups (id) on delete cascade,
  exercise_id uuid not null references questling.dub_exercises (id) on delete cascade,
  version integer not null,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, exercise_id),
  foreign key (exercise_id, version) references questling.dub_versions (exercise_id, version)
);
create index dub_assignments_exercise on questling.dub_assignments (exercise_id, version);

create table questling.dub_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references questling.users (id) on delete cascade,
  exercise_id uuid not null references questling.dub_exercises (id) on delete cascade,
  version integer not null,
  role text not null check (role ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  mode text not null check (mode in ('listen', 'voiceover', 'roleplay')),
  status text not null check (status in ('recording', 'submitted', 'approved', 'retry')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewer uuid references questling.teachers (user_id) on delete set null,
  feedback text check (feedback is null or char_length(feedback) <= 1000),
  rubric jsonb check (rubric is null or jsonb_typeof(rubric) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id, version),
  foreign key (exercise_id, version) references questling.dub_versions (exercise_id, version)
);
create index dub_submissions_exercise on questling.dub_submissions (exercise_id, version);

create table questling.dub_takes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references questling.dub_submissions (id) on delete cascade,
  line_id text not null check (line_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  media_id uuid not null unique references questling.media_objects (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index dub_takes_submission on questling.dub_takes (submission_id, line_id, created_at);

create table questling.media_ops (
  day date not null,
  op text not null check (op in ('upload', 'download', 'read', 'delete')),
  count integer not null default 0 check (count >= 0),
  primary key (day, op)
);

alter table questling.ledger drop constraint ledger_reason_check;
alter table questling.ledger add constraint ledger_reason_check
  check (reason in ('quest', 'daily_bonus', 'daily_quiz', 'daily_claim', 'story_node', 'chapter', 'ending', 'achievement', 'chest', 'purchase', 'review', 'dub', 'demo'));

alter table questling.completions drop constraint completions_kind_check;
alter table questling.completions add constraint completions_kind_check
  check (kind in ('quest', 'daily_quiz', 'daily_claim', 'daily_bonus', 'story_node', 'chapter', 'ending', 'help_request', 'achievement', 'chest', 'dub'));

do $$
declare t text;
begin
  foreach t in array array['media_objects', 'dub_exercises', 'dub_versions', 'dub_assignments', 'dub_submissions', 'dub_takes', 'media_ops'] loop
    execute format('alter table questling.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on questling.%I from anon, authenticated', t);
    end if;
  end loop;
end;
$$;
