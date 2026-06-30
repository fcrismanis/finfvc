-- =============================================================
-- FINANCE — Provisions (provisionamento anual)
-- Migration: 0010_provisions.sql
-- Apply with: supabase db push  OR  psql < this_file
--
-- Estrutural / compartilhada entre ambientes (mesmo banco).
-- Modela despesas grandes não-mensais (IPVA, IPTU, seguros,
-- matrícula, licenciamento) para reserva mensal = annual_amount/12.
-- =============================================================

create table if not exists provisions (
  id                text primary key,
  family_id         uuid not null references families(id) on delete cascade,
  label             text not null,
  macro_category_id text references macro_categories(id),
  annual_amount     numeric(14,2) not null check (annual_amount >= 0),
  recurrence        text not null default 'annual'
                    check (recurrence in ('annual', 'semiannual', 'quarterly')),
  due_month         int not null check (due_month between 1 and 12),
  active            boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_provisions_family_id on provisions(family_id);

-- ─────────────────────────────────────────────────────────────
-- RLS — espelha sub_categories
-- ─────────────────────────────────────────────────────────────
alter table provisions enable row level security;

create policy "member can view provisions"
  on provisions for select
  using (is_family_member(family_id));

create policy "member can insert provisions"
  on provisions for insert
  with check (has_family_role(family_id, array['owner','admin','member']::member_role[]));

create policy "member can update provisions"
  on provisions for update
  using (has_family_role(family_id, array['owner','admin','member']::member_role[]));

create policy "owner/admin can delete provisions"
  on provisions for delete
  using (has_family_role(family_id, array['owner','admin']::member_role[]));
