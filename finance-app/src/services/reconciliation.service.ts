import type { Transaction } from '../types'

/**
 * Neutral / internal-movement reconciliation.
 *
 * Card payments, transfers between own accounts and own-PIX must not inflate
 * the operational result or budget. This module flags them so the user can
 * neutralize in one click (classificationType 'neutral', excluded from budget
 * and operational result).
 */

const CARD_PAYMENT_RE = /pagamento\s*(de)?\s*(fatura|cart[aã]o)|fatura\s*cart[aã]o|credit\s*card\s*payment|pag\s*cart[aã]o/i
const OWN_TRANSFER_RE = /transfer[eê]ncia entre contas|mesma titularidade|same person transfer|conta pr[oó]pria/i
const OWN_PIX_RE      = /transfer\s*-\s*pix/i

export function isCardPayment(tx: Transaction): boolean {
  if (tx.pluggyCategoryId === '05040000') return true
  if (CARD_PAYMENT_RE.test(tx.pluggyCategory ?? '')) return true
  return CARD_PAYMENT_RE.test(`${tx.description} ${tx.originalDescription ?? ''}`)
}

export function isOwnTransfer(tx: Transaction): boolean {
  if (tx.isInternalTransfer) return true
  if (tx.pluggyCategoryId === '04000000' || tx.pluggyCategoryId === '04010000') return true
  return OWN_TRANSFER_RE.test(`${tx.pluggyCategory ?? ''} ${tx.description} ${tx.originalDescription ?? ''}`)
}

export function isOwnPix(tx: Transaction): boolean {
  if (tx.pluggyCategoryId === '05070000') return true
  return OWN_PIX_RE.test(`${tx.pluggyCategory ?? ''} ${tx.description}`)
}

function isManual(tx: Transaction): boolean {
  return !!(tx.manualCategoryOverride || tx.manualSubCategoryOverride)
}

function isAlreadyNeutral(tx: Transaction): boolean {
  return tx.classificationType === 'neutral' && tx.includeInBudget === false && tx.includeInOperationalResult === false
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00').getTime()
  const db = new Date(b + 'T12:00:00').getTime()
  return Math.abs(da - db) / 86_400_000
}

export interface ReconciliationResult {
  /** Transactions worth turning neutral that are not already neutral / manual. */
  candidateIds: Set<string>
  cardPayments: Transaction[]
  ownTransfers: Transaction[]
  ownPix: Transaction[]
  /** Pairs of mirrored income/expense (same |amount| within 3 days). */
  mirroredPairs: Array<[Transaction, Transaction]>
  neutralTotal: number     // sum of amounts already classified neutral in scope
  internalCount: number    // own transfers + own pix + mirrored entries
  possibleCardDupes: number // card payments detected
}

/** Diagnose neutral / internal movements for a set of transactions (typically one month). */
export function diagnoseReconciliation(transactions: Transaction[]): ReconciliationResult {
  const active = transactions.filter(t => t.status !== 'cancelled')

  const cardPayments: Transaction[] = []
  const ownTransfers: Transaction[] = []
  const ownPix: Transaction[] = []

  for (const tx of active) {
    if (isCardPayment(tx)) cardPayments.push(tx)
    else if (isOwnTransfer(tx)) ownTransfers.push(tx)
    else if (isOwnPix(tx)) ownPix.push(tx)
  }

  // Mirrored income/expense of equal magnitude within 3 days → internal movement.
  const mirroredPairs: Array<[Transaction, Transaction]> = []
  const usedInPair = new Set<string>()
  const incomes = active.filter(t => t.type === 'income')
  const expenses = active.filter(t => t.type === 'expense')
  for (const inc of incomes) {
    if (usedInPair.has(inc.id)) continue
    const match = expenses.find(exp =>
      !usedInPair.has(exp.id) &&
      Math.abs(exp.amount - inc.amount) < 0.01 &&
      daysBetween(inc.transactionDate, exp.transactionDate) <= 3
    )
    if (match) {
      mirroredPairs.push([inc, match])
      usedInPair.add(inc.id); usedInPair.add(match.id)
    }
  }

  const candidateIds = new Set<string>()
  const consider = (tx: Transaction) => {
    if (isManual(tx) || isAlreadyNeutral(tx)) return
    candidateIds.add(tx.id)
  }
  cardPayments.forEach(consider)
  ownTransfers.forEach(consider)
  ownPix.forEach(consider)
  for (const [a, b] of mirroredPairs) { consider(a); consider(b) }

  const neutralTotal = active
    .filter(t => t.classificationType === 'neutral')
    .reduce((s, t) => s + t.amount, 0)

  return {
    candidateIds,
    cardPayments,
    ownTransfers,
    ownPix,
    mirroredPairs,
    neutralTotal,
    internalCount: ownTransfers.length + ownPix.length + mirroredPairs.length,
    possibleCardDupes: cardPayments.length,
  }
}

/** Patch that turns a transaction into a budget-neutral internal movement. */
export function neutralPatch(): Partial<Transaction> {
  return {
    classificationType: 'neutral',
    macroCategoryId: 'mac_movfin',
    includeInBudget: false,
    includeInOperationalResult: false,
    includeInCashflow: true,
    isInternalTransfer: true,
    needsReview: false,
  }
}
