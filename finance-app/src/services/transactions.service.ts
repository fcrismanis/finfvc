import type { Transaction } from '../types'
import { MOCK_TRANSACTIONS } from '../mock/transactions'
import { localAdapter } from '../adapters/local.adapter'
import { learnRuleFromTransaction } from './categoryRules.service'

export function getTransactionsOrMock(): { transactions: Transaction[]; isDemo: boolean } {
  const raw = localStorage.getItem('finance_transactions')
  if (raw !== null) return { transactions: localAdapter.getTransactions(), isDemo: false }
  return { transactions: MOCK_TRANSACTIONS, isDemo: true }
}

export function updateTransaction(id: string, patch: Partial<Transaction>): void {
  const txns = localAdapter.getTransactions()
  if (localStorage.getItem('finance_transactions') === null) return // don't mutate mock

  const now = new Date().toISOString()
  const manualFields: Partial<Transaction> = {}
  if ('macroCategoryId' in patch || 'categoryId' in patch) {
    manualFields.manualCategoryOverride = true
    manualFields.manualEditedAt = now
  }
  if ('subCategoryId' in patch) {
    manualFields.manualSubCategoryOverride = true
    manualFields.manualEditedAt = now
  }
  if ('description' in patch) {
    manualFields.manualTextOverride = true
    manualFields.manualEditedAt = now
  }

  let learnedFrom: Transaction | null = null
  const updated = txns.map(tx => {
    if (tx.id !== id) return tx
    const next: Transaction = {
      ...tx,
      ...patch,
      ...manualFields,
      isAdjustment: true,
      adjustmentReason: (patch as Transaction).adjustmentReason ?? 'manual_reclassification',
      updatedAt: now,
    }
    if (manualFields.manualCategoryOverride || manualFields.manualSubCategoryOverride) learnedFrom = next
    return next
  })
  localAdapter.replaceAllTransactions(updated)

  // Learn a reusable rule from the manual correction (safe-guards inside).
  if (learnedFrom) learnRuleFromTransaction(learnedFrom, 'manual')
}

/**
 * Apply many patches in a single localStorage write (one reload upstream).
 *
 * `markManual` controls whether category/subcategory/description edits flip the
 * manual-override flags. Use `true` for genuine user decisions (bulk "apply
 * selected") and `false` for automatic application (rules, high-confidence
 * suggestions) so the auto-applied value is not mistaken for a manual lock.
 *
 * Existing manual overrides are never cleared here; callers must pre-filter
 * protected transactions out of `items`.
 */
export function applyTransactionPatches(
  items: Array<{ id: string; patch: Partial<Transaction> }>,
  opts: { markManual?: boolean } = {},
): void {
  if (items.length === 0) return
  if (localStorage.getItem('finance_transactions') === null) return // don't mutate mock

  const txns = localAdapter.getTransactions()
  const now = new Date().toISOString()
  const patchById = new Map(items.map(i => [i.id, i.patch]))

  const learned: Transaction[] = []
  const updated = txns.map(tx => {
    const patch = patchById.get(tx.id)
    if (!patch) return tx

    const manualFields: Partial<Transaction> = {}
    if (opts.markManual) {
      if ('macroCategoryId' in patch || 'categoryId' in patch) {
        manualFields.manualCategoryOverride = true
        manualFields.manualEditedAt = now
      }
      if ('subCategoryId' in patch) {
        manualFields.manualSubCategoryOverride = true
        manualFields.manualEditedAt = now
      }
      if ('description' in patch) {
        manualFields.manualTextOverride = true
        manualFields.manualEditedAt = now
      }
    }

    const next = { ...tx, ...patch, ...manualFields, updatedAt: now }
    if (manualFields.manualCategoryOverride || manualFields.manualSubCategoryOverride) learned.push(next)
    return next
  })

  localAdapter.replaceAllTransactions(updated)

  // Learn rules from explicit bulk corrections (markManual path only).
  for (const tx of learned) learnRuleFromTransaction(tx, 'manual')
}
