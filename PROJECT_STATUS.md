# PROJECT STATUS — FINANCE
> Atualizado: 2026-06-15 | Branch: `feature/fin-functional-upgrades`

---

## Estado atual

O projeto está na **Fase 3 concluída** — produto utilizável e confiável, com qualidade de dados, fluxo de revisão completo e ledger avançado. A fundação da Fase 2 (Supabase) está pronta mas não ativada em produção.

---

## Branch e commits recentes

```
Branch atual: feature/fin-functional-upgrades
Pendente de merge → main (após QA da Fase 3)

23487c3 feat(transactions): improve ledger filters and inline workflow
9d41b85 feat(closing): add reconciliation neutralization workflow
87a969e feat(review): smart tag suggestions and bulk tag actions
753bf4c feat(review): learned category rules engine
d6d0167 feat(review): bulk actions for categories and review state
1b6c27d feat(dashboard): data quality card with clickthrough filters
```

---

## O que está pronto

### Fase 4 — IA de categorização + regras robustas (concluída)
- [x] **4.1** `categoryRules.service.ts` — receiverName/payerName/pluggyCategoryId, `canAutoCategorize()`, prioridade de matching, `incrementRuleUseCount()`
- [x] **4.2** `POST /api/ai/categorize-transactions` — Claude (haiku) / GPT-4o-mini, batch ≤80, JSON estrito, sem secrets no frontend
- [x] **4.3** Botão "Categorizar com IA" na Revisão — modal com preview, apply individual, apply all high, learn rule on apply
- [x] **4.4** XLSX import aplica regras aprendidas (Pluggy já tinha desde Fase 3.3)
- [x] **4.5** `/regras` — mostra receiverName/payerName, confidence, origem colorida, data atualização, botão testar
- [x] **4.6** `FASE4_AI_CATEGORIZATION.md` — documentação completa da pipeline de categorização

### Fase 3 — Produto utilizável e confiável (concluída)
- [x] **3.0** `updateTransactions(items, opts)` — batch write em um passo (IDataProvider + Local + Supabase)
- [x] **3.1** DataQualityCard no Dashboard — 11 métricas clicáveis com drill-down para ledger filtrado
- [x] **3.2** Revisão em lote — multi-select, bulk categoria/tag/neutro/revisado (BulkActionBar)
- [x] **3.3** Regras de categoria aprendidas — engine completo, tela `/regras`, Priority 2 na importação
- [x] **3.4** Smart tags — suggestTags/buildTagContext, bulk "Aplicar sugestões", chips na revisão
- [x] **3.5** Reconciliação — diagnoseReconciliation, card de neutralização no Fechamento
- [x] **3.6** Ledger avançado — filtros salvos, pills rápidos, edição inline subcategoria/tags, CSV export

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
