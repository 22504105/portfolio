-- Flowly: tables for private workspaces. The public demo uses none of this.
-- docs/architecture.md explains the model; docs/metrics.md what is calculated from it.
--
-- Amounts are numeric, never floating point. Instants are timestamptz (UTC);
-- which day one falls on is decided in the workspace time zone when read.

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  -- One workspace per account in v1: no teams, no invitations.
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  timezone text not null check (char_length(timezone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets orders point at (workspace, currency) together: see orders below.
  unique (id, currency_code)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  filename text not null check (char_length(filename) between 1 and 255),
  file_type text not null check (file_type in ('csv', 'xlsx')),
  -- What one row of the file was: a whole order, or one line of an order.
  interpretation text not null check (interpretation in ('order_per_row', 'line_per_row')),
  row_count integer not null check (row_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  -- 'importing' until the last chunk is in. A batch left 'importing' was interrupted and can be deleted whole.
  status text not null default 'importing' check (status in ('importing', 'completed', 'failed')),
  imported_at timestamptz not null default now(),
  mapping_json jsonb not null default '{}'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb
);
create index import_batches_workspace on public.import_batches (workspace_id, imported_at desc);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  external_customer_id text check (char_length(external_customer_id) <= 200),
  name text check (char_length(name) <= 200),
  email text check (char_length(email) <= 320),
  -- What makes two rows the same person: 'id:<customer id>' when the file has
  -- one, otherwise 'email:<lower-cased email>'. A row with neither names no
  -- customer at all; nobody is invented for it.
  identity_key text not null check (char_length(identity_key) between 4 and 330),
  created_at timestamptz not null default now(),
  unique (workspace_id, identity_key)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  import_batch_id uuid not null references public.import_batches (id) on delete cascade,
  external_order_id text not null check (char_length(external_order_id) between 1 and 200),
  order_date timestamptz not null,
  customer_id uuid references public.customers (id) on delete set null,
  channel text check (char_length(channel) <= 120),
  status text not null check (status in ('completed', 'refunded', 'cancelled', 'pending')),
  currency_code text not null,
  gross_amount numeric(16, 4) not null check (gross_amount >= 0),
  discount_amount numeric(16, 4) not null default 0 check (discount_amount >= 0),
  net_amount numeric(16, 4) not null,
  -- Money given back on a completed order. A fully refunded order has the status 'refunded'.
  refund_amount numeric(16, 4) not null default 0 check (refund_amount >= 0),
  created_at timestamptz not null default now(),
  -- An order number appears once per workspace, so importing a file twice cannot double its orders.
  unique (workspace_id, external_order_id),
  -- An order is always in its workspace's currency. This also means the
  -- currency of a workspace cannot be changed while it has orders: amounts
  -- would be relabelled, not converted.
  foreign key (workspace_id, currency_code) references public.workspaces (id, currency_code) on delete cascade
);
create index orders_workspace_date on public.orders (workspace_id, order_date);
create index orders_batch on public.orders (import_batch_id);
create index orders_customer on public.orders (customer_id);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  position integer not null check (position >= 1),
  product_name text check (char_length(product_name) <= 300),
  category text check (char_length(category) <= 120),
  quantity integer not null check (quantity > 0),
  unit_price numeric(16, 4) not null check (unit_price >= 0),
  gross_amount numeric(16, 4) not null check (gross_amount >= 0),
  discount_amount numeric(16, 4) not null default 0 check (discount_amount >= 0),
  net_amount numeric(16, 4) not null,
  unique (order_id, position)
);
create index order_lines_workspace on public.order_lines (workspace_id);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger workspaces_touch before update on public.workspaces
for each row execute function public.touch_updated_at();
