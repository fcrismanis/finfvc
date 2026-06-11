export type TransactionType = 'income' | 'expense'

export type ClassificationType =
  | 'operational_income'
  | 'extraordinary_income'
  | 'operational_expense'
  | 'debt_cost'
  | 'investment'
  | 'redemption'
  | 'transfer'
  | 'reimbursement'
  | 'adjustment'
  | 'neutral'

export type TransactionStatus = 'paid' | 'pending' | 'cancelled'
export type PaymentMethod = 'card' | 'account' | 'pix' | 'cash' | 'boleto' | 'debit'
export type ViewMode = 'operational' | 'cashflow' | 'accounting'

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
  creditCardId?: string
  categoryId?: string
  macroCategoryId?: string
  paymentMethod: PaymentMethod
  installmentCurrent?: number
  installmentTotal?: number
  isRecurring: boolean
  includeInOperationalResult: boolean
  includeInCashflow: boolean
  includeInBudget: boolean
  isInternalTransfer: boolean
  isAdjustment: boolean
  adjustedFromId?: string
  adjustmentReason?: string
  sourceFile?: string
  importBatchId?: string
  importHash?: string
  origin: 'import_xlsx' | 'import_api' | 'manual_entry' | 'manual_adjustment'
  group?: string
  tags?: string[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface MacroCategory {
  id: string
  name: string
  classificationType: ClassificationType
  displayInResult: boolean
  displayInCashflow: boolean
  displayInBudget: boolean
  color: string
  icon: string
  sortOrder: number
}

export interface Category {
  id: string
  name: string
  macroCategoryId: string
  classificationType: ClassificationType
  defaultIncludeInOperationalResult: boolean
  defaultIncludeInCashflow: boolean
  defaultIncludeInBudget: boolean
  isInternalTransferDefault: boolean
  color?: string
  icon?: string
  sortOrder: number
  active: boolean
}

export interface Budget {
  id: string
  referenceMonth: string
  categoryId?: string
  macroCategoryId?: string
  plannedAmount: number
}

export interface Account {
  id: string
  name: string
  displayName: string
  type: 'checking' | 'savings' | 'investment' | 'digital_wallet'
  owner: string
  isFamilyAccount: boolean
  active: boolean
}

export interface MonthSummaryData {
  operationalIncome: number
  totalExpenses: number
  operationalResult: number
  savingsRate: number
  pendingAmount: number
  plannedIncome: number
  plannedExpenses: number
  hasRedemption: boolean
  redemptionAmount: number
  realOperationalResult: number
  isAtypicalMonth: boolean
  atypicalReason?: string
}

export interface MacroCategoryTotal {
  macroCategoryId: string
  name: string
  total: number
  percentage: number
  color: string
  icon: string
  avgLast3m: number
  isAboveAverage: boolean
}

export interface BudgetComparison {
  categoryId: string
  macroCategoryId: string
  name: string
  color: string
  planned: number
  realized: number
  deviationRs: number
  deviationPct: number
  status: 'ok' | 'warning' | 'critical' | 'no_budget'
}

export type AlertLevel = 'critical' | 'warning' | 'info' | 'distortion'

export interface AlertItem {
  id: string
  level: AlertLevel
  message: string
  categoryId?: string
  amount?: number
  deviationPct?: number
}

export interface MonthlyTrend {
  month: string
  label: string
  operationalIncome: number
  totalExpenses: number
  operationalResult: number
  isAtypical: boolean
  atypicalReason?: string
}

export interface TopTransaction {
  id: string
  description: string
  amount: number
  macroCategoryName: string
  macroCategoryColor: string
}

export interface MonthClosing {
  month: string
  isClosed: boolean
  closedAt?: string
  reopenedAt?: string
  checklist: Record<string, boolean>
  notes: string
}

export type SortField = 'competenceDate' | 'amount' | 'category' | 'status'
export type SortDir = 'asc' | 'desc'
