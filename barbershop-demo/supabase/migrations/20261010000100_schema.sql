-- CUT&CO schema.
--
-- Conventions
--   * Money is integer US cents. There are no floating-point amounts anywhere.
--   * Instants are timestamptz. Weekly schedules are local times in the shop's
--     time zone (shop_settings.timezone) and are converted when slots are built.
--   * Bilingual catalog content lives in *_en / *_ru columns.
--   * Tables are written by server code only, except where a policy in the
--     next migration says otherwise.

create extension if not exists btree_gist;
create extension if not exists citext;

-- Helper functions live here, outside the schema exposed by the API.
create schema if not exists app;

create type public.app_role as enum ('client', 'barber', 'admin');

create type public.booking_status as enum (
  'pending',    -- held, waiting for email verification
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
  'expired'     -- the hold ran out before verification
);

create type public.payment_status as enum ('unpaid', 'paid');
create type public.time_off_kind as enum ('break', 'time_off', 'holiday');
create type public.time_off_status as enum ('requested', 'approved', 'rejected');
create type public.token_purpose as enum ('verify', 'manage');

create type public.notification_type as enum (
  'verification',
  'confirmation',
  'reminder_24h',
  'reminder_2h',
  'cancellation',
  'reschedule'
);

create type public.notification_status as enum (
  'pending',
  'sending',
  'sent',
  'failed',
  'cancelled'
);

create function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shop
-- ---------------------------------------------------------------------------

-- One row. The booking policy lives in data so that tests and the demo can
-- read the same numbers the booking functions use.
create table public.shop_settings (
  id boolean primary key default true check (id),
  name text not null,
  timezone text not null default 'Europe/London',
  currency text not null default 'USD' check (currency = 'USD'),
  address_line1 text not null,
  address_line2 text,
  city text not null,
  postcode text not null,
  country_code text not null default 'GB',
  phone text not null,
  email text not null,
  hold_minutes integer not null default 15 check (hold_minutes between 1 and 120),
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 120),
  min_lead_minutes integer not null default 120 check (min_lead_minutes >= 0),
  horizon_days integer not null default 30 check (horizon_days between 1 and 365),
  change_cutoff_hours integer not null default 12 check (change_cutoff_hours >= 0),
  updated_at timestamptz not null default now()
);

create trigger shop_settings_touch before update on public.shop_settings
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- One row per authenticated user. The role is never taken from the client.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'client',
  full_name text,
  phone text,
  locale text not null default 'en' check (locale in ('en', 'ru')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  -- The staff account, once one has been provisioned.
  profile_id uuid unique references public.profiles (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  title_en text not null,
  title_ru text not null,
  bio_en text not null,
  bio_ru text not null,
  photo_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger barbers_touch before update on public.barbers
  for each row execute function app.touch_updated_at();

-- The person a booking is for. One row per email address, shared by guest
-- bookings and, once they register, by their account.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  email citext not null unique,
  locale text not null default 'en' check (locale in ('en', 'ru')),
  -- Set when an email link has proved the address belongs to the customer.
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_touch before update on public.customers
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Catalog and schedule
-- ---------------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null,
  name_ru text not null,
  description_en text not null,
  description_ru text not null,
  price_cents integer not null check (price_cents >= 0),
  -- Need not be a multiple of the slot interval.
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger services_touch before update on public.services
  for each row execute function app.touch_updated_at();

-- Which barber can deliver which service.
create table public.barber_services (
  barber_id uuid not null references public.barbers (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (barber_id, service_id)
);

create index barber_services_service_idx on public.barber_services (service_id);

-- Regular weekly hours, in the shop's local time. A day may have several
-- ranges; a day with no rows is a day off.
create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers (id) on delete cascade,
  -- ISO day of week: 1 is Monday, 7 is Sunday.
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  unique (barber_id, weekday, start_time)
);

-- Exceptions to the weekly hours. A row without a barber closes the shop.
create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references public.barbers (id) on delete cascade,
  kind public.time_off_kind not null,
  status public.time_off_status not null default 'approved',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Only a shop-wide closure may be without a barber.
  check (barber_id is not null or kind = 'holiday')
);

create index time_off_barber_range_idx on public.time_off (barber_id, starts_at, ends_at);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  -- Short code quoted in emails and at the counter.
  reference text not null unique check (reference ~ '^[A-Z0-9]{6,10}$'),
  barber_id uuid not null references public.barbers (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  -- The name and phone given for this visit.
  customer_name text not null,
  customer_phone text not null,
  -- Language of the emails about this booking.
  locale text not null default 'en' check (locale in ('en', 'ru')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'pending',
  -- A pending booking blocks its slot only until this instant.
  hold_expires_at timestamptz,
  -- True when the customer chose "Any available"; barber_id is who was assigned.
  any_barber_requested boolean not null default false,
  source text not null default 'web' check (source in ('web', 'admin')),
  created_by uuid references public.profiles (id) on delete set null,
  -- Totals of the service snapshot in booking_services.
  total_price_cents integer not null check (total_price_cents >= 0),
  total_duration_minutes integer not null check (total_duration_minutes > 0),
  -- Independent of status: a completed visit is not assumed to be paid.
  payment_status public.payment_status not null default 'unpaid',
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (status <> 'pending' or hold_expires_at is not null),
  -- Durable guarantee: one barber never has two confirmed bookings that
  -- overlap. Pending holds depend on the clock, which a constraint cannot
  -- read; they are checked under a per-barber lock by the booking functions.
  constraint bookings_no_confirmed_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'confirmed')
);

create trigger bookings_touch before update on public.bookings
  for each row execute function app.touch_updated_at();

create index bookings_barber_time_idx on public.bookings (barber_id, starts_at, ends_at);
create index bookings_customer_idx on public.bookings (customer_id, starts_at desc);
create index bookings_status_time_idx on public.bookings (status, starts_at);
create index bookings_pending_hold_idx on public.bookings (hold_expires_at) where status = 'pending';

-- What was booked, as it was at the time. Later catalog edits do not reach it.
create table public.booking_services (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  position smallint not null check (position >= 1),
  name_en text not null,
  name_ru text not null,
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  unique (booking_id, position)
);

-- Append-only history of every booking.
create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  type text not null check (type in (
    'created', 'confirmed', 'expired', 'cancelled', 'rescheduled',
    'completed', 'no_show', 'payment_recorded', 'payment_removed', 'note'
  )),
  from_status public.booking_status,
  to_status public.booking_status,
  actor text not null check (actor in ('system', 'guest', 'client', 'barber', 'admin')),
  actor_id uuid references public.profiles (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index booking_events_booking_idx on public.booking_events (booking_id, id);

create function app.forbid_change()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'restrict_violation';
end;
$$;

-- Updates are refused for every role. Deletes are not granted to any API role;
-- rows go only with their booking, which the retention policy relies on.
create trigger booking_events_no_update before update on public.booking_events
  for each row execute function app.forbid_change();

-- Email links. Only a SHA-256 hash of the token is stored.
create table public.booking_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  purpose public.token_purpose not null,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index booking_tokens_booking_idx on public.booking_tokens (booking_id, purpose);

-- Outgoing email. The idempotency key makes a retried enqueue or a retried
-- send harmless.
create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  type public.notification_type not null,
  locale text not null default 'en' check (locale in ('en', 'ru')),
  due_at timestamptz not null,
  status public.notification_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  idempotency_key text not null unique,
  provider_message_id text,
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_jobs_touch before update on public.notification_jobs
  for each row execute function app.touch_updated_at();

create index notification_jobs_due_idx on public.notification_jobs (due_at)
  where status in ('pending', 'failed');

-- Money taken at the counter. Revenue reports read this table, not bookings.
create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  method text not null check (method in ('cash', 'card_terminal')),
  note text,
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

-- Every new account starts as a client. Staff roles are granted by an admin
-- on the server, never by sign-up data.
create function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'ru' then 'ru' else 'en' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();
