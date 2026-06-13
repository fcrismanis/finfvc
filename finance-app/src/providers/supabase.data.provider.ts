import type { Transaction, Budget, MonthClosing } from '../types'
import type { IDataProvider, LoadResult } from './data.provider'
import { SupabaseAdapter } from '../adapters/supabase.adapter'
import { supabase } from '../lib/supabase'

// ── DB row types ──────────────────────────────────────────────────────────────

type DbBudget = {
  id: string
  family_id: string
  macro_category_id: string | null
  category_id: string | null
  month: string
  amount: number
}

type DbClosing = {
  id?: string
  family_id: string
  month: string
  closed_by?: string | null
  closed_at?: string | null
  is_closed: boolean
  notes?: string | null
  checklist?: Record<string, unknown> | null
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function fromDbBudget(row: DbBudget): Budget {
  return {
    id: row.id,
    referenceMonth: row.month,
    macroCategoryId: row.macro_category_id ?? undefined,
    categoryId: row.category_id ?? undefined,
    plannedAmount: row.amount,
  }
}

function toDbBudget(b: Budget, familyId: string): Omit<DbBudget, 'id'> & { id: string } {
  return {
    id: b.id,
    family_id: familyId,
    macro_category_id: b.macroCategoryId ?? null,
    category_id: b.categoryId ?? null,
    month: b.referenceMonth,
    amount: b.plannedAmount,
  }
}

function fromDbClosing(row: DbClosing): MonthClosing {
  const meta = (row.checklist ?? {}) as Record<string, unknown>
  return {
    month: row.month,
    isClosed: row.is_closed,
    closedAt: row.closed_at ?? undefined,
    // reopenedAt not in SQL schema — stored in checklist._reopenedAt if present
    reopenedAt: meta._reopenedAt as string | undefined,
    checklist: (meta._checklist as Record<string, boolean>) ?? {},
    notes: row.notes ?? '',
  }
}

function toDbClosing(c: MonthClosing, familyId: string): Omit<DbClosing, 'id'> {
  return {
    family_id: familyId,
    month: c.month,
    closed_at: c.isClosed ? (c.closedAt ?? new Date().toISOString()) : null,
    is_closed: c.isClosed,
    notes: c.notes || null,
    // Pack reopenedAt + checklist into the jsonb column to avoid a schema change
    checklist: {
      _checklist: c.checklist,
      ...(c.reopenedAt ? { _reopenedAt: c.reopenedAt } : {}),
    },
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class SupabaseDataProvider implements IDataProvider {
  private adapter: SupabaseAdapter
  private familyId: string

  constructor(familyId?: string) {
    // Empty string disables all queries; RLS will return empty sets safely.
    // familyId is guaranteed to be a real UUID once AuthContext resolves.
    this.familyId = familyId ?? ''
    this.adapter = new SupabaseAdapter(this.familyId)
  }

  async load(): Promise<LoadResult> {
    if (!this.familyId) return { transactions: [], budgets: [], isDemo: false }

    try {
      const [transactions, budgets] = await Promise.all([
        this.adapter.fetchTransactions(),
        this._loadBudgets(),
      ])
      return { transactions, budgets, isDemo: false }
    } catch (e) {
      console.warn('[SupabaseDataProvider] load failed:', (e as Error).message)
      return { transactions: [], budgets: [], isDemo: false }
    }
  }

  async updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
    if (!this.familyId) return

    // Convert camelCase patch fields to snake_case for Supabase
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (patch.description !== undefined)         dbPatch.description = patch.description
    if (patch.categoryId !== undefined)          dbPatch.category_id = patch.categoryId ?? null
    if (patch.macroCategoryId !== undefined)     dbPatch.macro_category_id = patch.macroCategoryId ?? null
    if (patch.classificationType !== undefined)  dbPatch.classification_type = patch.classificationType
    if (patch.status !== undefined)              dbPatch.status = patch.status
    if (patch.isRecurring !== undefined)         dbPatch.is_recurring = patch.isRecurring
    if (patch.notes !== undefined)               dbPatch.notes = patch.notes ?? null
    if (patch.includeInOperationalResult !== undefined) dbPatch.include_in_operational_result = patch.includeInOperationalResult
    if (patch.includeInCashflow !== undefined)   dbPatch.include_in_cashflow = patch.includeInCashflow
    if (patch.includeInBudget !== undefined)     dbPatch.include_in_budget = patch.includeInBudget
    if (patch.isInternalTransfer !== undefined)  dbPatch.is_internal_transfer = patch.isInternalTransfer

    const { error } = await supabase
      .from('transactions')
      .update(dbPatch)
      .eq('id', id)
      .eq('family_id', this.familyId)

    if (error) throw new Error(`[SupabaseDataProvider] updateTransaction: ${error.message}`)
  }

  async saveBudget(budget: Budget): Promise<void> {
    if (!this.familyId) return

    const row = toDbBudget(budget, this.familyId)
    const { error } = await supabase
      .from('budgets')
      .upsert(row, { onConflict: 'family_id,macro_category_id,category_id,month', ignoreDuplicates: false })

    if (error) throw new Error(`[SupabaseDataProvider] saveBudget: ${error.message}`)
  }

  async appendTransactions(txns: Transaction[]): Promise<void> {
    if (!this.familyId || txns.length === 0) return
    await this.adapter.insertTransactions(txns)
  }

  async getMonthlyClosings(): Promise<MonthClosing[]> {
    if (!this.familyId) return []

    const { data, error } = await supabase
      .from('monthly_closings')
      .select('*')
      .eq('family_id', this.familyId)
      .order('month', { ascending: false })

    if (error) {
      console.warn('[SupabaseDataProvider] getMonthlyClosings:', error.message)
      return []
    }

    return (data as DbClosing[]).map(fromDbClosing)
  }

  async saveMonthlyClosing(closing: MonthClosing): Promise<void> {
    if (!this.familyId) return

    const row = toDbClosing(closing, this.familyId)
    const { error } = await supabase
      .from('monthly_closings')
      .upsert(row, { onConflict: 'family_id,month', ignoreDuplicates: false })

    if (error) throw new Error(`[SupabaseDataProvider] saveMonthlyClosing: ${error.message}`)
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _loadBudgets(): Promise<Budget[]> {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('family_id', this.familyId)

    if (error) {
      console.warn('[SupabaseDataProvider] _loadBudgets:', error.message)
      return []
    }

    return (data as DbBudget[]).map(fromDbBudget)
  }
}
