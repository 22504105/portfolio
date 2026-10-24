-- Gate 3: campaigns as story graphs. A student plays each campaign in one run: where they are,
-- what they chose and found, how many attempts each scene has left. The run is bound to the
-- campaign version it started on, so a new version never changes a story half-way through.
-- Rewards stay in the ledger, keyed once per campaign scene, chapter and ending.

create table questling.story_runs (
  user_id uuid not null references questling.users (id) on delete cascade,
  campaign text not null check (char_length(campaign) between 1 and 60),
  version integer not null check (version >= 1),
  state jsonb not null check (jsonb_typeof(state) = 'object' and pg_column_size(state) <= 32768),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, campaign)
);

alter table questling.story_runs enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on questling.story_runs from anon, authenticated';
  end if;
end;
$$;

-- An ending's reward, and the endings and help requests as things done once.
alter table questling.ledger drop constraint ledger_reason_check;
alter table questling.ledger add constraint ledger_reason_check
  check (reason in ('quest', 'daily_bonus', 'daily_quiz', 'daily_claim', 'story_node', 'chapter', 'ending', 'achievement', 'chest', 'purchase', 'demo'));

alter table questling.completions drop constraint completions_kind_check;
alter table questling.completions add constraint completions_kind_check
  check (kind in ('quest', 'daily_quiz', 'daily_claim', 'daily_bonus', 'story_node', 'chapter', 'ending', 'help_request', 'achievement', 'chest'));
