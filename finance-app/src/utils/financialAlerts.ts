import type { Transaction, Budget } from '../types'
import { getLast6Months, getCompetenceMonth } from './date'
import { MACRO_CATEGORIES } from '../config/categories'
import { findDuplicateCandidateIds } from './dataQuality'
import { formatBRL } from './currency'

export interface FinancialAlert {
  id: string
  type:
    | 'budget_over'
    | 'above_avg_category'
    | 'above_avg_transaction'
    | 'recurring_spike'
    | 'income_below_avg'
    | 'many_uncategorized'
    | 'excess_financial_cost'
    | 'category_spike'
    | 'probable_duplicate'
    | 'suspicious_neutral'
  severity: 'high' | 'medium' | 'low'
  title: string
  message: string
  amount?: number
  deltaPercent?: number
  macroCategoryId?: string
  transactionIds?: string[]
  actionLabel?: string
  actionFilter?: string
}

function avgMacroExpense(txns: Transaction[], macroId: string, refMonth: string, n = 3): number {
  const months = getLast6Months(refMonth).slice(1, 1 + n)
  const totals = months
    .map(m =>
      txns
        .filter(
          t =>
            getCompetenceMonth(t.competenceDate) === m &&
            t.macroCategoryId === macroId &&
            t.includeInOperationalResult &&
            t.type === 'expense' &&
            t.status !== 'cancelled',
        )
        .reduce((s, t) => s + t.amount, 0),
    )
    .filter(v => v > 0)
  return totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
}

function avgIncome(txns: Transaction[], refMonth: string, n = 3): number {
  const months = getLast6Months(refMonth).slice(1, 1 + n)
  const totals = months
    .map(m =>
      txns
        .filter(
          t =>
            getCompetenceMonth(t.competenceDate) === m &&
            t.includeInOperationalResult &&
            t.type === 'income' &&
            t.status !== 'cancelled',
        )
        .reduce((s, t) => s + t.amount, 0),
    )
    .filter(v => v > 0)
  return totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
}

export function generateFinancialAlerts(
  allTransactions: Transaction[],
  month: string,
  budgets: Budget[],
): FinancialAlert[] {
  const alerts: FinancialAlert[] = []

  const monthTxns = allTransactions.filter(
    t => getCompetenceMonth(t.competenceDate) === month && t.status !== 'cancelled',
  )

  const monthBudgets = budgets.filter(
    b => b.referenceMonth.startsWith(month) && b.macroCategoryId !== 'mac_receita_op',
  )

  // 1. Budget over (per macro category)
  for (const budget of monthBudgets) {
    const realized = monthTxns
      .filter(
        t =>
          t.macroCategoryId === budget.macroCategoryId &&
          t.includeInBudget &&
          t.type === 'expense',
      )
      .reduce((s, t) => s + t.amount, 0)

    if (realized > budget.plannedAmount && budget.plannedAmount > 0) {
      const delta = realized - budget.plannedAmount
      const pct = (delta / budget.plannedAmount) * 100
      const macro = MACRO_CATEGORIES.find(m => m.id === budget.macroCategoryId)
      alerts.push({
        id: `alert_budget_${budget.macroCategoryId}`,
        type: 'budget_over',
        severity: pct > 40 ? 'high' : 'medium',
        title: `Orçamento ultrapassado: ${macro?.name ?? budget.macroCategoryId}`,
        message: `Realizado ${formatBRL(realized)} vs planejado ${formatBRL(budget.plannedAmount)} (+${pct.toFixed(0)}%)`,
        amount: delta,
        deltaPercent: pct,
        macroCategoryId: budget.macroCategoryId,
        actionLabel: 'Ver lançamentos',
        actionFilter: budget.macroCategoryId,
      })
    }
  }

  // 2. Category above 3m average (even without budget)
  const expenseMacros = MACRO_CATEGORIES.filter(m =>
    ['operational_expense', 'debt_cost'].includes(m.classificationType),
  )
  for (const macro of expenseMacros) {
    const realized = monthTxns
      .filter(t => t.macroCategoryId === macro.id && t.includeInOperationalResult && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    const avg = avgMacroExpense(allTransactions, macro.id, month)
    if (avg > 0 && realized > avg * 1.4 && realized > 200) {
      const delta = realized - avg
      const pct = (delta / avg) * 100
      // Skip if already flagged by budget
      if (alerts.find(a => a.id === `alert_budget_${macro.id}`)) continue
      alerts.push({
        id: `alert_avg_${macro.id}`,
        type: 'above_avg_category',
        severity: pct > 80 ? 'high' : 'medium',
        title: `${macro.name} acima da média`,
        message: `${formatBRL(realized)} vs média histórica ${formatBRL(avg)} (+${pct.toFixed(0)}%)`,
        amount: delta,
        deltaPercent: pct,
        macroCategoryId: macro.id,
        actionLabel: 'Ver lançamentos',
        actionFilter: macro.id,
      })
    }
  }

  // 3. Individual transaction above average for its category
  const avgPerTx = monthTxns
    .filter(t => t.type === 'expense' && t.includeInOperationalResult)
    .map(t => t.amount)
  const globalAvg = avgPerTx.length ? avgPerTx.reduce((a, b) => a + b, 0) / avgPerTx.length : 0
  const highThreshold = Math.max(globalAvg * 4, 2000)

  const highTxs = monthTxns.filter(
    t => t.type === 'expense' && t.includeInOperationalResult && t.amount > highThreshold,
  )
  if (highTxs.length > 0) {
    alerts.push({
      id: 'alert_high_tx',
      type: 'above_avg_transaction',
      severity: 'medium',
      title: `${highTxs.length} gasto(s) de alto valor`,
      message: `${highTxs.length} lançamento(s) acima de ${formatBRL(highThreshold)} este mês`,
      amount: highTxs.reduce((s, t) => s + t.amount, 0),
      transactionIds: highTxs.map(t => t.id),
      actionLabel: 'Ver alto valor',
      actionFilter: 'high_value',
    })
  }

  // 4. Income below 3m average
  const incomeRealized = monthTxns
    .filter(t => t.includeInOperationalResult && t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const incomeAvg = avgIncome(allTransactions, month)
  if (incomeAvg > 0 && incomeRealized < incomeAvg * 0.8 && incomeRealized > 0) {
    const delta = incomeAvg - incomeRealized
    alerts.push({
      id: 'alert_income_low',
      type: 'income_below_avg',
      severity: 'high',
      title: 'Receita abaixo da média',
      message: `${formatBRL(incomeRealized)} vs média histórica ${formatBRL(incomeAvg)} (−${((delta / incomeAvg) * 100).toFixed(0)}%)`,
      amount: delta,
      deltaPercent: ((delta / incomeAvg) * 100),
    })
  }

  // 5. Many uncategorized
  const uncatCount = monthTxns.filter(t => !t.macroCategoryId && t.type === 'expense').length
  const totalExpenseTxs = monthTxns.filter(t => t.type === 'expense').length
  if (uncatCount > 5 || (totalExpenseTxs > 0 && uncatCount / totalExpenseTxs > 0.2)) {
    alerts.push({
      id: 'alert_uncat',
      type: 'many_uncategorized',
      severity: uncatCount > 15 ? 'high' : 'medium',
      title: `${uncatCount} lançamentos sem categoria`,
      message: `${Math.round((uncatCount / Math.max(totalExpenseTxs, 1)) * 100)}% das despesas estão sem classificação`,
      transactionIds: monthTxns.filter(t => !t.macroCategoryId && t.type === 'expense').map(t => t.id),
      actionLabel: 'Classificar agora',
      actionFilter: 'no_category',
    })
  }

  // 6. Excess financial cost (debt_cost)
  const debtTxs = monthTxns.filter(t => t.classificationType === 'debt_cost')
  const debtTotal = debtTxs.reduce((s, t) => s + t.amount, 0)
  if (debtTotal > 100) {
    alerts.push({
      id: 'alert_debt',
      type: 'excess_financial_cost',
      severity: debtTotal > 1000 ? 'high' : 'medium',
      title: 'Custos financeiros detectados',
      message: `${formatBRL(debtTotal)} em juros, IOF, tarifas ou dívidas este mês`,
      amount: debtTotal,
      transactionIds: debtTxs.map(t => t.id),
      actionLabel: 'Ver custos financeiros',
    })
  }

  // 7. Probable duplicates
  const dupeIds = findDuplicateCandidateIds(monthTxns)
  if (dupeIds.size > 0) {
    const dupeTxs = [...dupeIds].map(id => monthTxns.find(t => t.id === id)).filter(Boolean) as Transaction[]
    const dupeTotal = dupeTxs.reduce((s, t) => s + t.amount, 0)
    alerts.push({
      id: 'alert_dupes',
      type: 'probable_duplicate',
      severity: 'high',
      title: `${Math.floor(dupeIds.size / 2)} possível(is) duplicidade(s)`,
      message: `${dupeIds.size} lançamentos com mesma data/valor/descrição — total: ${formatBRL(dupeTotal)}`,
      amount: dupeTotal,
      transactionIds: [...dupeIds],
      actionLabel: 'Ver duplicados',
      actionFilter: 'duplicates',
    })
  }

  // Deduplicate and sort by severity
  const seen = new Set<string>()
  const unique = alerts.filter(a => {
    if (seen.has(a.id)) return false
    seen.add(a.id)
    return true
  })

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
  return unique.sort((a, b) => order[a.severity] - order[b.severity])
}
