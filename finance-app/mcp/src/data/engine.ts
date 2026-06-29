import type { Transaction, Budget } from './types.js'
import { MACRO_CATEGORIES, EXPENSE_MACRO_IDS } from '../config/categories.js'

export function competenceMonth(date: string): string {
  return date.slice(0, 7)
}

function inMonth(tx: Transaction, month: string): boolean {
  return competenceMonth(tx.competenceDate) === month && tx.status !== 'cancelled'
}

function isOperational(tx: Transaction): boolean {
  return tx.includeInOperationalResult && !tx.isAdjustment
}

export function totalIncome(txns: Transaction[], month: string): number {
  return txns
    .filter(tx => inMonth(tx, month) && isOperational(tx) && tx.type === 'income')
    .reduce((s, tx) => s + tx.amount, 0)
}

export function totalExpenses(txns: Transaction[], month: string): number {
  return txns
    .filter(tx => inMonth(tx, month) && isOperational(tx) && tx.type === 'expense')
    .reduce((s, tx) => s + tx.amount, 0)
}

export function macroTotals(txns: Transaction[], month: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const tx of txns) {
    if (!inMonth(tx, month) || !isOperational(tx) || tx.type !== 'expense') continue
    if (!tx.macroCategoryId) continue
    map.set(tx.macroCategoryId, (map.get(tx.macroCategoryId) ?? 0) + tx.amount)
  }
  return map
}

export function avgMacroTotals(txns: Transaction[], refMonth: string, nMonths: number): Map<string, number> {
  const months: string[] = []
  const [yr, mo] = refMonth.split('-').map(Number)
  for (let i = 1; i <= nMonths; i++) {
    const m = mo - i
    const y = yr + Math.floor((m - 1) / 12)
    const mm = ((m - 1 + 12) % 12) + 1
    months.push(`${y}-${String(mm).padStart(2, '0')}`)
  }

  const result = new Map<string, number>()
  for (const macroId of EXPENSE_MACRO_IDS) {
    const vals = months.map(m => macroTotals(txns, m).get(macroId) ?? 0).filter(v => v > 0)
    if (vals.length > 0) result.set(macroId, vals.reduce((s, v) => s + v, 0) / vals.length)
  }
  return result
}

export function budgetByMacro(budgets: Budget[], month: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const b of budgets) {
    if (b.referenceMonth !== month || !b.macroCategoryId) continue
    map.set(b.macroCategoryId, (map.get(b.macroCategoryId) ?? 0) + b.plannedAmount)
  }
  return map
}

export function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function macroName(id: string): string {
  return MACRO_CATEGORIES.find(m => m.id === id)?.name ?? id
}
