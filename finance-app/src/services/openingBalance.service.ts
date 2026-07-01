/**
 * Saldo de abertura por conta — o saldo no ÚLTIMO DIA do mês anterior, usado
 * como baseline do saldoFIN na reconciliação. Sem baseline, saldoFIN começa do
 * zero e nunca bate com o banco.
 *
 * Fonte do dado: relatórios (saldo Pluggy no fim do mês, ou checkpoints do
 * extrato em bankTruth.ts). Sempre que um saldo de fecho de mês é obtido, é
 * "cravado" aqui (craveMonthEndBalance) e passa a servir de abertura do mês
 * seguinte.
 */
import { ITAU_ANCHOR, ITAU_ANCHOR_ID } from '../config/bankTruth'

const STORAGE_KEY = 'fin_opening_balances'

export interface BalancePoint {
  /** 'YYYY-MM-DD' — dia do saldo (fim de mês). */
  date: string
  balance: number
  source: 'pluggy' | 'extrato' | 'manual'
  cravedAt: string
}

type Store = Record<string, BalancePoint[]> // accountId -> pontos (asc por date)

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function save(store: Store): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

/** Todos os pontos conhecidos de uma conta = cravados + seed dos checkpoints (Itaú). */
export function getBalancePoints(accountId: string): BalancePoint[] {
  const craved = load()[accountId] ?? []
  const seed: BalancePoint[] =
    accountId === ITAU_ANCHOR_ID
      ? ITAU_ANCHOR.checkpoints.map(c => ({ date: c.date, balance: c.balance, source: 'extrato' as const, cravedAt: ITAU_ANCHOR.asOf }))
      : []
  // cravado tem prioridade sobre seed na mesma data
  const byDate = new Map<string, BalancePoint>()
  for (const p of seed) byDate.set(p.date, p)
  for (const p of craved) byDate.set(p.date, p)
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Saldo de abertura para o mês (= saldo no último dia do mês anterior).
 * Retorna o ponto conhecido mais recente ESTRITAMENTE antes de `monthStart`,
 * ou null se nenhum saldo foi obtido ainda.
 */
export function getOpeningBalance(accountId: string, monthStart: string): { balance: number; point: BalancePoint } | null {
  const points = getBalancePoints(accountId)
  let best: BalancePoint | null = null
  for (const p of points) {
    if (p.date < monthStart && (!best || p.date > best.date)) best = p
  }
  return best ? { balance: best.balance, point: best } : null
}

/** Saldo conhecido na data (ou o mais recente antes dela). Ex.: saldo de fim de mês. */
export function getBalanceAt(accountId: string, date: string): { balance: number; point: BalancePoint } | null {
  const points = getBalancePoints(accountId)
  let best: BalancePoint | null = null
  for (const p of points) {
    if (p.date <= date && (!best || p.date > best.date)) best = p
  }
  return best ? { balance: best.balance, point: best } : null
}

/** Crava um saldo de fecho de mês. Substitui ponto na mesma data. */
export function craveMonthEndBalance(accountId: string, date: string, balance: number, source: BalancePoint['source']): void {
  const store = load()
  const list = store[accountId] ?? []
  const idx = list.findIndex(p => p.date === date)
  const point: BalancePoint = { date, balance, source, cravedAt: new Date().toISOString() }
  if (idx >= 0) list[idx] = point
  else list.push(point)
  list.sort((a, b) => a.date.localeCompare(b.date))
  store[accountId] = list
  save(store)
}

/** Último dia do mês de uma data 'YYYY-MM' ou 'YYYY-MM-DD'. */
export function monthEndDate(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

/**
 * Grava o saldo ATUAL de uma conta como fecho do mês corrente, se hoje for o
 * último dia do mês — ou grava sempre que chamado com uma data de fecho.
 * Usado após sync Pluggy: crava o saldo obtido no fim do mês vigente.
 */
export function craveCurrentBalanceIfMonthEnd(accountId: string, balance: number | null, today: string): void {
  if (balance === null) return
  const ym = today.slice(0, 7)
  if (today === monthEndDate(ym)) {
    craveMonthEndBalance(accountId, today, balance, 'pluggy')
  }
}
