-- Leaving: removing one's imported data, and removing one's account.

-- Removes everything that was imported into the caller's workspace: batches,
-- orders, lines and customers. The workspace itself and its settings stay.
-- Runs with the caller's rights, so it can only ever reach their own rows.
create function public.delete_workspace_data()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_workspace uuid;
  v_orders integer;
begin
  select id into v_workspace from public.workspaces where owner_user_id = (select auth.uid());
  if not found then
    raise exception 'no workspace' using errcode = 'P0002';
  end if;

  select count(*) into v_orders from public.orders where workspace_id = v_workspace;
  -- Deleting the batches takes their orders and lines with them.
  delete from public.import_batches where workspace_id = v_workspace;
  delete from public.customers where workspace_id = v_workspace;

  return jsonb_build_object('orders_removed', v_orders);
end;
$$;

-- Deletes the caller's own account. The workspace and everything in it go
-- with it (the tables cascade from auth.users).
--
-- This is the one function that runs with more rights than its caller,
-- because nobody may delete from auth.users directly. It takes no argument:
-- the only account it can ever touch is the one that is calling it.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_workspace_data() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_workspace_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
