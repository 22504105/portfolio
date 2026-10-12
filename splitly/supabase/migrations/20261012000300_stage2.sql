-- Stage 2: what groups and hand-entered expenses need on top of the first schema.

-- How an expense was divided, as it was entered, so that it can be shown and
-- edited the same way: the mode on the expense, each person's entered value
-- (an amount, hundredths of a percent, or a number of shares) on their share.
alter table splitly.expenses
  add column split_mode text not null default 'equal' check (split_mode in ('equal', 'exact', 'percent', 'shares'));

alter table splitly.expense_splits
  add column split_value bigint not null default 1,
  add column position integer not null default 1 check (position >= 1);

alter table splitly.expense_payers
  add column position integer not null default 1 check (position >= 1);

-- Counts an attempt at something that is limited, and says whether it is
-- still within the limit: at most p_max attempts per window of p_seconds.
-- The key is a hash; nothing readable is stored. Old windows are cleared as
-- new ones are counted.
create function splitly.allow(p_key bytea, p_max integer, p_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_seconds) * p_seconds);
  v_hits integer;
begin
  insert into splitly.rate_limits (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = splitly.rate_limits.hits + 1
  returning hits into v_hits;

  -- Now and then, sweep away what is long past.
  if v_hits = 1 and random() < 0.05 then
    delete from splitly.rate_limits where window_start < clock_timestamp() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$$;

revoke all on function splitly.allow(bytea, integer, integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function splitly.allow(bytea, integer, integer) from anon, authenticated;
  end if;
end;
$$;

-- A group has exactly one owner among its current members, and the owner
-- named on the group is that member. Kept true by the application inside
-- its transactions; this index makes a second owner impossible regardless.
create unique index group_members_one_owner on splitly.group_members (group_id) where role = 'owner' and removed_at is null;
