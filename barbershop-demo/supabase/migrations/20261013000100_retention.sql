-- Keeping no more personal data than is needed, and a way to erase one
-- person's on request. docs/security.md states the policy these implement.

-- Removes everything about one customer: their bookings with the services,
-- history, tokens, emails queued and payments attached to them, and the
-- customer record itself. The account, if there is one, is a separate thing
-- and is deleted in the auth system; doing so first is not required.
--
-- Deleting bookings changes past totals in the analytics. That is the cost of
-- erasure, and the reason this is a deliberate act by an admin with database
-- access and not a button.
create function public.erase_customer(p_email text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_customer uuid;
  v_bookings integer;
begin
  select id into v_customer from public.customers where email = lower(trim(p_email))::public.citext;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- The audit trail refuses updates, not the deletion that comes with its booking.
  with gone as (delete from public.bookings where customer_id = v_customer returning 1)
  select count(*) into v_bookings from gone;
  delete from public.customers where id = v_customer;

  return jsonb_build_object('ok', true, 'bookings_removed', v_bookings);
end;
$$;

-- Clears out what was never confirmed and what has stopped being useful:
--   * holds that expired more than p_days ago, with the name, phone and email
--     typed into them by someone who never confirmed;
--   * customer records left with no booking and no account;
--   * email-link tokens that expired more than p_days ago;
--   * sent and withdrawn email jobs older than p_days;
--   * throttling counters older than a day.
-- Confirmed, completed, cancelled and missed bookings are kept: they are the
-- shop's records.
create function public.purge_stale_data(p_days integer default 30)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_before timestamptz := clock_timestamp() - make_interval(days => greatest(p_days, 1));
  v_holds integer;
  v_customers integer;
  v_tokens integer;
  v_jobs integer;
begin
  with gone as (delete from public.bookings where status = 'expired' and closed_at < v_before returning 1)
  select count(*) into v_holds from gone;

  with gone as (
    delete from public.customers c
    where c.profile_id is null
      and c.created_at < v_before
      and not exists (select 1 from public.bookings b where b.customer_id = c.id)
    returning 1
  )
  select count(*) into v_customers from gone;

  with gone as (delete from public.booking_tokens where expires_at < v_before returning 1)
  select count(*) into v_tokens from gone;

  with gone as (delete from public.notification_jobs where status in ('sent', 'cancelled') and updated_at < v_before returning 1)
  select count(*) into v_jobs from gone;

  delete from public.rate_limits where window_start < clock_timestamp() - interval '1 day';

  return jsonb_build_object('expired_holds', v_holds, 'customers', v_customers, 'tokens', v_tokens, 'email_jobs', v_jobs);
end;
$$;

do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname in ('erase_customer', 'purge_stale_data')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_function);
    execute format('grant execute on function %s to service_role', v_function);
  end loop;
end;
$$;
