import { getBudgets } from '../../services/budget.service'
import { getTransactionsOrMock } from '../../services/transactions.service'
import { getMacroCategoryTotals } from '../../engine/calculate'
import { getLast6Months } from '../../utils/date'
import { getAllMacroCategories } from '../../services/financeParentCategories.service'
import type { AgentToolResult } from '../types'

export interface GetBudgetAnalysisInput {
  month: string
  lastNMonths?: number
}

export interface CategoryBudget {
  macroCategoryId: string
  name: string
  planned: number
  actual: number
  deviation: number
  deviationPct: number
  avgLast3: number
  risk: 'ok' | 'warning' | 'over'
}

export interface GetBudgetAnalysisOutput {
  month: string
  categories: CategoryBudget[]
  totalPlanned: number
  totalActual: number
  totalDeviation: number
  noBudgetSet: boolean
}

export function getBudgetAnalysis(input: GetBudgetAnalysisInput): AgentToolResult<GetBudgetAnalysisOutput> {
  const alerts: string[] = []
  try {
    const { transactions } = getTransactionsOrMock()
    const budgets = getBudgets()
    const macros = getAllMacroCategories()
    const months = getLast6Months(input.month)
    const prevMonths = months.slice(1, 4)

    const monthBudgets = budgets.filter(b => b.referenceMonth === input.month && b.macroCategoryId)
    const actuals = getMacroCategoryTotals(transactions, input.month)

    const categories: CategoryBudget[] = []

    for (const macro of macros.filter(m => m.displayInBudget)) {
      const planned = monthBudgets.find(b => b.macroCategoryId === macro.id)?.plannedAmount ?? 0
      const actual = actuals.find(a => a.macroCategoryId === macro.id)?.total ?? 0

      const prevActuals = prevMonths.map(m => {
        const t = getMacroCategoryTotals(transactions, m)
        return t.find(x => x.macroCategoryId === macro.id)?.total ?? 0
      }).filter(x => x > 0)
      const avgLast3 = prevActuals.length > 0
        ? prevActuals.reduce((s, v) => s + v, 0) / prevActuals.length
        : 0

      const deviation = actual - planned
      const deviationPct = planned > 0 ? deviation / planned : 0
      const risk: CategoryBudget['risk'] =
        planned === 0 ? 'ok' : deviationPct > 0.1 ? 'over' : deviationPct > -0.05 ? 'warning' : 'ok'

      if (risk === 'over') alerts.push(`${macro.name} acima do orçamento em ${(deviationPct * 100).toFixed(0)}%`)

      if (planned > 0 || actual > 0) {
        categories.push({ macroCategoryId: macro.id, name: macro.name, planned, actual, deviation, deviationPct, avgLast3, risk })
      }
    }

    const totalPlanned = categories.reduce((s, c) => s + c.planned, 0)
    const totalActual = categories.reduce((s, c) => s + c.actual, 0)
    const noBudgetSet = monthBudgets.length === 0

    if (noBudgetSet) alerts.push('Orçamento não definido para este mês')

    return {
      tool: 'fin.getBudgetAnalysis',
      ok: true,
      data: { month: input.month, categories, totalPlanned, totalActual, totalDeviation: totalActual - totalPlanned, noBudgetSet },
      alerts,
    }
  } catch (err) {
    return { tool: 'fin.getBudgetAnalysis', ok: false, error: String(err), alerts }
  }
}
