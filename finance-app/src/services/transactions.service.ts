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

  const updated = txns.map(tx =>
    tx.id === id
      ? {
          ...tx,
          ...patch,
          isAdjustment: true,
          adjustmentReason: (patch as Transaction).adjustmentReason ?? 'manual_reclassification',
          updatedAt: new Date().toISOString(),
        }
      : tx
  )
  localAdapter.replaceAllTransactions(updated)
}
