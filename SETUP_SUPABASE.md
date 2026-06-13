# Supabase Setup — FINANCE

## Projeto

- **Dashboard:** https://supabase.com/dashboard/project/ycskqocrvjdwozqnsots
- **Project URL:** `https://ycskqocrvjdwozqnsots.supabase.co`
- **Anon key (frontend-safe):** veja `finance-app/.env.local`

> ⚠️ A **secret key** (`sb_secret_*`) é a service role. NUNCA vai ao frontend ou ao Git.

---

## 1. Variáveis de ambiente

Arquivo: `finance-app/.env.local` (não commitado)

```env
VITE_DATA_PROVIDER=local
VITE_SUPABASE_URL=https://ycskqocrvjdwozqnsots.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Para ativar Supabase no app, mudar para `VITE_DATA_PROVIDER=supabase`.

---

## 2. Aplicar migrations

### Opção A — Supabase CLI (recomendado)

```bash
# Instalar CLI
brew install supabase/tap/supabase

# Linkar projeto
supabase link --project-ref ycskqocrvjdwozqnsots

# Aplicar migrations em ordem
supabase db push
```

`supabase db push` aplica todas as migrations pendentes em ordem:

| Migration | O que faz |
|---|---|
| `0001_initial_schema.sql` | Tabelas + RLS + helpers |
| `0002_seed_categories.sql` | Seed de categorias globais |
| `0003_bootstrap_family_fn.sql` | RPC `create_family_for_user` (SECURITY DEFINER) |
| `0004_add_reimbursement_enum.sql` | Adiciona `reimbursement` ao enum `classification_type` |
| `0005_idempotent_create_family.sql` | Torna a RPC idempotente |

### Opção B — SQL direto no dashboard

1. Abrir https://supabase.com/dashboard/project/ycskqocrvjdwozqnsots/sql/new
2. Executar `0001` … `0005` na ordem.

---

## 3. Verificar tabelas

No SQL Editor do dashboard, testar:

```sql
-- Deve retornar 20 linhas
select id, name from macro_categories order by sort_order;

-- Deve retornar 26 linhas
select id, name, macro_category_id from categories order by sort_order;

-- Deve retornar 14 linhas
select keyword, category_id from classification_rules;
```

---

## 4. Testar RLS

Sem autenticação, queries via anon key devem retornar 0 transações:

```sql
-- Via anon role — deve retornar 0
set role anon;
select count(*) from transactions;
reset role;
```

---

## 5. Auth + família (Fase 2)

Com `VITE_DATA_PROVIDER=supabase`:

1. App mostra **Login** (`src/pages/Login.tsx`) quando não há sessão.
2. Criar conta (`Criar conta`) ou entrar. Por padrão o projeto exige
   **confirmação de e-mail** — ver seção 6.
3. Após login, `AuthContext.resolveFamilyId()`:
   - busca vínculo em `family_members`;
   - se não houver, chama a RPC `create_family_for_user` (cria família + owner).
4. `DataContext` recria o provider com o `familyId` e carrega dados do Supabase.

Validar via SQL (UUIDs mascarados ao reportar):

```sql
select count(*) from families;        -- 1 por família criada
select count(*) from family_members;  -- 1 vínculo por usuário
```

## 6. Confirmação de e-mail

Por padrão o Supabase Auth exige confirmação. Para o fluxo de produção,
decidir entre: manter confirmação por e-mail, usar magic link, ou desabilitar
em **Authentication → Providers → Email → Confirm email**. Em testes, é
possível confirmar manualmente via SQL (apenas em ambiente de teste):

```sql
update auth.users set email_confirmed_at = now()
where email = 'seu+teste@exemplo.com';
```

## 7. Migração Local → Supabase

Com dados em localStorage e logado no modo Supabase, um banner "Dados locais
detectados" leva à rota `/migrar` (`src/pages/MigrationPage.tsx`):
prévia → confirmação → `appendTransactions` (upsert por `import_hash`,
deduplicado). Reexecutar é seguro (não duplica). localStorage **não** é apagado.

## 8. Budget / Closing

Ambos persistem via `IDataProvider` (sem acesso direto ao Supabase nas páginas):
- Budget → `budgets` (id uuid no DB; match por chave natural família+macro+categoria+mês).
- Closing → `monthly_closings` (`reopenedAt` empacotado em `checklist._reopenedAt` jsonb).

## 9. Produção continua em LOCAL

A produção em https://fin.fjcrivo.com **deve permanecer** com
`VITE_DATA_PROVIDER=local` até o checklist beta (FASE2_BETA_CHECKLIST.md)
estar 100% concluído. Não ativar Supabase em produção sem aprovação.

---

## Segurança

| Item | Status |
|---|---|
| RLS em todas as tabelas | ✅ |
| Anon key no frontend (nunca service role) | ✅ |
| `service_role`/`sb_secret` ausente em `finance-app/src` | ✅ |
| `.env.local` no .gitignore | ✅ |
| Funções SECURITY DEFINER com search_path | ✅ |
| Dados financeiros reais fora do Git | ✅ |

> ⚠️ A **secret key** (`sb_secret_*` / service role) NUNCA entra no frontend,
> no Git, ou em qualquer arquivo de `finance-app/src`. O app usa apenas
> `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
