-- =============================================================
-- FINANCE — Initial Schema
-- Migration: 0001_initial_schema.sql
-- Apply with: supabase db push  OR  psql < this_file
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────
create type transaction_type as enum ('income', 'expense');

create type classification_type as enum (
  'operational_income',
  'extraordinary_income',
  'operational_expense',
  'debt_cost',
  'investment',
  'redemption',
  'transfer',
  'adjustment',
  'neutral'
);

create type transaction_status as enum ('paid', 'pending', 'cancelled');

create type payment_method as enum (
  'card', 'account', 'pix', 'cash', 'boleto', 'debit'
);

create type member_role as enum ('owner', 'admin', 'member', 'viewer');

-- ─────────────────────────────────────────────────────────────
-- FAMILIES
-- ─────────────────────────────────────────────────────────────
create table families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- FAMILY MEMBERS
-- ─────────────────────────────────────────────────────────────
create table family_members (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  user_id      uuid not null references auth.users(id),
  role         member_role not null default 'member',
  display_name text,
  created_at   timestamptz not null default now(),
  unique (family_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- ACCOUNTS
-- ─────────────────────────────────────────────────────────────
create table accounts (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  name       text not null,
  type       text not null check (type in ('checking','savings','investment','digital_wallet')),
  bank       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- CREDIT CARDS
-- ─────────────────────────────────────────────────────────────
create table credit_cards (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  name        text not null,
  last_4      text check (last_4 ~ '^\d{4}$'),
  closing_day smallint,
  due_day     smallint,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- MACRO CATEGORIES
-- family_id = NULL → global seed (visible to all families)
-- ─────────────────────────────────────────────────────────────
create table macro_categories (
  id                  text primary key,
  family_id           uuid references families(id) on delete cascade,
  name                text not null,
  classification_type classification_type not null,
  display_in_result   boolean not null default true,
  display_in_cashflow boolean not null default true,
  display_in_budget   boolean not null default true,
  color               text not null default '#94A3B8',
  icon                text not null default 'circle',
  sort_order          smallint not null default 99,
  active              boolean not null default true
);

-- ─────────────────────────────────────────────────────────────
-- CATEGORIES
-- family_id = NULL → global seed
-- ─────────────────────────────────────────────────────────────
create table categories (
  id                                    text primary key,
  family_id                             uuid references families(id) on delete cascade,
  name                                  text not null,
  macro_category_id                     text not null references macro_categories(id),
  classification_type                   classification_type not null,
  default_include_in_operational_result boolean not null default true,
  default_include_in_cashflow           boolean not null default true,
  default_include_in_budget             boolean not null default true,
  is_internal_transfer_default          boolean not null default false,
  sort_order                            smallint not null default 99,
  active                                boolean not null default true
);

-- ─────────────────────────────────────────────────────────────
-- IMPORT BATCHES
-- ─────────────────────────────────────────────────────────────
create table import_batches (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  imported_by uuid not null references auth.users(id),
  source_file text not null,
  row_count   int not null default 0,
  imported_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- TRANSACTIONS
-- ─────────────────────────────────────────────────────────────
create table transactions (
  id                            uuid primary key default gen_random_uuid(),
  family_id                     uuid not null references families(id) on delete cascade,
  description                   text not null,
  original_description          text,
  amount                        numeric(12,2) not null,
  transaction_type              transaction_type not null,
  classification_type           classification_type not null,
  transaction_date              date not null,
  competence_date               date,
  payment_date                  date,
  status                        transaction_status not null default 'paid',
  payment_method                payment_method,
  account_id                    uuid references accounts(id),
  credit_card_id                uuid references credit_cards(id),
  category_id                   text references categories(id),
  macro_category_id             text references macro_categories(id),
  installment_current           smallint,
  installment_total             smallint,
  is_recurring                  boolean not null default false,
  include_in_operational_result boolean not null default true,
  include_in_cashflow           boolean not null default true,
  include_in_budget             boolean not null default true,
  is_internal_transfer          boolean not null default false,
  import_batch_id               uuid references import_batches(id),
  import_hash                   text,
  source_file                   text,
  raw_data                      jsonb,
  notes                         text,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),

  constraint uq_family_import_hash unique (family_id, import_hash)
);

-- ─────────────────────────────────────────────────────────────
-- BUDGETS
-- ─────────────────────────────────────────────────────────────
create table budgets (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families(id) on delete cascade,
  macro_category_id text not null references macro_categories(id),
  category_id       text references categories(id),
  month             char(7) not null,           -- 'YYYY-MM'
  amount            numeric(12,2) not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint uq_budget unique (family_id, macro_category_id, category_id, month)
);

-- ─────────────────────────────────────────────────────────────
-- MONTHLY CLOSINGS
-- ─────────────────────────────────────────────────────────────
create table monthly_closings (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  month     char(7) not null,
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  is_closed boolean not null default false,
  notes     text,
  checklist jsonb,
  created_at timestamptz not null default now(),

  constraint uq_closing unique (family_id, month)
);

-- ─────────────────────────────────────────────────────────────
-- CLASSIFICATION RULES
-- family_id = NULL → global rule
-- ─────────────────────────────────────────────────────────────
create table classification_rules (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid references families(id) on delete cascade,
  keyword             text not null,
  match_type          text not null check (match_type in ('contains','starts_with','exact','regex')),
  category_id         text references categories(id),
  macro_category_id   text references macro_categories(id),
  classification_type classification_type,
  priority            smallint not null default 50,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────
create index idx_txn_family_id       on transactions(family_id);
create index idx_txn_competence_date on transactions(competence_date);
create index idx_txn_txn_date        on transactions(transaction_date);
create index idx_txn_category_id     on transactions(category_id);
create index idx_txn_macro_category  on transactions(macro_category_id);
create index idx_txn_classification  on transactions(classification_type);
create index idx_txn_import_hash     on transactions(import_hash);
create index idx_txn_status          on transactions(status);
create index idx_txn_family_month    on transactions(family_id, competence_date);

create index idx_budgets_family_month   on budgets(family_id, month);
create index idx_fm_user_id             on family_members(user_id);
create index idx_fm_family_id           on family_members(family_id);

-- ─────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS  (SECURITY DEFINER — no raw user input)
-- ─────────────────────────────────────────────────────────────

-- Returns true if current user is a member of the given family.
-- Does NOT assume the user belongs to only one family.
create or replace function is_family_member(p_family_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from family_members
    where family_id = p_family_id
      and user_id   = auth.uid()
  );
$$;

-- Returns true if current user holds one of the given roles in the family.
create or replace function has_family_role(p_family_id uuid, p_roles member_role[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from family_members
    where family_id = p_family_id
      and user_id   = auth.uid()
      and role      = any(p_roles)
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
alter table families             enable row level security;
alter table family_members       enable row level security;
alter table accounts             enable row level security;
alter table credit_cards         enable row level security;
alter table macro_categories     enable row level security;
alter table categories           enable row level security;
alter table transactions         enable row level security;
alter table budgets              enable row level security;
alter table import_batches       enable row level security;
alter table monthly_closings     enable row level security;
alter table classification_rules enable row level security;

-- families
create policy "family member can view"
  on families for select
  using (is_family_member(id));

create policy "owner/admin can update family"
  on families for update
  using (has_family_role(id, array['owner','admin']::member_role[]));

-- family_members
create policy "member can view roster"
  on family_members for select
  using (is_family_member(family_id));

create policy "owner/admin can insert members"
  on family_members for insert
  with check (has_family_role(family_id, array['owner','admin']::member_role[]));

create policy "owner/admin can delete members"
  on family_members for delete
  using (has_family_role(family_id, array['owner','admin']::member_role[]));

-- accounts
create policy "member can view accounts"
  on accounts for select using (is_family_member(family_id));

create policy "owner/admin can manage accounts"
  on accounts for all using (has_family_role(family_id, array['owner','admin']::member_role[]));

-- credit_cards
create policy "member can view credit_cards"
  on credit_cards for select using (is_family_member(family_id));

create policy "owner/admin can manage credit_cards"
  on credit_cards for all using (has_family_role(family_id, array['owner','admin']::member_role[]));

-- macro_categories: NULL family_id = global, visible to all authenticated users
create policy "view global or own macro_categories"
  on macro_categories for select
  using (family_id is null or is_family_member(family_id));

create policy "owner/admin can manage family macro_categories"
  on macro_categories for all
  using (family_id is not null and has_family_role(family_id, array['owner','admin']::member_role[]));

-- categories
create policy "view global or own categories"
  on categories for select
  using (family_id is null or is_family_member(family_id));

create policy "owner/admin can manage family categories"
  on categories for all
  using (family_id is not null and has_family_role(family_id, array['owner','admin']::member_role[]));

-- transactions
create policy "member can view transactions"
  on transactions for select using (is_family_member(family_id));

create policy "member can insert transactions"
  on transactions for insert
  with check (has_family_role(family_id, array['owner','admin','member']::member_role[]));

create policy "member can update transactions"
  on transactions for update
  using (has_family_role(family_id, array['owner','admin','member']::member_role[]));

create policy "owner/admin can delete transactions"
  on transactions for delete
  using (has_family_role(family_id, array['owner','admin']::member_role[]));

-- budgets
create policy "member can view budgets"
  on budgets for select using (is_family_member(family_id));

create policy "member can manage budgets"
  on budgets for all
  using (has_family_role(family_id, array['owner','admin','member']::member_role[]));

-- import_batches
create policy "member can view import_batches"
  on import_batches for select using (is_family_member(family_id));

create policy "member can insert import_batches"
  on import_batches for insert
  with check (has_family_role(family_id, array['owner','admin','member']::member_role[]));

-- monthly_closings
create policy "member can view closings"
  on monthly_closings for select using (is_family_member(family_id));

create policy "owner/admin can manage closings"
  on monthly_closings for all
  using (has_family_role(family_id, array['owner','admin']::member_role[]));

-- classification_rules
create policy "view global or own rules"
  on classification_rules for select
  using (family_id is null or is_family_member(family_id));

create policy "owner/admin can manage family rules"
  on classification_rules for all
  using (family_id is not null and has_family_role(family_id, array['owner','admin']::member_role[]));
