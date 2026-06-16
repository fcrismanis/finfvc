import type { TransactionStatus, PaymentMethod, TransactionType } from '../types'
import { currentFinancialDate, normalizeFinancialDate } from '../utils/date'

export function normalizeAmount(raw: string | number): number {
  if (typeof raw === 'number') return Math.abs(raw)
  const cleaned = String(raw)
    .replace(/R\$\s*/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
  const value = parseFloat(cleaned)
  return isNaN(value) ? 0 : Math.abs(value)
}

export function normalizeDate(raw: string | number | undefined): string {
  return normalizeFinancialDate(raw, currentFinancialDate())
}

export function normalizeType(raw: string): TransactionType {
  const v = String(raw).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (v.includes('receita') || v.includes('entrada') || v.includes('credito') || v === 'c') return 'income'
  return 'expense'
}

export function normalizeStatus(raw: string): TransactionStatus {
  const v = String(raw).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (v.includes('pendente') || v.includes('agendado') || v.includes('previsto')) return 'pending'
  if (v.includes('cancel')) return 'cancelled'
  return 'paid'
}

export function normalizePaymentMethod(raw: string): PaymentMethod {
  const v = String(raw).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (v.includes('cartao') || v.includes('credito') || v.includes('card')) return 'card'
  if (v.includes('debito') || v.includes('debit')) return 'debit'
  if (v.includes('pix')) return 'pix'
  if (v.includes('boleto')) return 'boleto'
  if (v.includes('dinheiro') || v.includes('especie')) return 'cash'
  return 'account'
}

export function normalizeDescription(raw: string): string {
  return String(raw)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

export function parseInstallment(raw: string | undefined): { current?: number; total?: number } {
  if (!raw) return {}
  const match = String(raw).match(/(\d+)\s*[\/\-]\s*(\d+)/)
  if (!match) return {}
  return { current: parseInt(match[1]), total: parseInt(match[2]) }
}
