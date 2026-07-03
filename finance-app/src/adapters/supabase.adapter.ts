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
  sub_category_id: string | null
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
  manual_category_override: boolean | null
  manual_sub_category_override: boolean | null
  manual_text_override: boolean | null
  manual_edited_at: string | null
  created_at: string
  updated_at: string
}

type TransactionRawData = {
  // Pluggy raw date fields
  pluggyRawDate?: string
  pluggyRawTransactionDate?: string
  pluggyRawPaymentDate?: string
  pluggyRawCompetenceDate?: string
  pluggyRawOperationDate?: string
  pluggyRawCreatedAt?: string
  pluggyRawUpdatedAt?: string
  // Provider date resolution metadata
  providerRawDate?: string
  providerDateField?: string
  providerDateConfidence?: string
  // Origin and review state
  origin?: string
  needsReview?: boolean
  isAdjustment?: boolean
  // Pluggy categorization metadata
  pluggyCategory?: string
  pluggyCategoryId?: string
  pluggyCategoryMapped?: boolean
  pluggyOperationType?: string
  pluggyPaymentMethod?: string
  pluggyReceiverName?: string
  pluggyPayerName?: string
  pluggyAccountName?: string
  pluggyInstitutionName?: string
  pluggyInstitutionLogoUrl?: string
  // Suggestion metadata
  categorySuggestionSource?: string
  categoryConfidence?: string
  // Tags and group
  tags?: string[]
  group?: string
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}
function strArr(v: unknown): string[] | undefined {
  return Array.isArray(v) ? (v as unknown[]).filter(x => typeof x === 'string') as string[] : undefined
}

function fromRawData(raw: Record<string, unknown> | null): TransactionRawData {
  if (!raw) return {}
  return {
    pluggyRawDate:            str(raw.pluggyRawDate),
    pluggyRawTransactionDate: str(raw.pluggyRawTransactionDate),
    pluggyRawPaymentDate:     str(raw.pluggyRawPaymentDate),
    pluggyRawCompetenceDate:  str(raw.pluggyRawCompetenceDate),
    pluggyRawOperationDate:   str(raw.pluggyRawOperationDate),
    pluggyRawCreatedAt:       str(raw.pluggyRawCreatedAt),
    pluggyRawUpdatedAt:       str(raw.pluggyRawUpdatedAt),
    providerRawDate:          str(raw.providerRawDate),
    providerDateField:        str(raw.providerDateField),
    providerDateConfidence:   str(raw.providerDateConfidence),
    origin:                   str(raw.origin),
    needsReview:              bool(raw.needsReview),
    isAdjustment:             bool(raw.isAdjustment),
    pluggyCategory:           str(raw.pluggyCategory),
    pluggyCategoryId:         str(raw.pluggyCategoryId),
    pluggyCategoryMapped:     bool(raw.pluggyCategoryMapped),
    pluggyOperationType:      str(raw.pluggyOperationType),
    pluggyPaymentMethod:      str(raw.pluggyPaymentMethod),
    pluggyReceiverName:       str(raw.pluggyReceiverName),
    pluggyPayerName:          str(raw.pluggyPayerName),
    pluggyAccountName:        str(raw.pluggyAccountName),
    pluggyInstitutionName:    str(raw.pluggyInstitutionName),
    pluggyInstitutionLogoUrl: str(raw.pluggyInstitutionLogoUrl),
    categorySuggestionSource: str(raw.categorySuggestionSource),
    categoryConfidence:       str(raw.categoryConfidence),
    tags:                     strArr(raw.tags),
    group:                    str(raw.group),
  }
}

function toRawData(tx: Transaction): Record<string, unknown> | null {
  const raw: TransactionRawData = {}
  // Pluggy raw date fields
  if (tx.pluggyRawDate)            raw.pluggyRawDate            = tx.pluggyRawDate
  if (tx.pluggyRawTransactionDate) raw.pluggyRawTransactionDate = tx.pluggyRawTransactionDate
  if (tx.pluggyRawPaymentDate)     raw.pluggyRawPaymentDate     = tx.pluggyRawPaymentDate
  if (tx.pluggyRawCompetenceDate)  raw.pluggyRawCompetenceDate  = tx.pluggyRawCompetenceDate
  if (tx.pluggyRawOperationDate)   raw.pluggyRawOperationDate   = tx.pluggyRawOperationDate
  if (tx.pluggyRawCreatedAt)       raw.pluggyRawCreatedAt       = tx.pluggyRawCreatedAt
  if (tx.pluggyRawUpdatedAt)       raw.pluggyRawUpdatedAt       = tx.pluggyRawUpdatedAt
  // Provider date resolution metadata
  if (tx.providerRawDate)          raw.providerRawDate          = tx.providerRawDate
  if (tx.providerDateField)        raw.providerDateField        = tx.providerDateField
  if (tx.providerDateConfidence)   raw.providerDateConfidence   = tx.providerDateConfidence
  // Origin and review state
  if (tx.origin)                   raw.origin                   = tx.origin
  if (tx.needsReview != null)      raw.needsReview              = tx.needsReview
  if (tx.isAdjustment)             raw.isAdjustment             = tx.isAdjustment
  // Pluggy categorization metadata
  if (tx.pluggyCategory)           raw.pluggyCategory           = tx.pluggyCategory
  if (tx.pluggyCategoryId)         raw.pluggyCategoryId         = tx.pluggyCategoryId
  if (tx.pluggyCategoryMapped)     raw.pluggyCategoryMapped     = tx.pluggyCategoryMapped
  if (tx.pluggyOperationType)      raw.pluggyOperationType      = tx.pluggyOperationType
  if (tx.pluggyPaymentMethod)      raw.pluggyPaymentMethod      = tx.pluggyPaymentMethod
  if (tx.pluggyReceiverName)       raw.pluggyReceiverName       = tx.pluggyReceiverName
  if (tx.pluggyPayerName)          raw.pluggyPayerName          = tx.pluggyPayerName
  if (tx.pluggyAccountName)        raw.pluggyAccountName        = tx.pluggyAccountName
  if (tx.pluggyInstitutionName)    raw.pluggyInstitutionName    = tx.pluggyInstitutionName
  if (tx.pluggyInstitutionLogoUrl) raw.pluggyInstitutionLogoUrl = tx.pluggyInstitutionLogoUrl
  // Suggestion metadata
  if (tx.categorySuggestionSource) raw.categorySuggestionSource = tx.categorySuggestionSource
  if (tx.categoryConfidence)       raw.categoryConfidence       = tx.categoryConfidence
  // Tags and group
  if (tx.tags?.length)             raw.tags                     = tx.tags
  if (tx.group)                    raw.group                    = tx.group
  return Object.keys(raw).length > 0 ? raw : null
}

function toTransaction(row: DbTransaction): Transaction {
  const raw = fromRawData(row.raw_data)
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
    subCategoryId: row.sub_category_id ?? undefined,
    macroCategoryId: row.macro_category_id ?? undefined,
    paymentMethod: row.payment_method as Transaction['paymentMethod'],
    installmentCurrent: row.installment_current ?? undefined,
    installmentTotal: row.installment_total ?? undefined,
    isRecurring: row.is_recurring,
    includeInOperationalResult: row.include_in_operational_result,
    includeInCashflow: row.include_in_cashflow,
    includeInBudget: row.include_in_budget ?? true,
    isInternalTransfer: row.is_internal_transfer,
    isAdjustment: raw.isAdjustment ?? false,
    importBatchId: row.import_batch_id ?? undefined,
    importHash: row.import_hash ?? undefined,
    sourceFile: row.source_file ?? undefined,
    notes: row.notes ?? undefined,
    manualCategoryOverride: row.manual_category_override ?? undefined,
    manualSubCategoryOverride: row.manual_sub_category_override ?? undefined,
    manualTextOverride: row.manual_text_override ?? undefined,
    manualEditedAt: row.manual_edited_at ?? undefined,
    origin: (raw.origin as Transaction['origin']) ?? 'import_xlsx',
    needsReview: raw.needsReview,
    pluggyCategory: raw.pluggyCategory,
    pluggyCategoryId: raw.pluggyCategoryId,
    pluggyCategoryMapped: raw.pluggyCategoryMapped,
    pluggyOperationType: raw.pluggyOperationType,
    pluggyPaymentMethod: raw.pluggyPaymentMethod,
    pluggyReceiverName: raw.pluggyReceiverName,
    pluggyPayerName: raw.pluggyPayerName,
    pluggyAccountName: raw.pluggyAccountName,
    pluggyInstitutionName: raw.pluggyInstitutionName,
    pluggyInstitutionLogoUrl: raw.pluggyInstitutionLogoUrl,
    categorySuggestionSource: raw.categorySuggestionSource as Transaction['categorySuggestionSource'],
    categoryConfidence: raw.categoryConfidence as Transaction['categoryConfidence'],
    providerRawDate: raw.providerRawDate,
    providerDateField: raw.providerDateField as Transaction['providerDateField'],
    providerDateConfidence: raw.providerDateConfidence as Transaction['providerDateConfidence'],
    pluggyRawDate: raw.pluggyRawDate,
    pluggyRawTransactionDate: raw.pluggyRawTransactionDate,
    pluggyRawPaymentDate: raw.pluggyRawPaymentDate,
    pluggyRawCompetenceDate: raw.pluggyRawCompetenceDate,
    pluggyRawOperationDate: raw.pluggyRawOperationDate,
    pluggyRawCreatedAt: raw.pluggyRawCreatedAt,
    pluggyRawUpdatedAt: raw.pluggyRawUpdatedAt,
    tags: raw.tags,
    group: raw.group,
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
    sub_category_id: t.subCategoryId ?? null,
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
    raw_data: toRawData(t),
    notes: t.notes ?? null,
    manual_category_override: t.manualCategoryOverride ?? null,
    manual_sub_category_override: t.manualSubCategoryOverride ?? null,
    manual_text_override: t.manualTextOverride ?? null,
    manual_edited_at: t.manualEditedAt ?? null,
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
    // PostgREST caps a single response at 1000 rows by default — paginar até
    // esgotar, senão famílias com >1000 lançamentos perdem dados silenciosamente.
    const PAGE_SIZE = 1000
    const rows: DbTransaction[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('family_id', this.familyId)
        .order('competence_date', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw new Error(`[SupabaseAdapter] fetchTransactions: ${error.message}`)

      rows.push(...(data as DbTransaction[]))
      if (!data || data.length < PAGE_SIZE) break
    }

    this.cache = rows.map(toTransaction)
    this.loaded = true
    return this.cache
  }

  async insertTransactions(txns: Transaction[]): Promise<void> {
    if (txns.length === 0) return

    const rows = txns.map(t => toDbRow(t, this.familyId))

    const { error } = await supabase
      .from('transactions')
      .upsert(rows, { onConflict: 'family_id,import_hash', ignoreDuplicates: true })

    if (error) {
      // FK violation on sub_category_id: retry stripping subcategory refs
      if (error.message.includes('sub_category_id_fkey') || error.message.includes('category_id_fkey')) {
        const safeRows = rows.map(r => ({ ...r, sub_category_id: null, category_id: null }))
        const { error: e2 } = await supabase
          .from('transactions')
          .upsert(safeRows, { onConflict: 'family_id,import_hash', ignoreDuplicates: true })
        if (e2) throw new Error(`[SupabaseAdapter] insertTransactions: ${e2.message}`)
      } else {
        throw new Error(`[SupabaseAdapter] insertTransactions: ${error.message}`)
      }
    }

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
