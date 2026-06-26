-- 0008: Flex IDs para suportar imports externos (Pluggy, xlsx, PDFs)
--
-- Problema: transactions.id, account_id, credit_card_id e import_batch_id
-- são UUID com FK, mas imports externos usam IDs string (pluggy_, real_, manual_).
-- Fix: converter para TEXT, dropar FKs opcionais, manter integridade dos dados reais.

-- 1. Dropar FKs que bloqueiam imports
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_credit_card_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_import_batch_id_fkey;

-- 2. Converter colunas para TEXT (aceita qualquer formato de ID)
ALTER TABLE transactions
  ALTER COLUMN id           TYPE text,
  ALTER COLUMN account_id   TYPE text,
  ALTER COLUMN credit_card_id TYPE text,
  ALTER COLUMN import_batch_id TYPE text;

-- 3. Remover default uuid do id (agora quem insere controla o ID)
ALTER TABLE transactions ALTER COLUMN id DROP DEFAULT;

-- 4. Adicionar coluna source_data para guardar dados brutos do banco/cartão
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source_bank text,
  ADD COLUMN IF NOT EXISTS source_raw_date text,
  ADD COLUMN IF NOT EXISTS origin_description text;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_family_month
  ON transactions(family_id, competence_date);

CREATE INDEX IF NOT EXISTS idx_transactions_family_type
  ON transactions(family_id, transaction_type);

CREATE INDEX IF NOT EXISTS idx_transactions_import_hash
  ON transactions(import_hash);

-- 6. Função helper: gera ID determinístico a partir de campos do lançamento
--    Permite re-import idempotente sem duplicar
CREATE OR REPLACE FUNCTION generate_tx_id(
  p_source text,
  p_description text,
  p_amount numeric,
  p_date date,
  p_account text
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'tx_' || encode(sha256(
    (p_source || '|' || p_description || '|' || p_amount::text || '|' || p_date::text || '|' || coalesce(p_account,''))::bytea
  ), 'hex')
$$;
