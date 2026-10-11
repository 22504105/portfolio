-- The booking engine.
--
-- Everything that takes, moves or releases a slot happens in one of the
-- functions below, in one transaction, under a lock on the barber concerned.
-- docs/architecture.md, section 5, states the guarantee and why it holds.
--
-- Shape of the functions
--   * They are called by server code only. Nothing here is executable by the
--     API roles (see the grants at the end).
--   * They never raise for a business reason. They return jsonb:
--       { "ok": true, ... }  or  { "ok": false, "code": "<reason>" }
--     so that a refusal is an ordinary answer the interface can show.
--   * The clock is read with clock_timestamp() after the lock is held: time
--     spent waiting for the lock counts.

-- ---------------------------------------------------------------------------
-- Locks
-- ---------------------------------------------------------------------------

-- Locks the given barbers until the end of the transaction. Always in the same
-- order, so two operations that need the same barbers cannot deadlock.
create function app.lock_barbers(p_barber_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select distinct b from unnest(p_barber_ids) as b order by b loop
    perform pg_advisory_xact_lock(hashtextextended('cutco:barber:' || v_id::text, 0));
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Slot rules
-- ---------------------------------------------------------------------------

-- Why a start time is not allowed by the booking policy, or null if it is.
create function app.slot_policy_error(p_starts_at timestamptz, p_now timestamptz)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  s public.shop_settings;
  v_local timestamp;
begin
  select * into s from public.shop_settings;
  v_local := p_starts_at at time zone s.timezone;

  -- Starts sit on the clock grid of the shop: :00 and :30 in London.
  if extract(second from v_local) <> 0
     or (extract(hour from v_local)::int * 60 + extract(minute from v_local)::int) % s.slot_interval_minutes <> 0 then
    return 'off_grid';
  end if;
  if p_starts_at < p_now + make_interval(mins => s.min_lead_minutes) then
    return 'too_soon';
  end if;
  -- The horizon is counted in the shop's calendar dates.
  if v_local::date > (p_now at time zone s.timezone)::date + s.horizon_days then
    return 'outside_horizon';
  end if;
  return null;
end;
$$;

-- Whether a barber can take [p_start, p_end): inside one of their working
-- ranges on that local day, clear of time off, and clear of every booking that
-- still counts. A hold counts only while it has not expired at p_now, so an
-- abandoned hold stops blocking by itself, cleanup or no cleanup.
create function app.barber_free(
  p_barber_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_now timestamptz,
  p_ignore_booking uuid default null
)
returns boolean
language sql
stable
set search_path = ''
as $$
  with local as (
    select (p_start at time zone s.timezone) as starts, (p_end at time zone s.timezone) as ends
    from public.shop_settings s
  )
  select
    exists (
      select 1
      from public.working_hours w, local
      where w.barber_id = p_barber_id
        and w.weekday = extract(isodow from local.starts)::int
        and local.starts::date = local.ends::date
        and w.start_time <= local.starts::time
        and local.ends::time <= w.end_time
    )
    and not exists (
      select 1
      from public.bookings b
      where b.barber_id = p_barber_id
        and b.id is distinct from p_ignore_booking
        and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_start, p_end, '[)')
        and (b.status = 'confirmed' or (b.status = 'pending' and b.hold_expires_at > p_now))
    )
    and not exists (
      select 1
      from public.time_off t
      -- A row without a barber closes the whole shop.
      where (t.barber_id = p_barber_id or t.barber_id is null)
        and t.status = 'approved'
        and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(p_start, p_end, '[)')
    );
$$;

-- Active barbers who deliver every one of the given services.
create function app.eligible_barbers(p_service_ids uuid[])
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select b.id
  from public.barbers b
  where b.is_active
    and not exists (
      select 1
      from unnest(p_service_ids) as wanted
      where not exists (
        select 1 from public.barber_services bs
        where bs.barber_id = b.id and bs.service_id = wanted
      )
    );
$$;

-- The start times on one day at which a visit of the given length fits, and
-- who among the given barbers is free at each.
create function app.day_slots(
  p_barber_ids uuid[],
  p_duration_minutes integer,
  p_date date,
  p_ignore_booking uuid,
  p_now timestamptz
)
returns table (slot_start timestamptz, free_barbers uuid[])
language sql
stable
set search_path = ''
as $$
  with shop as (
    select timezone, slot_interval_minutes as step from public.shop_settings
  ),
  candidates as (
    select
      w.barber_id,
      -- Local wall-clock time turned into an instant: this is where the clock
      -- changes are handled, by PostgreSQL's time zone database.
      ((p_date::timestamp + make_interval(mins => minute)) at time zone shop.timezone) as slot_start
    from public.working_hours w
    cross join shop
    cross join lateral generate_series(
      -- First point of the grid at or after opening.
      (ceil(extract(epoch from w.start_time) / 60 / shop.step) * shop.step)::int,
      -- Last start at which the visit still ends by closing.
      (extract(epoch from w.end_time) / 60)::int - p_duration_minutes,
      shop.step
    ) as minute
    where w.barber_id = any (p_barber_ids)
      and w.weekday = extract(isodow from p_date)::int
  )
  select c.slot_start, array_agg(c.barber_id order by c.barber_id)
  from candidates c
  where app.slot_policy_error(c.slot_start, p_now) is null
    and app.barber_free(c.barber_id, c.slot_start, c.slot_start + make_interval(mins => p_duration_minutes), p_now, p_ignore_booking)
  group by c.slot_start
  order by c.slot_start;
$$;

-- Free start times for a new booking. Read-only and advisory: the answer can be
-- out of date a moment later, which is why create_booking_hold checks again
-- under the lock. p_now exists so the time arithmetic can be tested on any date.
create function public.get_availability(
  p_service_ids uuid[],
  p_barber_id uuid,
  p_date date,
  p_now timestamptz default clock_timestamp()
)
returns table (slot_start timestamptz, free_barbers uuid[])
language plpgsql
stable
set search_path = ''
as $$
declare
  v_duration integer;
  v_found integer;
begin
  select sum(duration_minutes), count(*) into v_duration, v_found
  from public.services
  where id = any (p_service_ids) and is_active;

  -- Unknown, retired or repeated services: nothing is offered.
  if v_found is distinct from cardinality(p_service_ids) or v_found = 0 then
    return;
  end if;

  return query
    select d.slot_start, d.free_barbers
    from app.day_slots(
      array(select e from app.eligible_barbers(p_service_ids) as e where p_barber_id is null or e = p_barber_id),
      v_duration, p_date, null, p_now
    ) as d;
end;
$$;

-- Free start times for moving an existing booking, with the same barber.
create function public.get_reschedule_availability(
  p_booking_id uuid,
  p_date date,
  p_now timestamptz default clock_timestamp()
)
returns table (slot_start timestamptz, free_barbers uuid[])
language sql
stable
set search_path = ''
as $$
  select d.slot_start, d.free_barbers
  from public.bookings b
  cross join lateral app.day_slots(array[b.barber_id], b.total_duration_minutes, p_date, b.id, p_now) as d
  where b.id = p_booking_id and b.status = 'confirmed';
$$;

-- ---------------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------------

create function app.refusal(p_code text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('ok', false, 'code', p_code);
$$;

-- A short reference without the characters people mix up (0/O, 1/I/L).
create function app.new_reference()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_reference text;
begin
  loop
    -- Random bytes from a random UUID, skipping the bytes that carry its version.
    select string_agg(substr(v_alphabet, 1 + (get_byte(random.bytes, i) % length(v_alphabet)), 1), '')
    into v_reference
    from (select uuid_send(gen_random_uuid()) as bytes) as random, unnest(array[0, 1, 2, 3, 4, 5, 10, 11]) as i;
    exit when not exists (select 1 from public.bookings where reference = v_reference);
  end loop;
  return v_reference;
end;
$$;

-- Puts an email on the queue. The key makes a second enqueue a no-op.
create function app.enqueue_notification(
  p_booking_id uuid,
  p_type public.notification_type,
  p_due_at timestamptz,
  p_locale text,
  p_key text
)
returns void
language sql
set search_path = ''
as $$
  insert into public.notification_jobs (booking_id, type, locale, due_at, idempotency_key)
  values (p_booking_id, p_type, p_locale, p_due_at, p_key)
  on conflict (idempotency_key) do nothing;
$$;

-- Queues the two reminders of a confirmed booking. The start time is part of
-- the key, so a rescheduled booking gets new reminders and its old ones can be
-- told apart and cancelled.
create function app.enqueue_reminders(p_booking public.bookings, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_suffix text := ':' || extract(epoch from p_booking.starts_at)::bigint;
begin
  -- A reminder whose moment has already passed is not sent late.
  if p_booking.starts_at - interval '24 hours' > p_now then
    perform app.enqueue_notification(p_booking.id, 'reminder_24h', p_booking.starts_at - interval '24 hours',
                                     p_booking.locale, p_booking.id || ':reminder_24h' || v_suffix);
  end if;
  if p_booking.starts_at - interval '2 hours' > p_now then
    perform app.enqueue_notification(p_booking.id, 'reminder_2h', p_booking.starts_at - interval '2 hours',
                                     p_booking.locale, p_booking.id || ':reminder_2h' || v_suffix);
  end if;
end;
$$;

-- Withdraws emails that have not gone out yet.
create function app.cancel_pending_notifications(p_booking_id uuid, p_types public.notification_type[])
returns void
language sql
set search_path = ''
as $$
  update public.notification_jobs
  set status = 'cancelled'
  where booking_id = p_booking_id
    and type = any (p_types)
    and status in ('pending', 'failed');
$$;

-- ---------------------------------------------------------------------------
-- Create a hold
-- ---------------------------------------------------------------------------

create function public.create_booking_hold(
  p_service_ids uuid[],
  p_barber_id uuid,          -- null: any available
  p_starts_at timestamptz,
  p_name text,
  p_email text,
  p_phone text,
  p_locale text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s public.shop_settings;
  v_now timestamptz;
  v_candidates uuid[];
  v_barber uuid;
  v_duration integer;
  v_price integer;
  v_found integer;
  v_ends_at timestamptz;
  v_policy text;
  v_customer uuid;
  v_booking public.bookings;
  v_local_date date;
  v_email text := lower(trim(p_email));
begin
  select * into s from public.shop_settings;

  -- The services as they are in the catalog now: the client's idea of price
  -- and duration is never used.
  select sum(duration_minutes), sum(price_cents), count(*) into v_duration, v_price, v_found
  from public.services
  where id = any (p_service_ids) and is_active;
  if v_found is distinct from cardinality(p_service_ids) or v_found = 0 or v_found > 6 then
    return app.refusal('invalid');
  end if;
  if p_locale not in ('en', 'ru') or length(trim(p_name)) < 2 or position('@' in v_email) < 2 or length(trim(p_phone)) < 7 then
    return app.refusal('invalid');
  end if;

  v_candidates := array(
    select e from app.eligible_barbers(p_service_ids) as e where p_barber_id is null or e = p_barber_id
  );
  if cardinality(v_candidates) = 0 then
    return app.refusal('not_eligible');
  end if;

  perform app.lock_barbers(v_candidates);
  v_now := clock_timestamp();

  v_policy := app.slot_policy_error(p_starts_at, v_now);
  if v_policy is not null then
    return app.refusal(v_policy);
  end if;

  -- One address cannot sit on several unverified holds at once.
  if (
    select count(*)
    from public.bookings b
    join public.customers c on c.id = b.customer_id
    where c.email = v_email::public.citext and b.status = 'pending' and b.hold_expires_at > v_now
  ) >= 2 then
    return app.refusal('too_many_holds');
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);
  v_local_date := (p_starts_at at time zone s.timezone)::date;

  -- Of the barbers who are free, the one with the least work that day, then
  -- that week, then in display order. The same data always gives the same answer.
  select b.id into v_barber
  from public.barbers b
  where b.id = any (v_candidates)
    and app.barber_free(b.id, p_starts_at, v_ends_at, v_now)
  order by
    (select coalesce(sum(k.total_duration_minutes), 0)
       from public.bookings k
      where k.barber_id = b.id
        and (k.status in ('confirmed', 'completed') or (k.status = 'pending' and k.hold_expires_at > v_now))
        and (k.starts_at at time zone s.timezone)::date = v_local_date),
    (select coalesce(sum(k.total_duration_minutes), 0)
       from public.bookings k
      where k.barber_id = b.id
        and (k.status in ('confirmed', 'completed') or (k.status = 'pending' and k.hold_expires_at > v_now))
        and date_trunc('week', k.starts_at at time zone s.timezone) = date_trunc('week', v_local_date::timestamp)),
    b.sort_order,
    b.id
  limit 1;

  if v_barber is null then
    return app.refusal('slot_taken');
  end if;

  insert into public.customers (email, locale)
  values (v_email, p_locale)
  on conflict (email) do update set updated_at = now()
  returning id into v_customer;

  insert into public.bookings (
    reference, barber_id, customer_id, customer_name, customer_phone, locale, starts_at, ends_at,
    status, hold_expires_at, any_barber_requested, total_price_cents, total_duration_minutes
  )
  values (
    app.new_reference(), v_barber, v_customer, trim(p_name), trim(p_phone), p_locale, p_starts_at, v_ends_at,
    'pending', v_now + make_interval(mins => s.hold_minutes), p_barber_id is null, v_price, v_duration
  )
  returning * into v_booking;

  -- The snapshot: what was booked, as it was at this moment.
  insert into public.booking_services (booking_id, service_id, position, name_en, name_ru, price_cents, duration_minutes)
  select v_booking.id, sv.id, row_number() over (order by sv.sort_order, sv.id), sv.name_en, sv.name_ru, sv.price_cents, sv.duration_minutes
  from public.services sv
  where sv.id = any (p_service_ids);

  insert into public.booking_events (booking_id, type, to_status, actor, data)
  values (v_booking.id, 'created', 'pending', 'guest',
          jsonb_build_object('starts_at', v_booking.starts_at, 'barber_id', v_barber, 'any_barber', p_barber_id is null));

  perform app.enqueue_notification(v_booking.id, 'verification', v_now, p_locale, v_booking.id || ':verification');

  return jsonb_build_object(
    'ok', true,
    'booking_id', v_booking.id,
    'reference', v_booking.reference,
    'barber_id', v_barber,
    'expires_at', v_booking.hold_expires_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Confirm a hold
-- ---------------------------------------------------------------------------

-- p_token_hash is the SHA-256 of the token from the verification email.
-- Using the link twice is harmless: the second time answers that the booking
-- is already confirmed.
create function public.confirm_booking(p_token_hash bytea)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_token public.booking_tokens;
  v_booking public.bookings;
  v_now timestamptz;
begin
  select * into v_token from public.booking_tokens where token_hash = p_token_hash and purpose = 'verify';
  if not found then
    return app.refusal('invalid_token');
  end if;

  select * into v_booking from public.bookings where id = v_token.booking_id;
  perform app.lock_barbers(array[v_booking.barber_id]);
  v_now := clock_timestamp();
  -- Read again, now that nothing else can change it.
  select * into v_booking from public.bookings where id = v_token.booking_id for update;

  if v_booking.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'already_confirmed', true);
  end if;

  if v_booking.status = 'pending' and v_booking.hold_expires_at <= v_now then
    -- Too late. The hold is closed for good, even if the slot is still free:
    -- an expired reservation is never brought back.
    update public.bookings set status = 'expired', closed_at = v_now where id = v_booking.id;
    insert into public.booking_events (booking_id, type, from_status, to_status, actor)
    values (v_booking.id, 'expired', 'pending', 'expired', 'system');
    return app.refusal('hold_expired');
  end if;

  if v_booking.status = 'expired' then
    return app.refusal('hold_expired');
  end if;
  if v_booking.status <> 'pending' then
    return app.refusal('invalid_token');
  end if;

  begin
    update public.bookings
    set status = 'confirmed', confirmed_at = v_now, hold_expires_at = null
    where id = v_booking.id
    returning * into v_booking;
  exception when exclusion_violation then
    -- Cannot happen while every writer takes the lock; the constraint is the
    -- net under the lock, and this is what falling into it looks like.
    return app.refusal('slot_taken');
  end;

  update public.booking_tokens set consumed_at = v_now where id = v_token.id;
  update public.customers set email_verified_at = coalesce(email_verified_at, v_now) where id = v_booking.customer_id;

  insert into public.booking_events (booking_id, type, from_status, to_status, actor)
  values (v_booking.id, 'confirmed', 'pending', 'confirmed', 'guest');

  perform app.enqueue_notification(v_booking.id, 'confirmation', v_now, v_booking.locale, v_booking.id || ':confirmation');
  perform app.enqueue_reminders(v_booking, v_now);

  return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'already_confirmed', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancel and reschedule
-- ---------------------------------------------------------------------------

-- Whether a customer may still change a booking: the same rule for cancelling
-- and for rescheduling, so neither can be used to get round the other.
create function app.past_cutoff(p_starts_at timestamptz, p_now timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_starts_at - p_now < make_interval(hours => (select change_cutoff_hours from public.shop_settings));
$$;

-- p_enforce_cutoff is true for customers. Staff may cancel at any time.
create function public.cancel_booking(
  p_booking_id uuid,
  p_actor text,
  p_actor_id uuid default null,
  p_enforce_cutoff boolean default true
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_now timestamptz;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    return app.refusal('not_found');
  end if;

  perform app.lock_barbers(array[v_booking.barber_id]);
  v_now := clock_timestamp();
  select * into v_booking from public.bookings where id = p_booking_id for update;

  if v_booking.status = 'cancelled' then
    return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'already_cancelled', true);
  end if;
  if v_booking.status <> 'confirmed' then
    return app.refusal('not_changeable');
  end if;
  if p_enforce_cutoff and app.past_cutoff(v_booking.starts_at, v_now) then
    return app.refusal('past_cutoff');
  end if;

  update public.bookings set status = 'cancelled', cancelled_at = v_now, closed_at = v_now where id = v_booking.id;

  insert into public.booking_events (booking_id, type, from_status, to_status, actor, actor_id)
  values (v_booking.id, 'cancelled', 'confirmed', 'cancelled', p_actor, p_actor_id);

  perform app.cancel_pending_notifications(v_booking.id, array['reminder_24h', 'reminder_2h']::public.notification_type[]);
  perform app.enqueue_notification(v_booking.id, 'cancellation', v_now, v_booking.locale, v_booking.id || ':cancellation');

  return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'already_cancelled', false);
end;
$$;

-- Moves a confirmed booking to another start time with the same barber. The
-- row is updated in place, in one statement, under the lock: the customer never
-- holds both slots or neither, and the old slot is free the instant the new one
-- is taken. The move is recorded in the audit trail with both times.
create function public.reschedule_booking(
  p_booking_id uuid,
  p_starts_at timestamptz,
  p_actor text,
  p_actor_id uuid default null,
  p_enforce_cutoff boolean default true
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_old_start timestamptz;
  v_now timestamptz;
  v_ends_at timestamptz;
  v_policy text;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    return app.refusal('not_found');
  end if;

  perform app.lock_barbers(array[v_booking.barber_id]);
  v_now := clock_timestamp();
  select * into v_booking from public.bookings where id = p_booking_id for update;

  if v_booking.status <> 'confirmed' then
    return app.refusal('not_changeable');
  end if;
  -- The cutoff is measured from the appointment as it stands now.
  if p_enforce_cutoff and app.past_cutoff(v_booking.starts_at, v_now) then
    return app.refusal('past_cutoff');
  end if;
  if p_starts_at = v_booking.starts_at then
    return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'starts_at', v_booking.starts_at);
  end if;

  v_policy := app.slot_policy_error(p_starts_at, v_now);
  if v_policy is not null then
    return app.refusal(v_policy);
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_booking.total_duration_minutes);
  if not app.barber_free(v_booking.barber_id, p_starts_at, v_ends_at, v_now, v_booking.id) then
    return app.refusal('slot_taken');
  end if;

  v_old_start := v_booking.starts_at;
  begin
    update public.bookings set starts_at = p_starts_at, ends_at = v_ends_at
    where id = v_booking.id
    returning * into v_booking;
  exception when exclusion_violation then
    return app.refusal('slot_taken');
  end;

  insert into public.booking_events (booking_id, type, from_status, to_status, actor, actor_id, data)
  values (v_booking.id, 'rescheduled', 'confirmed', 'confirmed', p_actor, p_actor_id,
          jsonb_build_object('from', v_old_start, 'to', p_starts_at));

  -- Reminders for the old time are withdrawn; the new time gets its own.
  perform app.cancel_pending_notifications(v_booking.id, array['reminder_24h', 'reminder_2h']::public.notification_type[]);
  perform app.enqueue_reminders(v_booking, v_now);
  perform app.enqueue_notification(v_booking.id, 'reschedule', v_now, v_booking.locale,
                                   v_booking.id || ':reschedule:' || extract(epoch from p_starts_at)::bigint);

  return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'starts_at', v_booking.starts_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

-- Marks holds that ran out as expired and records it. Availability never
-- depended on this having run; it keeps statuses and the audit trail tidy.
create function public.expire_stale_holds()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.bookings
    set status = 'expired', closed_at = clock_timestamp()
    where status = 'pending' and hold_expires_at <= clock_timestamp()
    returning id
  ),
  logged as (
    insert into public.booking_events (booking_id, type, from_status, to_status, actor)
    select id, 'expired', 'pending', 'expired', 'system' from expired
    returning booking_id
  ),
  withdrawn as (
    update public.notification_jobs j
    set status = 'cancelled'
    from expired e
    where j.booking_id = e.id and j.status in ('pending', 'failed')
    returning j.id
  )
  select count(*) into v_count from logged;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Email queue
-- ---------------------------------------------------------------------------

-- Hands due jobs to a worker. A job is claimed by at most one worker at a time
-- (SKIP LOCKED); one left in "sending" by a worker that died is picked up again
-- after five minutes. Five attempts, then it stays failed and visible.
create function public.claim_notification_jobs(p_limit integer default 10)
returns setof public.notification_jobs
language sql
set search_path = ''
as $$
  update public.notification_jobs j
  set status = 'sending', locked_at = clock_timestamp(), attempts = j.attempts + 1
  where j.id in (
    select id
    from public.notification_jobs
    where attempts < 5
      and (
        (status in ('pending', 'failed') and due_at <= clock_timestamp())
        or (status = 'sending' and locked_at < clock_timestamp() - interval '5 minutes')
      )
    order by due_at
    limit p_limit
    for update skip locked
  )
  returning j.*;
$$;

create function public.finish_notification_job(p_job_id uuid, p_provider_message_id text default null)
returns void
language sql
set search_path = ''
as $$
  update public.notification_jobs
  set status = 'sent', sent_at = clock_timestamp(), provider_message_id = p_provider_message_id, last_error = null, locked_at = null
  where id = p_job_id and status = 'sending';
$$;

-- A failed job comes due again after a growing pause: 2, 4, 8, 16 minutes.
create function public.fail_notification_job(p_job_id uuid, p_error text)
returns void
language sql
set search_path = ''
as $$
  update public.notification_jobs
  set status = 'failed',
      last_error = left(p_error, 500),
      locked_at = null,
      due_at = clock_timestamp() + make_interval(mins => (2 ^ attempts)::int)
  where id = p_job_id and status = 'sending';
$$;

-- A job whose booking has moved on (cancelled, expired, rescheduled) is dropped.
create function public.skip_notification_job(p_job_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.notification_jobs set status = 'cancelled', locked_at = null where id = p_job_id and status = 'sending';
$$;

-- ---------------------------------------------------------------------------
-- Throttling
-- ---------------------------------------------------------------------------

-- Counters per key and time window. Keys are built by the server from an IP
-- address or an email address and a purpose; they are hashed before they get
-- here, so the table holds no personal data.
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;

-- Counts a hit and says whether it is within the limit.
create function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start)
  values (p_key, v_window)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  -- Old windows are swept now and then, by whoever happens to pass.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < clock_timestamp() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: server only
-- ---------------------------------------------------------------------------

revoke all on public.rate_limits from anon, authenticated;
grant all on public.rate_limits to service_role;

-- Named one by one: a blanket revoke on the schema would also take away the
-- functions behind extension types such as citext.
do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'get_availability', 'get_reschedule_availability', 'create_booking_hold', 'confirm_booking',
        'cancel_booking', 'reschedule_booking', 'expire_stale_holds', 'claim_notification_jobs',
        'finish_notification_job', 'fail_notification_job', 'skip_notification_job', 'hit_rate_limit'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_function);
    execute format('grant execute on function %s to service_role', v_function);
  end loop;
end;
$$;

revoke all on all functions in schema app from public;
grant execute on function app.current_app_role(), app.is_admin(), app.current_barber_id()
  to anon, authenticated, service_role;
