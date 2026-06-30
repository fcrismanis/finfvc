import type { Transaction, Budget, MonthClosing, SubCategory, Provision } from '../types'

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
  /** Persist many transaction patches at once (bulk actions, rules, tags). */
  updateTransactions(items: Array<{ id: string; patch: Partial<Transaction> }>, opts?: { markManual?: boolean }): Promise<void>
  /** Persist a budget record (upsert by id). */
  saveBudget(budget: Budget): Promise<void>
  /** Append new transactions (import flow). Deduplication is provider's responsibility. */
  appendTransactions(txns: Transaction[]): Promise<void>
  /** Load all monthly closings for the family. */
  getMonthlyClosings(): Promise<MonthClosing[]>
  /** Persist a monthly closing (upsert by month). */
  saveMonthlyClosing(closing: MonthClosing): Promise<void>
  /** Load all subcategories for this family. */
  loadSubCategories(): Promise<SubCategory[]>
  /** Upsert a subcategory. */
  saveSubCategory(sub: SubCategory): Promise<void>
  /** Delete a subcategory by id. */
  deleteSubCategory(id: string): Promise<void>
  /** Load all provisions for this family. */
  loadProvisions(): Promise<Provision[]>
  /** Upsert a provision. */
  saveProvision(prov: Provision): Promise<void>
  /** Delete a provision by id. */
  deleteProvision(id: string): Promise<void>
}
