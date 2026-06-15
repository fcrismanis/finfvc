-- =============================================================
-- FINANCE — Subcategories
-- Migration: 0006_subcategories.sql
-- Apply with: supabase db push  OR  psql < this_file
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- TABLE: sub_categories
-- Each row belongs to one family (no global/NULL family_id here —
-- subcategories are always user-created, unlike macro_categories).
-- ─────────────────────────────────────────────────────────────
create table if not exists sub_categories (
  id                text primary key,
  family_id         uuid not null references families(id) on delete cascade,
  macro_category_id text not null references macro_categories(id),
  name              text not null,
  essentiality      text not null default 'inherit'
                    check (essentiality in ('essential', 'non_essential', 'inherit')),
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_subcat_family_id  on sub_categories(family_id);
create index if not exists idx_subcat_macro_id   on sub_categories(macro_category_id);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table sub_categories enable row level security;

create policy "member can view sub_categories"
  on sub_categories for select
  using (is_family_member(family_id));

create policy "member can insert sub_categories"
  on sub_categories for insert
  with check (has_family_role(family_id, array['owner','admin','member']::member_role[]));

create policy "member can update sub_categories"
  on sub_categories for update
  using (has_family_role(family_id, array['owner','admin','member']::member_role[]));

create policy "owner/admin can delete sub_categories"
  on sub_categories for delete
  using (has_family_role(family_id, array['owner','admin']::member_role[]));

-- ─────────────────────────────────────────────────────────────
-- ADD sub_category_id TO transactions
-- NULL-safe: existing rows remain NULL; no backfill needed.
-- Uses text (not uuid) to match the app's string ID format,
-- consistent with category_id and macro_category_id columns.
-- ─────────────────────────────────────────────────────────────
alter table transactions
  add column if not exists sub_category_id text
    references sub_categories(id)
    on delete set null;

create index if not exists idx_txn_sub_category_id on transactions(sub_category_id);
