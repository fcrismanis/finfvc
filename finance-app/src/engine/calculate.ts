import type {
  Transaction, Budget, MacroCategoryTotal, BudgetComparison,
  MonthSummaryData, AlertItem, MonthlyTrend, TopTransaction
} from '../types'
import { MACRO_CATEGORIES, getMacroById } from '../config/categories'
import { getCompetenceMonth, formatMonthLabel, getLast6Months } from '../utils/date'

function txInMonth(tx: Transaction, month: string): boolean {
  return getCompetenceMonth(tx.competenceDate) === month && tx.status !== 'cancelled'
}

function txActive(tx: Transaction): boolean {
  return !tx.isAdjustment || tx.status !== 'cancelled'
}

export function getOperationalIncome(txns: Transaction[], month: string): number {
  return txns
    .filter(tx => txInMonth(tx, month) && txActive(tx) && tx.includeInOperationalResult && tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0)
}

export function getTotalExpenses(txns: Transaction[], month: string): number {
  return txns
    .filter(tx => txInMonth(tx, month) && txActive(tx) && tx.includeInOperationalResult && tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0)
}

export function getRedemptionTotal(txns: Transaction[], month: string): number {
  return txns
    .filter(tx => txInMonth(tx, month) && tx.classificationType === 'redemption' && tx.status !== 'cancelled')
    .reduce((sum, tx) => sum + tx.amount, 0)
}

export function getPendingAmount(txns: Transaction[]): number {
  return txns
    .filter(tx => tx.status === 'pending' && tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0)
}

export function getMonthSummary(
  txns: Transaction[],
  month: string,
  budgets: Budget[]
): MonthSummaryData {
  const income = getOperationalIncome(txns, month)
  const expenses = getTotalExpenses(txns, month)
  const result = income - expenses
  const redemption = getRedemptionTotal(txns, month)

  const monthBudgets = budgets.filter(b => b.referenceMonth.startsWith(month))
  const plannedIncome = monthBudgets.find(b => b.macroCategoryId === 'mac_receita_op')?.plannedAmount ?? 0
  const plannedExpenses = monthBudgets
    .filter(b => b.macroCategoryId !== 'mac_receita_op')
    .reduce((s, b) => s + b.plannedAmount, 0)

  const avg3mIncome = getAvgIncome(txns, month, 3)
  const isAtypical = avg3mIncome > 0 && income > avg3mIncome * 1.4

  return {
    operationalIncome: income,
    totalExpenses: expenses,
    operationalResult: result,
    savingsRate: income > 0 ? result / income : 0,
    pendingAmount: getPendingAmount(txns),
    plannedIncome,
    plannedExpenses,
    hasRedemption: redemption > 0,
    redemptionAmount: redemption,
    realOperationalResult: result,
    isAtypicalMonth: isAtypical,
    atypicalReason: isAtypical ? 'Receita inclui PLR / Férias / 13º' : undefined,
  }
}

function getAvgIncome(txns: Transaction[], refMonth: string, nMonths: number): number {
  const months = getLast6Months(refMonth).slice(0, nMonths)
  const totals = months.map(m => getOperationalIncome(txns, m)).filter(v => v > 0)
  return totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
}

export function getMacroCategoryTotals(txns: Transaction[], month: string): MacroCategoryTotal[] {
  const expenseMacros = MACRO_CATEGORIES.filter(m =>
    ['operational_expense', 'debt_cost'].includes(m.classificationType)
  )

  const monthTxns = txns.filter(tx =>
    txInMonth(tx, month) && txActive(tx) && tx.includeInOperationalResult && tx.type === 'expense'
  )
  const totalExpenses = monthTxns.reduce((s, tx) => s + tx.amount, 0)

  return expenseMacros
    .map(macro => {
      const total = monthTxns
        .filter(tx => tx.macroCategoryId === macro.id)
        .reduce((s, tx) => s + tx.amount, 0)

      if (total === 0) return null

      const avg3m = getAvgMacroExpense(txns, month, macro.id, 3)
      return {
        macroCategoryId: macro.id,
        name: macro.name,
        total,
        percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
        color: macro.color,
        icon: macro.icon,
        avgLast3m: avg3m,
        isAboveAverage: avg3m > 0 && total > avg3m * 1.25,
      } as MacroCategoryTotal
    })
    .filter((m): m is MacroCategoryTotal => m !== null)
    .sort((a, b) => b.total - a.total)
}

function getAvgMacroExpense(txns: Transaction[], refMonth: string, macroId: string, n: number): number {
  const months = getLast6Months(refMonth).slice(0, n)
  const totals = months.map(m =>
    txns
      .filter(tx => txInMonth(tx, m) && tx.macroCategoryId === macroId && tx.includeInOperationalResult && tx.type === 'expense')
      .reduce((s, tx) => s + tx.amount, 0)
  ).filter(v => v > 0)
  return totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
}

export function getBudgetComparison(
  txns: Transaction[],
  month: string,
  budgets: Budget[]
): BudgetComparison[] {
  const monthBudgets = budgets
    .filter(b => b.referenceMonth.startsWith(month) && b.macroCategoryId && b.macroCategoryId !== 'mac_receita_op')

  const monthTxns = txns.filter(tx =>
    txInMonth(tx, month) && txActive(tx) && tx.includeInBudget && tx.type === 'expense'
  )

  return monthBudgets.map(budget => {
    const macro = getMacroById(budget.macroCategoryId!)!
    const realized = monthTxns
      .filter(tx => tx.macroCategoryId === budget.macroCategoryId)
      .reduce((s, tx) => s + tx.amount, 0)
    const deviationRs = realized - budget.plannedAmount
    const deviationPct = budget.plannedAmount > 0 ? (deviationRs / budget.plannedAmount) * 100 : 0

    let status: BudgetComparison['status'] = 'ok'
    if (deviationPct > 40) status = 'critical'
    else if (deviationPct > 20) status = 'warning'

    return {
      categoryId: '',
      macroCategoryId: budget.macroCategoryId!,
      name: macro.name,
      color: macro.color,
      planned: budget.plannedAmount,
      realized,
      deviationRs,
      deviationPct,
      status,
    }
  }).sort((a, b) => b.deviationPct - a.deviationPct)
}

export function generateAlerts(
  txns: Transaction[],
  month: string,
  budgets: Budget[]
): AlertItem[] {
  const alerts: AlertItem[] = []
  const comparison = getBudgetComparison(txns, month, budgets)

  const debtTxns = txns.filter(tx =>
    txInMonth(tx, month) && tx.classificationType === 'debt_cost' && tx.status !== 'cancelled'
  )
  const debtTotal = debtTxns.reduce((s, tx) => s + tx.amount, 0)
  if (debtTotal > 0) {
    alerts.push({
      id: 'alert_debt',
      level: 'critical',
      message: `Cheque especial ou dívida: ${formatBRL(debtTotal)} em juros este mês`,
      amount: debtTotal,
    })
  }

  comparison.forEach(comp => {
    if (comp.status === 'critical') {
      alerts.push({
        id: `alert_${comp.macroCategoryId}_critical`,
        level: 'critical',
        message: `${comp.name} passou ${formatBRL(comp.deviationRs)} do planejado (+${comp.deviationPct.toFixed(0)}%)`,
        categoryId: comp.macroCategoryId,
        amount: comp.deviationRs,
        deviationPct: comp.deviationPct,
      })
    } else if (comp.status === 'warning') {
      alerts.push({
        id: `alert_${comp.macroCategoryId}_warning`,
        level: 'warning',
        message: `${comp.name} acima do planejado em ${formatBRL(comp.deviationRs)} (+${comp.deviationPct.toFixed(0)}%)`,
        categoryId: comp.macroCategoryId,
        amount: comp.deviationRs,
        deviationPct: comp.deviationPct,
      })
    }
  })

  const income = getOperationalIncome(txns, month)
  const avg3m = getAvgIncome(txns, month, 3)
  if (avg3m > 0 && income > avg3m * 1.4) {
    alerts.push({
      id: 'alert_atypical_income',
      level: 'distortion',
      message: `Receita de ${formatBRL(income)} está acima da média histórica — mês atípico (PLR/Férias/13º)`,
      amount: income,
    })
  }

  const redemption = getRedemptionTotal(txns, month)
  if (redemption > income * 0.2) {
    alerts.push({
      id: 'alert_redemption',
      level: 'distortion',
      message: `Mês inclui ${formatBRL(redemption)} em resgates — não é receita operacional`,
      amount: redemption,
    })
  }

  return alerts
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function getMonthlyTrend(txns: Transaction[], refMonth: string): MonthlyTrend[] {
  const months = getLast6Months(refMonth)
  return months.map(month => {
    const income = getOperationalIncome(txns, month)
    const expenses = getTotalExpenses(txns, month)
    const avg3m = getAvgIncome(txns, month, 3)
    const isAtypical = avg3m > 0 && income > avg3m * 1.4
    return {
      month,
      label: formatMonthLabel(month),
      operationalIncome: income,
      totalExpenses: expenses,
      operationalResult: income - expenses,
      isAtypical,
    }
  })
}

export function getTopExpenses(txns: Transaction[], month: string): TopTransaction[] {
  return txns
    .filter(tx => txInMonth(tx, month) && txActive(tx) && tx.type === 'expense' && tx.includeInOperationalResult)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(tx => {
      const macro = getMacroById(tx.macroCategoryId ?? '')
      return {
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        macroCategoryName: macro?.name ?? 'Outros',
        macroCategoryColor: macro?.color ?? '#9CA3AF',
      }
    })
}
