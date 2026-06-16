# Fase 2 — Inteligência Financeira, Orçamento e Fechamento Mensal
> Branch: `feature/fin-functional-upgrades` | Implementada: 2026-06-16

---

## Visão geral

Esta fase transforma o app de importador/categorizador em um assistente financeiro diário com inteligência sobre revisão, recorrência, orçamento e fechamento mensal.

---

## 2.1 — Centro de Revisão Inteligente

**Arquivo:** `src/utils/financialReview.ts`

Gera lista de `FinancialReviewItem` para o mês corrente detectando:

| Tipo | Severidade | Critério |
|------|-----------|----------|
| `uncategorized` | Alta | Sem macroCategoryId |
| `missing_subcategory` | Baixa | Despesa sem subCategoryId, > R$ 50 |
| `low_confidence` | Média | categoryConfidence === 'low', sem override manual |
| `possible_duplicate` | Alta | Mesmo dia/valor/descrição normalizada |
| `possible_wrong_neutral` | Média | Neutro > R$ 500 sem padrão de transferência |
| `above_average` | Média | Valor > 2,5× média da macro categoria nos últimos 3m |
| `card_payment_check` | Alta | Contém FATURA/FAT./PGTO FAT não marcado como transfer |
| `financial_cost` | Alta | classificationType === 'debt_cost' |
| `unexpected_income` | Baixa | Receita > R$ 500 não vista nos últimos 5 meses |
| `uncategorized` | Baixa | Descrição genérica (PIX, TED, TRANSFERENCIA, etc.) |

**UI:** Painel `IntelligentReviewPanel` na tela de Revisão com:
- Filtros de severidade (alta/média/baixa)
- Lista scrollável com badge de severidade, tipo, descrição, ação sugerida
- Botão ignorar por item
- Link "Abrir" para edição inline

**Dashboard:** `IntelligenceCard` com contagem por severidade + link para Revisão.

---

## 2.2 — Motor de Recorrência

**Arquivo:** `src/utils/recurrence.ts`

Detecta padrões recorrentes analisando:
- Chave normalizada: pluggyReceiverName / pluggyPayerName / description (sem dígitos, sem acentos, primeiros 40 chars)
- Agrupa por `tipo|chave_normalizada`
- Exige ≥ 2 meses distintos com ocorrências
- Calcula: média, min, max, variabilidade, dia típico, tendência
- Estima próxima data esperada para o mês seguinte

**Confiança:**
- Alta: ≥ 4 meses com variabilidade < 20%
- Média: ≥ 3 meses com variabilidade < 40%
- Baixa: 2 meses (dados insuficientes)

**UI:** Chip "Recorrentes" no IntelligenceCard + uso no orçamento sugerido e projeção.

---

## 2.3 — Orçamento Sugerido por Histórico

**Arquivo:** `src/utils/budgetSuggestion.ts`

Para cada macro categoria de despesa, calcula:
- `average3m`: média dos últimos 3 meses (exclui neutros/transfers)
- `lastMonth`: total do mês anterior
- `recurringForecast`: soma dos recorrentes de alta/média confiança
- `suggestedAmount`: max(avg3m, recurringForecast), suavizado com lastMonth
- `confidence`: alta se 3+ meses estáveis, média se 2-3 meses, baixa < 2

**Regras de exclusão:**
- Neutros não entram (includeInBudget = false)
- classificationType transfer/neutral excluídos
- Meses atípicos (lastMonth > 1,5× avg3m) ignorados na sugestão

**UI:** Botão "Orçamento inteligente" em Orçamento abre painel SmartBudgetPanel com tabela (avg3m, mês ant., recorrentes, sugestão, confiança) e aplicação em lote seletiva.

---

## 2.4 — Projeção de Fechamento do Mês

**Arquivo:** `src/utils/monthProjection.ts`

Calcula para o mês atual:
- `incomeRealized`: receita operacional lançada
- `incomeExpected`: diferença entre média histórica e o que já entrou
- `expenseRealized`: despesas lançadas
- `projectedMonthlyExpense`: burn rate diário × dias totais do mês
- `expenseExpected`: recorrentes ainda não lançados este mês
- `projectedBalance`: (incomeRealized + incomeExpected) − (projectedMonthlyExpense + expenseExpected)
- `riskLevel`: high/medium/low baseado nos riscos

**Riscos detectados:**
- Saldo projetado negativo
- Margem < 10% da receita
- Categorias acima do ritmo pro-rateado
- Recorrentes ainda esperados

**UI:** Seção "Projeção do mês" no Fechamento (só mês atual) + chip no IntelligenceCard.

---

## 2.5 — Alertas de Desvio

**Arquivo:** `src/utils/financialAlerts.ts`

| Tipo | Condição |
|------|----------|
| `budget_over` | Realizado > planejado para a macro categoria |
| `above_avg_category` | Realizado > 1,4× média histórica (sem orçamento) |
| `above_avg_transaction` | Transação > max(avg × 4, R$ 2.000) |
| `income_below_avg` | Receita < 80% da média histórica |
| `many_uncategorized` | > 5 despesas sem categoria ou > 20% do total |
| `excess_financial_cost` | debt_cost total > R$ 100 |
| `probable_duplicate` | Candidatos a duplicidade detectados |

**UI:** Seção "Alertas financeiros" no Fechamento + chips de alta no IntelligenceCard.

---

## 2.6 — Fechamento Mensal Guiado

**Arquivo:** `src/services/closing.service.ts`

Checklist expandido de 7 para 11 etapas:
1. Importar extratos (Pluggy ou XLSX)
2. Revisar lançamentos sem categoria
3. Revisar sem subcategoria
4. Validar transferências e neutros
5. Validar pagamentos de cartão
6. Validar receitas
7. Conferir recorrentes
8. Conferir orçamento
9. Conferir alertas financeiros
10. Gerar resumo do mês
11. Planejar orçamento do próximo mês

Estado persiste por mês no localStorage via `MonthClosing.checklist`.

---

## 2.7 — Resumo Mensal

Função `generateSummaryMarkdown()` em `Closing.tsx` gera relatório Markdown com:
- Entradas (receita operacional, resgates separados)
- Saídas (despesas por macro categoria top 5)
- Custos financeiros
- Saldo e margem familiar
- Alertas de alta severidade
- Recorrentes detectados
- Aprendizados (do campo Notes)
- Próximas ações

**UI:** Seção "Resumo do mês" no Fechamento com botões "Gerar resumo" e "Copiar".

---

## Regras de neutro e consumo real

- `classificationType === 'neutral'` ou `=== 'transfer'`: não entra em resultado operacional nem orçamento
- `classificationType === 'investment'`: saída de caixa, não é despesa de consumo
- `classificationType === 'redemption'`: entrada de caixa, não é receita operacional
- `classificationType === 'debt_cost'`: custo financeiro — entra no resultado mas alertado separadamente
- Pagamento de fatura de cartão: deve ser `neutral` se as compras já estão lançadas
- `includeInOperationalResult`, `includeInBudget`, `includeInCashflow`: flags por transação que determinam cada visão

## Diferença fluxo de caixa vs consumo real

| Visão | O que inclui |
|-------|-------------|
| Fluxo de caixa | Tudo que saiu/entrou da conta (includeInCashflow) |
| Consumo operacional | Só despesas reais (includeInOperationalResult = true) |
| Orçamento | Despesas planejáveis (includeInBudget = true) |

Resgates e aportes de investimento aparecem no fluxo de caixa mas NÃO no resultado operacional.
