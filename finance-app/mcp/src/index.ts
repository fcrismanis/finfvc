import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import express from 'express'
import { tool_getTransactions } from './tools/getTransactions.js'
import { tool_getBudgetAnalysis } from './tools/getBudgetAnalysis.js'
import { tool_getSpendingInsights } from './tools/getSpendingInsights.js'
import { tool_getReconciliationStatus } from './tools/getReconciliationStatus.js'
import { tool_suggestCategoryChanges } from './tools/suggestCategoryChanges.js'
import { tool_applyCategoryChanges } from './tools/applyCategoryChanges.js'
import { tool_updateTransaction } from './tools/updateTransaction.js'
import { tool_createTransaction } from './tools/createTransaction.js'
import { tool_getBudgets, tool_setBudget, tool_copyBudget } from './tools/manageBudget.js'
import { tool_getCategories, tool_createSubCategory, tool_markTransactionsNeutral, tool_deleteTransaction } from './tools/manageCategories.js'

function buildServer() {
  const server = new McpServer({
    name: 'Economista FIN',
    version: '1.0.0',
  })

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

  server.tool(
    'fin_apply_category_changes',
    '⚠️ ESCRITA — aplica um plano de reclassificação criado por fin_suggest_category_changes. Requer confirmed=true explícito.',
    {
      plan_id: z.string().describe('ID do plano retornado por fin_suggest_category_changes'),
      confirmed: z.boolean().describe('OBRIGATÓRIO true para executar. false apenas simula sem alterar.'),
    },
    async (input) => {
      const result = await tool_applyCategoryChanges(input)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  // ── Escrita direta ─────────────────────────────────────────────────────────

  server.tool(
    'fin_update_transaction',
    'Atualiza campos de um lançamento: categoria, descrição, notas, status, incluir_no_resultado, etc.',
    {
      id: z.string().describe('ID do lançamento'),
      macro_category_id: z.string().optional().describe('Nova macro-categoria (ex: mac_alimentacao)'),
      category_id: z.string().optional(),
      sub_category_id: z.string().optional(),
      classification_type: z.string().optional(),
      description: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(['paid', 'pending', 'cancelled']).optional(),
      include_in_operational_result: z.boolean().optional(),
      include_in_budget: z.boolean().optional(),
      needs_review: z.boolean().optional(),
    },
    async (input) => {
      const result = await tool_updateTransaction(input)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'fin_create_transaction',
    'Cria um lançamento manual no FINFVC.',
    {
      description: z.string().describe('Descrição do lançamento'),
      amount: z.number().describe('Valor (positivo)'),
      type: z.enum(['income', 'expense']).describe('Receita ou despesa'),
      competence_date: z.string().describe('Data no formato YYYY-MM-DD'),
      macro_category_id: z.string().optional(),
      classification_type: z.string().optional(),
      status: z.enum(['paid', 'pending']).optional(),
      notes: z.string().optional(),
      account_id: z.string().optional(),
      payment_method: z.string().optional(),
    },
    async (input) => {
      const result = await tool_createTransaction(input)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'fin_delete_transaction',
    '⚠️ IRREVERSÍVEL — exclui um lançamento permanentemente. Requer confirm=true.',
    {
      id: z.string().describe('ID do lançamento'),
      confirm: z.boolean().describe('OBRIGATÓRIO true para excluir permanentemente'),
    },
    async (input) => {
      const result = await tool_deleteTransaction(input)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'fin_mark_neutral',
    'Neutraliza lançamentos (transferências internas, pagamentos de fatura, etc.) — exclui do resultado operacional.',
    {
      transaction_ids: z.array(z.string()).describe('Lista de IDs dos lançamentos'),
      reason: z.string().optional().describe('Motivo da neutralização'),
    },
    async (input) => {
      const result = await tool_markTransactionsNeutral(input)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'fin_get_budgets',
    'Lista orçamentos de um mês.',
    { month: z.string().describe('Mês YYYY-MM') },
    async (input) => {
      const result = await tool_getBudgets(input)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'fin_set_budget',
    'Define ou atualiza o orçamento de uma categoria para um mês.',
    {
      month: z.string().describe('Mês YYYY-MM'),
      macro_category_id: z.string().describe('ID da macro-categoria (ex: mac_alimentacao)'),
      amount: z.number().describe('Valor planejado em reais'),
    },
    async (input) => {
      const result = await tool_setBudget(input)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'fin_copy_budget',
    'Copia o orçamento de um mês para outro.',
    {
      from_month: z.string().describe('Mês origem YYYY-MM'),
      to_month: z.string().describe('Mês destino YYYY-MM'),
    },
    async (input) => {
      const result = await tool_copyBudget(input)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'fin_get_categories',
    'Lista todas as macro-categorias e subcategorias disponíveis.',
    {},
    async () => {
      const result = await tool_getCategories()
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'fin_create_subcategory',
    'Cria uma nova subcategoria.',
    {
      name: z.string().describe('Nome da subcategoria'),
      macro_category_id: z.string().describe('ID da macro-categoria pai'),
      essentiality: z.enum(['essential', 'non_essential', 'inherit']).optional(),
    },
    async (input) => {
      const result = await tool_createSubCategory(input)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  return server
}

// ── HTTP mode (Open WebUI / LLM custom) ───────────────────────────────────────
async function startHttp() {
  const port = Number(process.env.MCP_PORT ?? 3010)
  const app = express()
  app.use(express.json())

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'Economista FIN MCP', version: '1.0.0' })
  })

  // MCP endpoint — cada requisição recebe seu próprio servidor (stateless)
  app.post('/mcp', async (req, res) => {
    const server = buildServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    })
    res.on('close', () => { server.close().catch(() => {}) })
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  })

  app.get('/mcp', async (req, res) => {
    const server = buildServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })
    res.on('close', () => { server.close().catch(() => {}) })
    await server.connect(transport)
    await transport.handleRequest(req, res)
  })

  app.listen(port, () => {
    process.stderr.write(`[Economista FIN] HTTP MCP server em :${port}/mcp\n`)
  })
}

// ── Stdio mode (Claude Code local) ───────────────────────────────────────────
async function startStdio() {
  const server = buildServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write('[Economista FIN] stdio MCP server iniciado\n')
}

// ── Entry point ───────────────────────────────────────────────────────────────
const mode = process.env.MCP_TRANSPORT ?? 'stdio'

if (mode === 'http') {
  startHttp().catch(e => {
    process.stderr.write(`[Economista FIN] Fatal: ${e}\n`)
    process.exit(1)
  })
} else {
  startStdio().catch(e => {
    process.stderr.write(`[Economista FIN] Fatal: ${e}\n`)
    process.exit(1)
  })
}
