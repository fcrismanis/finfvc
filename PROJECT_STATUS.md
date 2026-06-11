# PROJECT STATUS — FINANCE
> Atualizado: 2026-06-11 | Branch: `feature/supabase-foundation`

---

## Estado atual

O projeto está na **Fase 1 concluída** com a fundação da Fase 2 (Supabase) pronta para ser ativada.

---

## Branch e commits recentes

```
Branch atual: feature/supabase-foundation
Pendente de merge → main

91bad31 chore: add deployment and environment setup docs
138e4f8 style: standardize finance front design system
762613a feat: add data provider configuration
52356a9 fix: tighten RLS policies after security review
856c43f feat: add supabase foundation
7b5b2ef feat: dashboard layout reorder + wire props (step 5B/5)
5947af5 feat: alerts panel redesign — severity rows (step 5A/5)
```

---

## O que está pronto

### Frontend (Fase 1 completa)
- [x] Dashboard redesenhado (Direction A — Confiança, azul #1D5FE0)
- [x] KPI hero cards com sparkline (Entrou / Saiu / Sobrou)
- [x] Donut CSS conic-gradient para categorias de despesa
- [x] Budget Comparison — desvio ranqueado por criticidade
- [x] Alerts Panel — severidade crítica/atenção/distorção/info
- [x] Monthly Trend Chart
- [x] Top Expenses
- [x] Sidebar branca com navegação hierárquica
- [x] Header com seletor de mês e toggle de visualização
- [x] Tela de Lançamentos com filtros, sort, paginação e edição inline
- [x] Tela de Revisão Financeira (pontos de atenção)
- [x] Orçamento — planejado × realizado com edição inline
- [x] Fechamento mensal — checklist, resumo, aprendizados, locking
- [x] Importação XLSX/CSV
- [x] Design system: tokens CSS, utility classes, LoadingState, EmptyState

### Data layer
- [x] LocalAdapter (localStorage)
- [x] IDataProvider interface (async)
- [x] LocalDataProvider (wraps services existentes)
- [x] SupabaseDataProvider (stub — pronto para auth)
- [x] adapter.factory.ts com toggle via VITE_DATA_PROVIDER
- [x] DataContext async com loading/error states

### Supabase foundation
- [x] `supabase/migrations/0001_initial_schema.sql` — 11 tabelas, 5 enums, 12 índices, RLS completo
- [x] `supabase/migrations/0002_seed_categories.sql` — 20 macro_cats, 26 cats, 14 regras
- [x] Projeto Supabase: `ycskqocrvjdwozqnsots`
- [x] RLS revisado e corrigido (4 gaps identificados e corrigidos)

### Infraestrutura
- [x] Git remoto configurado: `https://github.com/fcrismanis/finfvc.git`
- [x] `.gitignore` protegendo dados financeiros, env files, secrets
- [x] `.env.local` criado localmente (NÃO commitado)
- [x] `SETUP_SUPABASE.md` — instruções de configuração
- [x] `SETUP_HOSTINGER.md` — instruções de deploy para `fin.fjcrivo.com`
- [x] `public/.htaccess` — SPA fallback para Apache

---

## O que ainda falta

### Fase 2 — Autenticação e dados reais
- [ ] Login / signup (Supabase Auth)
- [ ] Criação de família + adicionar membros
- [ ] Troca de LocalProvider → SupabaseProvider após login
- [ ] Migrar dados históricos das planilhas para Supabase (opcional)
- [ ] Import flow apontando para SupabaseProvider (hoje usa localAdapter direto)
- [ ] Budget e Closing via Supabase (stubs prontos, implementação pendente)

### Fase 2 — Features
- [ ] Metas financeiras
- [ ] Simulações
- [ ] Consultor IA
- [ ] Configurações (contas, categorias customizadas)

### Deploy
- [ ] Subdomínio `fin.fjcrivo.com` criado no hPanel
- [ ] Primeiro deploy realizado
- [ ] SSL ativo
- [ ] Migrations aplicadas no Supabase

---

## Como rodar localmente

```bash
# Pré-requisitos: Node 18+, npm

cd finance-app
npm install
npm run dev
# App em http://localhost:5173

# Build de produção:
npm run build
# Output em finance-app/dist/
```

---

## Como configurar Supabase

Ver `SETUP_SUPABASE.md` para instruções completas.

Resumo:
```bash
# 1. Linkar projeto
supabase link --project-ref ycskqocrvjdwozqnsots

# 2. Aplicar migrations
supabase db push

# 3. Ativar no app
# finance-app/.env.local:
VITE_DATA_PROVIDER=supabase
```

---

## Como fazer deploy para Hostinger

Ver `SETUP_HOSTINGER.md` para instruções completas.

Resumo:
```bash
cd finance-app
npm run build
# Upload de dist/ para public_html/fin/ no servidor
```

---

## Riscos conhecidos

| Risco | Impacto | Mitigação |
|---|---|---|
| Auth não implementado | Supabase inacessível sem login | VITE_DATA_PROVIDER=local por padrão |
| Import ainda usa localAdapter direto | Imports não chegam ao Supabase | Aceito para Fase 1 |
| Bundle >500KB | Carregamento inicial mais lento | Code splitting futuro (Fase 2) |
| family_members INSERT não tem trigger auto | Owner precisa ser inserido manualmente na família | SECURITY DEFINER function na Fase 2 |

---

## Próximos 3 passos recomendados

1. **Merge `feature/supabase-foundation` → `main`** e push para GitHub
2. **Deploy inicial para `fin.fjcrivo.com`** (com VITE_DATA_PROVIDER=local — sem Supabase ainda)
3. **Aplicar migrations no Supabase** e testar tabelas no SQL editor
