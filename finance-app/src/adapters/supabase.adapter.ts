import type { Transaction } from '../types'
import type { IDataAdapter } from './adapter.interface'
import { supabase } from '../lib/supabase'

// Supabase DB row shape (snake_case) → local camelCase Transaction
type DbTransaction = {
  id: string
  family_id: string
  description: string
  original_description: string | null
  amount: number
  transaction_type: string
  classification_type: string
  transaction_date: string
  competence_date: string
  payment_date: string | null
  status: string
  payment_method: string
  account_id: string | null
  credit_card_id: string | null
  category_id: string | null
  macro_category_id: string | null
  installment_current: number | null
  installment_total: number | null
  is_recurring: boolean
  include_in_operational_result: boolean
  include_in_cashflow: boolean
  include_in_budget: boolean
  is_internal_transfer: boolean
  import_batch_id: string | null
  import_hash: string | null
  source_file: string | null
  raw_data: Record<string, unknown> | null
  notes: string | null
  created_at: string
  updated_at: string
}

function toTransaction(row: DbTransaction): Transaction {
  return {
    id: row.id,
    description: row.description,
    originalDescription: row.original_description ?? row.description,
    amount: row.amount,
    type: row.transaction_type as Transaction['type'],
    classificationType: row.classification_type as Transaction['classificationType'],
    transactionDate: row.transaction_date,
    competenceDate: row.competence_date,
    paymentDate: row.payment_date ?? undefined,
    status: row.status as Transaction['status'],
    accountId: row.account_id ?? '',
    creditCardId: row.credit_card_id ?? undefined,
    categoryId: row.category_id ?? undefined,
    macroCategoryId: row.macro_category_id ?? undefined,
    paymentMethod: row.payment_method as Transaction['paymentMethod'],
    installmentCurrent: row.installment_current ?? undefined,
    installmentTotal: row.installment_total ?? undefined,
    isRecurring: row.is_recurring,
    includeInOperationalResult: row.include_in_operational_result,
    includeInCashflow: row.include_in_cashflow,
    includeInBudget: row.include_in_budget,
    isInternalTransfer: row.is_internal_transfer,
    isAdjustment: false,
    importBatchId: row.import_batch_id ?? undefined,
    importHash: row.import_hash ?? undefined,
    sourceFile: row.source_file ?? undefined,
    notes: row.notes ?? undefined,
    origin: 'import_xlsx',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toDbRow(t: Transaction, familyId: string): Omit<DbTransaction, 'created_at' | 'updated_at'> {
  return {
    id: t.id,
    family_id: familyId,
    description: t.description,
    original_description: t.originalDescription,
    amount: t.amount,
    transaction_type: t.type,
    classification_type: t.classificationType,
    transaction_date: t.transactionDate,
    competence_date: t.competenceDate,
    payment_date: t.paymentDate ?? null,
    status: t.status,
    payment_method: t.paymentMethod,
    account_id: t.accountId || null,
    credit_card_id: t.creditCardId ?? null,
    category_id: t.categoryId ?? null,
    macro_category_id: t.macroCategoryId ?? null,
    installment_current: t.installmentCurrent ?? null,
    installment_total: t.installmentTotal ?? null,
    is_recurring: t.isRecurring,
    include_in_operational_result: t.includeInOperationalResult,
    include_in_cashflow: t.includeInCashflow,
    include_in_budget: t.includeInBudget,
    is_internal_transfer: t.isInternalTransfer,
    import_batch_id: t.importBatchId ?? null,
    import_hash: t.importHash ?? null,
    source_file: t.sourceFile ?? null,
    raw_data: null,
    notes: t.notes ?? null,
  }
}

export class SupabaseAdapter implements IDataAdapter {
  private familyId: string
  private cache: Transaction[] = []
  private loaded = false

  constructor(familyId: string) {
    this.familyId = familyId
  }

  // ── IDataAdapter sync shims ────────────────────────────────────────────────
  // These return the in-memory cache. Call fetchTransactions() first to hydrate.

  getTransactions(): Transaction[] {
    if (!this.loaded) {
      console.warn('[SupabaseAdapter] getTransactions() called before fetchTransactions(). Cache may be empty.')
    }
    return this.cache
  }

  addTransactions(txns: Transaction[]): void {
    console.warn('[SupabaseAdapter] addTransactions() is sync-only shim. Use insertTransactions() for durable write.')
    const existingIds = new Set(this.cache.map(t => t.id))
    const existingHashes = new Set(this.cache.map(t => t.importHash).filter(Boolean))
    const deduped = txns.filter(t =>
      !existingIds.has(t.id) && !(t.importHash && existingHashes.has(t.importHash))
    )
    this.cache = [...this.cache, ...deduped]
  }

  replaceAllTransactions(txns: Transaction[]): void {
    console.warn('[SupabaseAdapter] replaceAllTransactions() is sync-only shim. Use insertTransactions() for durable write.')
    this.cache = txns
  }

  clearTransactions(): void {
    console.warn('[SupabaseAdapter] clearTransactions() is sync-only shim. Data is NOT deleted from Supabase.')
    this.cache = []
    this.loaded = false
  }

  // ── Async methods (Supabase I/O) ───────────────────────────────────────────

  async fetchTransactions(): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('family_id', this.familyId)
      .order('competence_date', { ascending: false })

    if (error) throw new Error(`[SupabaseAdapter] fetchTransactions: ${error.message}`)

    this.cache = (data as DbTransaction[]).map(toTransaction)
    this.loaded = true
    return this.cache
  }

  async insertTransactions(txns: Transaction[]): Promise<void> {
    if (txns.length === 0) return

    const rows = txns.map(t => toDbRow(t, this.familyId))

    const { error } = await supabase
      .from('transactions')
      .upsert(rows, { onConflict: 'family_id,import_hash', ignoreDuplicates: true })

    if (error) throw new Error(`[SupabaseAdapter] insertTransactions: ${error.message}`)

    // Sync cache
    this.addTransactions(txns)
  }

  async deleteAllTransactions(): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('family_id', this.familyId)

    if (error) throw new Error(`[SupabaseAdapter] deleteAllTransactions: ${error.message}`)

    this.cache = []
    this.loaded = false
  }
}
