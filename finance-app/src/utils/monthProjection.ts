import type { Transaction, Budget } from '../types'
import { getCompetenceMonth, getLast6Months } from './date'
import { detectRecurringPatterns } from './recurrence'
import { MACRO_CATEGORIES } from '../config/categories'

export interface ProjectionRisk {
  categoryId?: string
  subCategoryId?: string
  label: string
  message: string
  severity: 'high' | 'medium' | 'low'
}

export interface MonthProjection {
  month: string
  incomeRealized: number
  incomeExpected: number
  expenseRealized: number
  expenseExpected: number
  neutralMovements: number
  projectedBalance: number
  budgetUsedPercent: number
  riskLevel: 'low' | 'medium' | 'high'
  risks: ProjectionRisk[]
  daysElapsed: number
  totalDays: number
  burnRate: number
  projectedMonthlyExpense: number
}

function getMonthDays(month: string): { elapsed: number; total: number } {
  const [y, m] = month.split('-').map(Number)
  const total = new Date(y, m, 0).getDate()
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  if (month !== currentMonth) return { elapsed: total, total }
  return { elapsed: Math.min(today.getDate(), total), total }
}

function avgIncomeFor3m(txns: Transaction[], refMonth: string): number {
  const months = getLast6Months(refMonth).slice(1, 4)
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

export function computeMonthProjection(
  allTransactions: Transaction[],
  budgets: Budget[],
  month: string,
): MonthProjection {
  const monthTxns = allTransactions.filter(
    t => getCompetenceMonth(t.competenceDate) === month && t.status !== 'cancelled',
  )
  const { elapsed, total } = getMonthDays(month)

  // Realized
  const incomeRealized = monthTxns
    .filter(t => t.includeInOperationalResult && t.type === 'income' && t.status !== 'cancelled')
    .reduce((s, t) => s + t.amount, 0)

  const expenseRealized = monthTxns
    .filter(t => t.includeInOperationalResult && t.type === 'expense' && t.status !== 'cancelled')
    .reduce((s, t) => s + t.amount, 0)

  const neutralMovements = monthTxns
    .filter(
      t =>
        (t.classificationType === 'neutral' ||
          t.classificationType === 'transfer' ||
          t.classificationType === 'investment' ||
          t.classificationType === 'redemption') &&
        t.status !== 'cancelled',
    )
    .reduce((s, t) => s + t.amount, 0)

  // Expected (from recurring patterns not yet seen this month)
  const patterns = detectRecurringPatterns(allTransactions, month)
  const missingRecurrents = patterns.filter(
    p =>
      p.nextExpectedDate &&
      p.confidence !== 'low' &&
      getCompetenceMonth(p.nextExpectedDate) === month,
  )

  const expenseExpected = missingRecurrents
    .filter(p => {
      const macro = MACRO_CATEGORIES.find(m => m.id === p.macroCategoryId)
      return macro?.classificationType !== 'operational_income'
    })
    .reduce((s, p) => s + p.averageAmount, 0)

  // Income expected: if income not yet received (salary typically mid-month)
  const avgIncome = avgIncomeFor3m(allTransactions, month)
  const incomeExpected = incomeRealized < avgIncome * 0.5 ? Math.max(avgIncome - incomeRealized, 0) : 0

  // Burn rate: daily spending rate so far
  const burnRate = elapsed > 0 ? expenseRealized / elapsed : 0
  const projectedMonthlyExpense = burnRate * total

  const projectedBalance = (incomeRealized + incomeExpected) - (projectedMonthlyExpense + expenseExpected)

  // Budget used percent
  const monthBudgets = budgets.filter(b => b.referenceMonth.startsWith(month) && b.macroCategoryId !== 'mac_receita_op')
  const totalBudget = monthBudgets.reduce((s, b) => s + b.plannedAmount, 0)
  const budgetUsedPercent = totalBudget > 0 ? (expenseRealized / totalBudget) * 100 : 0

  // Risk assessment
  const risks: ProjectionRisk[] = []

  if (projectedBalance < 0) {
    risks.push({
      label: 'Saldo projetado negativo',
      message: `Projeção indica fechamento negativo — revise gastos ou aguarde entrada prevista`,
      severity: 'high',
    })
  } else if (projectedBalance < (incomeRealized + incomeExpected) * 0.1) {
    risks.push({
      label: 'Margem apertada',
      message: `Sobra projetada muito baixa — menos de 10% da receita`,
      severity: 'medium',
    })
  }

  // Categories running over budget
  for (const budget of monthBudgets) {
    const realized = monthTxns
      .filter(
        t =>
          t.macroCategoryId === budget.macroCategoryId &&
          t.includeInBudget &&
          t.type === 'expense',
      )
      .reduce((s, t) => s + t.amount, 0)
    const pct = budget.plannedAmount > 0 ? (realized / budget.plannedAmount) * 100 : 0
    const macro = MACRO_CATEGORIES.find(m => m.id === budget.macroCategoryId)

    if (elapsed < total) {
      // Pro-rate: if we've used more than elapsed/total × 100% × 1.2 buffer
      const expectedPct = (elapsed / total) * 100 * 1.2
      if (pct > expectedPct && budget.plannedAmount > 0) {
        risks.push({
          categoryId: budget.macroCategoryId ?? undefined,
          label: macro?.name ?? (budget.macroCategoryId ?? 'Categoria'),
          message: `${Math.round(pct)}% do orçamento gasto com ${Math.round((elapsed / total) * 100)}% do mês`,
          severity: pct > 100 ? 'high' : 'medium',
        })
      }
    } else if (pct > 100) {
      risks.push({
        categoryId: budget.macroCategoryId ?? undefined,
        label: macro?.name ?? (budget.macroCategoryId ?? 'Categoria'),
        message: `${Math.round(pct - 100)}% acima do orçamento planejado`,
        severity: pct > 140 ? 'high' : 'medium',
      })
    }
  }

  // Recurrents still expected
  if (missingRecurrents.length > 0 && elapsed < total) {
    risks.push({
      label: 'Recorrentes ainda esperados',
      message: `${missingRecurrents.length} despesa(s) recorrente(s) previstas ainda não foram lançadas`,
      severity: 'low',
    })
  }

  const riskLevel: MonthProjection['riskLevel'] =
    risks.some(r => r.severity === 'high')
      ? 'high'
      : risks.some(r => r.severity === 'medium')
        ? 'medium'
        : 'low'

  return {
    month,
    incomeRealized,
    incomeExpected,
    expenseRealized,
    expenseExpected,
    neutralMovements,
    projectedBalance,
    budgetUsedPercent,
    riskLevel,
    risks,
    daysElapsed: elapsed,
    totalDays: total,
    burnRate,
    projectedMonthlyExpense,
  }
}
