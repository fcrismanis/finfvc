export type TransactionType = 'income' | 'expense'
export type ClassificationType =
  | 'operational_income' | 'extraordinary_income' | 'operational_expense'
  | 'debt_cost' | 'investment' | 'redemption' | 'transfer'
  | 'reimbursement' | 'adjustment' | 'neutral'
export type TransactionStatus = 'paid' | 'pending' | 'cancelled'

export interface Transaction {
  id: string
  description: string
  originalDescription: string
  amount: number
  type: TransactionType
  classificationType: ClassificationType
  transactionDate: string
  competenceDate: string
  paymentDate?: string
  status: TransactionStatus
  accountId: string
  categoryId?: string
  subCategoryId?: string
  macroCategoryId?: string
  paymentMethod: string
  isRecurring: boolean
  includeInOperationalResult: boolean
  includeInCashflow: boolean
  includeInBudget: boolean
  isInternalTransfer: boolean
  isAdjustment: boolean
  manualCategoryOverride?: boolean
  manualSubCategoryOverride?: boolean
  manualTextOverride?: boolean
  manualEditedAt?: string
  needsReview?: boolean
  origin: string
  tags?: string[]
  notes?: string
  createdAt: string
  updatedAt: string
  // raw extras
  pluggyCategory?: string
  pluggyCategoryId?: string
  pluggyInstitutionName?: string
  categorySuggestionSource?: string
  categoryConfidence?: string
}

export interface Budget {
  id: string
  referenceMonth: string
  macroCategoryId?: string
  categoryId?: string
  plannedAmount: number
}

export interface MacroCategory {
  id: string
  name: string
  classificationType: ClassificationType
  displayInBudget: boolean
  color: string
}

// Supabase DB row shape
export interface DbTransaction {
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
  category_id: string | null
  sub_category_id: string | null
  macro_category_id: string | null
  is_recurring: boolean
  include_in_operational_result: boolean
  include_in_cashflow: boolean
  include_in_budget: boolean
  is_internal_transfer: boolean
  manual_category_override: boolean | null
  manual_sub_category_override: boolean | null
  manual_text_override: boolean | null
  manual_edited_at: string | null
  notes: string | null
  raw_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface DbBudget {
  id: string
  family_id: string
  macro_category_id: string | null
  category_id: string | null
  month: string
  amount: number
}

export function dbToTransaction(row: DbTransaction): Transaction {
  const raw = (row.raw_data ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    description: row.description,
    originalDescription: row.original_description ?? row.description,
    amount: row.amount,
    type: row.transaction_type as TransactionType,
    classificationType: row.classification_type as ClassificationType,
    transactionDate: row.transaction_date,
    competenceDate: row.competence_date,
    paymentDate: row.payment_date ?? undefined,
    status: row.status as TransactionStatus,
    accountId: row.account_id ?? '',
    categoryId: row.category_id ?? undefined,
    subCategoryId: row.sub_category_id ?? undefined,
    macroCategoryId: row.macro_category_id ?? undefined,
    paymentMethod: row.payment_method,
    isRecurring: row.is_recurring,
    includeInOperationalResult: row.include_in_operational_result,
    includeInCashflow: row.include_in_cashflow,
    includeInBudget: row.include_in_budget ?? true,
    isInternalTransfer: row.is_internal_transfer,
    isAdjustment: (raw.isAdjustment as boolean) ?? false,
    manualCategoryOverride: row.manual_category_override ?? undefined,
    manualSubCategoryOverride: row.manual_sub_category_override ?? undefined,
    manualTextOverride: row.manual_text_override ?? undefined,
    manualEditedAt: row.manual_edited_at ?? undefined,
    needsReview: raw.needsReview as boolean | undefined,
    origin: (raw.origin as string) ?? 'import_xlsx',
    tags: Array.isArray(raw.tags) ? raw.tags as string[] : undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pluggyCategory: raw.pluggyCategory as string | undefined,
    pluggyCategoryId: raw.pluggyCategoryId as string | undefined,
    pluggyInstitutionName: raw.pluggyInstitutionName as string | undefined,
    categorySuggestionSource: raw.categorySuggestionSource as string | undefined,
    categoryConfidence: raw.categoryConfidence as string | undefined,
  }
}

export function dbToBudget(row: DbBudget): Budget {
  return {
    id: row.id,
    referenceMonth: row.month,
    macroCategoryId: row.macro_category_id ?? undefined,
    categoryId: row.category_id ?? undefined,
    plannedAmount: row.amount,
  }
}
