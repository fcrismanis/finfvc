-- =============================================================
-- FINANCE — Category / Macro overrides (persist to Supabase)
-- Migration: 0011_category_overrides.sql
-- Apply with: supabase db push  OR  psql < this_file
--
-- Renames/edits of DEFAULT macro categories and DEFAULT/custom
-- categories were localStorage-only (keys finance_parent_categories_custom
-- and finance_categories_custom), so they never reached the base and
-- silently diverged across devices/browsers. This table is the source of
-- truth; localStorage stays only as a synchronous cache.
--
-- One row per overridden/custom entity. `data` holds the full serialized
-- MacroCategory or Category object (same shape written to localStorage).
-- =============================================================

create table if not exists fin_category_overrides (
  family_id  uuid not null references families(id) on delete cascade,
  kind       text not null check (kind in ('macro', 'category')),
  entity_id  text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (family_id, kind, entity_id)
);

create index if not exists idx_catovr_family on fin_category_overrides(family_id);

-- ─────────────────────────────────────────────────────────────
-- RLS (mirrors sub_categories)
-- ─────────────────────────────────────────────────────────────
alter table fin_category_overrides enable row level security;

create policy "member can view category_overrides"
  on fin_category_overrides for select
  using (is_family_member(family_id));

create policy "member can insert category_overrides"
  on fin_category_overrides for insert
  with check (has_family_role(family_id, array['owner','admin','member']::member_role[]));

create policy "member can update category_overrides"
  on fin_category_overrides for update
  using (has_family_role(family_id, array['owner','admin','member']::member_role[]));

create policy "member can delete category_overrides"
  on fin_category_overrides for delete
  using (has_family_role(family_id, array['owner','admin','member']::member_role[]));
