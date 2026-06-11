# DATA_MODEL.md
# Modelo de dados — FINANCE

Versão: 1.0 — 2026-06-10
Baseado em: FINANCE_RULES.md + análise de 855 lançamentos reais

---

## Princípios do modelo

- Lançamento original nunca alterado após import. Todo ajuste gera novo registro vinculado.
- Deduplicação por hash antes de qualquer insert.
- Campos booleanos de comportamento (`include_in_*`) controlam o que entra em cada cálculo — não há lógica hardcoded por tipo.
- Modelo funciona local (SQLite / JSON) na fase 1 e migra para Supabase sem mudança estrutural.
- Campos de auditoria em toda entidade mutável: `created_at`, `updated_at`, `updated_by`.

---

## 1. transactions

### Objetivo
Registro atômico de cada lançamento financeiro. Fonte de verdade de tudo. Imutável após import — ajustes criam novo registro vinculado.

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | UUID | SIM | Gerado no import. Nunca reutilizado. |
| `description` | TEXT | SIM | Nome legível. Pode ser editado pelo usuário. |
| `original_description` | TEXT | SIM | Descrição exata do arquivo de origem. Nunca alterada. |
| `amount` | DECIMAL(12,2) | SIM | Sempre positivo. Direção definida por `type`. |
| `type` | ENUM | SIM | `income` / `expense` |
| `classification_type` | ENUM | SIM | Ver tabela de valores abaixo. |
| `transaction_date` | DATE | SIM | Data do lançamento (campo "Data" do XLSX). |
| `competence_date` | DATE | SIM | Data de competência (campo "Data Competência"). Referência principal para agrupamento mensal. |
| `payment_date` | DATE | NÃO | Data do pagamento real (campo "Data Pagamento"). Usado no fluxo de caixa. |
| `status` | ENUM | SIM | `paid` / `pending` / `cancelled` |
| `account_id` | UUID | SIM | FK → accounts |
| `credit_card_id` | UUID | NÃO | FK → credit_cards. Preenchido só se forma = cartão. |
| `category_id` | UUID | NÃO | FK → categories. Pode ser nulo em lançamentos recém-importados. |
| `macro_category_id` | UUID | NÃO | FK → macro_categories. Derivado de category_id mas armazenado para performance. |
| `payment_method` | ENUM | SIM | `card` / `account` / `pix` / `cash` / `boleto` / `debit` |
| `installment_current` | SMALLINT | NÃO | Parcela atual. Ex: `3` de `3/5`. |
| `installment_total` | SMALLINT | NÃO | Total de parcelas. Ex: `5` de `3/5`. |
| `is_recurring` | BOOLEAN | SIM | `false` em todos os dados atuais. Campo preservado para uso futuro. |
| `include_in_operational_result` | BOOLEAN | SIM | Derivado de `classification_type`. Ver tabela. Pode ser sobrescrito manualmente. |
| `include_in_cashflow` | BOOLEAN | SIM | Derivado de `classification_type`. |
| `include_in_budget` | BOOLEAN | SIM | Derivado de `classification_type`. |
| `is_internal_transfer` | BOOLEAN | SIM | True = transferência entre contas da família. Excluído de todos os cálculos de resultado. |
| `is_adjustment` | BOOLEAN | SIM | True = lançamento de ajuste manual. |
| `adjusted_from_id` | UUID | NÃO | FK → transactions. Aponta para lançamento original substituído por este ajuste. |
| `adjustment_reason` | TEXT | NÃO | Obrigatório quando `is_adjustment = true`. |
| `source_file` | TEXT | NÃO | Nome do arquivo de origem (ex: `lancamentos_Pessoal_2026-01-01_2026-05-31.xlsx`). |
| `import_batch_id` | UUID | NÃO | FK → import_batches. |
| `import_hash` | TEXT | SIM | SHA256 de `original_description + amount + transaction_date + account`. Usado para deduplicação. |
| `origin` | ENUM | SIM | `import_xlsx` / `import_api` / `manual_entry` / `manual_adjustment` |
| `group` | TEXT | NÃO | Campo "Grupo" do XLSX. Ex: `Pessoal`. |
| `tags` | TEXT[] | NÃO | Array de tags livres. Campo "Tags" do XLSX. |
| `notes` | TEXT | NÃO | Observações do usuário. |
| `created_at` | TIMESTAMPTZ | SIM | Timestamp do import. |
| `updated_at` | TIMESTAMPTZ | SIM | Timestamp da última modificação (reclassificação). |
| `updated_by` | TEXT | NÃO | Identificador do usuário ou processo que fez a última alteração. |

### Valores de classification_type

| Valor | include_in_operational_result | include_in_cashflow | include_in_budget |
|---|---|---|---|
| `operational_income` | SIM | SIM | SIM |
| `extraordinary_income` | SIM | SIM | NÃO |
| `operational_expense` | SIM | SIM | SIM |
| `debt_cost` | SIM | SIM | SIM |
| `investment` | NÃO | SIM | NÃO |
| `redemption` | NÃO | SIM | NÃO |
| `transfer` | NÃO | SIM (por conta) | NÃO |
| `reimbursement` | SIM | SIM | NÃO |
| `adjustment` | DEPENDE | DEPENDE | NÃO |
| `neutral` | NÃO | NÃO | NÃO |

### Relacionamentos
- `account_id` → `accounts.id`
- `credit_card_id` → `credit_cards.id`
- `category_id` → `categories.id`
- `macro_category_id` → `macro_categories.id`
- `import_batch_id` → `import_batches.id`
- `adjusted_from_id` → `transactions.id` (auto-referência)

### Exemplo de registro
```
id: "txn_a1b2c3"
description: "Açougue São Jorge"
original_description: "ACOUGUE SAO JORGE LTDA"
amount: 165.52
type: "expense"
classification_type: "operational_expense"
transaction_date: 2026-01-15
competence_date: 2026-01-15
payment_date: 2026-02-10
status: "paid"
account_id: "acc_rico"
credit_card_id: "card_rico"
category_id: "cat_acougue"
macro_category_id: "mac_alimentacao"
payment_method: "card"
installment_current: null
installment_total: null
is_recurring: false
include_in_operational_result: true
include_in_cashflow: true
include_in_budget: true
is_internal_transfer: false
import_hash: "sha256:ab12cd..."
origin: "import_xlsx"
```

---

## 2. categories

### Objetivo
Mapeamento de cada categoria granular com seu comportamento financeiro padrão. Fonte de verdade para classificação automática e consolidação.

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | UUID | SIM | |
| `name` | TEXT | SIM | Nome da categoria. Ex: `Restaurantes` |
| `macro_category_id` | UUID | SIM | FK → macro_categories |
| `classification_type` | ENUM | SIM | Tipo padrão para lançamentos nesta categoria (ver tabela de classification_type) |
| `default_include_in_operational_result` | BOOLEAN | SIM | Padrão derivado de classification_type |
| `default_include_in_cashflow` | BOOLEAN | SIM | |
| `default_include_in_budget` | BOOLEAN | SIM | |
| `is_internal_transfer_default` | BOOLEAN | SIM | Se true, lançamentos nesta categoria são tratados como transferência por padrão |
| `color` | TEXT | NÃO | Hex color para UI. Ex: `#E74C3C` |
| `icon` | TEXT | NÃO | Nome do ícone (ex: `shopping-cart`, `utensils`) |
| `sort_order` | SMALLINT | NÃO | Ordem de exibição dentro da macro-categoria |
| `active` | BOOLEAN | SIM | Soft delete. |
| `created_at` | TIMESTAMPTZ | SIM | |
| `updated_at` | TIMESTAMPTZ | SIM | |

### Exemplo de registros (seed)

```
{ name: "Restaurantes",       macro: "Alimentação",  classification_type: "operational_expense", in_budget: true  }
{ name: "Padaria / Delivery", macro: "Alimentação",  classification_type: "operational_expense", in_budget: true  }
{ name: "Açougue",            macro: "Alimentação",  classification_type: "operational_expense", in_budget: true  }
{ name: "Salário",            macro: "Receita Op.",  classification_type: "operational_income",  in_budget: true  }
{ name: "Pagamento FIT",      macro: "Receita Op.",  classification_type: "operational_income",  in_budget: true  }
{ name: "Resgate",            macro: "Mov. Fin.",    classification_type: "redemption",          in_budget: false }
{ name: "Aporte",             macro: "Mov. Fin.",    classification_type: "investment",          in_budget: false }
{ name: "Dívidas",            macro: "Dívida",       classification_type: "debt_cost",           in_budget: true  }
```

---

## 3. macro_categories

### Objetivo
Agrupamento de categorias para visão consolidada no dashboard e no orçamento. Hierarquia de dois níveis: macro_category → categories.

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | UUID | SIM | |
| `name` | TEXT | SIM | Ex: `Alimentação`, `Transporte`, `Receitas Operacionais` |
| `classification_type` | ENUM | SIM | Tipo dominante. Herdam as categorias filhas se não especificado. |
| `display_in_result` | BOOLEAN | SIM | Aparece no resultado operacional? |
| `display_in_cashflow` | BOOLEAN | SIM | |
| `display_in_budget` | BOOLEAN | SIM | |
| `color` | TEXT | NÃO | Cor do grupo no dashboard |
| `icon` | TEXT | NÃO | |
| `sort_order` | SMALLINT | NÃO | |
| `active` | BOOLEAN | SIM | |
| `created_at` | TIMESTAMPTZ | SIM | |

### Macro-categorias seed (baseadas nos dados reais)

```
Receitas Operacionais    — operational_income    — display_in_result: true
Receitas Eventuais       — extraordinary_income  — display_in_result: true
Movimentação Financeira  — redemption/investment — display_in_result: false
Alimentação              — operational_expense   — display_in_result: true
Casa                     — operational_expense   — display_in_result: true
Saúde                    — operational_expense   — display_in_result: true
Transporte               — operational_expense   — display_in_result: true
Educação                 — operational_expense   — display_in_result: true
Assinaturas              — operational_expense   — display_in_result: true
Compras                  — operational_expense   — display_in_result: true
Serviços                 — operational_expense   — display_in_result: true
Seguros                  — operational_expense   — display_in_result: true
Cuidados Pessoais        — operational_expense   — display_in_result: true
Pets                     — operational_expense   — display_in_result: true
Lazer                    — operational_expense   — display_in_result: true
Presentes                — operational_expense   — display_in_result: true
Doações                  — operational_expense   — display_in_result: true
Prestadores de Serviços  — operational_expense   — display_in_result: true
Impostos e Taxas         — operational_expense   — display_in_result: true
Dívida                   — debt_cost             — display_in_result: true
```

---

## 4. accounts

### Objetivo
Cada conta bancária ou carteira da família. Referência para fluxo de caixa e rastreamento de saldo.

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | UUID | SIM | |
| `name` | TEXT | SIM | Nome exato como aparece no XLSX. Ex: `itau`, `RICO`, `Santander` |
| `display_name` | TEXT | NÃO | Nome legível. Ex: `Itaú Corrente`, `Rico Investimentos` |
| `type` | ENUM | SIM | `checking` / `savings` / `investment` / `digital_wallet` |
| `owner` | TEXT | NÃO | Titular. Ex: `Fabio`, `Jana` |
| `is_family_account` | BOOLEAN | SIM | True = pertence à família. Transferências entre contas family = neutro. |
| `initial_balance` | DECIMAL(12,2) | NÃO | Saldo inicial para cálculo de saldo atual (fase 2). |
| `currency` | TEXT | SIM | `BRL` padrão. |
| `active` | BOOLEAN | SIM | |
| `created_at` | TIMESTAMPTZ | SIM | |

### Seed baseado nos dados reais

```
{ name: "itau",          display_name: "Itaú Corrente",         type: "checking",       owner: "Fabio",   is_family: true }
{ name: "Santander",     display_name: "Santander Corrente",    type: "checking",       owner: "Fabio",   is_family: true }
{ name: "Banco Bradesco",display_name: "Bradesco Corrente",     type: "checking",       owner: "Fabio",   is_family: true }
{ name: "Rico - Conta Corrente", display_name: "Rico CC",       type: "investment",     owner: "Fabio",   is_family: true }
{ name: "MERCADO PAGO - ABFJAL211623", display_name: "Mercado Pago", type: "digital_wallet", is_family: true }
```

---

## 5. credit_cards

### Objetivo
Cada cartão de crédito da família. Separado de accounts porque cartão tem ciclo de fatura, limite e data de vencimento próprios.

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | UUID | SIM | |
| `name` | TEXT | SIM | Nome exato como aparece no XLSX. Ex: `RICO`, `INTER PRIME`, `NU - JANA` |
| `display_name` | TEXT | NÃO | Nome legível. |
| `bank` | TEXT | NÃO | Banco emissor. |
| `owner` | TEXT | NÃO | Titular. Ex: `Fabio`, `Jana` |
| `closing_day` | SMALLINT | NÃO | Dia de fechamento da fatura (1–31). |
| `due_day` | SMALLINT | NÃO | Dia de vencimento da fatura (1–31). |
| `credit_limit` | DECIMAL(12,2) | NÃO | Limite do cartão. |
| `payment_account_id` | UUID | NÃO | FK → accounts. Conta que paga a fatura. |
| `is_family_card` | BOOLEAN | SIM | |
| `active` | BOOLEAN | SIM | |
| `created_at` | TIMESTAMPTZ | SIM | |

### Seed baseado nos dados reais

```
{ name: "RICO",        owner: "Fabio", is_family: true, pending_balance: 6742.22 }
{ name: "INTER PRIME", owner: "Fabio", is_family: true, pending_balance: 2229.81 }
{ name: "NU - JANA",   owner: "Jana",  is_family: true, pending_balance: 208.04  }
{ name: "Sam's Club",  owner: "Fabio", is_family: true, pending_balance: 6506.66 }
{ name: "BTG BLACK",   owner: "Fabio", is_family: true }
{ name: "SANTANDER FREE", owner: "Fabio", is_family: true }
```

---

## 6. budgets

### Objetivo
Valor orçado por categoria/macro-categoria por mês. Permite cálculo de desvio planejado vs realizado.

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | UUID | SIM | |
| `reference_month` | DATE | SIM | Primeiro dia do mês de referência. Ex: `2026-01-01` para jan/2026. |
| `category_id` | UUID | NÃO | FK → categories. Null se orçamento é por macro. |
| `macro_category_id` | UUID | NÃO | FK → macro_categories. Null se orçamento é por categoria. |
| `planned_amount` | DECIMAL(12,2) | SIM | Valor orçado. |
| `notes` | TEXT | NÃO | Observação sobre o orçamento daquele mês. |
| `created_at` | TIMESTAMPTZ | SIM | |
| `updated_at` | TIMESTAMPTZ | SIM | |

**Regra:** Um budget é definido para `category_id` OU `macro_category_id`, nunca os dois ao mesmo tempo. CHECK constraint necessário.

**Cálculo de desvio:**
```
realizado = SUM(transactions.amount)
  WHERE competence_date IN mês
    AND category_id = budget.category_id
    AND include_in_budget = true
    AND status != 'cancelled'

desvio_rs  = realizado - planned_amount
desvio_pct = (realizado - planned_amount) / planned_amount * 100
```

---

## 7. monthly_snapshots

### Objetivo
Cache calculado dos totais mensais por categoria. Evita recalcular 855+ transações toda vez que o dashboard abre. Invalidado automaticamente quando nova transação do mês é adicionada ou reclassificada.

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | UUID | SIM | |
| `reference_month` | DATE | SIM | Primeiro dia do mês. |
| `macro_category_id` | UUID | SIM | FK → macro_categories. |
| `category_id` | UUID | NÃO | FK → categories. Null = snapshot de macro. |
| `total_paid` | DECIMAL(12,2) | SIM | Soma de lançamentos `status = paid`. |
| `total_pending` | DECIMAL(12,2) | SIM | Soma de lançamentos `status = pending`. |
| `total_realized` | DECIMAL(12,2) | SIM | `total_paid + total_pending`. |
| `transaction_count` | INT | SIM | Número de lançamentos no período. |
| `operational_result` | DECIMAL(12,2) | NÃO | Só preenchido no snapshot da macro "Resultado". |
| `planned_amount` | DECIMAL(12,2) | NÃO | Copiado de budgets para facilitar comparação. |
| `is_stale` | BOOLEAN | SIM | True = precisa recalcular. Setado quando transação do mês muda. |
| `calculated_at` | TIMESTAMPTZ | SIM | Quando foi calculado. |

### O que vai aqui vs o que é tempo real

**Snapshot (calculado 1x por mês ou quando invalidado):**
- Total por categoria/mês
- Resultado operacional do mês
- Desvio orçado vs realizado
- Comparativo com média dos 3 meses anteriores

**Tempo real (calculado na query, sem snapshot):**
- Saldo atual de cada conta
- Total pendente de cada cartão
- Lançamentos sem categoria (fila de revisão)
- Alertas de tendência do mês em curso

---

## 8. classification_rules

### Objetivo
Regras automáticas para classificar lançamentos novos no import. Evita classificação manual de 90% dos lançamentos recorrentes.

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | UUID | SIM | |
| `pattern` | TEXT | SIM | Texto a buscar. Ex: `CREDITO DE SALARIO` ou `ACOUGUE` |
| `match_type` | ENUM | SIM | `contains` / `starts_with` / `ends_with` / `exact` / `regex` |
| `case_sensitive` | BOOLEAN | SIM | Padrão: `false` |
| `field_to_match` | ENUM | SIM | `original_description` / `amount` / `account_name` |
| `target_category_id` | UUID | NÃO | FK → categories. |
| `target_macro_category_id` | UUID | NÃO | FK → macro_categories. Derivado se category preenchida. |
| `classification_type` | ENUM | SIM | Tipo financeiro a aplicar. |
| `is_internal_transfer` | BOOLEAN | SIM | Se true, marca lançamento como transferência interna. |
| `confidence` | DECIMAL(3,2) | SIM | 0.00–1.00. Regras manuais = 1.0. ML futuro = variável. |
| `priority` | SMALLINT | SIM | Menor número = maior prioridade quando múltiplas regras batem. |
| `active` | BOOLEAN | SIM | |
| `created_by` | TEXT | NÃO | `system_seed` / `user_manual` / `ml_model` |
| `match_count` | INT | SIM | Quantas vezes esta regra aplicou. Útil para auditoria e ML. |
| `created_at` | TIMESTAMPTZ | SIM | |
| `updated_at` | TIMESTAMPTZ | SIM | |

### Exemplos de regras seed (dos dados reais)

```
{ pattern: "CREDITO DE SALARIO",           match: contains, category: "Salário",              type: operational_income,  confidence: 1.0, priority: 1 }
{ pattern: "PIX TRANSF  GUILHER",          match: starts_with, category: "Pagamento FIT",     type: operational_income,  confidence: 1.0, priority: 1 }
{ pattern: "JUROS LIMITE DA CONTA",        match: contains, category: "Dívidas",               type: debt_cost,           confidence: 1.0, priority: 1 }
{ pattern: "PIX TRANSF  DARLY B",          match: starts_with, is_internal_transfer: true,     type: transfer,            confidence: 1.0, priority: 1 }
{ pattern: "PIX TRANSF  JANAINA",          match: starts_with, is_internal_transfer: true,     type: transfer,            confidence: 0.8, priority: 2 }
{ pattern: "REMUNERACAO APLICACAO",        match: contains, category: "Neutro",                type: neutral,             confidence: 1.0, priority: 1 }
{ pattern: "TED 104.0000CAIXA ECON F",    match: contains, category: "Resgate",               type: redemption,          confidence: 0.9, priority: 1 }
{ pattern: "APLICACAO PREVIDENCIA",        match: contains, category: "Aporte",                type: investment,          confidence: 1.0, priority: 1 }
{ pattern: "SPOTIFY",                      match: contains, category: "Spotify",               type: operational_expense, confidence: 1.0, priority: 1 }
{ pattern: "BRASIL PARAL",                match: contains, category: "Brasil Paralelo",        type: operational_expense, confidence: 1.0, priority: 1 }
{ pattern: "NOTA FISCAL PAULISTA",        match: contains, category: "Outras Receitas",        type: extraordinary_income, confidence: 1.0, priority: 1 }
```

---

## 9. import_batches

### Objetivo
Rastrear cada importação de arquivo. Permite desfazer import completo, auditar origem e detectar reimportações.

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | UUID | SIM | |
| `filename` | TEXT | SIM | Nome do arquivo. Ex: `lancamentos_Pessoal_2026-01-01_2026-05-31.xlsx` |
| `file_hash` | TEXT | SIM | SHA256 do arquivo completo. Impede reimportação acidental. |
| `source_type` | ENUM | SIM | `xlsx` / `csv` / `api_open_finance` / `api_banco` |
| `period_start` | DATE | NÃO | Período coberto pelo arquivo (início). |
| `period_end` | DATE | NÃO | Período coberto pelo arquivo (fim). |
| `total_rows_in_file` | INT | SIM | Total de linhas no arquivo original. |
| `rows_imported` | INT | SIM | Linhas efetivamente inseridas. |
| `rows_skipped_duplicate` | INT | SIM | Linhas ignoradas por duplicata. |
| `rows_skipped_invalid` | INT | SIM | Linhas ignoradas por dado inválido. |
| `rows_pending_review` | INT | SIM | Linhas importadas sem categoria (fila de revisão). |
| `status` | ENUM | SIM | `completed` / `partial` / `failed` / `rolled_back` |
| `imported_by` | TEXT | NÃO | Usuário ou processo. |
| `notes` | TEXT | NÃO | |
| `created_at` | TIMESTAMPTZ | SIM | |

---

## 10. users

### Objetivo
Controle de acesso e auditoria. Fase 1: campo informativo. Fase 2 (Supabase): autenticação real.

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | UUID | SIM | |
| `name` | TEXT | SIM | Nome do membro da família. |
| `email` | TEXT | NÃO | Para autenticação futura. |
| `role` | ENUM | NÃO | `admin` / `viewer`. Fase 2. |
| `active` | BOOLEAN | SIM | |
| `created_at` | TIMESTAMPTZ | SIM | |

**Fase 1:** único usuário implícito, sem autenticação. Campo `updated_by` nas transações recebe string literal `"user"`.

**Fase 2 (Supabase):** substituir por Supabase Auth. `users.id` = `auth.users.id`. Row Level Security por família.

---

## 11. Deduplicação de lançamentos importados

### Estratégia: hash-first

Antes de cada insert, calcular:
```
import_hash = SHA256(
  original_description
  + "|" + amount (2 casas decimais, string)
  + "|" + transaction_date (YYYY-MM-DD)
  + "|" + account_name
)
```

Se `import_hash` já existe em `transactions`: descartar silenciosamente, incrementar `rows_skipped_duplicate` no `import_batch`.

### Casos especiais

**Mesmo lançamento em dois arquivos sobrepostos:**
- Exemplo: `lancamentos_2026-01-01_2026-05-31.xlsx` e `lancamentos_2026-01-01_2026-12-31.xlsx` têm os mesmos lançamentos de jan–mai.
- Hash resolve: segundo import descarta duplicatas automaticamente.

**Parcelas com mesmo valor e mesma data:**
- Possível colisão de hash se duas parcelas de valores iguais caem na mesma data.
- Desambiguar adicionando `installment_current + installment_total` ao hash quando presentes.
- Hash parcelado: `SHA256(desc + amount + date + account + installment_current + "/" + installment_total)`

**Lançamento manual vs importado:**
- Lançamento manual cria hash diferente (`origin = manual_entry`, sem `source_file`).
- Na reimportação, se lançamento manual existir com hash diferente mas mesmos dados: não duplicar. Verificar com fallback: `original_description + amount + transaction_date + account` (sem hash).

---

## 12. Preservar dados originais + rastreabilidade

### Modelo de imutabilidade

Três estados possíveis para um lançamento:

```
ATIVO          — lançamento original, em uso normal
SUBSTITUÍDO    — lançamento original que teve ajuste. Não exibido no resultado, mantido para auditoria.
AJUSTE         — novo lançamento criado para corrigir um SUBSTITUÍDO
```

### Campos que podem ser editados pelo usuário (geram SUBSTITUÍDO + AJUSTE)
- `description` (nome legível)
- `category_id`
- `macro_category_id`
- `classification_type`
- `competence_date`
- `is_internal_transfer`
- `include_in_operational_result` (override manual)
- `include_in_cashflow` (override manual)
- `include_in_budget` (override manual)
- `notes`
- `tags`

### Campos NUNCA editáveis após import
- `original_description`
- `amount`
- `transaction_date`
- `account_id`
- `import_hash`
- `source_file`
- `import_batch_id`
- `origin` (quando `import_xlsx` ou `import_api`)

### Auditoria de reclassificação

Toda reclassificação registra no próprio lançamento:
```
updated_at: timestamp da mudança
updated_by: identificação do usuário
```

Para auditoria completa (fase 2), considerar tabela `transaction_audit_log`:
```
{ transaction_id, field_changed, old_value, new_value, changed_by, changed_at }
```

Fase 1: sem audit log separado. Rastreabilidade pelo par `adjusted_from_id` + `adjustment_reason`.

---

## 13. Calculado em tempo real vs snapshot mensal

### Calcular em tempo real (sem cache)

| Métrica | Por quê tempo real |
|---|---|
| Saldo atual por conta | Muda com cada novo import/lançamento |
| Total pendente por cartão | Dado operacional crítico, sempre atual |
| Lançamentos sem categoria | Fila de ação — deve ser imediato |
| Contagem de alertas ativos | Contextual, muda com cada classificação |
| Resultado do mês em curso | Mês aberto, dados mudam frequentemente |

### Calcular como snapshot (invalidado em mudanças)

| Métrica | Frequência de cálculo |
|---|---|
| Total por categoria/mês (meses fechados) | 1x por mês quando mês fecha |
| Resultado operacional de meses passados | Recalcula só se reclassificação afeta o mês |
| Desvio orçado vs realizado (meses fechados) | 1x no fechamento |
| Comparativo mês a mês (últimos 6 meses) | Diário ou ao abrir dashboard |
| Médias históricas por categoria (3M, 6M, 12M) | Semanal ou on-demand |

### Regra de invalidação do snapshot

`monthly_snapshots.is_stale = true` quando:
- Nova transação importada com `competence_date` no mês do snapshot
- Reclassificação altera `classification_type`, `category_id`, `include_in_*` ou `competence_date` de transação do mês
- Budget do mês é alterado (invalida desvio calculado)

Snapshot recalculado na próxima abertura do dashboard ou via job assíncrono.

---

## 14. Campos derivados vs armazenados

### Derivados (calcular na query, não armazenar em transactions)
- `competence_month` = `DATE_TRUNC('month', competence_date)` — usar índice em `competence_date`
- `is_installment` = `installment_total IS NOT NULL AND installment_total > 1`
- `desvio_rs` e `desvio_pct` = calculados de `budgets + transactions`

### Armazenados (redundância proposital para performance)
- `macro_category_id` em `transactions` — derivável de `category.macro_category_id` mas armazenado para evitar join triplo em queries de dashboard
- `include_in_operational_result`, `include_in_cashflow`, `include_in_budget` — deriváveis de `classification_type` mas armazenados porque usuário pode sobrescrever individualmente

---

*Versão 1.0 — 2026-06-10*
*Pronto para fase 1 (local/XLSX). Compatível com migração Supabase sem mudança estrutural.*
