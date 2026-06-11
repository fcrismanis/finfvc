# UI_SPEC_DASHBOARD.md
# Especificação da tela Home/Dashboard — FINANCE

Versão: 1.0 — 2026-06-10
Referências: FINANCE_RULES.md, DATA_MODEL.md, ARCHITECTURE.md

---

## 1. Propósito da tela

Responder em < 5 segundos de leitura:
1. Fechei o mês no positivo ou negativo?
2. Para onde foi o dinheiro?
3. O que estourou o orçamento?
4. O que precisa de atenção agora?
5. Estou melhorando ou piorando ao longo dos meses?

---

## 2. Layout macro

```
┌──────────┬──────────────────────────────────────────────┐
│          │  HEADER                                      │
│ SIDEBAR  ├──────────────────────────────────────────────┤
│  240px   │  RESUMO DO MÊS (4 cards)                    │
│          ├──────────────────────────────────────────────┤
│          │  PARA ONDE FOI   │  PLANEJADO x REALIZADO    │
│          │  (left col)      │  (right col)              │
│          ├──────────────────┴───────────────────────────┤
│          │  ALERTAS DO MÊS                              │
│          ├──────────────────────────────────────────────┤
│          │  EVOLUÇÃO MENSAL (6 meses)                   │
│          ├──────────────────────────────────────────────┤
│          │  MAIORES GASTOS  │  ÁREA SECUNDÁRIA          │
└──────────┴──────────────────────────────────────────────┘
```

Grid principal: sidebar fixa 240px + conteúdo fluid. Conteúdo usa `max-width: 1280px`, centralizado.

---

## 3. Design tokens

| Token | Valor | Uso |
|---|---|---|
| `color-bg` | `#F8F9FB` | Fundo da página |
| `color-surface` | `#FFFFFF` | Cards, painéis |
| `color-sidebar-bg` | `#1E2235` | Fundo sidebar (grafite-indigo) |
| `color-sidebar-active` | `#3B4A8C` | Item ativo sidebar |
| `color-sidebar-text` | `#A8B4D0` | Texto inativo sidebar |
| `color-sidebar-text-active` | `#FFFFFF` | Texto ativo sidebar |
| `color-income` | `#16A34A` | Verde receita |
| `color-income-bg` | `#F0FDF4` | Fundo badge receita |
| `color-expense` | `#DC2626` | Vermelho despesa |
| `color-expense-bg` | `#FEF2F2` | Fundo badge despesa |
| `color-result-positive` | `#059669` | Resultado positivo |
| `color-result-negative` | `#B91C1C` | Resultado negativo |
| `color-warning` | `#D97706` | Alerta moderado |
| `color-warning-bg` | `#FFFBEB` | Fundo alerta |
| `color-critical` | `#DC2626` | Alerta crítico |
| `color-neutral` | `#6B7280` | Texto secundário |
| `color-border` | `#E5E7EB` | Bordas de card |
| `font-number` | Inter 700 | Valores monetários grandes |
| `font-label` | Inter 400/500 | Labels de campo |
| `radius-card` | `12px` | Cards |
| `radius-badge` | `6px` | Badges |
| `shadow-card` | `0 1px 3px rgba(0,0,0,0.06)` | Sombra cards |

---

## 4. Sidebar

### Estrutura
```
┌─────────────────────┐
│  💎 FINANCE    (logo)│
│  ─────────────────  │
│  PRINCIPAL          │
│  ● Visão Geral ←ativo│
│    Lançamentos      │
│    Orçamento        │
│    Metas            │
│    Fechamento       │
│  ─────────────────  │
│  FERRAMENTAS        │
│    Conectar dados   │
│    Simulações       │
│    Consultor IA     │
│    Configurações    │
│  ─────────────────  │
│  [avatar] Fabio     │
└─────────────────────┘
```

### Especificação
- Largura: 240px fixa. Não colapsa na fase 1. Mobile: oculta (ver responsividade).
- Fundo: `color-sidebar-bg` (#1E2235)
- Logo: tipografia bold, branca, com ícone geométrico à esquerda
- Grupos com label uppercase 11px, `color-sidebar-text`, tracking 0.08em
- Item ativo: fundo `color-sidebar-active`, pill-shaped, `border-radius: 8px`, texto branco
- Item inativo: texto `color-sidebar-text`, hover fundo rgba(255,255,255,0.05)
- Ícone: 18px, Lucide React
- Rodapé sidebar: avatar circular + nome do usuário

### Componente
`Sidebar` — recebe `activeItem: string`, emite `onNavigate(route: string)`

### Estado vazio
N/A — sidebar sempre visível com itens fixos

---

## 5. Header

### Estrutura
```
┌──────────────────────────────────────────────────────────┐
│  Bom dia, Fabio ☀          Maio 2026  ◀ ▶   + Lançamento │
│                             [Operacional][Caixa][Contábil]│
└──────────────────────────────────────────────────────────┘
```

### Especificação

**Esquerda:**
- Saudação: "Bom dia" / "Boa tarde" / "Boa noite" + nome. `font-size: 20px, font-weight: 600`
- Ícone contextual: ☀ manhã, ⛅ tarde, 🌙 noite

**Centro:**
- Seletor de mês: `◀  Maio 2026  ▶`
- `◀` e `▶`: setas chevron, clicáveis, navegam entre meses
- Mês: `font-size: 16px, font-weight: 500`
- Limite: não avança além do mês atual

**Direita:**
- Botão `+ Lançamento`: primário, `background: color-sidebar-active`, texto branco, `border-radius: 8px`, `height: 36px`
- Toggle de visão: 3 tabs compactas — `Operacional | Caixa | Contábil`
  - Tab ativa: fundo `#1E2235`, texto branco, `border-radius: 6px`
  - Tab inativa: texto `color-neutral`, hover fundo `#F3F4F6`
  - Default: Operacional

### Dados necessários
- `currentUser.name: string`
- `selectedMonth: Date`
- `activeView: 'operational' | 'cashflow' | 'accounting'`

### Componente
`DashboardHeader` — recebe `userName`, `selectedMonth`, `activeView`, emite `onMonthChange`, `onViewChange`, `onAddTransaction`

---

## 6. Bloco Resumo do mês (4 cards)

### Layout
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Receita Op. │ │   Despesas   │ │  Resultado   │ │  Taxa Sobra  │
│              │ │              │ │  Operacional │ │              │
│  R$ 17.500   │ │  R$ 21.462   │ │  -R$ 3.962   │ │   -22,6%     │
│  ↑ vs planej │ │  ▲ +21% orç  │ │  ● negativo  │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Card 1 — Receita Operacional
- Label: "Receita operacional" — 12px, `color-neutral`
- Valor: `font-number`, 28px, `color-income`
- Sublabel: variação vs mês anterior ou vs planejado
  - ↑ R$ X acima do planejado → verde
  - ↓ R$ X abaixo do planejado → amarelo
- Badge aviso: se mês tem salário atípico (> 140% da média 3M), exibir pill amber `"Mês atípico"`
- Fundo card: `color-surface` com borda esquerda 3px `color-income`

### Card 2 — Despesas
- Label: "Despesas" — 12px, `color-neutral`
- Valor: `font-number`, 28px, `color-expense`
- Sublabel: desvio vs orçamento em R$ e %
  - Acima: `▲ R$ X (+Y%)` em vermelho
  - Abaixo: `▼ R$ X (-Y%)` em verde
- Pendentes: linha menor abaixo `"+ R$ X pendente"` em `color-warning` se pendente > 0
- Fundo card: `color-surface` com borda esquerda 3px `color-expense`

### Card 3 — Resultado Operacional
- Label: "Resultado operacional" — 12px, `color-neutral`
- Valor: `font-number`, 32px (maior que os outros) — cor dinâmica:
  - Positivo: `color-result-positive`
  - Negativo: `color-result-negative`
  - Zerado: `color-neutral`
- Pill de estado: `● Positivo` (verde) ou `● Negativo` (vermelho) ou `● Equilibrado`
- Se mês tem resgate grande: banner amarelo embaixo `"⚠ Inclui R$ X de resgate — resultado real: R$ Y"`
- Fundo card: `color-surface`, border 1.5px `color-result-positive` ou `color-result-negative`
- Card com sombra levemente maior que os outros para hierarquia

### Card 4 — Taxa de Sobra
- Label: "Taxa de sobra" — 12px, `color-neutral`
- Cálculo: `(resultado / receita_operacional) * 100`
- Valor: `font-number`, 28px — cor dinâmica igual resultado
- Sublabel: barra de progresso horizontal 0–100%
  - < 0%: barra vermelha
  - 0–10%: barra amarela
  - 10–20%: barra verde claro
  - > 20%: barra verde escuro
- Referência: meta padrão 20% (configurável). Linha tracejada na barra indicando meta.

### Dados necessários
```typescript
{
  operationalIncome: number
  totalExpenses: number
  operationalResult: number
  savingsRate: number            // result / income
  pendingAmount: number
  plannedIncome: number
  plannedExpenses: number
  hasRedemption: boolean
  redemptionAmount: number
  realOperationalResult: number  // sem resgates
  isAtypicalMonth: boolean
}
```

### Estados
- **Carregando:** skeleton de 4 cards com animação pulse
- **Sem dados:** card cinza com "Nenhum lançamento em Maio 2026" + link "Importar dados"
- **Erro de cálculo:** ícone ⚠ + "Erro ao calcular. Tente novamente."

### Componente
`MonthSummaryCards` — recebe `MonthSummaryData`, emite `onImportClick`

---

## 7. Bloco "Para onde o dinheiro foi"

Posição: coluna esquerda, abaixo do resumo.

### Layout
```
┌─────────────────────────────────────┐
│ Para onde foi o dinheiro            │
│ Maio 2026                           │
│                                     │
│  [Donut chart 200px]                │
│                                     │
│  Alimentação    ████░ R$2.897  13%  │
│  Casa           ██░░░ R$1.369   6%  │
│  Educação       ███░░ R$2.765  13%  │
│  Compras        ████░ R$3.897 ▲18%  │ ← acima da média
│  Transporte     ██░░░ R$1.188   6%  │
│  Outros         █░░░░ R$X      Y%   │
│                                     │
│  [Ver todas as categorias →]        │
└─────────────────────────────────────┘
```

### Especificação

**Donut chart:**
- Recharts `PieChart` com `innerRadius` (donut)
- Cada fatia = macro-categoria. Máximo 8 fatias, resto vai para "Outros"
- Cores fixas por macro-categoria (definidas em `config/category-map.ts`)
- Centro do donut: total de despesas em número grande
- Tooltip ao hover: nome + valor + %

**Lista de categorias:**
- Ordenada por valor (maior primeiro)
- Cada linha: ícone 16px + nome + barra proporcional + valor + %
- Barra: largura proporcional ao maior gasto do mês, `height: 6px`, `border-radius: 3px`
- Cor da barra = cor da categoria no donut
- Se categoria acima da média histórica (3M): badge laranja `▲ acima da média`
- Máximo 6 linhas na lista. Link "Ver todas as categorias →" embaixo.

**Cores por macro-categoria (seed):**
```
Alimentação       #F97316  (laranja)
Casa              #6366F1  (indigo)
Transporte        #0EA5E9  (azul)
Saúde             #10B981  (verde)
Educação          #8B5CF6  (roxo)
Compras           #F43F5E  (rosa)
Assinaturas       #F59E0B  (âmbar)
Outros            #9CA3AF  (cinza)
```

### Dados necessários
```typescript
MacroCategoryTotal[] = {
  macro_category_id: string
  name: string
  total: number
  percentage: number           // sobre total despesas
  color: string
  avg_last_3m: number
  is_above_average: boolean
}
```

### Estados
- **Carregando:** skeleton circular + 5 linhas
- **Sem gastos:** donut vazio com mensagem "Nenhuma despesa registrada"

### Componente
`ExpenseBreakdown` — recebe `MacroCategoryTotal[]`, `totalExpenses: number`

---

## 8. Bloco "Planejado x Realizado"

Posição: coluna direita, ao lado de "Para onde foi".

### Layout
```
┌─────────────────────────────────────┐
│ Planejado x Realizado               │
│ Maio 2026                           │
│                                     │
│ Alimentação                         │
│ Plan ████████████░░░░  R$1.750      │
│ Real █████████████████  R$2.897 ▲   │
│                          +R$1.147 / +66% │
│                                     │
│ Compras                             │
│ Plan ████░░░░░░░░░░░░  R$850        │
│ Real ████████████████  R$3.897 ▲▲   │
│                          +R$3.047 / +358% │
│                                     │
│ Casa                                │
│ Plan ████████████████  R$7.503      │
│ Real ████████░░░░░░░░  R$1.369 ✓   │
│                          -R$6.134 / -82% │
│                                     │
│ [Ver orçamento completo →]          │
└─────────────────────────────────────┘
```

### Especificação

**Ordenação:** categorias com maior desvio positivo (estouros) primeiro.

**Barra dupla por categoria:**
- Linha 1: "Planejado" — cor cinza claro, largura proporcional
- Linha 2: "Realizado" — cor da categoria, largura proporcional
- Barra de referência: máximo = maior entre `planned` e `realized` de todas as categorias
- Altura de cada barra: `6px`, `border-radius: 3px`

**Estado de desvio:**
- Realizado > Planejado: ícone `▲` vermelho + desvio em vermelho
- Realizado > 2× Planejado: ícone `▲▲` vermelho escuro
- Realizado < Planejado: ícone `✓` verde + desvio em verde
- Sem orçamento (planejado = 0): badge azul `"Sem orçamento"`

**Desvio em texto:** `+R$ X / +Y%` ou `-R$ X / -Y%`

**Limite:** mostrar top 6 categorias por desvio. Link "Ver orçamento completo →".

### Dados necessários
```typescript
BudgetComparison[] = {
  category_id: string
  macro_category_id: string
  name: string
  planned: number
  realized: number
  deviation_rs: number
  deviation_pct: number
  color: string
  status: 'ok' | 'warning' | 'critical' | 'no_budget'
}
```

### Estados
- **Sem orçamento configurado:** estado vazio com CTA "Configurar orçamento →"
- **Carregando:** skeleton de 4 pares de barras

### Componente
`BudgetComparison` — recebe `BudgetComparison[]`, emite `onViewAll`

---

## 9. Bloco "Alertas do mês"

Posição: largura total, abaixo das duas colunas.

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│ ⚠ Alertas do mês  (3)                                       │
│                                                              │
│ 🔴 Compras passou R$ 3.047 do planejado (+358%)             │
│ 🟡 Cheque especial ativo — juros R$ 2.236 em maio           │
│ 🟡 Alimentação passou R$ 1.147 do planejado (+66%)          │
└──────────────────────────────────────────────────────────────┘
```

### Especificação

**Regras de exibição:**
- Máximo 5 alertas no dashboard. Resto em página de alertas.
- Ordem: crítico (🔴) antes de atenção (🟡) antes de informativo (🔵)
- Alertas de cheque especial sempre primeiro se presentes

**Tipos de alerta e visual:**

| Tipo | Ícone | Cor borda | Condição |
|---|---|---|---|
| Crítico | 🔴 | `#DC2626` | desvio > 40% ou juros cheque especial |
| Atenção | 🟡 | `#D97706` | desvio 20–40% ou sem categoria > R$500 |
| Informativo | 🔵 | `#2563EB` | tendência de aumento, categoria sem orçamento |
| Distorção | ⚪ | `#6B7280` | resgate ou salário atípico no mês |

**Cada alerta:**
- Ícone 16px + texto objetivo em uma linha
- Texto: `"[Categoria] passou R$ X do planejado (+Y%)"` ou `"Cheque especial: R$ X em juros"`
- Fundo: stripe fina da cor do nível no lado esquerdo
- `border-radius: 8px`, padding `12px 16px`
- Sem botões de ação no card de alerta (clicar navega para detalhe)

**Se nenhum alerta:**
- Exibir card verde suave: `"✓ Nenhum alerta em Maio 2026"`

### Dados necessários
```typescript
AlertItem[] = {
  id: string
  level: 'critical' | 'warning' | 'info' | 'distortion'
  message: string
  category_id?: string
  amount?: number
  deviation_pct?: number
  action_url?: string
}
```

### Componente
`AlertsPanel` — recebe `AlertItem[]`, `maxVisible: number = 5`, emite `onAlertClick(alert)`

---

## 10. Bloco "Evolução mensal"

Posição: largura total, abaixo dos alertas.

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│ Evolução dos últimos 6 meses                                 │
│                                                              │
│  40k ┤                                                       │
│  30k ┤     ░░░                                              │
│  20k ┤ ░░░ ░░░                     ░░░                      │
│  10k ┤ ░░░ ░░░ ░░░ ░░░ ░░░░░░░░░ ░░░                      │
│   0  ├─────────────────────────────────                      │
│ -10k ┤         ▓▓▓      ▓▓▓                                 │
│      jan  fev  mar  abr  mai  jun                            │
│                                                              │
│  ░ Receita   ▓ Resultado  ── Meta mensal                    │
└──────────────────────────────────────────────────────────────┘
```

### Especificação

**Recharts `ComposedChart`:**
- Eixo X: meses (Jan–Jun, abreviado)
- Eixo Y: valores em R$ com formatação `"R$ Xk"`
- Linha de zero destacada (eixo visível em negrito)

**Séries:**
1. `Bar` — Receita operacional — cor `color-income` leve (opacity 0.6)
2. `Bar` — Despesas — cor `color-expense` leve (opacity 0.6). Barras empilhadas ou lado a lado TBD.
3. `Line` — Resultado operacional — linha sólida 2px, cor dinâmica (verde se > 0, vermelho se < 0)
4. `ReferenceLine` — y=0 — linha tracejada cinza, label "zero"

**Tooltips:**
- Hover no mês: card com receita, despesa, resultado do mês
- Se mês tem flag `is_atypical_month`: nota `"⚠ Mês atípico"` no tooltip

**Meses distorcidos:**
- Se mês tem resgate > 20% receita: ponto na linha com `stroke-dasharray` diferente, tooltip marcado

**Legenda:** abaixo do gráfico, em linha, com color swatch + nome

**Altura:** 240px

### Dados necessários
```typescript
MonthlyTrend[] = {
  month: string           // "jan/26", "fev/26"...
  operational_income: number
  total_expenses: number
  operational_result: number
  is_atypical: boolean
  atypical_reason?: string
}
```

### Estados
- **Menos de 2 meses:** mensagem "Dados insuficientes para exibir evolução. Importe mais meses."
- **Carregando:** skeleton de gráfico

### Componente
`MonthlyTrendChart` — recebe `MonthlyTrend[]`

---

## 11. Bloco "Maiores gastos"

Posição: coluna esquerda, bloco final.

### Layout
```
┌─────────────────────────────────────┐
│ Maiores gastos em Maio              │
│                                     │
│ 1. Prestação casa   R$ 6.311 Casa   │
│ 2. Bethel           R$ 2.049 Educ.  │
│ 3. Sem Parar        R$ 610  Transp. │
│ 4. ML/Amazon        R$ 1.742 Compra │
│ 5. VIVO             R$ 270  Serviço │
│                                     │
│ [Ver todos os lançamentos →]        │
└─────────────────────────────────────┘
```

### Especificação

**Top 5** por valor, lançamentos individuais (não agrupados).

Cada linha:
- Número de ranking: 14px, `color-neutral`, width 20px
- Descrição: truncada em 22 chars, 14px, `font-weight 500`
- Valor: `font-number`, 14px, `color-expense`, alinhado à direita
- Badge de categoria: pill 10px, cor da macro-categoria, nome abreviado

Sem tabela. Layout flex row com gap. Sem header de colunas.

Separador: linha `color-border` 0.5px entre itens.

### Dados necessários
```typescript
TopTransaction[] = {
  id: string
  description: string
  amount: number
  macro_category_name: string
  macro_category_color: string
}
```

### Componente
`TopExpenses` — recebe `TopTransaction[]`, emite `onViewAll`

---

## 12. Área secundária

Posição: coluna direita, bloco final (ao lado de Maiores gastos).

### Layout
```
┌─────────────────────────────────────┐
│ Ações rápidas                       │
│                                     │
│ → Ver todos os lançamentos          │
│   855 lançamentos em 2026           │
│                                     │
│ → Fechar mês                        │
│   Maio ainda aberto                 │
│                                     │
│ → Revisar lançamentos               │
│   12 sem categoria ●                │
│                                     │
│ → Importar dados                    │
│   Último import: 10/06/2026         │
└─────────────────────────────────────┘
```

### Especificação

4 links de ação, cada um com:
- Seta `→` em `color-sidebar-active`
- Título: 14px, `font-weight 500`
- Sublabel: 12px, `color-neutral`
- "Revisar lançamentos" com badge vermelho se `pending_review_count > 0`

Fundo card: `color-surface`, borda `color-border`

### Dados necessários
```typescript
{
  total_transactions_year: number
  month_is_closed: boolean
  pending_review_count: number
  last_import_date: Date | null
}
```

### Componente
`QuickActions` — recebe dados acima, emite `onNavigate(route)`

---

## 13. Hierarquia visual

Peso visual de cima para baixo:

1. **Resultado Operacional** (card maior, borda colorida, fonte 32px) — responde "fui bem?"
2. **Receita + Despesas** (cards laterais, fonte 28px) — contexto do resultado
3. **Alertas** (strip colorida, destaque vermelho) — o que exige ação
4. **Para onde foi + Planejado x Realizado** (blocos médios) — análise
5. **Evolução mensal** (gráfico largo) — tendência
6. **Maiores gastos + Ações** (compactos) — detalhe e navegação

---

## 14. Responsividade

### Desktop (> 1280px)
- Layout completo conforme especificado
- 2 colunas em "Para onde foi" + "Planejado x Realizado"
- 2 colunas em "Maiores gastos" + "Ações"

### Tablet (768px–1280px)
- Sidebar colapsa para ícones 64px (sem texto)
- 4 cards do resumo: 2×2 grid
- "Para onde foi" e "Planejado x Realizado": empilhados verticalmente (1 coluna)
- Gráfico evolução: mantém largura total, altura reduz para 180px

### Mobile (< 768px)
- Sidebar: oculta. Hamburguer no header abre drawer.
- 4 cards: scroll horizontal (não empiha — mantém horizontal com scroll snap)
- Todos os blocos: largura total, empilhados
- Donut chart: reduz para 160px
- Gráfico evolução: mostra apenas últimos 4 meses, labels rotacionados
- "Maiores gastos": 3 itens (não 5)

---

## 15. Estados da página

### Carregando (inicial)
- Skeleton em todos os blocos
- Sidebar visível e funcional
- Header visível, botões desabilitados
- Animação pulse em todos os cards

### Sem dados no mês selecionado
- Cards de resumo com valor "R$ 0,00" e estado visual vazio
- "Para onde foi": ilustração simples + "Nenhum gasto registrado. Importe um arquivo ou adicione um lançamento."
- CTA primário visível: botão "Importar dados"
- Alertas: nenhum
- Gráfico: sem dados, mensagem inline

### Mês com dados parciais (em curso)
- Badge "Em curso" ao lado do nome do mês no header
- Cards com total até a data
- Gráfico evolução: barra do mês atual com opacity reduzida (indica incompleto)

### Erro de carregamento
- Toast de erro no canto superior direito: "Erro ao carregar dados de Maio 2026"
- Botão "Tentar novamente" em cada bloco com erro
- Restante da UI permanece visível com último estado válido

### Mês com distorção (resgate ou salário atípico)
- Banner amarelo abaixo do header (não intrusivo, colapsável):
  `"⚠ Este mês inclui R$ 31.584 em resgates. Resultado operacional real: -R$ 3.328"`
- Card de Resultado Operacional exibe resultado limpo com nota de rodapé
- Não bloqueia nenhuma ação

---

## 16. Componentes necessários (resumo)

| Componente | Props principais | Emite |
|---|---|---|
| `Sidebar` | `activeItem` | `onNavigate` |
| `DashboardHeader` | `userName, selectedMonth, activeView` | `onMonthChange, onViewChange, onAddTransaction` |
| `MonthSummaryCards` | `MonthSummaryData` | `onImportClick` |
| `ExpenseBreakdown` | `MacroCategoryTotal[], totalExpenses` | — |
| `BudgetComparison` | `BudgetComparison[]` | `onViewAll` |
| `AlertsPanel` | `AlertItem[], maxVisible` | `onAlertClick` |
| `MonthlyTrendChart` | `MonthlyTrend[]` | — |
| `TopExpenses` | `TopTransaction[]` | `onViewAll` |
| `QuickActions` | `actions data` | `onNavigate` |
| `SkeletonCard` | `width, height` | — |
| `MonthPicker` | `value, min, max` | `onChange` |
| `ViewToggle` | `activeView` | `onChange` |
| `AlertBadge` | `level, count` | — |
| `CategoryBadge` | `name, color` | — |
| `CurrencyDisplay` | `amount, size, color` | — |

---

## 17. Dados necessários no hook da página

`useDashboard(month: Date, view: ViewType)` deve retornar:

```typescript
{
  summary: MonthSummaryData
  expenseBreakdown: MacroCategoryTotal[]
  budgetComparison: BudgetComparison[]
  alerts: AlertItem[]
  trend: MonthlyTrend[]
  topExpenses: TopTransaction[]
  quickActions: QuickActionsData
  isLoading: boolean
  error: Error | null
}
```

Todas as queries passam por `snapshot.service.getOrCalculate(month)` para aproveitar cache.

---

## 18. Critérios de aceite visual

- [ ] Dashboard carrega em < 1.5s com 855 transações
- [ ] Resultado de mês com resgate exibe banner de distorção automaticamente
- [ ] Mês sem dados exibe CTA de importação visível e claro
- [ ] 4 cards do resumo visualmente distintos em hierarquia (resultado maior)
- [ ] Alertas de cheque especial aparecem em vermelho no topo do painel de alertas
- [ ] Categorias acima da média têm badge visual distinto
- [ ] Gráfico de evolução exibe linha zero e diferencia meses negativos visualmente
- [ ] Toggle Operacional/Caixa/Contábil muda os valores dos cards sem reload
- [ ] Navegação entre meses com ◀ ▶ recalcula tudo corretamente
- [ ] Estados de carregamento (skeleton) aparecem em todos os blocos simultaneamente
- [ ] Em mobile, cards de resumo ficam acessíveis via scroll horizontal sem quebrar
- [ ] Cores de receita (verde) e despesa (vermelho) consistentes em todos os blocos
- [ ] Sidebar com item ativo destacado visualmente em qualquer resolução desktop
- [ ] Badge de "Revisar lançamentos" aparece se `pending_review_count > 0`
- [ ] Números grandes usam separador de milhar (R$ 1.742, não R$ 1742)

---

*Versão 1.0 — 2026-06-10*
*Implementar após: types/ + engine/ + services/ concluídos (ver ARCHITECTURE.md fase 1A)*
