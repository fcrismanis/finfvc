// Financiamentos / Dívidas geridos manualmente (localStorage).
// Independente dos lançamentos — modela o contrato da dívida: valor total,
// valor pago, parcelas, vencimento, status e recorrência.
const KEY = 'finance_financiamentos'

export type FinanciamentoStatus = 'ativo' | 'quitado' | 'atrasado'

export interface Financiamento {
  id: string
  nome: string
  credor?: string
  valorTotal: number
  valorPago: number
  parcelasTotal: number
  parcelasPagas: number
  parcelaValor?: number
  diaVencimento?: number   // dia do mês (1-31)
  taxaJuros?: number       // % a.m.
  recorrente: boolean      // débito mensal recorrente
  status: FinanciamentoStatus
  descricao?: string
  createdAt: string
}

export const STATUS_LABEL: Record<FinanciamentoStatus, string> = {
  ativo:    'Ativo',
  quitado:  'Quitado',
  atrasado: 'Atrasado',
}

export const STATUS_COLOR: Record<FinanciamentoStatus, string> = {
  ativo:    'var(--accent)',
  quitado:  'var(--pos)',
  atrasado: 'var(--crit)',
}

export function saldoRestante(f: Financiamento): number {
  return Math.max(0, (f.valorTotal ?? 0) - (f.valorPago ?? 0))
}

export function getFinanciamentos(): Financiamento[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Financiamento[]) : []
  } catch {
    return []
  }
}

export function addFinanciamento(f: Omit<Financiamento, 'id' | 'createdAt'>): Financiamento {
  const all = getFinanciamentos()
  const novo: Financiamento = { ...f, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  localStorage.setItem(KEY, JSON.stringify([...all, novo]))
  return novo
}

export function updateFinanciamento(id: string, patch: Partial<Omit<Financiamento, 'id' | 'createdAt'>>): void {
  const all = getFinanciamentos().map(f => (f.id === id ? { ...f, ...patch } : f))
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function deleteFinanciamento(id: string): void {
  const all = getFinanciamentos().filter(f => f.id !== id)
  localStorage.setItem(KEY, JSON.stringify(all))
}
