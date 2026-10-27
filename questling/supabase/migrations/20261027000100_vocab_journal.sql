-- The student's word journal (lib/learning/vocab.ts) and its spaced-repetition schedule
-- (lib/learning/srs.ts). A card's content is copied from the campaign or word of the day by the
-- server when it is kept, so editing content later does not change it. Reviews pay a little XP,
-- capped per day by the actions (ledger reason 'review').
-- Teachers can turn practice suggestions off for a group (groups.recommend, on by default).
-- Non-destructive: one new table, one new column with a default, and the ledger's reason check
-- widened by one value.
-- Rollback:
--   drop table questling.vocab;
--   alter table questling.groups drop column recommend;
--   delete from questling.ledger where reason = 'review';   -- only if review XP must go too
--   alter table questling.ledger drop constraint ledger_reason_check;
--   alter table questling.ledger add constraint ledger_reason_check check (reason in ('quest', 'daily_bonus',
--     'daily_quiz', 'daily_claim', 'story_node', 'chapter', 'ending', 'achievement', 'chest', 'purchase', 'demo'));

create table questling.vocab (
  user_id uuid not null references questling.users (id) on delete cascade,
  ref text not null check (char_length(ref) between 1 and 120),
  term text not null check (char_length(term) between 1 and 80),
  ru text not null check (char_length(ru) between 1 and 120),
  example text check (example is null or char_length(example) <= 200),
  cefr text check (cefr is null or cefr in ('A1', 'A2', 'B1', 'B2', 'C1')),
  source text not null check (source = 'daily' or source ~ '^story:[a-z0-9-]{1,80}$'),
  saved_at timestamptz not null default now(),
  favorite boolean not null default false,
  known boolean not null default false,
  due date not null,
  interval_days integer not null default 0 check (interval_days between 0 and 365),
  ease integer not null default 250 check (ease between 100 and 400),
  reps integer not null default 0 check (reps between 0 and 10000),
  lapses integer not null default 0 check (lapses between 0 and 10000),
  primary key (user_id, ref)
);
create index vocab_due on questling.vocab (user_id, due);

alter table questling.groups add column recommend boolean not null default true;

alter table questling.ledger drop constraint ledger_reason_check;
alter table questling.ledger add constraint ledger_reason_check
  check (reason in ('quest', 'daily_bonus', 'daily_quiz', 'daily_claim', 'story_node', 'chapter', 'ending', 'achievement', 'chest', 'purchase', 'review', 'demo'));

alter table questling.vocab enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on questling.vocab from anon, authenticated';
  end if;
end;
$$;
