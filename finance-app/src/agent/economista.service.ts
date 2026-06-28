import { getTransactions } from './tools/getTransactions'
import { getBudgetAnalysis } from './tools/getBudgetAnalysis'
import { getReconciliationStatus } from './tools/getReconciliationStatus'
import { getSpendingInsights } from './tools/getSpendingInsights'
import type { AgentToolResult } from './types'
import { formatBRL } from '../utils/currency'

export type EconomistaProvider = 'simulated' | 'gpt' | 'claude' | 'openrouter' | 'hermes'

export interface EconomistaContext {
  month: string
}

export interface EconomistaResponse {
  answer: string
  toolsUsed: string[]
  alerts: string[]
  diagnosticData: Record<string, AgentToolResult>
}

const RECONCILIATION_RE = /reconcil|concilia|pendente|fatura|cartão|conta|itaú|bradesco|nubank|santander|bb\b/i

function buildContextText(month: string, results: Record<string, AgentToolResult>): string {
  const lines: string[] = [`# Dados financeiros do Economista FIN — ${month}`, '']

  const tx = results['getTransactions']?.data as ReturnType<typeof getTransactions>['data']
  if (tx) {
    lines.push('## Lançamentos do mês')
    lines.push(`- Total de registros: ${tx.count}`)
    lines.push(`- Receita: ${formatBRL(tx.totalIncome)}`)
    lines.push(`- Despesas: ${formatBRL(tx.totalExpense)}`)
    lines.push(`- Resultado: ${formatBRL(tx.totalIncome - tx.totalExpense)}`)
    if (tx.needsReviewCount > 0) lines.push(`- Precisam revisão: ${tx.needsReviewCount}`)
    if (tx.uncategorizedCount > 0) lines.push(`- Sem categoria: ${tx.uncategorizedCount}`)
    lines.push('')
  }

  const bud = results['getBudgetAnalysis']?.data as ReturnType<typeof getBudgetAnalysis>['data']
  if (bud && bud.categories.length > 0) {
    lines.push('## Orçamento vs Realizado')
    if (bud.noBudgetSet) {
      lines.push('- Orçamento não definido para este mês')
    } else {
      lines.push(`- Planejado total: ${formatBRL(bud.totalPlanned)}`)
      lines.push(`- Realizado total: ${formatBRL(bud.totalActual)}`)
      lines.push(`- Desvio total: ${formatBRL(bud.totalDeviation)}`)
      for (const c of bud.categories.filter(c => c.planned > 0 || c.actual > 0).slice(0, 8)) {
        const pct = c.planned > 0 ? ` (${c.deviationPct >= 0 ? '+' : ''}${(c.deviationPct * 100).toFixed(0)}%)` : ''
        lines.push(`- ${c.name}: planejado ${formatBRL(c.planned)} | realizado ${formatBRL(c.actual)}${pct}`)
      }
    }
    lines.push('')
  }

  const ins = results['getSpendingInsights']?.data as ReturnType<typeof getSpendingInsights>['data']
  if (ins && ins.insights.length > 0) {
    lines.push('## Variações de gastos vs meses anteriores')
    lines.push(`- Variação total vs média: ${formatBRL(ins.totalSpendingVsAvg)}`)
    for (const i of ins.insights.slice(0, 5)) {
      lines.push(`- ${i.description}`)
    }
    lines.push('')
  }

  const rec = results['getReconciliationStatus']?.data as ReturnType<typeof getReconciliationStatus>['data']
  if (rec) {
    lines.push('## Status de reconciliação')
    lines.push(`- Movimentos internos não neutralizados: ${rec.neutralCandidates}`)
    lines.push(`- Pendentes de revisão: ${rec.needsReviewCount}`)
    lines.push(`- Despesas pendentes: ${rec.pendingExpenses}`)
    lines.push('')
  }

  lines.push('---')
  lines.push('Responda em português do Brasil. Use apenas os dados acima. Não invente valores.')

  return lines.join('\n')
}

function buildSimulatedAnswer(question: string, month: string, results: Record<string, AgentToolResult>): string {
  const tx = results['getTransactions']?.data as ReturnType<typeof getTransactions>['data']
  const ins = results['getSpendingInsights']?.data as ReturnType<typeof getSpendingInsights>['data']
  const bud = results['getBudgetAnalysis']?.data as ReturnType<typeof getBudgetAnalysis>['data']
  const rec = results['getReconciliationStatus']?.data as ReturnType<typeof getReconciliationStatus>['data']

  const parts: string[] = []

  if (tx) {
    const saldo = tx.totalIncome - tx.totalExpense
    parts.push(`**Resumo de ${month}:**`)
    parts.push(`Receita ${formatBRL(tx.totalIncome)} | Despesas ${formatBRL(tx.totalExpense)} | Resultado ${saldo >= 0 ? '+' : ''}${formatBRL(saldo)}`)
    if (tx.needsReviewCount > 0) parts.push(`⚠️ ${tx.needsReviewCount} lançamentos precisam de revisão.`)
    if (tx.uncategorizedCount > 0) parts.push(`⚠️ ${tx.uncategorizedCount} lançamentos sem categoria.`)
  }

  if (ins && ins.insights.length > 0) {
    parts.push('')
    parts.push('**Variações detectadas:**')
    ins.insights.slice(0, 3).forEach(i => parts.push(`• ${i.description}`))
  }

  if (bud && !bud.noBudgetSet) {
    const over = bud.categories.filter(c => c.risk === 'over')
    if (over.length > 0) {
      parts.push('')
      parts.push('**Categorias acima do orçamento:**')
      over.forEach(c => parts.push(`• ${c.name}: ${formatBRL(c.actual)} (planejado ${formatBRL(c.planned)})`))
    }
  }

  if (rec && (rec.neutralCandidates > 0 || rec.needsReviewCount > 0)) {
    parts.push('')
    parts.push('**Reconciliação:**')
    if (rec.neutralCandidates > 0) parts.push(`• ${rec.neutralCandidates} movimentos internos aguardam neutralização`)
    if (rec.needsReviewCount > 0) parts.push(`• ${rec.needsReviewCount} lançamentos aguardam revisão`)
  }

  if (parts.length === 0) {
    return `Modo simulado ativo. Para análise real, configure um provedor de IA nas configurações do Consultor.\n\nPergunta recebida: "${question}"`
  }

  return parts.join('\n')
}

export async function askEconomista(
  question: string,
  ctx: EconomistaContext,
  provider: EconomistaProvider,
): Promise<EconomistaResponse> {
  const toolsUsed: string[] = []
  const allAlerts: string[] = []
  const diagnosticData: Record<string, AgentToolResult> = {}

  const txResult = getTransactions({ period: ctx.month, limit: 300 })
  diagnosticData['getTransactions'] = txResult
  toolsUsed.push('fin.getTransactions')
  allAlerts.push(...txResult.alerts)

  const budgetResult = getBudgetAnalysis({ month: ctx.month, lastNMonths: 3 })
  diagnosticData['getBudgetAnalysis'] = budgetResult
  toolsUsed.push('fin.getBudgetAnalysis')
  allAlerts.push(...budgetResult.alerts)

  const insightsResult = getSpendingInsights({ month: ctx.month, compareLastN: 3 })
  diagnosticData['getSpendingInsights'] = insightsResult
  toolsUsed.push('fin.getSpendingInsights')
  allAlerts.push(...insightsResult.alerts)

  if (RECONCILIATION_RE.test(question)) {
    const recResult = getReconciliationStatus({ month: ctx.month })
    diagnosticData['getReconciliationStatus'] = recResult
    toolsUsed.push('fin.getReconciliationStatus')
    allAlerts.push(...recResult.alerts)
  }

  const uniqueAlerts = [...new Set(allAlerts)]

  if (provider === 'simulated') {
    return {
      answer: buildSimulatedAnswer(question, ctx.month, diagnosticData),
      toolsUsed,
      alerts: uniqueAlerts,
      diagnosticData,
    }
  }

  const contextText = buildContextText(ctx.month, diagnosticData)

  try {
    const res = await fetch('/api/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        question,
        month: ctx.month,
        context: {
          summary: contextText,
          transactions: [],
          budget: {},
        },
        systemPromptExtra: `Você é o Economista FIN — assistente financeiro pessoal integrado ao FINFVC.
Modo atual: Diagnóstico (somente leitura — não execute ações).
Analise apenas os dados fornecidos. Responda em português do Brasil.
Separe fatos observados, hipóteses e recomendações.`,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { answer?: string }
    return {
      answer: json.answer ?? 'Sem resposta do servidor.',
      toolsUsed,
      alerts: uniqueAlerts,
      diagnosticData,
    }
  } catch {
    return {
      answer: 'Erro ao conectar com o backend. Verifique se o servidor está rodando ou use o modo Simulado.',
      toolsUsed,
      alerts: uniqueAlerts,
      diagnosticData,
    }
  }
}
