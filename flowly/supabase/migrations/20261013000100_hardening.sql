-- Hardening after the final review (docs/security.md).
--
-- Until now a signed-in user could write rows into their own workspace's
-- orders, lines and customers directly through the API. Row level security
-- kept them inside their own workspace, but nothing stopped them from
-- skipping the import function and its checks: orders that do not add up to
-- their lines, or far more orders than the limit, until the free database
-- was full. From here on imported rows are written by the import function
-- only.

revoke insert on public.customers, public.orders, public.order_lines from authenticated;

-- The import function therefore runs with the rights of its owner, and so can
-- no longer lean on row level security: it checks for itself that the batch
-- belongs to the caller, before anything else.
create or replace function public.import_orders(p_batch uuid, p_orders jsonb, p_replace boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_workspace uuid;
  v_currency text;
  v_status text;
  v_count integer;
  v_existing integer;
  v_replaced integer := 0;
  v_inserted integer;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- Someone else's batch is "not found", exactly like one that does not exist.
  select b.workspace_id, b.status, w.currency_code
    into v_workspace, v_status, v_currency
  from public.import_batches b
  join public.workspaces w on w.id = b.workspace_id
  where b.id = p_batch and w.owner_user_id = v_user;

  if not found then
    raise exception 'import batch not found' using errcode = 'P0002';
  end if;
  if v_status <> 'importing' then
    raise exception 'import batch is closed' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_orders) <> 'array' then
    raise exception 'orders must be an array' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_orders);
  if v_count > 500 then
    raise exception 'too many orders in one request' using errcode = '22023';
  end if;

  if exists (select 1 from public.import_rows(p_orders) group by external_id having count(*) > 1) then
    raise exception 'the same order number twice in one request' using errcode = '23505';
  end if;
  -- An order is the sum of its lines, here as everywhere.
  if exists (
    select 1 from public.import_rows(p_orders) i
    where jsonb_typeof(i.lines) <> 'array'
       or jsonb_array_length(i.lines) = 0
       or jsonb_array_length(i.lines) > 500
       or i.net <> (select sum((l ->> 'net')::numeric) from jsonb_array_elements(i.lines) l)
       or i.gross <> (select sum((l ->> 'gross')::numeric) from jsonb_array_elements(i.lines) l)
       or i.refund > i.net
  ) then
    raise exception 'an order does not add up to its lines' using errcode = '23514';
  end if;

  if p_replace then
    with gone as (
      delete from public.orders o
      using public.import_rows(p_orders) i
      where o.workspace_id = v_workspace and o.external_order_id = i.external_id
      returning 1
    )
    select count(*) into v_replaced from gone;
  end if;

  select count(*) into v_existing from public.orders where workspace_id = v_workspace;
  if v_existing + v_count > public.workspace_order_limit() then
    raise exception 'workspace order limit reached' using errcode = '54000';
  end if;

  insert into public.customers (workspace_id, identity_key, external_customer_id, name, email)
  select distinct on (i.customer ->> 'identity_key')
    v_workspace, i.customer ->> 'identity_key', i.customer ->> 'external_id', i.customer ->> 'name', i.customer ->> 'email'
  from public.import_rows(p_orders) i
  where i.customer is not null and jsonb_typeof(i.customer) = 'object'
  order by i.customer ->> 'identity_key'
  on conflict (workspace_id, identity_key) do nothing;

  with added as (
    insert into public.orders (
      workspace_id, import_batch_id, external_order_id, order_date, customer_id, channel, status,
      currency_code, gross_amount, discount_amount, net_amount, refund_amount
    )
    select
      v_workspace, p_batch, i.external_id, i.placed_at,
      (select c.id from public.customers c where c.workspace_id = v_workspace and c.identity_key = i.customer ->> 'identity_key'),
      i.channel, i.status, v_currency, i.gross, i.discount, i.net, i.refund
    from public.import_rows(p_orders) i
    on conflict (workspace_id, external_order_id) do nothing
    returning id, external_order_id
  ),
  lines as (
    insert into public.order_lines (order_id, workspace_id, position, product_name, category, quantity, unit_price, gross_amount, discount_amount, net_amount)
    select
      a.id, v_workspace, l.position, l.line ->> 'product', l.line ->> 'category', (l.line ->> 'quantity')::integer,
      (l.line ->> 'unit_price')::numeric, (l.line ->> 'gross')::numeric, (l.line ->> 'discount')::numeric, (l.line ->> 'net')::numeric
    from added a
    join public.import_rows(p_orders) i on i.external_id = a.external_order_id
    cross join lateral jsonb_array_elements(i.lines) with ordinality as l(line, position)
    returning 1
  )
  select count(*) into v_inserted from added;

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_count - v_inserted, 'replaced', v_replaced);
end;
$$;

revoke all on function public.import_orders(uuid, jsonb, boolean) from public, anon;
grant execute on function public.import_orders(uuid, jsonb, boolean) to authenticated;

-- Bounds on what a client can still write directly: batches and the workspace row.

-- A batch's mapping and log are small by construction; refuse anything that is not.
alter table public.import_batches
  add constraint import_batches_mapping_small check (pg_column_size(mapping_json) <= 16384),
  add constraint import_batches_warnings_small check (pg_column_size(warnings_json) <= 131072);

-- Nobody needs thousands of imports; without a ceiling, batch rows alone could fill the database.
create function public.limit_import_batches()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.import_batches where workspace_id = new.workspace_id) >= 500 then
    raise exception 'import limit reached: delete old imports first' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger import_batches_limit before insert on public.import_batches
for each row execute function public.limit_import_batches();

-- A time zone the database does not know would break every page of the
-- workspace. The application checks the name; so does the database.
create function public.check_workspace_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown time zone' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger workspaces_timezone before insert or update of timezone on public.workspaces
for each row execute function public.check_workspace_timezone();
