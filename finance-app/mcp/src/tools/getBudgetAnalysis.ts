import { fetchTransactions, fetchBudgets } from '../data/supabase.js'
import { macroTotals, avgMacroTotals, budgetByMacro, formatBRL, macroName } from '../data/engine.js'
import { MACRO_CATEGORIES } from '../config/categories.js'

export async function tool_getBudgetAnalysis({ month, compare_months = 3 }: { month: string; compare_months?: number }) {
  const [txns, budgets] = await Promise.all([
    fetchTransactions({ periodFrom: getPeriodFrom(month, compare_months + 1), periodTo: month }),
    fetchBudgets(month),
  ])

  const actual = macroTotals(txns, month)
  const avg = avgMacroTotals(txns, month, compare_months)
  const planned = budgetByMacro(budgets, month)

  const categories = MACRO_CATEGORIES
    .filter(m => m.displayInBudget)
    .map(m => {
      const act = actual.get(m.id) ?? 0
      const plan = planned.get(m.id) ?? 0
      const avgAmt = avg.get(m.id) ?? 0
      const deviation = act - plan
      const deviationPct = plan > 0 ? (deviation / plan) * 100 : null
      const vsAvgPct = avgAmt > 0 ? ((act - avgAmt) / avgAmt) * 100 : null
      const risk = plan > 0 && deviationPct !== null
        ? deviationPct > 10 ? 'over' : deviationPct > -5 ? 'warning' : 'ok'
        : 'no_budget'

      return {
        macro_category_id: m.id,
        name: m.name,
        planned: plan,
        planned_fmt: formatBRL(plan),
        actual: act,
        actual_fmt: formatBRL(act),
        avg_last_n: avgAmt,
        avg_last_n_fmt: formatBRL(avgAmt),
        deviation,
        deviation_fmt: formatBRL(deviation),
        deviation_pct: deviationPct !== null ? +deviationPct.toFixed(1) : null,
        vs_avg_pct: vsAvgPct !== null ? +vsAvgPct.toFixed(1) : null,
        risk,
      }
    })
    .filter(c => c.planned > 0 || c.actual > 0)

  const totalPlanned = categories.reduce((s, c) => s + c.planned, 0)
  const totalActual = categories.reduce((s, c) => s + c.actual, 0)
  const over = categories.filter(c => c.risk === 'over').map(c => c.name)
  const noBudget = budgets.length === 0

  return {
    month,
    no_budget_set: noBudget,
    total_planned: totalPlanned,
    total_planned_fmt: formatBRL(totalPlanned),
    total_actual: totalActual,
    total_actual_fmt: formatBRL(totalActual),
    total_deviation: totalActual - totalPlanned,
    total_deviation_fmt: formatBRL(totalActual - totalPlanned),
    categories_over_budget: over,
    categories,
    alerts: [
      ...(noBudget ? ['Orçamento não definido para este mês'] : []),
      ...over.map(n => `${n} acima do orçamento`),
    ],
  }
}

function getPeriodFrom(month: string, nMonthsBack: number): string {
  const [yr, mo] = month.split('-').map(Number)
  const m = mo - nMonthsBack
  const y = yr + Math.floor((m - 1) / 12)
  const mm = ((m - 1 + 12) % 12) + 1
  return `${y}-${String(mm).padStart(2, '0')}`
}
