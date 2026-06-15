import type { MonthClosing } from '../types'

const KEY = 'finance_closings'

export const CHECKLIST_ITEMS: { id: string; label: string }[] = [
  { id: 'imports_reviewed',     label: 'Todos os extratos importados e revisados' },
  { id: 'duplicates_checked',   label: 'Duplicidades e transferências confirmadas' },
  { id: 'no_category_fixed',    label: 'Lançamentos sem categoria classificados' },
  { id: 'pending_resolved',     label: 'Pendentes do mês resolvidos ou justificados' },
  { id: 'budget_compared',      label: 'Desvios de orçamento revisados' },
  { id: 'investments_logged',   label: 'Investimentos e resgates registrados' },
  { id: 'next_month_planned',   label: 'Orçamento do próximo mês definido' },
]

export function emptyClosing(month: string): MonthClosing {
  return {
    month,
    isClosed: false,
    checklist: Object.fromEntries(CHECKLIST_ITEMS.map(i => [i.id, false])),
    notes: '',
  }
}

export function getAllClosings(): MonthClosing[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function getClosing(month: string): MonthClosing {
  const all = getAllClosings()
  return all.find(c => c.month === month) ?? emptyClosing(month)
}

export function saveClosing(closing: MonthClosing): void {
  const all = getAllClosings()
  const idx = all.findIndex(c => c.month === closing.month)
  if (idx >= 0) all[idx] = closing
  else all.push(closing)
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function closeMonth(month: string): void {
  const closing = getClosing(month)
  saveClosing({ ...closing, isClosed: true, closedAt: new Date().toISOString() })
}

export function reopenMonth(month: string): void {
  const closing = getClosing(month)
  saveClosing({ ...closing, isClosed: false, reopenedAt: new Date().toISOString() })
}

export function isMonthClosed(month: string): boolean {
  return getClosing(month).isClosed
}
