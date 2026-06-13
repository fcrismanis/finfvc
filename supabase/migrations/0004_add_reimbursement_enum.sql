-- 0004_add_reimbursement_enum.sql
-- ─────────────────────────────────────────────────────────────
-- Adds 'reimbursement' to the classification_type enum.
--
-- Rationale: 'reimbursement' (Reembolso) is a first-class, user-selectable
-- classification in the app (types/index.ts, importers/classifier.ts,
-- Transactions.tsx) and is counted in the operational result. The initial
-- schema (0001) omitted it, so the Supabase adapter shimmed it to 'neutral'
-- on write — silently distorting the data. This migration makes persistence
-- faithful and lets us remove that shim.
--
-- Note: ALTER TYPE ... ADD VALUE is non-destructive and idempotent here via
-- IF NOT EXISTS. It only appends a value; existing rows are untouched.
-- ─────────────────────────────────────────────────────────────

alter type classification_type add value if not exists 'reimbursement';
