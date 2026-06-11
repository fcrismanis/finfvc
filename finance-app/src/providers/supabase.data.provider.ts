import type { Transaction, Budget, MonthClosing } from '../types'
import type { IDataProvider, LoadResult } from './data.provider'
import { SupabaseAdapter } from '../adapters/supabase.adapter'

// familyId is set after auth. Placeholder used until auth flow is implemented —
// Supabase RLS denies access for unauthenticated sessions, so load() returns empty safely.
const PENDING_FAMILY_ID = '00000000-0000-0000-0000-000000000000'

export class SupabaseDataProvider implements IDataProvider {
  private adapter: SupabaseAdapter

  constructor(familyId = PENDING_FAMILY_ID) {
    this.adapter = new SupabaseAdapter(familyId)
  }

  async load(): Promise<LoadResult> {
    try {
      const transactions = await this.adapter.fetchTransactions()
      // Budgets and closings via Supabase are implemented in a future step
      return { transactions, budgets: [], isDemo: false }
    } catch (e) {
      console.warn('[SupabaseDataProvider] load failed:', (e as Error).message)
      return { transactions: [], budgets: [], isDemo: false }
    }
  }

  async updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
    // TODO: supabase.from('transactions').update(patch).eq('id', id).eq('family_id', familyId)
    console.warn('[SupabaseDataProvider] updateTransaction not yet implemented')
    const txns = this.adapter.getTransactions()
    const updated = txns.map(t =>
      t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
    )
    this.adapter.replaceAllTransactions(updated)
  }

  async saveBudget(_budget: Budget): Promise<void> {
    // TODO: supabase.from('budgets').upsert(toDbBudget(_budget))
    console.warn('[SupabaseDataProvider] saveBudget not yet implemented')
  }

  async appendTransactions(txns: Transaction[]): Promise<void> {
    await this.adapter.insertTransactions(txns)
  }

  async getMonthlyClosings(): Promise<MonthClosing[]> {
    // TODO: supabase.from('monthly_closings').select('*').eq('family_id', familyId)
    console.warn('[SupabaseDataProvider] getMonthlyClosings not yet implemented')
    return []
  }

  async saveMonthlyClosing(_closing: MonthClosing): Promise<void> {
    // TODO: supabase.from('monthly_closings').upsert(toDbClosing(_closing))
    console.warn('[SupabaseDataProvider] saveMonthlyClosing not yet implemented')
  }
}
