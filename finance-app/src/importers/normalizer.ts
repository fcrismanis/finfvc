import type { TransactionStatus, PaymentMethod, TransactionType } from '../types'

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
  if (!raw) return new Date().toISOString().slice(0, 10)

  if (typeof raw === 'number') {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30)
    const date = new Date(excelEpoch.getTime() + raw * 86400000)
    return date.toISOString().slice(0, 10)
  }

  const s = String(raw).trim()

  // DD/MM/YYYY or DD-MM-YYYY
  const brMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (brMatch) {
    const [, d, m, y] = brMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)

  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)

  return new Date().toISOString().slice(0, 10)
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
