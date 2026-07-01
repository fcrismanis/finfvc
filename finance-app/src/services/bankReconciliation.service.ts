import type { Transaction } from '../types'

/**
 * Bank reconciliation — diagnosis only (no auto-fix, no data mutation).
 *
 * Goal: prove that, for a given account and period,
 *   Banco = FIN  ·  Entradas Banco = Entradas FIN  ·  Saídas Banco = Saídas FIN.
 *
 * The bank side (`BankTxn[]`) comes from Pluggy (live `/api/pluggy/transactions`
 * or a stored snapshot). The FIN side is the local ledger (`Transaction[]`).
 * This module is a pure function set: callers gather data, this compares.
 *
 * Note on balances: the FIN ledger has no per-account opening balance, so
 * `saldoFIN` is the cumulative cash-flow net of FIN entries up to the period
 * end, and `diferenca` (saldoBanco − saldoFIN) may carry an un-modelled
 * baseline. Status is therefore driven by the *flows* (entradas/saídas) and by
 * transaction-level matching (missing/extra), not by the absolute balance gap —
 * a non-zero balance gap alone only raises a "saldo defasado" warning.
 */

export type ReconStatus = 'reconciled' | 'warning' | 'critical'

export interface ReconPeriod {
  from: string // 'YYYY-MM-DD' inclusive
  to: string   // 'YYYY-MM-DD' inclusive
  label?: string
}

export type FlowDirection = 'in' | 'out'

/** Normalised bank movement (from a Pluggy raw transaction). */
export interface BankTxn {
  id: string
  date: string            // financial date 'YYYY-MM-DD'
  description: string
  amountAbs: number       // always positive magnitude
  direction: FlowDirection
  status: 'posted' | 'pending'
}

export interface MatchedPair {
  bank: BankTxn
  fin: Transaction
  dateDiffDays: number
}

export interface ReconcileInput {
  accountId: string
  period: ReconPeriod
  /** Bank movements already normalised for this account. */
  bankTxns: BankTxn[]
  /** Full FIN ledger (any account) — filtered to account+period internally. */
  finTxns: Transaction[]
  /** Current bank balance reported by the provider, if known. */
  bankBalance?: number | null
  /** Saldo de abertura = último dia do mês anterior. Baseline do saldoFIN. */
  openingBalance?: number | null
  /** Date tolerance (days) before a matched pair is flagged as divergent. Default 1. */
  dateToleranceDays?: number
  /** Max days to still consider two movements the same one. Default 5. */
  matchWindowDays?: number
}

export interface ReconciliationReport {
  accountId: string
  period: ReconPeriod
  saldoBanco: number | null
  saldoFIN: number
  diferenca: number | null
  entradasBanco: number
  entradasFIN: number
  saidasBanco: number
  saidasFIN: number
  entradasDiff: number // banco − fin
  saidasDiff: number   // banco − fin
  matched: MatchedPair[]
  missing: BankTxn[]            // present in bank, absent in FIN
  extra: Transaction[]          // present in FIN, absent in bank
  dateMismatches: MatchedPair[] // matched by amount/direction but date diverges
  probableDuplicates: Transaction[]
  status: ReconStatus
  notes: string[]
}

const CENTS = 0.01

// ── date helpers (no external deps so this stays runtime-pure) ───────────────

export function financialDateOf(tx: Transaction): string {
  return (tx.transactionDate || tx.competenceDate || '').slice(0, 10)
}

function inPeriod(date: string, period: ReconPeriod): boolean {
  return !!date && date >= period.from && date <= period.to
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return Number.POSITIVE_INFINITY
  const da = new Date(a + 'T12:00:00').getTime()
  const db = new Date(b + 'T12:00:00').getTime()
  if (Number.isNaN(da) || Number.isNaN(db)) return Number.POSITIVE_INFINITY
  return Math.abs(da - db) / 86_400_000
}

function finDirection(tx: Transaction): FlowDirection {
  return tx.type === 'income' ? 'in' : 'out'
}

function descKey(s: string): string {
  return (s || '').trim().slice(0, 24).toUpperCase()
}

// ── normalisation from Pluggy raw transactions ──────────────────────────────

interface PluggyRawLike {
  id: string
  date: string
  transactionDate?: string | null
  description: string
  amount: number
  type: 'DEBIT' | 'CREDIT'
  status: 'POSTED' | 'PENDING'
}

/** Convert Pluggy raw transactions into normalised BankTxn for one account. */
export function normalizeBankTxns(raw: PluggyRawLike[]): BankTxn[] {
  return raw.map(r => ({
    id: r.id,
    date: (r.transactionDate || r.date || '').slice(0, 10),
    description: r.description ?? '',
    amountAbs: Math.abs(r.amount),
    direction: r.type === 'CREDIT' ? 'in' : 'out',
    status: r.status === 'PENDING' ? 'pending' : 'posted',
  }))
}

// ── core ────────────────────────────────────────────────────────────────────

function ledgerForAccount(accountId: string, finTxns: Transaction[]): Transaction[] {
  return finTxns.filter(t => t.accountId === accountId && t.status !== 'cancelled')
}

/** Cumulative cash-flow net of FIN entries for the account up to period end. */
function cumulativeFinBalance(accountId: string, finTxns: Transaction[], upTo: string): number {
  return ledgerForAccount(accountId, finTxns)
    .filter(t => t.includeInCashflow !== false && financialDateOf(t) <= upTo)
    .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
}

/** Net cash-flow of FIN entries strictly inside [from, to]. */
function netFinInPeriod(accountId: string, finTxns: Transaction[], period: ReconPeriod): number {
  return ledgerForAccount(accountId, finTxns)
    .filter(t => t.includeInCashflow !== false && inPeriod(financialDateOf(t), period))
    .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
}

/**
 * saldoFIN esperado ao fim do período.
 * Com saldo de abertura (último dia do mês anterior) → abertura + fluxo do período.
 * Sem abertura → fallback antigo: soma cumulativa desde o zero (não bate com banco).
 */
function computeSaldoFIN(accountId: string, finTxns: Transaction[], period: ReconPeriod, opening: number | null): number {
  if (opening !== null) return opening + netFinInPeriod(accountId, finTxns, period)
  return cumulativeFinBalance(accountId, finTxns, period.to)
}

/** Probable duplicates inside the FIN ledger for the period (same dir+amount+~date+desc). */
function findProbableDuplicates(finPeriod: Transaction[]): Transaction[] {
  const dupes: Transaction[] = []
  const seen = new Map<string, Transaction>()
  for (const tx of finPeriod) {
    const k = `${finDirection(tx)}|${tx.amount.toFixed(2)}|${descKey(tx.description)}`
    const prev = seen.get(k)
    if (prev && daysBetween(financialDateOf(prev), financialDateOf(tx)) <= 1) {
      dupes.push(tx)
    } else {
      seen.set(k, tx)
    }
  }
  return dupes
}

export function reconcileAccount(input: ReconcileInput): ReconciliationReport {
  const {
    accountId, period, bankTxns, finTxns,
    bankBalance = null,
    openingBalance = null,
    dateToleranceDays = 1,
    matchWindowDays = 5,
  } = input

  const finPeriod = ledgerForAccount(accountId, finTxns)
    .filter(t => inPeriod(financialDateOf(t), period))

  const bankPeriod = bankTxns.filter(b => inPeriod(b.date, period))

  // ── flows ────────────────────────────────────────────────
  const sum = (xs: number[]) => xs.reduce((s, n) => s + n, 0)
  const entradasBanco = sum(bankPeriod.filter(b => b.direction === 'in').map(b => b.amountAbs))
  const saidasBanco = sum(bankPeriod.filter(b => b.direction === 'out').map(b => b.amountAbs))
  const entradasFIN = sum(finPeriod.filter(t => t.type === 'income').map(t => t.amount))
  const saidasFIN = sum(finPeriod.filter(t => t.type === 'expense').map(t => t.amount))

  // ── transaction-level matching (greedy, nearest date) ────
  const finPool = [...finPeriod]
  const usedFin = new Set<string>()
  const matched: MatchedPair[] = []
  const dateMismatches: MatchedPair[] = []
  const missing: BankTxn[] = []

  for (const b of bankPeriod) {
    let best: Transaction | null = null
    let bestDiff = Number.POSITIVE_INFINITY
    for (const f of finPool) {
      if (usedFin.has(f.id)) continue
      if (finDirection(f) !== b.direction) continue
      if (Math.abs(f.amount - b.amountAbs) > CENTS) continue
      const diff = daysBetween(b.date, financialDateOf(f))
      if (diff < bestDiff) { bestDiff = diff; best = f }
    }
    if (best && bestDiff <= matchWindowDays) {
      usedFin.add(best.id)
      const pair: MatchedPair = { bank: b, fin: best, dateDiffDays: Math.round(bestDiff) }
      matched.push(pair)
      if (bestDiff > dateToleranceDays) dateMismatches.push(pair)
    } else {
      missing.push(b)
    }
  }

  const extra = finPeriod.filter(f => !usedFin.has(f.id))
  const probableDuplicates = findProbableDuplicates(finPeriod)

  // ── balances ─────────────────────────────────────────────
  const saldoFIN = computeSaldoFIN(accountId, finTxns, period, openingBalance)
  const diferenca = bankBalance === null ? null : bankBalance - saldoFIN

  const entradasDiff = entradasBanco - entradasFIN
  const saidasDiff = saidasBanco - saidasFIN

  // ── status + notes ───────────────────────────────────────
  const notes: string[] = []
  if (missing.length) notes.push(`${missing.length} lançamento(s) no banco ausente(s) no FIN.`)
  if (extra.length) notes.push(`${extra.length} lançamento(s) no FIN sem correspondência no banco.`)
  if (dateMismatches.length) notes.push(`${dateMismatches.length} lançamento(s) com data divergente.`)
  if (probableDuplicates.length) notes.push(`${probableDuplicates.length} provável(is) duplicado(s) no FIN.`)
  if (bankBalance !== null && Math.abs(diferenca ?? 0) > 1) {
    notes.push(`Saldo banco e FIN diferem em ${(diferenca ?? 0).toFixed(2)} (pode ser saldo defasado por sync ou baseline de abertura).`)
  }

  let status: ReconStatus
  if (missing.length > 0 || extra.length > 0) {
    status = 'critical'
  } else if (
    dateMismatches.length > 0 ||
    probableDuplicates.length > 0 ||
    (bankBalance !== null && Math.abs(diferenca ?? 0) > 1)
  ) {
    status = 'warning'
  } else {
    status = 'reconciled'
  }

  return {
    accountId, period,
    saldoBanco: bankBalance,
    saldoFIN,
    diferenca,
    entradasBanco, entradasFIN,
    saidasBanco, saidasFIN,
    entradasDiff, saidasDiff,
    matched, missing, extra, dateMismatches, probableDuplicates,
    status, notes,
  }
}

// ── lightweight list summary (no bank-txn fetch needed) ─────────────────────

export interface AccountQuickSummary {
  accountId: string
  saldoBanco: number | null
  saldoFIN: number
  diferenca: number | null
  entradasFIN: number
  saidasFIN: number
  /** Balance-based hint only — full status needs reconcileAccount() with bank txns. */
  status: ReconStatus
}

export function quickAccountSummary(
  accountId: string,
  finTxns: Transaction[],
  bankBalance: number | null,
  period: ReconPeriod,
  openingBalance: number | null = null,
): AccountQuickSummary {
  const finPeriod = ledgerForAccount(accountId, finTxns)
    .filter(t => inPeriod(financialDateOf(t), period))
  const entradasFIN = finPeriod.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const saidasFIN = finPeriod.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const saldoFIN = computeSaldoFIN(accountId, finTxns, period, openingBalance)
  const diferenca = bankBalance === null ? null : bankBalance - saldoFIN

  let status: ReconStatus = 'reconciled'
  if (bankBalance !== null) {
    const gap = Math.abs(diferenca ?? 0)
    if (gap > 100) status = 'critical'
    else if (gap > 1) status = 'warning'
  }

  return { accountId, saldoBanco: bankBalance, saldoFIN, diferenca, entradasFIN, saidasFIN, status }
}
