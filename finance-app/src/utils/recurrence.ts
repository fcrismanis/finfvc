import type { Transaction } from '../types'
import { getLast6Months, getCompetenceMonth, nextMonth } from './date'

export interface RecurringPattern {
  id: string
  label: string
  normalizedKey: string
  categoryId?: string
  subCategoryId?: string
  macroCategoryId?: string
  averageAmount: number
  minAmount: number
  maxAmount: number
  frequency: 'weekly' | 'monthly' | 'annual' | 'unknown'
  typicalDay?: number
  transactionIds: string[]
  occurrences: number
  confidence: 'high' | 'medium' | 'low'
  nextExpectedDate?: string
  trend?: 'stable' | 'increasing' | 'decreasing'
  isNew?: boolean
}

function normalizeKey(tx: Transaction): string {
  const base = (tx.pluggyReceiverName || tx.pluggyPayerName || tx.description || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\d+/g, '')
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  return base || tx.description.slice(0, 20).toUpperCase()
}

function dayOfMonth(dateStr: string): number {
  return parseInt(dateStr.split('-')[2] ?? '1', 10)
}

function detectTrend(amounts: number[]): 'stable' | 'increasing' | 'decreasing' {
  if (amounts.length < 2) return 'stable'
  const first = amounts[0]
  const last = amounts[amounts.length - 1]
  const change = (last - first) / Math.max(first, 1)
  if (change > 0.1) return 'increasing'
  if (change < -0.1) return 'decreasing'
  return 'stable'
}

function estimateNextDate(typicalDay: number, refMonth: string): string {
  const nm = nextMonth(refMonth)
  const [y, m] = nm.split('-').map(Number)
  const maxDay = new Date(y, m, 0).getDate()
  const day = Math.min(typicalDay, maxDay)
  return `${nm}-${String(day).padStart(2, '0')}`
}

const EXCLUDE_KEYS = new Set([
  'PIX', 'TED', 'DOC', 'TRANSFERENCIA', 'TRANSF', 'DEPOSITO', 'DEP',
  'PAGAMENTO', 'PGTO', 'BOLETO', 'DEBITO', 'CREDITO',
])

export function detectRecurringPatterns(
  transactions: Transaction[],
  refMonth: string,
): RecurringPattern[] {
  const months = getLast6Months(refMonth)

  // Only look at paid expense or income transactions that count in operations
  const relevant = transactions.filter(
    t =>
      t.status !== 'cancelled' &&
      (t.includeInOperationalResult || t.classificationType === 'debt_cost'),
  )

  // Group by normalized key (and type to avoid mixing income/expense)
  const groups = new Map<string, Transaction[]>()
  for (const tx of relevant) {
    const key = `${tx.type}|${normalizeKey(tx)}`
    if (EXCLUDE_KEYS.has(key.split('|')[1])) continue
    const arr = groups.get(key) ?? []
    arr.push(tx)
    groups.set(key, arr)
  }

  const patterns: RecurringPattern[] = []

  for (const [groupKey, txs] of groups) {
    // Count distinct months with at least one occurrence
    const txMonths = new Set(txs.map(t => getCompetenceMonth(t.competenceDate)))
    if (txMonths.size < 2) continue // need at least 2 months

    const occurrences = txMonths.size
    const amounts = [...txMonths]
      .sort()
      .map(m => {
        return txs
          .filter(t => getCompetenceMonth(t.competenceDate) === m)
          .reduce((s, t) => s + t.amount, 0)
      })

    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const min = Math.min(...amounts)
    const max = Math.max(...amounts)
    const variability = avg > 0 ? (max - min) / avg : 0

    // Confidence based on occurrences and variability
    let confidence: 'high' | 'medium' | 'low' = 'low'
    if (occurrences >= 4 && variability < 0.2) confidence = 'high'
    else if (occurrences >= 3 && variability < 0.4) confidence = 'medium'
    else if (occurrences >= 2) confidence = 'low'

    // Detect frequency: look at day spread across month occurrences
    const days = txs.map(t => dayOfMonth(t.competenceDate))
    const uniqueDays = [...new Set(days)]
    const avgDay = Math.round(days.reduce((a, b) => a + b, 0) / days.length)

    let frequency: RecurringPattern['frequency'] = 'monthly'
    if (txMonths.size === 1 && txs.length >= 4) {
      // Multiple in same month → weekly
      frequency = 'weekly'
    } else if (txMonths.size <= 2 && months.length >= 6) {
      frequency = 'unknown'
    }

    // Check if it appeared in previous months but NOT in current month yet
    const appearsInCurrent = txMonths.has(refMonth)
    const prevMonthsOnly = [...txMonths].filter(m => m < refMonth)
    const isNew = prevMonthsOnly.length === 1 // only one prior month — just started

    const representative = txs[txs.length - 1]
    const label = (representative.pluggyReceiverName || representative.pluggyPayerName || representative.description)
      .split(' ')
      .slice(0, 5)
      .join(' ')

    patterns.push({
      id: `rec_${groupKey.replace(/[^a-z0-9]/gi, '_')}`,
      label,
      normalizedKey: groupKey,
      macroCategoryId: representative.macroCategoryId,
      categoryId: representative.categoryId,
      subCategoryId: representative.subCategoryId,
      averageAmount: avg,
      minAmount: min,
      maxAmount: max,
      frequency,
      typicalDay: uniqueDays.length <= 3 ? avgDay : undefined,
      transactionIds: txs.map(t => t.id),
      occurrences,
      confidence,
      nextExpectedDate:
        !appearsInCurrent && avgDay > 0
          ? estimateNextDate(avgDay, refMonth)
          : undefined,
      trend: detectTrend(amounts),
      isNew,
    })
  }

  return patterns.sort((a, b) => b.averageAmount - a.averageAmount)
}

export function getExpectedButMissingThisMonth(
  patterns: RecurringPattern[],
  _refMonth: string,
): RecurringPattern[] {
  return patterns.filter(p => {
    return !!p.nextExpectedDate && p.confidence !== 'low'
  })
}

export function getTotalExpectedRecurring(patterns: RecurringPattern[]): number {
  return patterns
    .filter(p => !!p.nextExpectedDate && p.confidence !== 'low')
    .reduce((s, p) => s + p.averageAmount, 0)
}
