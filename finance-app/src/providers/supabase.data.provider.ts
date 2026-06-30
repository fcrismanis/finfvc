import type { Transaction, Budget, MonthClosing, SubCategory, Provision } from '../types'
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
    if (patch.transactionDate !== undefined)     dbPatch.transaction_date = patch.transactionDate
    if (patch.competenceDate !== undefined)      dbPatch.competence_date = patch.competenceDate
    if (patch.paymentDate !== undefined)         dbPatch.payment_date = patch.paymentDate ?? null
    if (patch.categoryId !== undefined)          dbPatch.category_id = patch.categoryId ?? null
    if (patch.subCategoryId !== undefined)       dbPatch.sub_category_id = patch.subCategoryId ?? null
    if (patch.macroCategoryId !== undefined)     dbPatch.macro_category_id = patch.macroCategoryId ?? null
    if (patch.classificationType !== undefined)  dbPatch.classification_type = patch.classificationType
    if (patch.type !== undefined)                dbPatch.transaction_type = patch.type
    if (patch.status !== undefined)              dbPatch.status = patch.status
    if (patch.isRecurring !== undefined)         dbPatch.is_recurring = patch.isRecurring
    if (patch.notes !== undefined)               dbPatch.notes = patch.notes ?? null
    if (patch.includeInOperationalResult !== undefined) dbPatch.include_in_operational_result = patch.includeInOperationalResult
    if (patch.includeInCashflow !== undefined)   dbPatch.include_in_cashflow = patch.includeInCashflow
    if (patch.includeInBudget !== undefined)     dbPatch.include_in_budget = patch.includeInBudget
    if (patch.isInternalTransfer !== undefined)           dbPatch.is_internal_transfer = patch.isInternalTransfer
    if (patch.manualCategoryOverride !== undefined)       dbPatch.manual_category_override = patch.manualCategoryOverride ?? null
    if (patch.manualSubCategoryOverride !== undefined)    dbPatch.manual_sub_category_override = patch.manualSubCategoryOverride ?? null
    if (patch.manualTextOverride !== undefined)           dbPatch.manual_text_override = patch.manualTextOverride ?? null
    if (patch.manualEditedAt !== undefined)               dbPatch.manual_edited_at = patch.manualEditedAt ?? null

    const { error } = await supabase
      .from('transactions')
      .update(dbPatch)
      .eq('id', id)
      .eq('family_id', this.familyId)

    if (error) throw new Error(`[SupabaseDataProvider] updateTransaction: ${error.message}`)
  }

  async updateTransactions(items: Array<{ id: string; patch: Partial<Transaction> }>, _opts?: { markManual?: boolean }): Promise<void> {
    if (!this.familyId) return
    // Sequential upserts keep the snake_case mapping in one place (updateTransaction).
    for (const { id, patch } of items) {
      await this.updateTransaction(id, patch)
    }
  }

  async saveBudget(budget: Budget): Promise<void> {
    if (!this.familyId) return

    // budgets.id is a DB-generated uuid — the app's string id (e.g. 'bud_2026-06_mac_x')
    // is NOT a valid uuid, so we never send it. We match on the natural key instead.
    // uq_budget = (family_id, macro_category_id, category_id, month). Postgres treats a
    // NULL category_id as distinct, so an onConflict upsert can't reliably target macro-level
    // rows (category_id IS NULL) and would create duplicates. Hence: explicit find → update/insert.
    const macroId = budget.macroCategoryId ?? null
    const categoryId = budget.categoryId ?? null

    let lookup = supabase
      .from('budgets')
      .select('id')
      .eq('family_id', this.familyId)
      .eq('month', budget.referenceMonth)
    lookup = macroId === null ? lookup.is('macro_category_id', null) : lookup.eq('macro_category_id', macroId)
    lookup = categoryId === null ? lookup.is('category_id', null) : lookup.eq('category_id', categoryId)

    const { data: existing, error: selErr } = await lookup.maybeSingle()
    if (selErr) throw new Error(`[SupabaseDataProvider] saveBudget lookup: ${selErr.message}`)

    if (existing) {
      const { error } = await supabase
        .from('budgets')
        .update({ amount: budget.plannedAmount, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('family_id', this.familyId)
      if (error) throw new Error(`[SupabaseDataProvider] saveBudget update: ${error.message}`)
    } else {
      const { error } = await supabase
        .from('budgets')
        .insert({
          family_id: this.familyId,
          macro_category_id: macroId,
          category_id: categoryId,
          month: budget.referenceMonth,
          amount: budget.plannedAmount,
        })
      if (error) throw new Error(`[SupabaseDataProvider] saveBudget insert: ${error.message}`)
    }
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

  async loadSubCategories(): Promise<SubCategory[]> {
    if (!this.familyId) return []
    const { data, error } = await supabase
      .from('sub_categories')
      .select('*')
      .eq('family_id', this.familyId)
      .order('name', { ascending: true })
    if (error) {
      console.warn('[SupabaseDataProvider] loadSubCategories:', error.message)
      return []
    }
    return (data as Array<{
      id: string; family_id: string; macro_category_id: string;
      name: string; essentiality: string; active: boolean; created_at: string; updated_at: string
    }>).map(r => ({
      id: r.id,
      macroCategoryId: r.macro_category_id,
      name: r.name,
      essentiality: r.essentiality as SubCategory['essentiality'],
      active: r.active,
      createdAt: r.created_at,
    }))
  }

  async saveSubCategory(sub: SubCategory): Promise<void> {
    if (!this.familyId) return
    const { error } = await supabase
      .from('sub_categories')
      .upsert({
        id: sub.id,
        family_id: this.familyId,
        macro_category_id: sub.macroCategoryId,
        name: sub.name,
        essentiality: sub.essentiality,
        active: sub.active,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    if (error) throw new Error(`[SupabaseDataProvider] saveSubCategory: ${error.message}`)
  }

  async deleteSubCategory(id: string): Promise<void> {
    if (!this.familyId) return
    const { error } = await supabase
      .from('sub_categories')
      .delete()
      .eq('id', id)
      .eq('family_id', this.familyId)
    if (error) throw new Error(`[SupabaseDataProvider] deleteSubCategory: ${error.message}`)
  }

  async loadProvisions(): Promise<Provision[]> {
    if (!this.familyId) return []
    const { data, error } = await supabase
      .from('provisions')
      .select('*')
      .eq('family_id', this.familyId)
      .order('due_month', { ascending: true })
    if (error) {
      console.warn('[SupabaseDataProvider] loadProvisions:', error.message)
      return []
    }
    return (data as Array<{
      id: string; family_id: string; label: string; macro_category_id: string | null;
      annual_amount: number; recurrence: string; due_month: number; active: boolean;
      notes: string | null; created_at: string
    }>).map(r => ({
      id: r.id,
      label: r.label,
      macroCategoryId: r.macro_category_id ?? undefined,
      annualAmount: Number(r.annual_amount),
      recurrence: r.recurrence as Provision['recurrence'],
      dueMonth: r.due_month,
      active: r.active,
      notes: r.notes ?? undefined,
      createdAt: r.created_at,
    }))
  }

  async saveProvision(prov: Provision): Promise<void> {
    if (!this.familyId) return
    const { error } = await supabase
      .from('provisions')
      .upsert({
        id: prov.id,
        family_id: this.familyId,
        label: prov.label,
        macro_category_id: prov.macroCategoryId ?? null,
        annual_amount: prov.annualAmount,
        recurrence: prov.recurrence,
        due_month: prov.dueMonth,
        active: prov.active,
        notes: prov.notes ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    if (error) throw new Error(`[SupabaseDataProvider] saveProvision: ${error.message}`)
  }

  async deleteProvision(id: string): Promise<void> {
    if (!this.familyId) return
    const { error } = await supabase
      .from('provisions')
      .delete()
      .eq('id', id)
      .eq('family_id', this.familyId)
    if (error) throw new Error(`[SupabaseDataProvider] deleteProvision: ${error.message}`)
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
