-- The admin's side: bookings made at the counter, money taken at the counter,
-- decisions on time off, and the figures behind the analytics page.
--
-- Same shape as the rest of the engine: server-only functions, jsonb answers,
-- the barber's lock before a calendar changes.

-- ---------------------------------------------------------------------------
-- A booking made by staff
-- ---------------------------------------------------------------------------

-- For the phone and the counter. Confirmed at once: staff vouch for it, so
-- there is no hold and no verification email. The two-hour lead does not apply
-- (a walk-in sits down now); the grid, the horizon, working hours, time off
-- and other bookings all do.
create function public.create_admin_booking(
  p_service_ids uuid[],
  p_barber_id uuid,
  p_starts_at timestamptz,
  p_name text,
  p_email text,
  p_phone text,
  p_locale text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s public.shop_settings;
  v_now timestamptz;
  v_duration integer;
  v_price integer;
  v_found integer;
  v_ends_at timestamptz;
  v_policy text;
  v_customer uuid;
  v_booking public.bookings;
  v_email text := lower(trim(p_email));
begin
  select * into s from public.shop_settings;

  select sum(duration_minutes), sum(price_cents), count(*) into v_duration, v_price, v_found
  from public.services
  where id = any (p_service_ids) and is_active;
  if v_found is distinct from cardinality(p_service_ids) or v_found = 0 or v_found > 6 then
    return app.refusal('invalid');
  end if;
  if p_locale not in ('en', 'ru') or length(trim(p_name)) < 2 or position('@' in v_email) < 2 or length(trim(p_phone)) < 7 then
    return app.refusal('invalid');
  end if;
  if p_barber_id is null or not exists (select 1 from app.eligible_barbers(p_service_ids) as e where e = p_barber_id) then
    return app.refusal('not_eligible');
  end if;

  perform app.lock_barbers(array[p_barber_id]);
  v_now := clock_timestamp();

  -- The policy as for anyone, except the lead time. The check is made as if it
  -- were asked earlier, by the lead plus half an hour: that leaves the grid and
  -- the horizon in force and lets a walk-in take the slot that has just begun.
  v_policy := app.slot_policy_error(p_starts_at, v_now - make_interval(mins => s.min_lead_minutes + 30));
  if v_policy = 'too_soon' then
    return app.refusal('in_the_past');
  end if;
  if v_policy is not null then
    return app.refusal(v_policy);
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);
  if not app.barber_free(p_barber_id, p_starts_at, v_ends_at, v_now) then
    return app.refusal('slot_taken');
  end if;

  insert into public.customers (email, locale)
  values (v_email, p_locale)
  on conflict (email) do update set updated_at = now()
  returning id into v_customer;

  insert into public.bookings (
    reference, barber_id, customer_id, customer_name, customer_phone, locale, starts_at, ends_at,
    status, confirmed_at, source, created_by, total_price_cents, total_duration_minutes
  )
  values (
    app.new_reference(), p_barber_id, v_customer, trim(p_name), trim(p_phone), p_locale, p_starts_at, v_ends_at,
    'confirmed', v_now, 'admin', p_actor_id, v_price, v_duration
  )
  returning * into v_booking;

  insert into public.booking_services (booking_id, service_id, position, name_en, name_ru, price_cents, duration_minutes)
  select v_booking.id, sv.id, row_number() over (order by sv.sort_order, sv.id), sv.name_en, sv.name_ru, sv.price_cents, sv.duration_minutes
  from public.services sv
  where sv.id = any (p_service_ids);

  insert into public.booking_events (booking_id, type, to_status, actor, actor_id, data)
  values (v_booking.id, 'created', 'confirmed', 'admin', p_actor_id, jsonb_build_object('starts_at', v_booking.starts_at, 'barber_id', p_barber_id));

  perform app.enqueue_notification(v_booking.id, 'confirmation', v_now, p_locale, v_booking.id || ':confirmation');
  perform app.enqueue_reminders(v_booking, v_now);

  return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'reference', v_booking.reference);
end;
$$;

-- ---------------------------------------------------------------------------
-- Money taken at the counter
-- ---------------------------------------------------------------------------

-- Records what a client paid for a completed visit. One record per booking;
-- recording again corrects it. A visit that did not happen cannot be paid for.
create function public.record_payment(
  p_booking_id uuid,
  p_amount_cents integer,
  p_method text,
  p_note text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  if p_amount_cents is null or p_amount_cents < 0 or p_amount_cents > 100000000 or p_method not in ('cash', 'card_terminal') then
    return app.refusal('invalid');
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    return app.refusal('not_found');
  end if;
  if v_booking.status <> 'completed' then
    return app.refusal('not_completed');
  end if;

  insert into public.payment_records as p (booking_id, amount_cents, method, note, recorded_by)
  values (p_booking_id, p_amount_cents, p_method, nullif(trim(coalesce(p_note, '')), ''), p_actor_id)
  on conflict (booking_id) do update
    set amount_cents = excluded.amount_cents, method = excluded.method, note = excluded.note,
        recorded_by = excluded.recorded_by, recorded_at = now();

  update public.bookings set payment_status = 'paid' where id = p_booking_id;

  insert into public.booking_events (booking_id, type, actor, actor_id, data)
  values (p_booking_id, 'payment_recorded', 'admin', p_actor_id, jsonb_build_object('amount_cents', p_amount_cents, 'method', p_method));

  return jsonb_build_object('ok', true);
end;
$$;

create function public.remove_payment(p_booking_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  delete from public.payment_records where booking_id = p_booking_id;
  if not found then
    return app.refusal('not_found');
  end if;
  update public.bookings set payment_status = 'unpaid' where id = p_booking_id;
  insert into public.booking_events (booking_id, type, actor, actor_id) values (p_booking_id, 'payment_removed', 'admin', p_actor_id);
  return jsonb_build_object('ok', true);
end;
$$;

-- An admin undoing an outcome changes whether a payment makes sense: a visit
-- marked as missed after all keeps no payment.
create function app.drop_payment_of_unfinished()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'completed' and new.status <> 'completed' then
    delete from public.payment_records where booking_id = new.id;
    new.payment_status := 'unpaid';
  end if;
  return new;
end;
$$;

create trigger bookings_drop_payment before update of status on public.bookings
  for each row execute function app.drop_payment_of_unfinished();

-- ---------------------------------------------------------------------------
-- Decisions on time off
-- ---------------------------------------------------------------------------

-- Approves or declines a barber's request. Approval is refused while someone
-- is booked in that time: the bookings are moved or cancelled first, by a
-- person, with the customers told.
create function public.decide_time_off(p_time_off_id uuid, p_approve boolean, p_actor_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_row public.time_off;
  v_now timestamptz;
begin
  select * into v_row from public.time_off where id = p_time_off_id;
  if not found then
    return app.refusal('not_found');
  end if;

  perform app.lock_barbers(case when v_row.barber_id is null then array(select id from public.barbers) else array[v_row.barber_id] end);
  v_now := clock_timestamp();
  select * into v_row from public.time_off where id = p_time_off_id for update;

  if v_row.status <> 'requested' then
    return app.refusal('already_decided');
  end if;

  if p_approve and exists (
    select 1
    from public.bookings b
    where (v_row.barber_id is null or b.barber_id = v_row.barber_id)
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_row.starts_at, v_row.ends_at, '[)')
      and (b.status = 'confirmed' or (b.status = 'pending' and b.hold_expires_at > v_now))
  ) then
    return app.refusal('has_bookings');
  end if;

  update public.time_off
  set status = case when p_approve then 'approved' else 'rejected' end::public.time_off_status,
      decided_by = p_actor_id, decided_at = v_now
  where id = p_time_off_id;

  return jsonb_build_object('ok', true, 'status', case when p_approve then 'approved' else 'rejected' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Analytics
-- ---------------------------------------------------------------------------

-- The figures for a range of shop-local dates, both ends included. Everything
-- is counted from stored rows at the moment of asking; nothing is estimated.
--
-- Definitions, which the page repeats next to the numbers:
--   * A booking belongs to the date it starts on, in the shop's time zone.
--   * Revenue is money recorded at the counter for completed visits in the
--     range. A completed visit with no payment recorded adds nothing.
--   * Booked minutes are the service minutes of visits that were completed or
--     are still confirmed. Cancelled, missed and expired bookings add nothing.
--   * Available minutes are the barber's working hours on the dates of the
--     range, less approved time off and shop closures.
--   * Utilisation is booked minutes divided by available minutes.
create function public.admin_analytics(p_from date, p_to date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with shop as (
    select timezone from public.shop_settings
  ),
  in_range as (
    select b.*
    from public.bookings b, shop
    where (b.starts_at at time zone shop.timezone)::date between p_from and p_to
  ),
  by_status as (
    select status::text as status, count(*)::int as n from in_range group by status
  ),
  revenue as (
    select coalesce(sum(p.amount_cents), 0)::bigint as cents, count(*)::int as payments
    from public.payment_records p
    join in_range b on b.id = p.booking_id and b.status = 'completed'
  ),
  services as (
    select s.name_en, s.name_ru, count(*)::int as visits, sum(s.price_cents)::bigint as listed_cents
    from public.booking_services s
    join in_range b on b.id = s.booking_id and b.status = 'completed'
    group by s.name_en, s.name_ru
  ),
  days as (
    select d::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d
  ),
  shifts as (
    -- Every working range of every barber on every date of the range, as instants.
    select w.barber_id,
           ((days.day::timestamp + w.start_time) at time zone shop.timezone) as starts_at,
           ((days.day::timestamp + w.end_time) at time zone shop.timezone) as ends_at
    from days
    cross join shop
    join public.working_hours w on w.weekday = extract(isodow from days.day)::int
  ),
  available as (
    select sh.barber_id,
           sum(
             extract(epoch from (sh.ends_at - sh.starts_at)) / 60
             - least(
                 extract(epoch from (sh.ends_at - sh.starts_at)) / 60,
                 coalesce((
                   select sum(extract(epoch from (least(t.ends_at, sh.ends_at) - greatest(t.starts_at, sh.starts_at))) / 60)
                   from public.time_off t
                   where (t.barber_id = sh.barber_id or t.barber_id is null)
                     and t.status = 'approved'
                     and t.starts_at < sh.ends_at and t.ends_at > sh.starts_at
                 ), 0)
               )
           )::int as minutes
    from shifts sh
    group by sh.barber_id
  ),
  per_barber as (
    select br.id, br.name, br.sort_order,
           count(b.id) filter (where b.status = 'completed')::int as completed,
           count(b.id) filter (where b.status = 'no_show')::int as no_shows,
           count(b.id) filter (where b.status = 'cancelled')::int as cancelled,
           coalesce(sum(b.total_duration_minutes) filter (where b.status in ('completed', 'confirmed')), 0)::int as booked_minutes,
           coalesce((
             select sum(p.amount_cents) from public.payment_records p
             join in_range k on k.id = p.booking_id and k.status = 'completed' and k.barber_id = br.id
           ), 0)::bigint as paid_cents
    from public.barbers br
    left join in_range b on b.barber_id = br.id
    group by br.id, br.name, br.sort_order
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'bookings', (select coalesce(sum(n), 0) from by_status),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from by_status),
    'paid_cents', (select cents from revenue),
    'payments', (select payments from revenue),
    'top_services', (
      select coalesce(jsonb_agg(jsonb_build_object('name_en', name_en, 'name_ru', name_ru, 'visits', visits, 'listed_cents', listed_cents)
                                order by visits desc, name_en), '[]'::jsonb)
      from services
    ),
    'barbers', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', pb.id, 'name', pb.name, 'completed', pb.completed, 'no_shows', pb.no_shows, 'cancelled', pb.cancelled,
               'booked_minutes', pb.booked_minutes, 'available_minutes', coalesce(a.minutes, 0), 'paid_cents', pb.paid_cents
             ) order by pb.sort_order, pb.name), '[]'::jsonb)
      from per_barber pb
      left join available a on a.barber_id = pb.id
    )
  );
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
      and p.proname in ('create_admin_booking', 'record_payment', 'remove_payment', 'decide_time_off', 'admin_analytics')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_function);
    execute format('grant execute on function %s to service_role', v_function);
  end loop;
end;
$$;
