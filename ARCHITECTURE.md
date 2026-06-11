# ARCHITECTURE.md
# Arquitetura técnica — FINANCE

Versão: 1.0 — 2026-06-10
Stack: React + TypeScript + Vite + Tailwind + Recharts → Supabase (fase 2)

---

## 1. Visão geral

```
┌─────────────────────────────────────────────────────┐
│                        UI                           │
│         pages + components + Recharts charts        │
└────────────────────┬────────────────────────────────┘
                     │ só chama services, nunca engine direto
┌────────────────────▼────────────────────────────────┐
│                   Services                          │
│   transactionService / budgetService / alertService │
└──────────┬─────────────────────┬────────────────────┘
           │                     │
┌──────────▼──────────┐ ┌────────▼────────────────────┐
│   Finance Engine    │ │      Data Adapters          │
│  classify / calc /  │ │  localStorage ↔ Supabase    │
│  alerts / snapshot  │ │  (swap sem mudar services)  │
└─────────────────────┘ └──────────┬──────────────────┘
                                   │
                        ┌──────────▼──────────┐
                        │   Importers / Mock  │
                        │  XLSX parser / seed │
                        └─────────────────────┘
```

**Princípio central:** UI não conhece regras financeiras. Engine não conhece React. Services fazem a ponte. Data adapters são trocáveis sem tocar no resto.

---

## 2. Estrutura de pastas

```
src/
├── types/                     # Interfaces e enums. Sem lógica.
│   ├── transaction.ts
│   ├── category.ts
│   ├── account.ts
│   ├── budget.ts
│   ├── alert.ts
│   └── index.ts               # Re-exporta tudo
│
├── engine/                    # Lógica financeira pura. Sem React, sem IO.
│   ├── classify.ts            # Aplica classification_rules → classification_type
│   ├── normalize.ts           # Mapeia categoria raw → category_id + macro_category_id
│   ├── calculate.ts           # Resultado operacional, desvio, totais por categoria
│   ├── alerts.ts              # Geração de AlertItem[] a partir de transações + budgets
│   ├── snapshot.ts            # Agrega transações em MonthlySnapshot
│   └── index.ts
│
├── adapters/                  # Abstração de fonte de dados. Trocar aqui para migrar.
│   ├── adapter.interface.ts   # IDataAdapter com métodos: getTransactions, saveTransaction, etc.
│   ├── local.adapter.ts       # Implementa IDataAdapter com localStorage/IndexedDB
│   ├── supabase.adapter.ts    # Implementa IDataAdapter com Supabase client (fase 2)
│   └── index.ts               # Exporta adapter ativo via feature flag
│
├── importers/                 # Leitura e parsing de arquivos externos.
│   ├── xlsx.importer.ts       # Lê XLSX, retorna RawTransaction[]
│   ├── csv.importer.ts        # Lê CSV (formato futuro)
│   ├── deduplicator.ts        # Gera import_hash, detecta duplicatas
│   ├── transformer.ts         # RawTransaction → Transaction (com engine.classify + engine.normalize)
│   └── index.ts
│
├── services/                  # Orquestra engine + adapters. É o que UI chama.
│   ├── transaction.service.ts
│   ├── budget.service.ts
│   ├── category.service.ts
│   ├── alert.service.ts
│   ├── import.service.ts
│   ├── snapshot.service.ts
│   └── index.ts
│
├── mock/                      # Dados seed para desenvolvimento sem import.
│   ├── transactions.mock.ts   # ~50 transações representativas dos dados reais
│   ├── categories.mock.ts     # Seed completo de categories + macro_categories
│   ├── budgets.mock.ts        # Orçamentos de jan–mai/2026
│   ├── accounts.mock.ts
│   └── index.ts
│
├── components/                # Componentes React reutilizáveis. Recebem dados via props.
│   ├── ui/                    # Primitivos: Button, Card, Badge, Input, Select, Modal
│   ├── charts/                # Recharts wrappers: BarChart, LineChart, DonutChart
│   ├── transactions/          # TransactionList, TransactionRow, TransactionForm
│   ├── budget/                # BudgetBar, BudgetCard, BudgetOverview
│   ├── alerts/                # AlertBanner, AlertList, AlertBadge
│   ├── import/                # ImportDropzone, ImportProgress, ImportReview
│   └── categories/            # CategoryBadge, CategoryPicker, CategoryMap
│
├── pages/                     # Uma pasta por tela. Orquestra services + components.
│   ├── Dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── Dashboard.hooks.ts # useMonthlyResult, usePendingAlerts
│   │   └── index.ts
│   ├── Transactions/
│   ├── Budget/
│   ├── Import/
│   ├── Categories/
│   └── Settings/
│
├── hooks/                     # Hooks compartilhados entre páginas.
│   ├── useTransactions.ts
│   ├── useBudget.ts
│   ├── useAlerts.ts
│   └── useMonthFilter.ts
│
├── utils/                     # Funções puras auxiliares. Sem dependências de domínio.
│   ├── date.ts                # parseBRDate, toCompetenceMonth, formatMonth
│   ├── currency.ts            # formatBRL, parseBRL
│   ├── hash.ts                # generateImportHash
│   └── array.ts               # groupBy, sumBy, sortBy
│
├── config/
│   ├── classification-rules.ts  # Seed das regras em código (fase 1). Migra para DB na fase 2.
│   ├── category-map.ts          # Mapa categoria raw → category_id (gerado da análise real)
│   └── feature-flags.ts         # USE_SUPABASE, USE_MOCK_DATA, etc.
│
└── App.tsx
```

---

## 3. Camadas do sistema

### 3.1 types/
Único ponto de verdade para interfaces. Derivado direto do DATA_MODEL.md.

Regra: nenhum componente ou service define tipo inline. Tudo importa de `types/`.

Principais: `Transaction`, `Category`, `MacroCategory`, `Budget`, `Account`, `CreditCard`, `MonthlySnapshot`, `AlertItem`, `ImportBatch`, `ClassificationRule`, `RawTransaction`.

### 3.2 engine/
Funções puras. Input = dados. Output = dados calculados. Sem efeitos colaterais. Sem React. Sem IO.

Testável sem setup: `engine.calculate.getOperationalResult(transactions, month)` retorna número. Ponto.

**engine/classify.ts**
- Input: `RawTransaction`, `ClassificationRule[]`
- Output: `classification_type`, `is_internal_transfer`, `confidence`
- Lógica: percorre regras ordenadas por `priority`. Primeira que bate vence.

**engine/normalize.ts**
- Input: categoria raw (string do XLSX), mapa de categorias
- Output: `category_id`, `macro_category_id`
- Lógica: lookup direto no `config/category-map.ts`. Se não encontrar: `null` + flag `needs_review`.

**engine/calculate.ts**
- `getOperationalResult(txns, month)` → `{ income, expenses, debt_cost, result }`
- `getTotalByMacroCategory(txns, month)` → `MacroCategoryTotal[]`
- `getDeviation(realized, planned)` → `{ rs, pct }`
- `getPendingCommitment(txns)` → soma de pendentes por cartão
- Filtra por `include_in_operational_result`, `competence_date`, `status != cancelled`.

**engine/alerts.ts**
- Input: `MonthlySnapshot[]`, `Budget[]`, histórico 3M
- Output: `AlertItem[]` com `level` (`info/warning/critical`), `message`, `category_id`
- Regras: ver FINANCE_RULES.md seção 8.

**engine/snapshot.ts**
- Agrega `Transaction[]` em `MonthlySnapshot` para um mês.
- Usado pelo `snapshot.service.ts` para calcular e persistir.

### 3.3 adapters/
Interface única `IDataAdapter`:

```
getTransactions(filters?) → Transaction[]
saveTransaction(t) → Transaction
updateTransaction(id, patch) → Transaction
getCategories() → Category[]
getBudgets(month) → Budget[]
saveBudget(b) → Budget
getMonthlySnapshot(month) → MonthlySnapshot | null
saveMonthlySnapshot(s) → MonthlySnapshot
getImportBatches() → ImportBatch[]
saveImportBatch(b) → ImportBatch
```

**local.adapter.ts (fase 1):** persiste em `localStorage` com JSON. Limite ~5MB, suficiente para 3–4 anos de transações. Alternativa: IndexedDB se volume crescer.

**supabase.adapter.ts (fase 2):** mesma interface, implementação com `@supabase/supabase-js`. Services não mudam. Só trocar qual adapter está ativo em `adapters/index.ts`.

### 3.4 services/
Orquestra engine + adapters. Componentes React chamam só services.

**transaction.service.ts**
- `getMonthTransactions(month)` → busca adapter + filtra
- `reclassify(id, patch)` → cria ajuste, marca original como substituído
- `getUnreviewedTransactions()` → sem categoria

**import.service.ts**
- `importFile(file)` → chama importer → deduplicator → transformer → adapter.saveTransaction
- Retorna `ImportResult { imported, skipped, pending_review, errors }`

**budget.service.ts**
- `getBudgetComparison(month)` → budgets + realizado calculado pelo engine
- `upsertBudget(month, category_id, amount)`

**alert.service.ts**
- `getActiveAlerts()` → busca snapshots + passa pro engine.alerts → retorna lista

**snapshot.service.ts**
- `getOrCalculate(month)` → busca snapshot; se `is_stale` ou inexistente, recalcula via engine
- `invalidate(month)` → seta `is_stale = true`

### 3.5 importers/
Responsável por ler arquivo externo e entregar `Transaction[]` prontos para salvar.

Fluxo:
```
File → xlsx.importer → RawTransaction[]
     → deduplicator (gera import_hash, remove duplicatas)
     → transformer (engine.classify + engine.normalize)
     → Transaction[] com campos preenchidos
     → import.service salva no adapter
```

**RawTransaction** = espelho exato do XLSX: `Tipo, Descrição, Valor, Data, Data Competência, Data Pagamento, Status, Forma de Pagamento, Conta/Cartão, Categoria, Parcela, Recorrente, Tags, Grupo`.

**transformer.ts** converte RawTransaction → Transaction:
- Parse de datas BR (DD/MM/AAAA → Date)
- Parse de parcela ("3/5" → `installment_current=3, installment_total=5`)
- Valor: positivo sempre, `type` definido pelo campo `Tipo`
- Classifica via `engine.classify`
- Normaliza categoria via `engine.normalize`
- Define `include_in_*` derivado do `classification_type` (a menos que category tenha override)

### 3.6 mock/
Dados hardcoded para desenvolvimento rápido. Ativados via `feature-flags.ts: USE_MOCK_DATA = true`.

`transactions.mock.ts` contém ~80 transações que cobrem todos os `classification_type` + casos especiais: resgate grande, parcelado, pendente, transferência interna, ajuste.

Mock não substitui import real — é andaime para UI não ficar em branco.

### 3.7 components/
Regra: nenhum componente chama `engine.*` diretamente. Recebe dados prontos via props ou hooks.

`components/ui/` — primitivos sem semântica financeira: `Button`, `Card`, `Badge`, `Spinner`, `EmptyState`, `Table`.

`components/charts/` — wrappers finos sobre Recharts. Recebem `data: ChartDataPoint[]`, não transações brutas.

Hooks de página (`Dashboard.hooks.ts`) chamam services, transformam em props, passam para componentes.

### 3.8 pages/
Uma pasta por tela. Cada página:
1. Declara hooks que chamam services
2. Passa dados para componentes
3. Não tem lógica de cálculo inline

---

## 4. Como organizar as responsabilidades

### Regras financeiras
Vivem em `engine/` e `config/classification-rules.ts`. Nenhuma regra do FINANCE_RULES.md fica hardcoded em componente.

### Cálculos mensais
`engine/calculate.ts` → chamado por `snapshot.service.ts` → resultado cacheado em `MonthlySnapshot`.

Dashboard não recalcula tudo: lê snapshot. Se `is_stale`, snapshot.service recalcula antes de retornar.

### Classificação automática
`config/classification-rules.ts` = array de `ClassificationRule[]` em código, fase 1. Engine.classify percorre em ordem de prioridade. Transações sem match ficam com `classification_type = null` e `category_id = null` → fila de revisão manual.

Fase 2: regras migram para tabela `classification_rules` no Supabase. Engine não muda — só a fonte do array muda.

### Normalização de categorias
`config/category-map.ts` = objeto `Record<string, string>` mapeando nome raw → UUID de category. Gerado a partir do seed real dos dados.

Exemplo: `"Açougue" → "cat_acougue"`, `"Restaurantes" → "cat_restaurantes"`.

Categoria raw sem match → `category_id = null` + flag `needs_review = true`.

### Geração de alertas
`engine/alerts.ts` recebe snapshots + budgets + define `AlertItem[]`. Stateless — mesmos inputs = mesmos outputs. `alert.service.ts` chama engine e formata para UI.

### Importação de arquivos
`ImportDropzone` component → `import.service.ts` → `xlsx.importer` → `transformer` → `adapter.saveTransaction`. Progresso via callback. Resultado final: `ImportResult` exibido na tela de revisão.

---

## 5. Estratégia para iniciar sem backend

Fase 1 = 100% client-side.

- `local.adapter.ts` persiste em `localStorage` (JSON serializado)
- `USE_MOCK_DATA = true` na config para desenvolvimento de UI sem import
- Importer lê XLSX no browser via `xlsx` (SheetJS) — sem server
- Sem autenticação. Sem usuário. Dados ficam no browser.
- Export de dados: botão "Baixar JSON" chama `adapter.getAll()` → download

Limitações aceitas na fase 1:
- Sem multi-device (dados só no browser local)
- Sem backup automático
- Sem histórico de auditoria separado (rastreado por `adjusted_from_id`)

### Lib para XLSX no browser
`xlsx` (SheetJS) — lê `.xlsx` no client sem server. Import: `import * as XLSX from 'xlsx'`. Parseia XLSX para array de objetos. Suporte a `.csv` também.

---

## 6. Estratégia para migrar para Supabase

Migração não exige reescrita porque adapters são trocáveis.

### Passos ordenados:
1. Criar projeto Supabase e gerar schema SQL a partir do DATA_MODEL.md
2. Implementar `supabase.adapter.ts` com mesma interface de `local.adapter.ts`
3. Criar script de migração: lê `localStorage` → insere no Supabase
4. Setar `USE_SUPABASE = true` na config
5. Adicionar Supabase Auth (fase 2.1)
6. Adicionar Row Level Security por família (fase 2.2)
7. Mover `classification_rules` de config para tabela (fase 2.3)
8. Substituir `MonthlySnapshot` em localStorage por tabela Supabase (fase 2.4)

Adapters locais continuam como fallback offline.

### O que NÃO muda ao migrar:
- Engine (classify, calculate, alerts, snapshot)
- Services (assinatura pública não muda)
- Importers (independentes de storage)
- Componentes e páginas (nunca tocaram adapter)
- Types (mesmas interfaces)

---

## 7. Estratégia para testes

### O que testar + como

**Engine (prioridade máxima):**
- `engine/calculate.ts` — testar com transações reais dos dados analisados. Cobrir: mês com resgate grande, mês com salário distorcido, parcelas pendentes, transferências internas excluídas.
- `engine/classify.ts` — testar cada `ClassificationRule` do seed.
- `engine/normalize.ts` — testar categorias existentes + categoria desconhecida.
- `engine/alerts.ts` — testar cada limiar de alerta.

Ferramenta: Vitest. Sem mocks de React. Funções puras = testes simples e rápidos.

**Importers (prioridade alta):**
- `transformer.ts` — testar parse de datas BR, parse de parcelas, detecção de neutros (valor < R$1).
- `deduplicator.ts` — testar hash com parcelas de mesmo valor + data.

**Services (prioridade média):**
- `snapshot.service.ts` — testar invalidação de cache.
- `import.service.ts` — testar detecção de duplicatas no fluxo completo.

**UI (prioridade baixa fase 1):**
- Smoke tests nos componentes principais (Dashboard renderiza sem crash).
- Sem testes de integração E2E na fase 1.

### Cobertura mínima fase 1
- engine/: 80%+
- importers/: 70%+
- services/: 50%+
- UI: 0% (visual, testar manualmente)

---

## 8. Estratégia para economizar créditos de IA

### Problema
Sessões longas com muito contexto = consumo alto. Refatorações amplas = alto.

### Regras de trabalho

**Tarefas pequenas e autocontidas:**
- Cada tarefa = 1 arquivo ou 1 função. "Implementar engine/classify.ts" não "implementar engine inteiro".
- Tarefa bem descrita com types de input/output já definidos = contexto menor, resposta mais precisa.

**Documentos como contexto comprimido:**
- FINANCE_RULES.md, DATA_MODEL.md e ARCHITECTURE.md substituem explicações longas em cada sessão.
- No início de cada sessão: colar só o trecho relevante, não os 3 arquivos completos.

**Engine primeiro, UI depois:**
- Engine é texto puro sem dependências visuais. Sessões de engine são baratas.
- UI tem mais vai-e-vem visual = mais tokens. Fazer depois, com engine já testado.

**Nunca pedir refatoração ampla:**
- "Refatora toda a estrutura de dados" = cara.
- "Adiciona campo X em Transaction e ajusta calculate.ts" = barato.

**Componentes com interface definida antes de implementar:**
- Props tipadas no types/ antes de pedir a Claude que escreva o componente.
- "Escreve TransactionList que recebe `transactions: Transaction[]` e `onReclassify: (id, patch) => void`" = contexto mínimo necessário.

**Reaproveitar seed:**
- `mock/` e `config/classification-rules.ts` criados uma vez, reusados em todas as sessões.
- Não pedir para Claude "criar dados de exemplo" a cada sessão.

**Commits pequenos:**
- 1 arquivo modificado por commit → diff pequeno → revisão com AI barata.

---

## 9. Ordem recomendada de implementação

### Fase 1A — Fundação (sem UI)
1. Scaffold do projeto: `npm create vite@latest finance -- --template react-ts`
2. Configurar Tailwind, eslint, vitest
3. Criar `types/` completo (derivado do DATA_MODEL.md)
4. Criar `config/category-map.ts` e `config/classification-rules.ts` (seed dos dados reais)
5. Criar `engine/classify.ts` + testes
6. Criar `engine/normalize.ts` + testes
7. Criar `utils/date.ts`, `utils/currency.ts`, `utils/hash.ts`
8. Criar `importers/xlsx.importer.ts` e `importers/transformer.ts` + testes com arquivo real
9. Criar `importers/deduplicator.ts` + testes
10. Criar `engine/calculate.ts` + testes com dados reais
11. Criar `engine/alerts.ts` + testes
12. Criar `engine/snapshot.ts`
13. Criar `adapters/local.adapter.ts`
14. Criar `services/` (finos, sem lógica)
15. Criar `mock/` com dados representativos

**Critério de conclusão 1A:** `import.service.importFile(xlsxReal)` retorna transações classificadas corretamente. `calculate.getOperationalResult(transactions, '2026-05')` retorna resultado correto excluindo resgates.

### Fase 1B — UI básica
16. Criar `components/ui/` primitivos
17. Criar página Dashboard com gráfico de resultado por mês (Recharts)
18. Criar página Transactions com lista + filtros por mês/categoria
19. Criar página Import com dropzone e revisão pós-import
20. Criar página Budget com comparativo orçado vs realizado
21. Criar componente de alertas

**Critério de conclusão 1B:** ver seção 10.

### Fase 2 — Supabase (após 1B estável)
22. Schema SQL no Supabase
23. `supabase.adapter.ts`
24. Migração de dados do localStorage
25. Auth + RLS

---

## 10. Critérios de aceite da Fase 1

### Importação
- [ ] Importar `lancamentos_Pessoal_2026-01-01_2026-05-31.xlsx` sem erro
- [ ] 855 lançamentos processados; 0 duplicatas se importar duas vezes
- [ ] Lançamentos sem categoria aparecem em fila de revisão
- [ ] Resgates (PIX CAIXA E, TED CAIXA ECON F) classificados como `redemption` automaticamente
- [ ] Salário classificado como `operational_income` automaticamente
- [ ] Juros de cheque especial classificados como `debt_cost` automaticamente

### Cálculos
- [ ] Resultado operacional de fevereiro/2026 NÃO inclui R$31.584 de resgates
- [ ] Resultado operacional de maio/2026 mostra salário distorcido com banner de aviso
- [ ] Total de pendentes = R$15.477 (RICO + Sam's + INTER PRIME + NU-JANA)
- [ ] Transferências PIX entre contas da família não aparecem no resultado
- [ ] Import de mesmo arquivo duas vezes não duplica lançamentos

### Dashboard
- [ ] Resultado operacional por mês (jan–mai) em gráfico de barras
- [ ] Resultado bruto vs operacional visualmente separados
- [ ] Pendentes de cartão com valor total destacado
- [ ] Meses com resgates / salário atípico marcados visualmente
- [ ] Alertas de cheque especial visíveis (presente em jan, fev, abr, mai)

### Orçamento
- [ ] Desvio em R$ e % por categoria
- [ ] Categorias acima do orçamento em vermelho/laranja
- [ ] Alimentação: real mai/2026 vs orçado R$1.750

### Categorias
- [ ] Reclassificação manual de lançamento preserva original
- [ ] Lançamento reclassificado aparece com ícone de ajuste
- [ ] Fila de revisão mostra lançamentos sem categoria

### Performance
- [ ] Dashboard carrega em < 1s com 855 transações
- [ ] Import de 855 lançamentos conclui em < 3s

---

## Dependências sugeridas (fase 1)

| Lib | Uso |
|---|---|
| `xlsx` (SheetJS) | Parse XLSX no browser |
| `recharts` | Gráficos |
| `tailwindcss` | Estilo |
| `date-fns` | Manipulação de datas |
| `vitest` | Testes unitários |
| `uuid` | Geração de IDs |
| `crypto-js` ou Web Crypto API | SHA256 para import_hash |

Sem Redux, sem React Query fase 1. Services + hooks locais são suficientes. Adicionar conforme necessidade real.

---

*Versão 1.0 — 2026-06-10*
*Arquitetura baseada em FINANCE_RULES.md + DATA_MODEL.md*
