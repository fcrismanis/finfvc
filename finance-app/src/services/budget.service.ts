import type { Budget, Transaction } from '../types'
import { MOCK_BUDGETS } from '../mock/transactions'
import { getMacroCategoryTotals } from '../engine/calculate'
import { getLast6Months, prevMonth } from '../utils/date'
import { MACRO_CATEGORIES } from '../config/categories'

const KEY = 'finance_budgets'

export function getBudgets(): Budget[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as Budget[]
  } catch { return [] }
}

export function getBudgetsOrMock(): { budgets: Budget[]; isDemo: boolean } {
  const local = getBudgets()
  if (local.length > 0) return { budgets: local, isDemo: false }
  return { budgets: MOCK_BUDGETS, isDemo: true }
}

export function getBudgetsForMonth(month: string): Budget[] {
  return getBudgets().filter(b => b.referenceMonth.startsWith(month))
}

export function saveBudget(budget: Budget): void {
  const all = getBudgets()
  const idx = all.findIndex(b => b.id === budget.id)
  if (idx >= 0) all[idx] = { ...budget }
  else all.push(budget)
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function deleteBudget(id: string): void {
  const all = getBudgets().filter(b => b.id !== id)
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function upsertMacroBudget(month: string, macroCategoryId: string, plannedAmount: number): Budget {
  const all = getBudgets()
  const existing = all.find(b => b.referenceMonth === month && b.macroCategoryId === macroCategoryId && !b.categoryId)
  if (existing) {
    existing.plannedAmount = plannedAmount
    localStorage.setItem(KEY, JSON.stringify(all))
    return existing
  }
  const newBudget: Budget = {
    id: `bud_${month}_${macroCategoryId}_${Date.now()}`,
    referenceMonth: month,
    macroCategoryId,
    plannedAmount,
  }
  all.push(newBudget)
  localStorage.setItem(KEY, JSON.stringify(all))
  return newBudget
}

export function copyBudgetFromMonth(fromMonth: string, toMonth: string): Budget[] {
  const all = getBudgets()
  const fromBudgets = all.filter(b => b.referenceMonth === fromMonth)
  const copied: Budget[] = fromBudgets.map(b => ({
    ...b,
    id: `bud_${toMonth}_${b.macroCategoryId ?? b.categoryId ?? Date.now()}`,
    referenceMonth: toMonth,
  }))
  // Remove existing budgets for toMonth, add copied
  const filtered = all.filter(b => !b.referenceMonth.startsWith(toMonth))
  const merged = [...filtered, ...copied]
  localStorage.setItem(KEY, JSON.stringify(merged))
  return copied
}

export function suggestBudgets(txns: Transaction[], refMonth: string): Budget[] {
  const months = getLast6Months(refMonth).slice(1, 4) // skip current month, use 3 prior
  const expenseMacros = MACRO_CATEGORIES.filter(m =>
    ['operational_expense', 'debt_cost'].includes(m.classificationType)
  )

  return expenseMacros.map(macro => {
    const totals = months.map(m =>
      getMacroCategoryTotals(txns, m).find(t => t.macroCategoryId === macro.id)?.total ?? 0
    ).filter(v => v > 0)
    const avg = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0

    return {
      id: `suggest_${refMonth}_${macro.id}`,
      referenceMonth: refMonth,
      macroCategoryId: macro.id,
      plannedAmount: Math.ceil(avg / 10) * 10, // round up to nearest 10
    }
  }).filter(b => b.plannedAmount > 0)
}

export function getPrevMonthBudgets(month: string): Budget[] {
  return getBudgetsForMonth(prevMonth(month))
}
