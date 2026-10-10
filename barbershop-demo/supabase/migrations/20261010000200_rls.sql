-- Row level security and grants.
--
-- The rule of the house: the browser may read the public catalog and a signed-in
-- user may read what is theirs. Everything that changes a booking, a payment,
-- a token or an email job goes through server code with the service role, where
-- prices, durations, eligibility and state transitions are checked. So most
-- tables have no write policy at all, and the most sensitive ones have no
-- grants for the API roles either.
--
-- docs/architecture.md holds the permission matrix these policies implement.

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so that a policy can look up the caller's role without the
-- profiles policies recursing into themselves.
create function app.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.current_app_role() = 'admin', false);
$$;

-- The barber profile of the caller, if they are an active barber.
create function app.current_barber_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
  from public.barbers b
  join public.profiles p on p.id = b.profile_id
  where b.profile_id = (select auth.uid())
    and b.is_active
    and p.role = 'barber';
$$;

revoke all on all functions in schema app from public;
grant usage on schema app to anon, authenticated, service_role;
grant execute on function app.current_app_role(), app.is_admin(), app.current_barber_id()
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grants: start from nothing
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter table public.shop_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.barbers enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.barber_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_services enable row level security;
alter table public.booking_events enable row level security;
alter table public.booking_tokens enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.payment_records enable row level security;

-- ---------------------------------------------------------------------------
-- Public catalog: anyone reads, admins manage
-- ---------------------------------------------------------------------------

grant select on public.shop_settings, public.services, public.barbers,
  public.barber_services, public.working_hours to anon, authenticated;
grant update on public.shop_settings to authenticated;
grant insert, update on public.services, public.barbers to authenticated;
grant insert, delete on public.barber_services to authenticated;
grant insert, update, delete on public.working_hours to authenticated;

create policy shop_settings_read on public.shop_settings
  for select to anon, authenticated using (true);
create policy shop_settings_admin_update on public.shop_settings
  for update to authenticated using (app.is_admin()) with check (app.is_admin());

-- Retired services and barbers stay in the table for the sake of history but
-- are visible to admins only. Nothing is deleted: it is switched off.
create policy services_read on public.services
  for select to anon, authenticated using (is_active or app.is_admin());
create policy services_admin_insert on public.services
  for insert to authenticated with check (app.is_admin());
create policy services_admin_update on public.services
  for update to authenticated using (app.is_admin()) with check (app.is_admin());

create policy barbers_read on public.barbers
  for select to anon, authenticated using (is_active or app.is_admin());
create policy barbers_admin_insert on public.barbers
  for insert to authenticated with check (app.is_admin());
create policy barbers_admin_update on public.barbers
  for update to authenticated using (app.is_admin()) with check (app.is_admin());

create policy barber_services_read on public.barber_services
  for select to anon, authenticated using (true);
create policy barber_services_admin_insert on public.barber_services
  for insert to authenticated with check (app.is_admin());
create policy barber_services_admin_delete on public.barber_services
  for delete to authenticated using (app.is_admin());

-- Only an admin changes the base weekly schedule.
create policy working_hours_read on public.working_hours
  for select to anon, authenticated using (true);
create policy working_hours_admin_insert on public.working_hours
  for insert to authenticated with check (app.is_admin());
create policy working_hours_admin_update on public.working_hours
  for update to authenticated using (app.is_admin()) with check (app.is_admin());
create policy working_hours_admin_delete on public.working_hours
  for delete to authenticated using (app.is_admin());

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

-- A user edits their own name, phone and language. Not the role: there is no
-- column grant for it, whatever the policy says.
grant select on public.profiles to authenticated;
grant update (full_name, phone, locale) on public.profiles to authenticated;

create policy profiles_read_own on public.profiles
  for select to authenticated using (id = (select auth.uid()) or app.is_admin());
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- The email address of a customer is visible to that customer and to admins.
-- Barbers see the name and phone on their own bookings and nothing here.
grant select on public.customers to authenticated;

create policy customers_read on public.customers
  for select to authenticated
  using (profile_id = (select auth.uid()) or app.is_admin());

-- ---------------------------------------------------------------------------
-- Time off: admins see all, a barber sees their own. Writes are server-side.
-- ---------------------------------------------------------------------------

grant select on public.time_off to authenticated;

create policy time_off_read on public.time_off
  for select to authenticated
  using (app.is_admin() or barber_id = app.current_barber_id());

-- ---------------------------------------------------------------------------
-- Bookings: read-only for the API roles
-- ---------------------------------------------------------------------------

grant select on public.bookings, public.booking_services to authenticated;

create policy bookings_read on public.bookings
  for select to authenticated
  using (
    app.is_admin()
    or barber_id = app.current_barber_id()
    or exists (
      select 1 from public.customers c
      where c.id = bookings.customer_id and c.profile_id = (select auth.uid())
    )
  );

-- Visible exactly when the booking is: the subquery runs under the caller's
-- own bookings policy.
create policy booking_services_read on public.booking_services
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_services.booking_id));

-- Audit history and takings are for admins.
grant select on public.booking_events, public.payment_records to authenticated;

create policy booking_events_admin_read on public.booking_events
  for select to authenticated using (app.is_admin());
create policy payment_records_admin_read on public.payment_records
  for select to authenticated using (app.is_admin());

-- booking_tokens and notification_jobs: row level security is on, there is no
-- policy and no grant. Only the service role reaches them.
