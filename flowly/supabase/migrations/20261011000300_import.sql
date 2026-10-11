-- Importing and removing orders. The browser sends validated, normalised
-- orders in chunks; each chunk goes in whole or not at all. These functions
-- run with the caller's own rights (security invoker), so row level security
-- applies to every statement in them: a caller can only ever touch the
-- workspace they own.

-- How many orders a workspace may hold. Flowly loads a workspace's orders to
-- calculate from them, and the free database tier is small; this keeps both honest.
create function public.workspace_order_limit()
returns integer
language sql
immutable
as $$ select 50000 $$;

-- The orders of a request as rows.
create function public.import_rows(p_orders jsonb)
returns table (
  external_id text, placed_at timestamptz, status text, channel text,
  gross numeric, discount numeric, net numeric, refund numeric,
  customer jsonb, lines jsonb
)
language sql
immutable
set search_path = ''
as $$
  select o.external_id, o.placed_at, o.status, o.channel, o.gross, o.discount, o.net, o.refund, o.customer, o.lines
  from jsonb_to_recordset(p_orders) as o(
    external_id text, placed_at timestamptz, status text, channel text,
    gross numeric, discount numeric, net numeric, refund numeric,
    customer jsonb, lines jsonb
  );
$$;

-- Adds one chunk of orders to a batch that is being imported.
--
-- p_orders is an array of
--   { "external_id", "placed_at", "status", "channel", "gross", "discount",
--     "net", "refund", "customer": { "identity_key", "external_id", "name",
--     "email" } | null, "lines": [ { "product", "category", "quantity",
--     "unit_price", "gross", "discount", "net" } ] }
-- with amounts as decimal strings.
--
-- An order number the workspace already has is skipped, or, with p_replace,
-- the earlier order is deleted and this one takes its place.
create function public.import_orders(p_batch uuid, p_orders jsonb, p_replace boolean default false)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_workspace uuid;
  v_currency text;
  v_status text;
  v_count integer;
  v_existing integer;
  v_replaced integer := 0;
  v_inserted integer;
begin
  -- Row level security makes someone else's batch invisible here.
  select b.workspace_id, b.status, w.currency_code
    into v_workspace, v_status, v_currency
  from public.import_batches b
  join public.workspaces w on w.id = b.workspace_id
  where b.id = p_batch;

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

-- Closes a batch: counts what it really holds and records what was left out.
create function public.finish_import(p_batch uuid, p_rejected integer, p_warnings jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_accepted integer;
begin
  select count(*) into v_accepted from public.orders where import_batch_id = p_batch;

  update public.import_batches
  set status = 'completed',
      accepted_count = v_accepted,
      rejected_count = greatest(p_rejected, 0),
      warnings_json = coalesce(p_warnings, '[]'::jsonb)
  where id = p_batch and status = 'importing';

  if not found then
    raise exception 'import batch not found or already closed' using errcode = 'P0002';
  end if;
  return jsonb_build_object('accepted', v_accepted);
end;
$$;

-- Removes a batch with every order it brought in, and then the customers who
-- are left with no order at all. Figures are calculated from the orders that
-- remain, so nothing needs recomputing.
create function public.delete_import(p_batch uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_workspace uuid;
  v_orders integer;
  v_customers integer;
begin
  select workspace_id into v_workspace from public.import_batches where id = p_batch;
  if not found then
    raise exception 'import batch not found' using errcode = 'P0002';
  end if;

  select count(*) into v_orders from public.orders where import_batch_id = p_batch;
  delete from public.import_batches where id = p_batch;

  with gone as (
    delete from public.customers c
    where c.workspace_id = v_workspace
      and not exists (select 1 from public.orders o where o.customer_id = c.id)
    returning 1
  )
  select count(*) into v_customers from gone;

  return jsonb_build_object('orders_removed', v_orders, 'customers_removed', v_customers);
end;
$$;

do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname in ('import_orders', 'import_rows', 'finish_import', 'delete_import', 'workspace_order_limit')
  loop
    execute format('revoke all on function %s from public, anon', v_function);
    execute format('grant execute on function %s to authenticated', v_function);
  end loop;
end;
$$;
