import { fetchTransactions } from '../data/supabase.js'
import { macroTotals, avgMacroTotals, formatBRL, macroName, totalExpenses, totalIncome } from '../data/engine.js'
import { MACRO_CATEGORIES, EXPENSE_MACRO_IDS } from '../config/categories.js'

export async function tool_getSpendingInsights({ month, compare_months = 3 }: { month: string; compare_months?: number }) {
  const periodFrom = getPeriodFrom(month, compare_months + 1)
  const txns = await fetchTransactions({ periodFrom, periodTo: month })

  const current = macroTotals(txns, month)
  const avg = avgMacroTotals(txns, month, compare_months)

  const insights: {
    type: 'increase' | 'decrease' | 'opportunity' | 'new'
    macro_category_id: string
    name: string
    current: number
    current_fmt: string
    avg: number
    avg_fmt: string
    change_pct: number
    description: string
  }[] = []

  for (const macroId of EXPENSE_MACRO_IDS) {
    const cur = current.get(macroId) ?? 0
    const av = avg.get(macroId) ?? 0
    if (cur === 0 && av === 0) continue

    const changePct = av > 0 ? ((cur - av) / av) * 100 : 0
    const name = macroName(macroId)

    if (av === 0 && cur > 50) {
      insights.push({ type: 'new', macro_category_id: macroId, name, current: cur, current_fmt: formatBRL(cur), avg: 0, avg_fmt: formatBRL(0), change_pct: 100, description: `${name}: gasto novo este mês (${formatBRL(cur)})` })
    } else if (changePct > 20 && cur > 100) {
      insights.push({ type: 'increase', macro_category_id: macroId, name, current: cur, current_fmt: formatBRL(cur), avg: av, avg_fmt: formatBRL(av), change_pct: +changePct.toFixed(1), description: `${name} subiu ${changePct.toFixed(0)}% vs média (${formatBRL(av)} → ${formatBRL(cur)})` })
    } else if (changePct < -20 && av > 100) {
      insights.push({ type: 'opportunity', macro_category_id: macroId, name, current: cur, current_fmt: formatBRL(cur), avg: av, avg_fmt: formatBRL(av), change_pct: +changePct.toFixed(1), description: `${name} caiu ${Math.abs(changePct).toFixed(0)}% — bom momento para manter controle (${formatBRL(cur)} vs média ${formatBRL(av)})` })
    }
  }

  insights.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))

  const curTotal = [...current.values()].reduce((s, v) => s + v, 0)
  const prevTotals: number[] = []
  const [yr, mo] = month.split('-').map(Number)
  for (let i = 1; i <= compare_months; i++) {
    const m = mo - i
    const y = yr + Math.floor((m - 1) / 12)
    const mm = ((m - 1 + 12) % 12) + 1
    const pm = `${y}-${String(mm).padStart(2, '0')}`
    const t = [...macroTotals(txns, pm).values()].reduce((s, v) => s + v, 0)
    if (t > 0) prevTotals.push(t)
  }
  const avgTotal = prevTotals.length > 0 ? prevTotals.reduce((s, v) => s + v, 0) / prevTotals.length : 0

  const income = totalIncome(txns, month)
  const expenses = totalExpenses(txns, month)

  return {
    month,
    compare_months,
    income: income,
    income_fmt: formatBRL(income),
    expenses: expenses,
    expenses_fmt: formatBRL(expenses),
    result: income - expenses,
    result_fmt: formatBRL(income - expenses),
    total_spending_vs_avg: curTotal - avgTotal,
    total_spending_vs_avg_fmt: formatBRL(curTotal - avgTotal),
    top_increases: insights.filter(i => i.type === 'increase').slice(0, 5).map(i => i.name),
    insights: insights.slice(0, 10),
    alerts: insights.filter(i => i.type === 'increase').map(i => i.description),
  }
}

function getPeriodFrom(month: string, nMonthsBack: number): string {
  const [yr, mo] = month.split('-').map(Number)
  const m = mo - nMonthsBack
  const y = yr + Math.floor((m - 1) / 12)
  const mm = ((m - 1 + 12) % 12) + 1
  return `${y}-${String(mm).padStart(2, '0')}`
}
