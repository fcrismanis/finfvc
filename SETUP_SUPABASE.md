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

### Opção B — SQL direto no dashboard

1. Abrir https://supabase.com/dashboard/project/ycskqocrvjdwozqnsots/sql/new
2. Colar e executar `supabase/migrations/0001_initial_schema.sql`
3. Colar e executar `supabase/migrations/0002_seed_categories.sql`

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

## 5. Criar primeiro usuário / família

Auth não está implementado no app ainda (Fase 2). Por enquanto, usar `VITE_DATA_PROVIDER=local`.

---

## Segurança

| Item | Status |
|---|---|
| RLS em todas as tabelas | ✅ |
| Anon key no frontend (nunca service role) | ✅ |
| `.env.local` no .gitignore | ✅ |
| Funções SECURITY DEFINER com search_path | ✅ |
| Dados financeiros reais fora do Git | ✅ |
