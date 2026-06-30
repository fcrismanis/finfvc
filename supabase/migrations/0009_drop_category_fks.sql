-- 0009: Dropar FKs de categoria em transactions
--
-- Problema: a hierarquia de categorias (macro/sub) virou config-driven na Phase 2
-- (CATEGORIES em src/config/categories.ts é a fonte única de verdade) e as
-- subcategorias vivem em localStorage (subcategory.service.ts). Mas o schema ainda
-- mantém FKs contra as tabelas seedadas em 0002, que estão desatualizadas.
--
-- Sintomas: selecionar uma categoria/subcategoria não persiste. updateTransaction
-- grava macro_category_id + sub_category_id numa única UPDATE; qualquer id que não
-- exista nas tabelas seedadas (ex.: mac_divida, mac_impostos, sub_*) dispara FK
-- violation e a UPDATE inteira é rejeitada — nem a macro persiste. A "inteligência"
-- (auto-aplicar a similares) sofre o mesmo bloqueio.
--
-- Fix: dropar as 3 FKs de categoria, igual ao 0008 fez com account/card/batch.
-- As colunas continuam TEXT livres; integridade fica a cargo do app/config.

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_sub_category_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_macro_category_id_fkey;
