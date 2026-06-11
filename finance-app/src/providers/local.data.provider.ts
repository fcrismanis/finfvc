import type { Transaction, Budget, MonthClosing } from '../types'
import type { IDataProvider, LoadResult } from './data.provider'
import { getTransactionsOrMock, updateTransaction as svcUpdateTx } from '../services/transactions.service'
import { getBudgetsOrMock, saveBudget as svcSaveBudget } from '../services/budget.service'
import { getAllClosings, saveClosing } from '../services/closing.service'
import { localAdapter } from '../adapters/local.adapter'

export class LocalDataProvider implements IDataProvider {
  async load(): Promise<LoadResult> {
    const { transactions, isDemo: txDemo } = getTransactionsOrMock()
    const { budgets, isDemo: budDemo } = getBudgetsOrMock()
    return { transactions, budgets, isDemo: txDemo && budDemo }
  }

  async updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
    svcUpdateTx(id, patch)
  }

  async saveBudget(budget: Budget): Promise<void> {
    svcSaveBudget(budget)
  }

  async appendTransactions(txns: Transaction[]): Promise<void> {
    localAdapter.addTransactions(txns)
  }

  async getMonthlyClosings(): Promise<MonthClosing[]> {
    return getAllClosings()
  }

  async saveMonthlyClosing(closing: MonthClosing): Promise<void> {
    saveClosing(closing)
  }
}
