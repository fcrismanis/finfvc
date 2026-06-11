# SUPABASE_PLAN.md — Integração FINANCE × Supabase

## 1. Visão geral

Migração em duas fases:
- **Fase A:** Supabase como banco remoto; app continua com adaptador local como fallback.
- **Fase B:** Supabase como fonte de verdade; localStorage apenas como cache offline.

O código React não muda entre fases — só o adapter trocado em `src/adapters/`.

---

## 2. SQL Schema

### 2.1 Tabela `families`
Unidade de isolamento. Cada família é um tenant independente.

```sql
CREATE TABLE families (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.2 Tabela `family_members`
Relaciona usuários (auth.users) a uma família com papel (role).

```sql
CREATE TYPE family_role AS ENUM ('owner', 'admin', 'viewer');

CREATE TABLE family_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         family_role NOT NULL DEFAULT 'viewer',
  display_name TEXT,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);
```

### 2.3 Tabela `accounts`
Contas bancárias e carteiras da família.

```sql
CREATE TYPE account_type AS ENUM ('checking', 'savings', 'investment', 'digital_wallet');

CREATE TABLE accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  type            account_type NOT NULL DEFAULT 'checking',
  owner           TEXT,
  is_family_account BOOLEAN NOT NULL DEFAULT true,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.4 Tabela `macro_categories`
Seed gerenciado pela aplicação. Uma linha por família permite customização futura.

```sql
CREATE TABLE macro_categories (
  id                      TEXT PRIMARY KEY,  -- 'mac_alimentacao', etc.
  family_id               UUID REFERENCES families(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  classification_type     TEXT NOT NULL,
  display_in_result       BOOLEAN NOT NULL DEFAULT true,
  display_in_cashflow     BOOLEAN NOT NULL DEFAULT true,
  display_in_budget       BOOLEAN NOT NULL DEFAULT true,
  color                   TEXT NOT NULL,
  icon                    TEXT NOT NULL,
  sort_order              INT NOT NULL DEFAULT 99,
  is_system               BOOLEAN NOT NULL DEFAULT false
);
-- NULL family_id = registro global de sistema (seed). Família pode sobrescrever por id.
```

### 2.5 Tabela `categories`

```sql
CREATE TABLE categories (
  id                              TEXT PRIMARY KEY,
  family_id                       UUID REFERENCES families(id) ON DELETE CASCADE,
  macro_category_id               TEXT NOT NULL REFERENCES macro_categories(id),
  name                            TEXT NOT NULL,
  classification_type             TEXT NOT NULL,
  default_include_in_operational  BOOLEAN NOT NULL DEFAULT true,
  default_include_in_cashflow     BOOLEAN NOT NULL DEFAULT true,
  default_include_in_budget       BOOLEAN NOT NULL DEFAULT true,
  is_internal_transfer_default    BOOLEAN NOT NULL DEFAULT false,
  color                           TEXT,
  icon                            TEXT,
  sort_order                      INT NOT NULL DEFAULT 99,
  active                          BOOLEAN NOT NULL DEFAULT true
);
```

### 2.6 Tabela `transactions`
Núcleo do sistema. Imutável por design — edições geram ajuste separado.

```sql
CREATE TYPE transaction_type   AS ENUM ('income', 'expense');
CREATE TYPE transaction_status AS ENUM ('paid', 'pending', 'cancelled');
CREATE TYPE payment_method     AS ENUM ('card', 'account', 'pix', 'cash', 'boleto', 'debit');
CREATE TYPE transaction_origin AS ENUM ('import_xlsx', 'import_api', 'manual_entry', 'manual_adjustment');
CREATE TYPE classification_type AS ENUM (
  'operational_income', 'extraordinary_income',
  'operational_expense', 'debt_cost',
  'investment', 'redemption', 'transfer',
  'reimbursement', 'adjustment', 'neutral'
);

CREATE TABLE transactions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id                   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  account_id                  UUID REFERENCES accounts(id),
  category_id                 TEXT REFERENCES categories(id),
  macro_category_id           TEXT REFERENCES macro_categories(id),

  description                 TEXT NOT NULL,
  original_description        TEXT NOT NULL,
  amount                      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  type                        transaction_type NOT NULL,
  classification_type         classification_type NOT NULL,

  transaction_date            DATE NOT NULL,
  competence_date             DATE NOT NULL,
  payment_date                DATE,
  status                      transaction_status NOT NULL DEFAULT 'paid',

  payment_method              payment_method NOT NULL DEFAULT 'account',
  installment_current         SMALLINT,
  installment_total           SMALLINT,
  is_recurring                BOOLEAN NOT NULL DEFAULT false,

  include_in_operational_result BOOLEAN NOT NULL DEFAULT true,
  include_in_cashflow           BOOLEAN NOT NULL DEFAULT true,
  include_in_budget             BOOLEAN NOT NULL DEFAULT true,
  is_internal_transfer          BOOLEAN NOT NULL DEFAULT false,
  is_adjustment                 BOOLEAN NOT NULL DEFAULT false,
  adjusted_from_id              UUID REFERENCES transactions(id),
  adjustment_reason             TEXT,

  source_file                 TEXT,
  import_batch_id             TEXT,
  import_hash                 TEXT,   -- deduplication key
  origin                      transaction_origin NOT NULL DEFAULT 'manual_entry',

  tags                        TEXT[],
  notes                       TEXT,
  group_name                  TEXT,

  created_by                  UUID REFERENCES auth.users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_transactions_family_competence ON transactions (family_id, competence_date);
CREATE INDEX idx_transactions_family_status     ON transactions (family_id, status);
CREATE INDEX idx_transactions_import_hash       ON transactions (family_id, import_hash) WHERE import_hash IS NOT NULL;
CREATE INDEX idx_transactions_batch             ON transactions (import_batch_id)         WHERE import_batch_id IS NOT NULL;
```

### 2.7 Tabela `budgets`

```sql
CREATE TABLE budgets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id         UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  reference_month   TEXT NOT NULL,          -- 'YYYY-MM'
  macro_category_id TEXT REFERENCES macro_categories(id),
  category_id       TEXT REFERENCES categories(id),
  planned_amount    NUMERIC(12,2) NOT NULL CHECK (planned_amount >= 0),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, reference_month, macro_category_id, category_id)
);
```

### 2.8 Tabela `import_batches`
Rastreia cada importação para permitir rollback.

```sql
CREATE TABLE import_batches (
  id            TEXT PRIMARY KEY,             -- batch_xyz123
  family_id     UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  source_file   TEXT NOT NULL,
  imported_by   UUID REFERENCES auth.users(id),
  total_rows    INT NOT NULL DEFAULT 0,
  accepted_rows INT NOT NULL DEFAULT 0,
  skipped_rows  INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'completed',
  imported_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3. Relacionamentos

```
families
  └── family_members (N usuários por família, 1 usuário em 1 família no MVP)
  └── accounts
  └── macro_categories (override por família)
  └── categories
  └── transactions
        └── accounts
        └── categories
        └── macro_categories
        └── transactions (self-ref: adjusted_from_id)
  └── budgets
  └── import_batches
```

**Regra crítica:** `family_id` presente em todas as tabelas de dados. Todo SELECT e INSERT faz JOIN implícito com `family_id` via RLS — aplicação nunca precisa filtrar manualmente por família.

---

## 4. Row Level Security (RLS)

### Princípio
Cada usuário só acessa dados da própria família. Verificação no banco, não no app.

### Helper function

```sql
CREATE OR REPLACE FUNCTION current_family_id() RETURNS UUID
  LANGUAGE sql STABLE
  AS $$
    SELECT family_id FROM family_members
    WHERE user_id = auth.uid()
    LIMIT 1;
  $$;
```

### Policies — transactions (padrão para todas as tabelas de dados)

```sql
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer membro da família
CREATE POLICY "family members can read transactions"
  ON transactions FOR SELECT
  USING (family_id = current_family_id());

-- INSERT: owners e admins
CREATE POLICY "family admins can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (
    family_id = current_family_id()
    AND EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid()
        AND family_id = transactions.family_id
        AND role IN ('owner', 'admin')
    )
  );

-- UPDATE: apenas o criador ou admin (não permitido em produção — usar adjustment)
CREATE POLICY "no direct update"
  ON transactions FOR UPDATE
  USING (false);

-- DELETE: apenas owner (rollback de batch)
CREATE POLICY "owner can delete transactions"
  ON transactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid()
        AND family_id = transactions.family_id
        AND role = 'owner'
    )
  );
```

Aplicar políticas equivalentes em: `accounts`, `budgets`, `import_batches`, `categories`, `macro_categories`.

### Política para family_members

```sql
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- Membro só vê outros membros da mesma família
CREATE POLICY "see own family members"
  ON family_members FOR SELECT
  USING (family_id = current_family_id());

-- Só owner adiciona membros
CREATE POLICY "owner manages members"
  ON family_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.user_id = auth.uid()
        AND fm.family_id = family_members.family_id
        AND fm.role = 'owner'
    )
  );
```

---

## 5. Estratégia de autenticação

### MVP: Magic Link (email)
- Sem senha. Usuário recebe link por e-mail, clica e está dentro.
- Adequado para uso familiar: sem risco de esquecer senha.
- Supabase Auth provê isso nativamente (`supabase.auth.signInWithOtp`).

### Fluxo de convite familiar
1. Owner cria a família (onboarding).
2. Owner gera convite via e-mail → Supabase envia magic link com `redirect_to` apontando para rota `/entrar?familia=<id>`.
3. Novo membro aceita → backend cria linha em `family_members` com `role = 'viewer'`.
4. Owner pode elevar para `admin` depois.

### Sem Google/social login no MVP
Reduz superfície de ataque. Adicionar OAuth depois se necessário.

---

## 6. Estratégia de migração (localStorage → Supabase)

### Passo a passo seguro

**Etapa 1 — Criar adapter Supabase**
```
src/adapters/supabase.adapter.ts
```
Implementa a mesma interface `IDataAdapter` do `local.adapter.ts`.
Nenhum componente ou serviço muda.

**Etapa 2 — Modo dual (sync)**
Criar `src/adapters/sync.adapter.ts`:
- Lê do localStorage (offline-first).
- Escreve em Supabase E localStorage simultaneamente.
- Se Supabase falhar, mantém dado local e agenda retry.

**Etapa 3 — Migração de dados existentes**
```typescript
// migration.service.ts
export async function migrateLocalToSupabase(familyId: string) {
  const local = localAdapter.getTransactions()
  if (local.length === 0) return

  // batch insert respeitando limit do Supabase (1000 rows/req)
  const chunks = chunk(local, 500)
  for (const c of chunks) {
    await supabase.from('transactions').upsert(
      c.map(tx => ({ ...tx, family_id: familyId })),
      { onConflict: 'import_hash' }  // dedup via import_hash
    )
  }
  localAdapter.clearTransactions()
}
```

**Etapa 4 — Cortar para Supabase puro**
Trocar adapter no bootstrap da aplicação:
```typescript
// src/adapters/index.ts
import { supabaseAdapter } from './supabase.adapter'
export const dataAdapter = supabaseAdapter
```

**Etapa 5 — Remover LocalAdapter das dependências de produção**
Manter apenas como fallback offline.

---

## 7. Uso familiar seguro

### Papéis e permissões

| Papel    | Ler dados | Importar / lançar | Reclassificar | Excluir / rollback | Convidar membros |
|----------|-----------|-------------------|---------------|-------------------|-----------------|
| owner    | ✅        | ✅                | ✅            | ✅                | ✅              |
| admin    | ✅        | ✅                | ✅            | ❌                | ❌              |
| viewer   | ✅        | ❌                | ❌            | ❌                | ❌              |

### Regras operacionais
- **Imutabilidade:** transações importadas nunca são editadas. Correção = lançamento de ajuste (`is_adjustment: true`, `adjusted_from_id`).
- **Rastreabilidade:** todo INSERT registra `created_by` (auth.uid()).
- **Rollback de importação:** deletar pelo `import_batch_id` (só owner via RLS).
- **Viewer é seguro para crianças/terceiros:** acesso somente leitura.

---

## 8. Riscos e cuidados com dados financeiros sensíveis

### R1 — Exposição de dados via API key pública
**Risco:** A `anon key` do Supabase é pública no bundle do frontend.
**Mitigação:**
- RLS bem configurado torna a chave inútil sem autenticação.
- Nunca usar `service_role` key no frontend.
- Rotacionar `anon key` se vazar.

### R2 — Leak via import_hash
**Risco:** O hash de deduplicação deriva de descrição + valor + data — não expõe dados diretamente mas é reversível por força bruta em valores pequenos.
**Mitigação:**
- Hash não é publicado em endpoints públicos.
- RLS garante que só membros da família acessam.
- Para dados altamente sensíveis, adicionar salt aleatório por família ao hash.

### R3 — Coluna `description` com dados PII
**Risco:** Nomes de médicos, farmácias, estabelecimentos — informação de saúde implícita.
**Mitigação:**
- Não usar `description` como campo de busca full-text público.
- Em Supabase, usar `pg_crypto` para criptografar `description` no banco se necessário (troca performance por privacidade).
- Política de retenção: definir prazo (ex: 7 anos fiscal) e mecanismo de purge.

### R4 — Sem 2FA no MVP
**Risco:** Magic link interceptado = acesso total.
**Mitigação:**
- Magic links do Supabase expiram em 1h (configurável, reduzir para 15min).
- Habilitar 2FA via TOTP no Supabase Auth antes de usar em produção.
- Alertar usuário se login de IP/device novo.

### R5 — Backup
**Risco:** Supabase free tier não tem backup automático configurável.
**Mitigação:**
- Habilitar Point-in-Time Recovery no plano Pro antes de migrar dados reais.
- Export mensal via `pg_dump` automatizado (GitHub Actions ou cron).
- Manter export XLSX local como backup fora do sistema.

### R6 — Crescimento de volume
**Risco:** 855 transações / 5 meses → ~2.000 / ano → ok para free tier. Mas histórico de 10 anos = ~20.000 rows.
**Mitigação:**
- Índice em `(family_id, competence_date)` cobre 100% dos queries do dashboard.
- Free tier Supabase: 500MB banco, suporta décadas de dados desta aplicação.
- Nenhuma otimização necessária no MVP.

---

## 9. Ordem segura de implementação

```
Sprint 1 — Infraestrutura
  [ ] Criar projeto Supabase
  [ ] Executar migrations (tabelas + índices)
  [ ] Configurar RLS policies
  [ ] Seed de macro_categories e categories (system rows)
  [ ] Testar isolamento de família via SQL direto

Sprint 2 — Auth
  [ ] Implementar magic link no React (supabase-js)
  [ ] Tela de login simples
  [ ] Onboarding: criar família + inserir owner em family_members
  [ ] Fluxo de convite para membros adicionais

Sprint 3 — Adapter Supabase
  [ ] Criar src/adapters/supabase.adapter.ts
  [ ] Implementar IDataAdapter com supabase-js
  [ ] Testar paridade com LocalAdapter (mesmos dados, mesmos resultados no engine)

Sprint 4 — Migração
  [ ] Criar migration.service.ts
  [ ] UI de migração: "Mover dados locais para a nuvem"
  [ ] Confirmar dedup via import_hash
  [ ] Validar resultados do dashboard pós-migração

Sprint 5 — Sync / Offline
  [ ] SyncAdapter com fallback local
  [ ] Indicador de status de sincronização no Header

Sprint 6 — Segurança final
  [ ] Habilitar 2FA / TOTP
  [ ] Configurar expiração de magic link = 15min
  [ ] Habilitar PITR backup
  [ ] Audit log básico via triggers (quem alterou o quê)
```

---

## 10. Variáveis de ambiente necessárias

```bash
# .env.local (nunca comitar)
VITE_SUPABASE_URL=https://xyzxyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# Nunca no frontend:
# SUPABASE_SERVICE_ROLE_KEY — usar apenas em Edge Functions ou scripts de migração
```

Adicionar ao `.gitignore`:
```
.env.local
.env.production
```
