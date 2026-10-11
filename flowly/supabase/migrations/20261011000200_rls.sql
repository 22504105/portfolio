-- Row level security: a signed-in user reaches the rows of the workspace they
-- own and nothing else. Visitors who are not signed in reach nothing; the demo
-- does not use the database. Cross-account denial is tested in Phase 3.

-- Whether the caller owns a workspace. Security definer so that policies on
-- other tables can ask without being subject to the workspaces policy themselves.
create function public.owns_workspace(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = p_workspace and w.owner_user_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_workspace(uuid) from public, anon;
grant execute on function public.owns_workspace(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.import_batches enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;

revoke all on public.workspaces, public.import_batches, public.customers, public.orders, public.order_lines from anon, authenticated;

-- Least privilege: imported rows are written once and deleted, never edited.
grant select, insert, delete on public.workspaces to authenticated;
grant update (name, currency_code, timezone) on public.workspaces to authenticated;
grant select, insert, delete on public.import_batches to authenticated;
grant update (accepted_count, rejected_count, status, warnings_json) on public.import_batches to authenticated;
grant select, insert, delete on public.customers, public.orders, public.order_lines to authenticated;

create policy workspaces_own on public.workspaces
  for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy import_batches_own on public.import_batches
  for all to authenticated
  using (public.owns_workspace(workspace_id))
  with check (public.owns_workspace(workspace_id));

create policy customers_own on public.customers
  for all to authenticated
  using (public.owns_workspace(workspace_id))
  with check (public.owns_workspace(workspace_id));

create policy orders_own on public.orders
  for all to authenticated
  using (public.owns_workspace(workspace_id))
  with check (public.owns_workspace(workspace_id));

create policy order_lines_own on public.order_lines
  for all to authenticated
  using (public.owns_workspace(workspace_id))
  with check (public.owns_workspace(workspace_id));
