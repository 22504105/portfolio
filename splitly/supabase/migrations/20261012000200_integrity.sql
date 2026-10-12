-- What the database itself guarantees about money, whatever the application does.

-- Every active expense: what was paid in total == the expense's total == what
-- is owed in total. Checked when the transaction commits, so the rows of one
-- expense can be written in any order inside it, and no half-written expense
-- can ever be committed.
create function splitly.check_expense_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_expense uuid := coalesce(new.expense_id, old.expense_id);
  v_total bigint;
  v_status text;
  v_paid bigint;
  v_owed bigint;
begin
  select total_minor, status into v_total, v_status from splitly.expenses where id = v_expense;
  -- The expense itself is gone (its group was deleted): nothing left to check.
  if not found then
    return null;
  end if;

  select coalesce(sum(paid_minor), 0) into v_paid from splitly.expense_payers where expense_id = v_expense;
  select coalesce(sum(owed_minor), 0) into v_owed from splitly.expense_splits where expense_id = v_expense;

  if v_paid <> v_total or v_owed <> v_total then
    raise exception 'expense % does not balance: total %, paid %, owed %', v_expense, v_total, v_paid, v_owed
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create function splitly.check_new_expense_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- An expense with no payers or no shares at all is caught here; one with some is caught by the triggers on those tables.
  if not exists (select 1 from splitly.expense_payers where expense_id = new.id)
     or not exists (select 1 from splitly.expense_splits where expense_id = new.id) then
    raise exception 'expense % has no payers or no shares', new.id using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger expense_payers_balanced
  after insert or update or delete on splitly.expense_payers
  deferrable initially deferred
  for each row execute function splitly.check_expense_balanced();

create constraint trigger expense_splits_balanced
  after insert or update or delete on splitly.expense_splits
  deferrable initially deferred
  for each row execute function splitly.check_expense_balanced();

create constraint trigger expenses_have_parts
  after insert on splitly.expenses
  deferrable initially deferred
  for each row execute function splitly.check_new_expense_balanced();

-- An expense's amount, currency, group and date are facts about the past.
-- They are not edited: an edit writes a new expense and marks the old one as
-- replaced. Only the status and the pointer to the replacement may change.
create function splitly.keep_expense_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.total_minor <> old.total_minor
     or new.currency <> old.currency
     or new.group_id <> old.group_id
     or new.expense_date <> old.expense_date
     or new.idempotency_key <> old.idempotency_key
     or new.creator_member_id <> old.creator_member_id then
    raise exception 'an expense is replaced, not edited in place' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger expenses_history before update on splitly.expenses
for each row execute function splitly.keep_expense_history();

-- A recorded exchange rate never changes.
create function splitly.refuse_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are never changed', tg_table_name using errcode = '23514';
end;
$$;

create trigger fx_rates_immutable before update on splitly.fx_rates
for each row execute function splitly.refuse_change();

create trigger activity_log_immutable before update on splitly.activity_log
for each row execute function splitly.refuse_change();

-- The lines of a confirmed receipt add up, each to what its members took.
create function splitly.check_receipt_item_allocated()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_item uuid := coalesce(new.receipt_item_id, old.receipt_item_id);
  v_total bigint;
  v_allocated bigint;
begin
  select line_total_minor into v_total from splitly.receipt_items where id = v_item;
  if not found then
    return null;
  end if;
  select coalesce(sum(share_minor), 0) into v_allocated from splitly.receipt_item_allocations where receipt_item_id = v_item;
  -- A line may be left unallocated while a receipt is a draft; once any of it is given out, all of it must be.
  if v_allocated <> v_total and exists (select 1 from splitly.receipt_item_allocations where receipt_item_id = v_item) then
    raise exception 'receipt line % is not fully allocated: line %, allocated %', v_item, v_total, v_allocated using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger receipt_items_allocated
  after insert or update or delete on splitly.receipt_item_allocations
  deferrable initially deferred
  for each row execute function splitly.check_receipt_item_allocated();

-- Access. The application reaches the database with one server-side
-- connection and enforces "is this person a member of this group" on every
-- operation (docs/security.md). The API roles of the hosting platform get
-- nothing here at all: with no grant and row level security on, a public or
-- signed-in API key cannot read or write a single row of Splitly's data.
do $$
declare
  v_table text;
begin
  for v_table in select tablename from pg_tables where schemaname = 'splitly' loop
    execute format('alter table splitly.%I enable row level security', v_table);
  end loop;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema splitly from anon, authenticated;
    revoke all on all tables in schema splitly from anon, authenticated;
    revoke all on all functions in schema splitly from anon, authenticated;
    alter default privileges in schema splitly revoke all on tables from anon, authenticated;
    alter default privileges in schema splitly revoke all on functions from anon, authenticated;
  end if;
end;
$$;

revoke all on all functions in schema splitly from public;
