import type { Transaction } from '../types'
import type { IDataAdapter } from './adapter.interface'

const STORAGE_KEY = 'finance_transactions'

export class LocalAdapter implements IDataAdapter {
  getTransactions(): Transaction[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      return JSON.parse(raw) as Transaction[]
    } catch {
      return []
    }
  }

  addTransactions(txns: Transaction[]): void {
    const existing = this.getTransactions()
    const existingIds = new Set(existing.map(t => t.id))
    const existingHashes = new Set(existing.map(t => t.importHash).filter(Boolean))

    const deduped = txns.filter(t =>
      !existingIds.has(t.id) && !(t.importHash && existingHashes.has(t.importHash))
    )

    const merged = [...existing, ...deduped]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  }

  replaceAllTransactions(txns: Transaction[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txns))
  }

  clearTransactions(): void {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export const localAdapter = new LocalAdapter()
