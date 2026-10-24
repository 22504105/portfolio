-- Questling, gate 2: students, their Telegram sign-in, and their record of play.
--
-- One table per kind of fact (lib/game/facts.ts). Balances, levels and streaks are never
-- stored: the application works them out from these rows. The database itself guarantees
-- what must never go wrong whatever the application does:
--   * a reward is granted once: every ledger row has a key, unique per student and currency;
--   * the coin balance never goes below zero (checked at commit);
--   * the ledger is never rewritten: rows can be added, not changed;
--   * an item can only be worn if it is owned.
-- Everything lives in schema "questling". The server reaches it with its own connection;
-- Supabase's public API roles get no access at all (row level security on, no policies).

create schema if not exists questling;

create table questling.users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  hero_name text check (hero_name is null or char_length(hero_name) between 2 and 24),
  character_id text check (character_id is null or character_id in ('girl', 'boy', 'cat', 'fox', 'owl', 'forest')),
  ui_locale text not null default 'ru' check (ui_locale in ('ru', 'en'))
);

-- How a person signs in. A Telegram account is identified by its numeric id.
create table questling.auth_identities (
  provider text not null check (provider in ('telegram')),
  subject text not null check (char_length(subject) between 1 and 64),
  user_id uuid not null references questling.users (id) on delete cascade,
  username text check (username is null or char_length(username) <= 32),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (provider, subject)
);
create index auth_identities_user on questling.auth_identities (user_id);

-- XP and coins: one row per grant or spend.
create table questling.ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references questling.users (id) on delete cascade,
  currency text not null check (currency in ('xp', 'coins')),
  amount integer not null check (amount <> 0 and amount between -100000 and 100000),
  key text not null check (char_length(key) between 1 and 200),
  reason text not null check (reason in ('quest', 'daily_bonus', 'daily_quiz', 'daily_claim', 'story_node', 'chapter', 'achievement', 'chest', 'purchase', 'demo')),
  at timestamptz not null default now(),
  unique (user_id, currency, key)
);

create function questling.ledger_is_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'the ledger is append-only' using errcode = '23514';
end;
$$;
create trigger ledger_no_update before update on questling.ledger
  for each row execute function questling.ledger_is_append_only();

create function questling.coins_not_negative() returns trigger
language plpgsql as $$
begin
  if (select coalesce(sum(amount), 0) from questling.ledger where user_id = new.user_id and currency = 'coins') < 0 then
    raise exception 'coin balance below zero' using errcode = '23514';
  end if;
  return null;
end;
$$;
-- Checked when the transaction commits, so a purchase is judged on the whole of what it wrote.
create constraint trigger ledger_coins_not_negative
  after insert on questling.ledger
  deferrable initially deferred
  for each row when (new.currency = 'coins')
  execute function questling.coins_not_negative();

-- Every graded answer.
create table questling.answers (
  id bigint generated always as identity primary key,
  user_id uuid not null references questling.users (id) on delete cascade,
  scope text not null check (scope in ('quest', 'story', 'daily')),
  ref text not null check (char_length(ref) between 1 and 120),
  question text not null check (char_length(question) between 1 and 120),
  attempt integer not null check (attempt between 1 and 50),
  correct boolean not null,
  skill text not null check (skill in ('vocabulary', 'grammar', 'reading', 'listening', 'cipher')),
  at timestamptz not null default now(),
  unique (user_id, scope, ref, question, attempt)
);
create index answers_user on questling.answers (user_id);

-- Things done once: a quest on a day, a story clue, a chapter, an achievement, a weekly chest.
create table questling.completions (
  user_id uuid not null references questling.users (id) on delete cascade,
  kind text not null check (kind in ('quest', 'daily_quiz', 'daily_claim', 'daily_bonus', 'story_node', 'chapter', 'achievement', 'chest')),
  ref text not null check (char_length(ref) between 1 and 120),
  at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);

-- Words and facts the student kept.
create table questling.saved (
  user_id uuid not null references questling.users (id) on delete cascade,
  kind text not null check (kind in ('word', 'fact')),
  ref text not null check (char_length(ref) between 1 and 80),
  at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);

-- Cosmetic items owned, and the ones worn (one per slot, only if owned).
create table questling.inventory (
  user_id uuid not null references questling.users (id) on delete cascade,
  item text not null check (char_length(item) between 1 and 60),
  source text not null check (source in ('starter', 'purchase', 'achievement', 'chest', 'demo')),
  at timestamptz not null default now(),
  primary key (user_id, item)
);

create table questling.equipped (
  user_id uuid not null references questling.users (id) on delete cascade,
  slot text not null check (slot in ('headwear', 'face', 'neck', 'outerwear', 'outfit', 'back', 'handheld', 'companion')),
  item text not null,
  primary key (user_id, slot),
  foreign key (user_id, item) references questling.inventory (user_id, item) on delete cascade
);

-- Attempts counted per window, to slow down abuse of sign-in and actions.
create table questling.rate_limits (
  scope text not null,
  subject text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (scope, subject, window_start)
);

-- No access through Supabase's public API: row level security with no policies, and no grants.
do $$
declare
  t text;
begin
  foreach t in array array['users', 'auth_identities', 'ledger', 'answers', 'completions', 'saved', 'inventory', 'equipped', 'rate_limits'] loop
    execute format('alter table questling.%I enable row level security', t);
  end loop;
end;
$$;
revoke all on schema questling from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema questling from anon, authenticated';
    execute 'revoke all on schema questling from anon, authenticated';
  end if;
end;
$$;
