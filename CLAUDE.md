# CLAUDE.md — FINANCE (finfvc)

Assistente de contexto para Claude Code / Gatoverde.
Leia este arquivo no início de cada sessão antes de qualquer tarefa.

---

## O que é este projeto

App de finanças pessoais/familiares construído com React + TypeScript + Vite.
Importa lançamentos de planilha XLSX, classifica automaticamente, calcula resultado
operacional excluindo resgates e transferências internas, e exibe dashboards, orçamento
e fechamento mensal.

**Usuário real:** família brasileira, ~855 lançamentos/semestre, múltiplas contas e cartões.

---

## Stack

| Camada | Tecnologia |
|---|---|
| UI | React 18 + TypeScript + Tailwind CSS |
| Build | Vite |
| Gráficos | Recharts |
| Parse XLSX | SheetJS (`xlsx`) |
| Backend (fase 2) | Supabase (PostgreSQL + Auth + RLS) |
| Testes | Vitest |
| Deploy | Hostinger → `fin.fjcrivo.com` |

---

## Como rodar

```bash
cd finance-app
npm install
npm run dev        # http://localhost:5173
npm run build      # output em finance-app/dist/
npm run test       # vitest
```

Variáveis de ambiente: copiar `finance-app/.env.example` → `.env.local`.
`VITE_DATA_PROVIDER=local` usa localStorage (padrão, sem Supabase).
`VITE_DATA_PROVIDER=supabase` requer credenciais do projeto `ycskqocrvjdwozqnsots`.

---

## Arquitetura em camadas

```
UI (pages + components)
    ↓ só chama services
Services (transactionService, budgetService, alertService, importService, snapshotService)
    ↓                        ↓
Finance Engine          Data Adapters
(classify/calc/         (localStorage ↔ Supabase,
 alerts/snapshot)        trocável sem mudar services)
                             ↓
                      Importers / Mock
                      (XLSX parser / seed)
```

**Regras de camada (nunca violar):**
- UI não importa nada de `engine/` diretamente
- Engine não importa React nem faz IO
- Services são a única ponte entre UI e engine/adapters
- Adapters são trocáveis; services não mudam ao trocar adapter

---

## Estrutura de pastas relevante

```
finance-app/src/
├── types/          # Interfaces e enums — fonte única de verdade
├── engine/         # Lógica financeira pura, sem React
│   ├── calculate.ts
│   └── (classify, alerts, snapshot — ainda não implementados como módulos separados)
├── adapters/       # IDataAdapter → local.adapter.ts / supabase.adapter.ts
├── importers/      # xlsxParser, transformer, deduplicator, normalizer, classifier
├── services/       # budget.service.ts, import.service.ts, transactions.service.ts, closing.service.ts
├── providers/      # data.provider.ts, local.data.provider.ts, supabase.data.provider.ts
├── context/        # DataContext (async, loading/error), AuthContext
├── hooks/          # useDashboard, useAuth
├── components/     # ui/, dashboard/, import/, layout/
├── pages/          # Dashboard, Transactions, Budget, Import, Review, Closing, Login, MigrationPage
├── config/         # categories.ts, env.ts
├── mock/           # transactions.ts (seed para dev)
└── lib/            # supabase.ts (client)
```

---

## Documentos de referência

Antes de implementar qualquer feature de domínio financeiro, leia:

| Arquivo | Quando ler |
|---|---|
| `FINANCE_RULES.md` | Qualquer cálculo, classificação ou regra de negócio |
| `DATA_MODEL.md` | Ao criar/alterar tipos, campos ou relações |
| `ARCHITECTURE.md` | Ao adicionar módulos, camadas ou dependências |
| `SUPABASE_PLAN.md` | Ao trabalhar na integração Supabase |
| `FASE2_BETA_CHECKLIST.md` | Para saber o que está pendente na Fase 2 |

---

## Regras de negócio críticas (nunca esquecer)

1. **Resultado operacional exclui resgates** — PIX CAIXA E, TED CAIXA ECON F são `classification_type = redemption` e `include_in_operational_result = false`.
2. **Transferências internas excluídas de tudo** — `is_internal_transfer = true` não entra em resultado, fluxo de caixa nem orçamento.
3. **Competence date é a referência** — agrupamento mensal usa `competence_date`, não `transaction_date`.
4. **Lançamento original é imutável** — ajustes criam novo registro com `is_adjustment = true` e `adjusted_from_id` apontando para o original.
5. **Deduplicação por hash** — `import_hash = SHA256(original_description + amount + transaction_date + account)`. Import do mesmo arquivo duas vezes não duplica.
6. **Parcelas pendentes de cartão** — `status = pending` e `credit_card_id != null` formam o "compromisso pendente" total.

---

## Estado atual do projeto

**Fase 1 — Concluída:**
- Dashboard, Transactions, Budget, Closing, Import XLSX, design system
- LocalAdapter (localStorage)
- Interface IDataProvider + LocalDataProvider + SupabaseDataProvider (stub)
- Schema SQL Supabase com migrations em `supabase/migrations/`

**Fase 2 — Em andamento:**
- [ ] Login / signup com Supabase Auth
- [ ] Troca LocalProvider → SupabaseProvider após login
- [ ] Import flow apontando para SupabaseProvider
- [ ] Metas financeiras, simulações, Consultor IA
- [ ] Deploy em `fin.fjcrivo.com`

---

## Convenções de código

- Sem comentários óbvios — só quando o "por quê" não é evidente no código
- Sem `console.log` em produção
- Tailwind para estilos — sem CSS inline desnecessário
- Tipos sempre em `types/index.ts` — nenhum tipo definido inline em componente
- Erros de rede/banco tratados nos adapters/providers, não nos componentes
- Nenhuma lógica financeira em componente React — vai para `engine/` ou `services/`

---

## Supabase

Projeto: `ycskqocrvjdwozqnsots`
Migrations: `supabase/migrations/`
Para aplicar: `supabase link --project-ref ycskqocrvjdwozqnsots && supabase db push`
Credenciais: em `.env.local` (nunca commitado)

---

## Git

Branch de desenvolvimento padrão: `main`
Formato de commit: `tipo: descrição curta` (feat, fix, chore, style, refactor, docs)
Nunca commitar: `.env.local`, dados financeiros reais, secrets

---

*Documento mantido por: fcrismanis@gmail.com*
*Última atualização: 2026-06-21*
