-- Splitly: the data model. docs/architecture.md explains it; docs/security.md
-- says who may do what.
--
-- Everything lives in its own schema, `splitly`, so that Splitly can share a
-- database with another application without either seeing the other's tables.
--
-- Money is BIGINT minor units (kuruş, cents; whole yen) with the currency
-- beside it. Exchange rates are exact decimal text. Balances are not stored
-- anywhere: they are always calculated from expenses and confirmed settlements.

create schema splitly;

-- A person. Created the first time someone signs in through Telegram.
create table splitly.users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  locale text not null default 'en' check (locale in ('en', 'ru')),
  created_at timestamptz not null default now()
);

-- Which Telegram account is which person. The id comes only from sign-in data
-- whose signature the server has verified, never from anything a client says.
create table splitly.telegram_identities (
  user_id uuid primary key references splitly.users (id) on delete cascade,
  telegram_user_id bigint not null unique,
  verified_at timestamptz not null default now()
);

create table splitly.user_settings (
  user_id uuid primary key references splitly.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  locale text not null default 'en' check (locale in ('en', 'ru')),
  preferred_currency text check (preferred_currency ~ '^[A-Z]{3}$')
);

create table splitly.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  -- The currency the group's summary is shown in. Expenses keep their own.
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  owner_id uuid not null references splitly.users (id),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- Everyone in a group, whether they have an account or not. Rows that point at a member go when the
-- group goes (on delete cascade); a member alone is never deleted, only marked as having left.
-- A member is
-- either a user or a guest (a name added by someone else: "Mehmet, who is not
-- on Telegram"). Expenses, shares and settlements point at members, so a
-- guest's history stays intact when they later join and claim it.
create table splitly.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references splitly.groups (id) on delete cascade,
  user_id uuid references splitly.users (id),
  -- For a guest: the name they go by, and who they turned out to be, once they join.
  guest_name text check (char_length(trim(guest_name)) between 1 and 80),
  claimed_by_user_id uuid references splitly.users (id),
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  -- People are never deleted from a group that has history with them: they are marked as having left.
  removed_at timestamptz,
  check ((user_id is not null) <> (guest_name is not null)),
  check (guest_name is not null or claimed_by_user_id is null),
  -- Lets other tables point at (group, member) together, so a member of one group cannot appear in another's expense.
  unique (group_id, id)
);
-- A user is in a group once.
create unique index group_members_user on splitly.group_members (group_id, user_id) where user_id is not null;
create index group_members_by_user on splitly.group_members (user_id) where user_id is not null and removed_at is null;

-- Invitations. Only a hash of the token is kept: the link itself exists once, where it was shared.
create table splitly.invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references splitly.groups (id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references splitly.users (id),
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 100),
  uses integer not null default 0 check (uses >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (uses <= max_uses)
);

-- A receipt that was scanned. The photograph itself is not stored: it is read
-- on the device and stays there. What is kept is a hash, to notice the same
-- receipt being added twice, and the lines the user confirmed.
create table splitly.receipts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references splitly.groups (id) on delete cascade,
  uploader_member_id uuid not null,
  content_hash bytea not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'discarded')),
  created_at timestamptz not null default now(),
  foreign key (group_id, uploader_member_id) references splitly.group_members (group_id, id) on delete cascade,
  unique (group_id, id)
);
create index receipts_duplicate on splitly.receipts (group_id, content_hash);

create table splitly.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references splitly.groups (id) on delete cascade,
  creator_member_id uuid not null,
  description text not null check (char_length(trim(description)) between 1 and 200),
  category text check (char_length(category) <= 40),
  expense_date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Positive for a purchase, negative for a refund. Never zero, never changed in place.
  total_minor bigint not null check (total_minor <> 0 and abs(total_minor) <= 10000000000000),
  -- 'active' counts towards balances; 'cancelled' and 'replaced' do not, and stay for the record.
  status text not null default 'active' check (status in ('active', 'cancelled', 'replaced')),
  -- An edit writes a new expense and points the old one at it; a refund points at what it refunds.
  replaced_by uuid references splitly.expenses (id),
  refund_of uuid references splitly.expenses (id),
  receipt_id uuid,
  -- Chosen by the client once per submission. The same key twice is the same expense, not a second one.
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (group_id, creator_member_id) references splitly.group_members (group_id, id) on delete cascade,
  foreign key (group_id, receipt_id) references splitly.receipts (group_id, id),
  unique (group_id, idempotency_key),
  unique (group_id, id)
);
create index expenses_group_date on splitly.expenses (group_id, expense_date desc, created_at desc);

-- Who paid. Several people can pay one expense.
create table splitly.expense_payers (
  expense_id uuid not null,
  group_id uuid not null,
  member_id uuid not null,
  paid_minor bigint not null check (paid_minor <> 0),
  primary key (expense_id, member_id),
  foreign key (group_id, expense_id) references splitly.expenses (group_id, id) on delete cascade,
  foreign key (group_id, member_id) references splitly.group_members (group_id, id) on delete cascade
);

-- Who owes what share of it.
create table splitly.expense_splits (
  expense_id uuid not null,
  group_id uuid not null,
  member_id uuid not null,
  owed_minor bigint not null,
  primary key (expense_id, member_id),
  foreign key (group_id, expense_id) references splitly.expenses (group_id, id) on delete cascade,
  foreign key (group_id, member_id) references splitly.group_members (group_id, id) on delete cascade
);

-- The lines of a receipt as the user confirmed them. The text the scanner
-- read is kept as it was; what is shown (translated or corrected) is separate.
create table splitly.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  group_id uuid not null,
  position integer not null check (position >= 1),
  -- 'item' is something bought; the others are the receipt's own adjustments, which are allocated too.
  kind text not null default 'item' check (kind in ('item', 'discount', 'tax', 'tip', 'service', 'adjustment')),
  original_label text not null check (char_length(original_label) between 1 and 200),
  display_label text not null check (char_length(display_label) between 1 and 200),
  -- Where the shown label came from: the glossary, the user, or nowhere (shown as written).
  translation_source text not null default 'none' check (translation_source in ('none', 'glossary', 'user')),
  quantity_decimal text not null default '1' check (quantity_decimal ~ '^\d{1,6}(\.\d{1,3})?$'),
  line_total_minor bigint not null,
  -- How sure the scanner was, 0 to 100; null for a line typed by hand.
  confidence smallint check (confidence between 0 and 100),
  manual_reviewed boolean not null default false,
  foreign key (group_id, receipt_id) references splitly.receipts (group_id, id) on delete cascade,
  unique (receipt_id, position),
  unique (group_id, id)
);

-- Which member takes how much of each line.
create table splitly.receipt_item_allocations (
  receipt_item_id uuid not null,
  group_id uuid not null,
  member_id uuid not null,
  share_minor bigint not null,
  method text not null check (method in ('equal', 'exact', 'percent', 'shares')),
  primary key (receipt_item_id, member_id),
  foreign key (group_id, receipt_item_id) references splitly.receipt_items (group_id, id) on delete cascade,
  foreign key (group_id, member_id) references splitly.group_members (group_id, id) on delete cascade
);

-- A payment between two members. Only a confirmed one changes what is owed.
create table splitly.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references splitly.groups (id) on delete cascade,
  from_member_id uuid not null,
  to_member_id uuid not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 10000000000000),
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'cancelled')),
  idempotency_key uuid not null,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check (from_member_id <> to_member_id),
  check ((status = 'confirmed') = (confirmed_at is not null)),
  foreign key (group_id, from_member_id) references splitly.group_members (group_id, id) on delete cascade,
  foreign key (group_id, to_member_id) references splitly.group_members (group_id, id) on delete cascade,
  foreign key (group_id, created_by_member_id) references splitly.group_members (group_id, id) on delete cascade,
  unique (group_id, idempotency_key)
);
create index settlements_group on splitly.settlements (group_id, created_at desc);

-- Exchange rates as they were recorded. A row is never changed: a new rate is
-- a new row, so anything converted with an old one can always be explained.
create table splitly.fx_rates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references splitly.groups (id) on delete cascade,
  from_currency text not null check (from_currency ~ '^[A-Z]{3}$'),
  to_currency text not null check (to_currency ~ '^[A-Z]{3}$'),
  -- One unit of from_currency in to_currency, as exact decimal text: never a float.
  decimal_rate text not null check (decimal_rate ~ '^\d{1,12}(\.\d{1,12})?$' and decimal_rate::numeric > 0),
  source text not null default 'manual' check (source in ('manual')),
  effective_at timestamptz not null,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  check (from_currency <> to_currency),
  foreign key (group_id, created_by_member_id) references splitly.group_members (group_id, id) on delete cascade
);
create index fx_rates_lookup on splitly.fx_rates (group_id, from_currency, to_currency, effective_at desc);

-- Who did what, for the Activity screen. Metadata is redacted before it is
-- written: amounts and names of things, never receipt text or contact details.
create table splitly.activity_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references splitly.groups (id) on delete cascade,
  actor_member_id uuid,
  action text not null check (char_length(action) between 1 and 60),
  entity_type text not null check (entity_type in ('group', 'member', 'invite', 'expense', 'receipt', 'settlement', 'fx_rate')),
  entity_id uuid,
  metadata_redacted jsonb not null default '{}'::jsonb check (pg_column_size(metadata_redacted) <= 4096),
  created_at timestamptz not null default now(),
  foreign key (group_id, actor_member_id) references splitly.group_members (group_id, id) on delete cascade
);
create index activity_group on splitly.activity_log (group_id, created_at desc);

-- Counters for limiting how often sensitive things can be attempted. Keys are hashes: nothing readable.
create table splitly.rate_limits (
  key bytea not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (key, window_start)
);
