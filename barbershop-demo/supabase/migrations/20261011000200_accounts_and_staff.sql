-- Accounts and the barber's side of a booking.
--
-- Same shape as the booking engine: server-only functions that return
-- { "ok": true, ... } or { "ok": false, "code": "..." } and take the barber's
-- lock before they touch a calendar.

-- How long a break a barber may take without asking. Longer absences are
-- requests that an admin approves.
alter table public.shop_settings
  add column max_break_minutes integer not null default 120 check (max_break_minutes between 5 and 480);

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

-- Ties an account to the customer record of its email address, so bookings
-- made as a guest with that address appear in the account. Only once the
-- address is confirmed: otherwise anyone could claim a stranger's bookings by
-- registering with the stranger's address.
create function public.link_customer_account(p_user_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_locale text;
  v_customer uuid;
begin
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = p_user_id;
  if v_email is null or v_confirmed is null then
    return null;
  end if;
  select locale into v_locale from public.profiles where id = p_user_id;

  insert into public.customers as c (email, profile_id, locale, email_verified_at)
  values (v_email, p_user_id, coalesce(v_locale, 'en'), v_confirmed)
  on conflict (email) do update
    set profile_id = excluded.profile_id,
        email_verified_at = coalesce(c.email_verified_at, excluded.email_verified_at)
    -- A customer record already tied to another account is left alone.
    where c.profile_id is null or c.profile_id = excluded.profile_id
  returning id into v_customer;

  return v_customer;
end;
$$;

-- ---------------------------------------------------------------------------
-- After the visit
-- ---------------------------------------------------------------------------

-- Records how a confirmed appointment ended: the client came, or did not.
-- p_barber_id is given when a barber is acting: the booking must be theirs.
-- Without it the caller is an admin, who may also correct a mistake by
-- switching between the two outcomes.
create function public.close_booking(
  p_booking_id uuid,
  p_outcome text,
  p_actor text,
  p_actor_id uuid,
  p_barber_id uuid default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_now timestamptz;
  v_from public.booking_status;
begin
  if p_outcome not in ('completed', 'no_show') then
    return app.refusal('invalid');
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  -- One answer for "no such booking" and "not yours": a barber learns nothing
  -- about other barbers' bookings by guessing ids.
  if not found or (p_barber_id is not null and v_booking.barber_id <> p_barber_id) then
    return app.refusal('not_found');
  end if;

  perform app.lock_barbers(array[v_booking.barber_id]);
  v_now := clock_timestamp();
  select * into v_booking from public.bookings where id = p_booking_id for update;
  v_from := v_booking.status;

  if v_from::text = p_outcome then
    return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'unchanged', true);
  end if;
  if not (v_from = 'confirmed' or (p_barber_id is null and v_from in ('completed', 'no_show'))) then
    return app.refusal('not_changeable');
  end if;
  -- An appointment cannot have happened, or been missed, before it starts.
  if v_booking.starts_at > v_now then
    return app.refusal('too_early');
  end if;

  update public.bookings set status = p_outcome::public.booking_status, closed_at = v_now where id = v_booking.id;

  insert into public.booking_events (booking_id, type, from_status, to_status, actor, actor_id)
  values (v_booking.id, p_outcome, v_from, p_outcome::public.booking_status, p_actor, p_actor_id);

  perform app.cancel_pending_notifications(v_booking.id, array['reminder_24h', 'reminder_2h']::public.notification_type[]);

  return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'unchanged', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Breaks and time off
-- ---------------------------------------------------------------------------

-- A barber may take a short break by themselves; anything longer is a request
-- that an admin approves. Nothing that takes effect may sit on top of an
-- appointment: the customer was promised that time.
create function public.add_time_off(
  p_barber_id uuid,
  p_kind public.time_off_kind,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text,
  p_actor_id uuid,
  p_by_admin boolean default false
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s public.shop_settings;
  v_now timestamptz;
  v_status public.time_off_status;
  v_id uuid;
begin
  select * into s from public.shop_settings;

  if p_ends_at <= p_starts_at or p_ends_at - p_starts_at > interval '60 days' then
    return app.refusal('invalid');
  end if;
  if p_kind = 'holiday' and not p_by_admin then
    return app.refusal('forbidden');
  end if;
  if p_kind <> 'holiday' and p_barber_id is null then
    return app.refusal('invalid');
  end if;
  if p_kind = 'break' and (
       p_ends_at - p_starts_at > make_interval(mins => s.max_break_minutes)
       or (p_starts_at at time zone s.timezone)::date <> (p_ends_at at time zone s.timezone)::date
     ) then
    return app.refusal('break_too_long');
  end if;

  -- A shop holiday touches every calendar.
  perform app.lock_barbers(case when p_barber_id is null then array(select id from public.barbers) else array[p_barber_id] end);
  v_now := clock_timestamp();

  if not p_by_admin and p_starts_at < v_now then
    return app.refusal('in_the_past');
  end if;

  v_status := case when p_by_admin or p_kind = 'break' then 'approved' else 'requested' end;

  if v_status = 'approved' and exists (
    select 1
    from public.bookings b
    where (p_barber_id is null or b.barber_id = p_barber_id)
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      and (b.status = 'confirmed' or (b.status = 'pending' and b.hold_expires_at > v_now))
  ) then
    return app.refusal('has_bookings');
  end if;

  insert into public.time_off (barber_id, kind, status, starts_at, ends_at, reason, created_by, decided_by, decided_at)
  values (
    p_barber_id, p_kind, v_status, p_starts_at, p_ends_at, nullif(trim(coalesce(p_reason, '')), ''), p_actor_id,
    case when v_status = 'approved' and p_by_admin then p_actor_id end,
    case when v_status = 'approved' then v_now end
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status);
end;
$$;

-- A barber withdraws their own break or request, as long as it has not begun.
create function public.remove_time_off(p_time_off_id uuid, p_barber_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_row public.time_off;
begin
  select * into v_row from public.time_off where id = p_time_off_id;
  if not found or v_row.barber_id is distinct from p_barber_id then
    return app.refusal('not_found');
  end if;
  if v_row.starts_at <= clock_timestamp() then
    return app.refusal('in_the_past');
  end if;
  -- Approved time off is the admin's decision to undo.
  if v_row.kind <> 'break' and v_row.status = 'approved' then
    return app.refusal('forbidden');
  end if;

  delete from public.time_off where id = p_time_off_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: server only
-- ---------------------------------------------------------------------------

do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('link_customer_account', 'close_booking', 'add_time_off', 'remove_time_off')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_function);
    execute format('grant execute on function %s to service_role', v_function);
  end loop;
end;
$$;
