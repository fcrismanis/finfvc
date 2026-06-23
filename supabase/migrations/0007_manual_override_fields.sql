-- 0007_manual_override_fields.sql
-- ─────────────────────────────────────────────────────────────
-- Adds four manual-override tracking fields to transactions.
--
-- Rationale: the app marks user-applied category edits with
-- manualCategoryOverride / manualSubCategoryOverride / manualTextOverride /
-- manualEditedAt (types/index.ts:52-55). Without these columns the flags
-- exist only in-memory and are lost on every Supabase reload — causing
-- Pluggy re-syncs to silently overwrite user corrections.
--
-- All columns are nullable: existing rows read as NULL (= no override),
-- which is the correct default behaviour. Non-breaking migration.
-- ─────────────────────────────────────────────────────────────

alter table transactions
  add column if not exists manual_category_override     boolean,
  add column if not exists manual_sub_category_override boolean,
  add column if not exists manual_text_override         boolean,
  add column if not exists manual_edited_at             timestamptz;
