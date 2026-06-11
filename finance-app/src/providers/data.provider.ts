import type { Transaction, Budget, MonthClosing } from '../types'

export interface LoadResult {
  transactions: Transaction[]
  budgets: Budget[]
  isDemo: boolean
}

export interface IDataProvider {
  /** Load all data needed by DataContext on init and reload. */
  load(): Promise<LoadResult>
  /** Persist a transaction patch. Called after UI edit. */
  updateTransaction(id: string, patch: Partial<Transaction>): Promise<void>
  /** Persist a budget record (upsert by id). */
  saveBudget(budget: Budget): Promise<void>
  /** Append new transactions (import flow). Deduplication is provider's responsibility. */
  appendTransactions(txns: Transaction[]): Promise<void>
  /** Load all monthly closings for the family. */
  getMonthlyClosings(): Promise<MonthClosing[]>
  /** Persist a monthly closing (upsert by month). */
  saveMonthlyClosing(closing: MonthClosing): Promise<void>
}
