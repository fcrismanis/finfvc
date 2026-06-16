import type { MonthClosing } from '../types'

const KEY = 'finance_closings'

export const CHECKLIST_ITEMS: { id: string; label: string; description?: string }[] = [
  { id: 'imports_done',         label: 'Importar extratos (Pluggy ou XLSX)',         description: 'Sincronizar todas as contas e cartões do mês' },
  { id: 'no_category_fixed',    label: 'Revisar lançamentos sem categoria',           description: 'Classificar todos os itens sem macro categoria' },
  { id: 'no_subcategory_fixed', label: 'Revisar sem subcategoria',                    description: 'Adicionar subcategoria às despesas relevantes' },
  { id: 'neutrals_validated',   label: 'Validar transferências e neutros',            description: 'Confirmar que movimentos internos não duplicam consumo' },
  { id: 'card_payment_checked', label: 'Validar pagamentos de cartão',                description: 'Garantir que faturas estão como neutro se compras já estão lançadas' },
  { id: 'income_validated',     label: 'Validar receitas',                            description: 'Confirmar todas as entradas do mês' },
  { id: 'recurring_checked',    label: 'Conferir recorrentes',                        description: 'Verificar se todos os gastos fixos foram lançados' },
  { id: 'budget_compared',      label: 'Conferir orçamento',                          description: 'Revisar desvios entre planejado e realizado' },
  { id: 'alerts_reviewed',      label: 'Conferir alertas financeiros',                description: 'Revisar alertas de desvio gerados automaticamente' },
  { id: 'summary_generated',    label: 'Gerar resumo do mês',                         description: 'Criar ou revisar o resumo financeiro do mês' },
  { id: 'next_month_planned',   label: 'Planejar orçamento do próximo mês',           description: 'Definir metas para o próximo período' },
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
