-- Gate 4: Teacher Studio. Teachers sign in with email and password (Supabase Auth); the server checks
-- the password with Supabase and keeps its own session, like the students' (lib/server/session.ts).
-- A teacher sees only their own groups and the students who joined them. Everything goes through the
-- server: row level security is on and Supabase's API roles get nothing, as for the students' tables.
--
--   * one teacher, many groups; a student may join several groups (by the group's invite code);
--   * teacher-authored campaigns are versioned: a published version is never changed (trigger), an
--     edit is a new draft; a student's run stays bound to the version it started on;
--   * assignments give a group a campaign (built-in or the teacher's, a pinned version) with dates;
--   * daily entries let a teacher schedule a group's word or fact of the day;
--   * mentor messages answer a student's help request; the audit log records what teachers changed.

alter table questling.auth_identities drop constraint auth_identities_provider_check;
alter table questling.auth_identities add constraint auth_identities_provider_check check (provider in ('telegram', 'supabase'));

create table questling.teachers (
  user_id uuid primary key references questling.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  email text not null check (char_length(email) between 3 and 254),
  created_at timestamptz not null default now()
);

create table questling.groups (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references questling.teachers (user_id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  cefr text not null check (cefr in ('A1', 'A2', 'B1', 'B2', 'C1')),
  -- Invite code: what the Telegram link carries (t.me/<bot>?startapp=<code>). Unique, can be renewed.
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index groups_teacher on questling.groups (teacher_id);

create table questling.group_members (
  group_id uuid not null references questling.groups (id) on delete cascade,
  user_id uuid not null references questling.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user on questling.group_members (user_id);

create table questling.quests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references questling.teachers (user_id) on delete cascade,
  -- The id runs and rewards use ("t-…"), unique across all campaigns.
  slug text not null unique check (slug ~ '^t-[a-z0-9-]{4,60}$'),
  title text not null check (char_length(title) between 2 and 120),
  cefr text not null check (cefr in ('A1', 'A2', 'B1', 'B2', 'C1')),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index quests_teacher on questling.quests (teacher_id);

create table questling.quest_versions (
  quest_id uuid not null references questling.quests (id) on delete cascade,
  version integer not null check (version >= 1),
  status text not null check (status in ('draft', 'published')),
  -- The campaign graph (lib/story/graph.ts) and its answer keys, validated by the server before publishing.
  graph jsonb not null check (jsonb_typeof(graph) = 'object' and pg_column_size(graph) <= 262144),
  keys jsonb not null check (jsonb_typeof(keys) = 'object' and pg_column_size(keys) <= 65536),
  note text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  primary key (quest_id, version),
  check ((status = 'published') = (published_at is not null))
);
-- At most one draft per quest.
create unique index quest_versions_one_draft on questling.quest_versions (quest_id) where status = 'draft';

-- A published version is frozen: students' runs are bound to it.
create function questling.quest_versions_frozen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'published' then
    raise exception 'published quest versions are immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger quest_versions_frozen before update or delete on questling.quest_versions
  for each row execute function questling.quest_versions_frozen();

create table questling.assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references questling.groups (id) on delete cascade,
  -- A built-in campaign ('forgotten-academy') or a teacher's quest slug ('t-…').
  campaign text not null check (char_length(campaign) between 1 and 64),
  -- For a teacher's quest: the published version the group plays.
  version integer check (version is null or version >= 1),
  starts_at timestamptz not null default now(),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  check (due_at is null or due_at > starts_at),
  unique (group_id, campaign)
);

create table questling.daily_entries (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references questling.teachers (user_id) on delete cascade,
  group_id uuid not null references questling.groups (id) on delete cascade,
  day date not null,
  -- The word and the fact of the day, in the shape of lib/content/daily.ts, validated by the server.
  content jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 16384),
  created_at timestamptz not null default now(),
  unique (group_id, day)
);

create table questling.mentor_messages (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references questling.teachers (user_id) on delete cascade,
  user_id uuid not null references questling.users (id) on delete cascade,
  -- What it answers: a help request ('<campaign>/<scene>').
  ref text not null check (char_length(ref) between 1 and 120),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index mentor_messages_user on questling.mentor_messages (user_id);

create table questling.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references questling.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 60),
  target text check (target is null or char_length(target) <= 120),
  at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['teachers', 'groups', 'group_members', 'quests', 'quest_versions', 'assignments', 'daily_entries', 'mentor_messages', 'audit_log'] loop
    execute format('alter table questling.%I enable row level security', t);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema questling from anon, authenticated';
    execute 'revoke all on all functions in schema questling from anon, authenticated, public';
  end if;
end;
$$;
