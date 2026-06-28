import { getTransactionsOrMock } from '../../services/transactions.service'
import { getMacroCategoryTotals } from '../../engine/calculate'
import { getLast6Months } from '../../utils/date'
import { getAllMacroCategories } from '../../services/financeParentCategories.service'
import type { AgentToolResult } from '../types'

export interface GetSpendingInsightsInput {
  month: string
  compareLastN?: number
}

export interface SpendingInsight {
  type: 'increase' | 'decrease' | 'opportunity'
  macroCategoryId: string
  categoryName: string
  currentAmount: number
  avgAmount: number
  changeAmt: number
  changePct: number
  description: string
}

export interface GetSpendingInsightsOutput {
  month: string
  insights: SpendingInsight[]
  totalSpendingVsAvg: number
  topGrowthCategories: string[]
}

const EXPENSE_TYPES = new Set(['operational_expense', 'debt_cost'])

export function getSpendingInsights(input: GetSpendingInsightsInput): AgentToolResult<GetSpendingInsightsOutput> {
  const alerts: string[] = []
  try {
    const { transactions } = getTransactionsOrMock()
    const macros = getAllMacroCategories()
    const months = getLast6Months(input.month)
    const compareN = input.compareLastN ?? 3
    const prevMonths = months.slice(1, compareN + 1)

    const currentTotals = getMacroCategoryTotals(transactions, input.month)
    const insights: SpendingInsight[] = []

    for (const macro of macros.filter(m => EXPENSE_TYPES.has(m.classificationType))) {
      const current = currentTotals.find(t => t.macroCategoryId === macro.id)?.total ?? 0

      const prevAmounts = prevMonths
        .map(m => getMacroCategoryTotals(transactions, m).find(x => x.macroCategoryId === macro.id)?.total ?? 0)
        .filter(x => x > 0)

      if (prevAmounts.length === 0 && current === 0) continue

      const avg = prevAmounts.length > 0 ? prevAmounts.reduce((s, v) => s + v, 0) / prevAmounts.length : 0
      const changeAmt = current - avg
      const changePct = avg > 0 ? changeAmt / avg : 0

      if (changePct > 0.2 && current > 100) {
        insights.push({
          type: 'increase',
          macroCategoryId: macro.id,
          categoryName: macro.name,
          currentAmount: current,
          avgAmount: avg,
          changeAmt,
          changePct,
          description: `${macro.name} subiu ${(changePct * 100).toFixed(0)}% vs média dos últimos ${compareN} meses`,
        })
        alerts.push(`${macro.name} cresceu ${(changePct * 100).toFixed(0)}% vs períodos anteriores`)
      } else if (changePct < -0.2 && avg > 100) {
        insights.push({
          type: 'opportunity',
          macroCategoryId: macro.id,
          categoryName: macro.name,
          currentAmount: current,
          avgAmount: avg,
          changeAmt,
          changePct,
          description: `${macro.name} caiu ${Math.abs(changePct * 100).toFixed(0)}% — oportunidade de manter controle`,
        })
      }
    }

    insights.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))

    const totalCurrent = currentTotals
      .filter(t => EXPENSE_TYPES.has(macros.find(m => m.id === t.macroCategoryId)?.classificationType ?? ''))
      .reduce((s, t) => s + t.total, 0)

    const prevTotals = prevMonths.map(m =>
      getMacroCategoryTotals(transactions, m)
        .filter(t => EXPENSE_TYPES.has(macros.find(x => x.id === t.macroCategoryId)?.classificationType ?? ''))
        .reduce((s, t) => s + t.total, 0),
    )
    const avgTotal = prevTotals.length > 0 ? prevTotals.reduce((s, v) => s + v, 0) / prevTotals.length : 0

    return {
      tool: 'fin.getSpendingInsights',
      ok: true,
      data: {
        month: input.month,
        insights: insights.slice(0, 10),
        totalSpendingVsAvg: totalCurrent - avgTotal,
        topGrowthCategories: insights.filter(i => i.type === 'increase').map(i => i.categoryName).slice(0, 3),
      },
      alerts,
    }
  } catch (err) {
    return { tool: 'fin.getSpendingInsights', ok: false, error: String(err), alerts }
  }
}
