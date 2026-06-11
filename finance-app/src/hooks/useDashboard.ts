import { useMemo } from 'react'
import { useData } from '../context/DataContext'
import {
  getMonthSummary,
  getMacroCategoryTotals,
  getBudgetComparison,
  generateAlerts,
  getMonthlyTrend,
  getTopExpenses,
  getPendingAmount,
} from '../engine/calculate'
import { buildFunnelSteps } from '../utils/funnelSteps'

export function useDashboard(month: string) {
  const { transactions, budgets, isDemo } = useData()

  return useMemo(() => {
    const summary = getMonthSummary(transactions, month, budgets)
    const expenseBreakdown = getMacroCategoryTotals(transactions, month)
    return {
      summary,
      expenseBreakdown,
      funnelSteps: buildFunnelSteps(summary.operationalIncome, expenseBreakdown),
      budgetComparison: getBudgetComparison(transactions, month, budgets),
      alerts: generateAlerts(transactions, month, budgets),
      trend: getMonthlyTrend(transactions, month),
      topExpenses: getTopExpenses(transactions, month),
      pendingAmount: getPendingAmount(transactions),
      isDemo,
      isLoading: false,
      error: null,
    }
  }, [transactions, budgets, month, isDemo])
}
