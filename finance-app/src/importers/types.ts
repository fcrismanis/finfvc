import type { ClassificationType, TransactionType } from '../types'

export interface RawTransaction {
  originalDescription: string
  rawAmount: string
  rawDate: string
  rawCompetenceDate: string
  rawPaymentDate?: string
  rawType: string
  rawStatus: string
  rawPaymentMethod: string
  rawAccount: string
  rawCategory: string
  rawInstallment?: string
  rawRecurring?: string
  rawTags?: string
  rawGroup?: string
  rowIndex: number
  sourceFile: string
}

export interface ClassificationResult {
  type: TransactionType
  classificationType: ClassificationType
  macroCategoryId: string
  categoryId: string
  includeInOperationalResult: boolean
  includeInCashflow: boolean
  includeInBudget: boolean
  isInternalTransfer: boolean
}

export interface ParsedImportItem {
  raw: RawTransaction
  normalizedDescription: string
  amount: number
  transactionDate: string
  competenceDate: string
  paymentDate?: string
  classification: ClassificationResult
  importHash: string
  isDuplicate: boolean
  selected: boolean
}

export interface ImportSummaryData {
  total: number
  incomeCount: number
  expenseCount: number
  neutralCount: number
  duplicateCount: number
  uncategorizedCount: number
  totalIncome: number
  totalExpenses: number
  importedAt: string
  batchId: string
  sourceFile: string
}
