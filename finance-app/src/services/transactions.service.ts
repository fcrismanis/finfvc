import type { Transaction } from '../types'
import { MOCK_TRANSACTIONS } from '../mock/transactions'
import { localAdapter } from '../adapters/local.adapter'

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

  const updated = txns.map(tx =>
    tx.id === id
      ? {
          ...tx,
          ...patch,
          ...manualFields,
          isAdjustment: true,
          adjustmentReason: (patch as Transaction).adjustmentReason ?? 'manual_reclassification',
          updatedAt: now,
        }
      : tx
  )
  localAdapter.replaceAllTransactions(updated)
}
