import type { Transaction } from '../types'

export interface IDataAdapter {
  getTransactions(): Transaction[]
  addTransactions(txns: Transaction[]): void
  replaceAllTransactions(txns: Transaction[]): void
  clearTransactions(): void
}
