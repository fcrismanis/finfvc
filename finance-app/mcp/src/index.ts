import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { tool_getTransactions } from './tools/getTransactions.js'
import { tool_getBudgetAnalysis } from './tools/getBudgetAnalysis.js'
import { tool_getSpendingInsights } from './tools/getSpendingInsights.js'
import { tool_getReconciliationStatus } from './tools/getReconciliationStatus.js'
import { tool_suggestCategoryChanges } from './tools/suggestCategoryChanges.js'
import { tool_applyCategoryChanges } from './tools/applyCategoryChanges.js'

const server = new McpServer({
  name: 'Economista FIN',
  version: '1.0.0',
})

// ── fin_get_transactions ──────────────────────────────────────────────────────
server.tool(
  'fin_get_transactions',
  'Lista lançamentos financeiros do FINFVC com filtros. Modo leitura.',
  {
    period: z.string().optional().describe('Mês no formato YYYY-MM (ex: 2026-06)'),
    period_from: z.string().optional().describe('Período de (YYYY-MM)'),
    period_to: z.string().optional().describe('Período até (YYYY-MM)'),
    account_id: z.string().optional().describe('Filtrar por conta específica'),
    macro_category_id: z.string().optional().describe('Filtrar por macro-categoria (ex: mac_alimentacao)'),
    type: z.enum(['income', 'expense', 'any']).optional().describe('Tipo de lançamento'),
    status: z.enum(['paid', 'pending', 'cancelled', 'any']).optional(),
    text: z.string().optional().describe('Busca no texto da descrição'),
    needs_review: z.boolean().optional().describe('Somente lançamentos que precisam de revisão'),
    limit: z.number().optional().describe('Máximo de resultados (padrão: 500)'),
  },
  async (input) => {
    const result = await tool_getTransactions(input)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

// ── fin_get_budget_analysis ───────────────────────────────────────────────────
server.tool(
  'fin_get_budget_analysis',
  'Analisa orçamento vs realizado por categoria. Mostra desvios e médias históricas.',
  {
    month: z.string().describe('Mês de referência (YYYY-MM)'),
    compare_months: z.number().optional().describe('Quantos meses anteriores usar para calcular média (padrão: 3)'),
  },
  async (input) => {
    const result = await tool_getBudgetAnalysis(input)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

// ── fin_get_spending_insights ─────────────────────────────────────────────────
server.tool(
  'fin_get_spending_insights',
  'Detecta variações de gastos vs meses anteriores. Identifica categorias em alta, em queda e oportunidades de economia.',
  {
    month: z.string().describe('Mês de referência (YYYY-MM)'),
    compare_months: z.number().optional().describe('Meses de histórico para comparação (padrão: 3)'),
  },
  async (input) => {
    const result = await tool_getSpendingInsights(input)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

// ── fin_get_reconciliation_status ─────────────────────────────────────────────
server.tool(
  'fin_get_reconciliation_status',
  'Verifica status de reconciliação: movimentos internos não neutralizados, pendências de revisão, despesas pendentes.',
  {
    month: z.string().describe('Mês de referência (YYYY-MM)'),
    account_id: z.string().optional().describe('Filtrar por conta específica'),
  },
  async (input) => {
    const result = await tool_getReconciliationStatus(input)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

// ── fin_suggest_category_changes ──────────────────────────────────────────────
server.tool(
  'fin_suggest_category_changes',
  'Cria um plano de reclassificação de lançamentos. SOMENTE SUGESTÃO — não altera dados. Retorna plan_id para usar em fin_apply_category_changes.',
  {
    target_macro_category_id: z.string().describe('ID da macro-categoria destino (ex: mac_alimentacao)'),
    period: z.string().optional().describe('Filtrar por mês (YYYY-MM)'),
    period_from: z.string().optional(),
    period_to: z.string().optional(),
    text_contains: z.string().optional().describe('Filtrar por texto na descrição'),
    current_macro_category_id: z.string().optional().describe('Filtrar por categoria atual'),
    reason: z.string().optional().describe('Motivo da reclassificação (para histórico)'),
    skip_manual_overrides: z.boolean().optional().describe('Pular lançamentos com override manual (padrão: true)'),
  },
  async (input) => {
    const result = await tool_suggestCategoryChanges(input)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

// ── fin_apply_category_changes ────────────────────────────────────────────────
server.tool(
  'fin_apply_category_changes',
  '⚠️ ESCRITA — aplica um plano de reclassificação criado por fin_suggest_category_changes. Requer confirmed=true explícito. Sem rollback automático.',
  {
    plan_id: z.string().describe('ID do plano retornado por fin_suggest_category_changes'),
    confirmed: z.boolean().describe('OBRIGATÓRIO true para executar. false apenas simula sem alterar.'),
  },
  async (input) => {
    const result = await tool_applyCategoryChanges(input)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

// ── Start ─────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // MCP servers must NOT write to stdout (it's the protocol channel)
  process.stderr.write('[Economista FIN] MCP server iniciado\n')
}

main().catch(e => {
  process.stderr.write(`[Economista FIN] Fatal: ${e}\n`)
  process.exit(1)
})
