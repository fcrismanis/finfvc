import type { Transaction, Budget } from '../types'
import { getLast6Months, getCompetenceMonth, prevMonth } from './date'
import { MACRO_CATEGORIES } from '../config/categories'
import { detectRecurringPatterns } from './recurrence'

export interface BudgetSuggestion {
  macroCategoryId: string
  label: string
  color: string
  average3m: number
  lastMonth: number
  recurringForecast: number
  suggestedAmount: number
  // Recommended savings band (10–20% below the 3-month average, floored at fixed costs).
  targetMin: number
  targetMax: number
  // false when fixed/recurring costs leave no room to cut — suggestion holds the average.
  reducible: boolean
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

function macroCategoryTotalForMonth(txns: Transaction[], month: string, macroId: string): number {
  return txns
    .filter(
      t =>
        getCompetenceMonth(t.competenceDate) === month &&
        t.macroCategoryId === macroId &&
        t.includeInBudget &&
        t.type === 'expense' &&
        t.status !== 'cancelled' &&
        t.classificationType !== 'neutral' &&
        t.classificationType !== 'transfer',
    )
    .reduce((s, t) => s + t.amount, 0)
}

export function generateBudgetSuggestions(
  transactions: Transaction[],
  _currentBudgets: Budget[],
  refMonth: string,
): BudgetSuggestion[] {
  const expenseMacros = MACRO_CATEGORIES.filter(m =>
    ['operational_expense', 'debt_cost'].includes(m.classificationType),
  )

  const last3Months = getLast6Months(refMonth).slice(1, 4) // skip current, take 3 prior
  const lm = prevMonth(refMonth)

  // Get recurring patterns for the recurring forecast
  const recurringPatterns = detectRecurringPatterns(transactions, refMonth)

  const suggestions: BudgetSuggestion[] = []

  for (const macro of expenseMacros) {
    const monthlyTotals = last3Months.map(m => macroCategoryTotalForMonth(transactions, m, macro.id))
    const nonZeroTotals = monthlyTotals.filter(v => v > 0)

    const avg3m = nonZeroTotals.length > 0
      ? nonZeroTotals.reduce((a, b) => a + b, 0) / nonZeroTotals.length
      : 0

    const lastMonth = macroCategoryTotalForMonth(transactions, lm, macro.id)

    // Sum recurring patterns that belong to this macro
    const recurringForecast = recurringPatterns
      .filter(p => p.macroCategoryId === macro.id && p.confidence !== 'low')
      .reduce((s, p) => s + p.averageAmount, 0)

    if (avg3m === 0 && lastMonth === 0 && recurringForecast === 0) continue

    // Baseline is the realized 3-month average (fall back to last month / recurring).
    const base = avg3m > 0 ? avg3m : Math.max(lastMonth, recurringForecast)
    // Fixed/recurring commitments are the floor — we never plan a budget below them.
    const fixedFloor = Math.min(recurringForecast, base)

    // Savings band: aim for a 10–20% cut off the average to free up money.
    const targetMin = Math.max(base * 0.80, fixedFloor) // -20%
    const targetMax = Math.max(base * 0.90, fixedFloor) // -10%
    // Reducible only if a 10% cut still clears the fixed floor.
    const reducible = base > 0 && fixedFloor < base * 0.90

    let suggested: number
    let savingsReason: string
    if (!reducible) {
      // No slack: hold the average instead of forcing an unrealistic cut.
      suggested = Math.ceil(base / 10) * 10
      savingsReason = recurringForecast >= base * 0.9
        ? 'Gasto majoritariamente fixo/recorrente — não recomendamos redução'
        : 'Sem folga para reduzir — mantenha a média'
    } else {
      suggested = Math.round(((targetMin + targetMax) / 2) / 10) * 10
      const pct = Math.max(0, Math.round((1 - suggested / base) * 100))
      savingsReason = `Meta de economia: -${pct}% sobre a média de 3 meses`
    }

    // Confidence (history depth / stability) — independent of the savings target.
    let confidence: BudgetSuggestion['confidence']
    let reason: string

    if (nonZeroTotals.length >= 3) {
      const variance = nonZeroTotals.map(v => Math.abs(v - avg3m))
      const maxDev = Math.max(...variance)
      if (maxDev / Math.max(avg3m, 1) < 0.2) {
        confidence = 'high'
        reason = `Média de ${nonZeroTotals.length} meses estável`
      } else {
        confidence = 'medium'
        reason = `Média de ${nonZeroTotals.length} meses com variação`
      }
    } else if (nonZeroTotals.length === 2) {
      confidence = 'medium'
      reason = 'Baseado em 2 meses de histórico'
    } else if (recurringForecast > 0) {
      confidence = 'medium'
      reason = 'Baseado em padrões recorrentes detectados'
    } else {
      confidence = 'low'
      reason = 'Histórico insuficiente (menos de 2 meses)'
    }

    // Lead with the savings recommendation; keep the history/confidence note as context.
    const fullReason = `${savingsReason} · ${reason}`

    suggestions.push({
      macroCategoryId: macro.id,
      label: macro.name,
      color: macro.color,
      average3m: avg3m,
      lastMonth,
      recurringForecast,
      suggestedAmount: suggested,
      targetMin: Math.round(targetMin),
      targetMax: Math.round(targetMax),
      reducible,
      confidence,
      reason: fullReason,
    })
  }

  return suggestions.sort((a, b) => b.suggestedAmount - a.suggestedAmount)
}

export function applyBudgetSuggestions(
  suggestions: BudgetSuggestion[],
  refMonth: string,
): Budget[] {
  return suggestions.map(s => ({
    id: `bud_${refMonth}_${s.macroCategoryId}_sug`,
    referenceMonth: refMonth,
    macroCategoryId: s.macroCategoryId,
    plannedAmount: s.suggestedAmount,
  }))
}
