import type { Transaction, PaymentMethod } from '../types'
import type { ParsedImportItem } from './types'
import { normalizePaymentMethod, parseInstallment } from './normalizer'
import { suggestFromRules, canAutoCategorize, incrementRuleUseCount, loadRules } from '../services/categoryRules.service'

export function toTransaction(item: ParsedImportItem, batchId: string): Transaction {
  const now = new Date().toISOString()
  const { raw, classification } = item
  const installment = parseInstallment(raw.rawInstallment)
  const paymentMethod: PaymentMethod = normalizePaymentMethod(raw.rawPaymentMethod)

  const accountId = raw.rawAccount
    ? `acc_${raw.rawAccount.toLowerCase().replace(/\s+/g, '_').slice(0, 20)}`
    : 'acc_unknown'

  const tx: Transaction = {
    id: `imp_${batchId}_${raw.rowIndex}`,
    description: item.normalizedDescription,
    originalDescription: raw.originalDescription,
    amount: item.amount,
    type: classification.type,
    classificationType: classification.classificationType,
    transactionDate: item.transactionDate,
    competenceDate: item.competenceDate,
    paymentDate: item.paymentDate,
    status: 'paid',
    accountId,
    categoryId: classification.categoryId,
    macroCategoryId: classification.macroCategoryId,
    paymentMethod,
    installmentCurrent: installment.current,
    installmentTotal: installment.total,
    isRecurring: raw.rawRecurring?.toLowerCase().includes('sim') ?? false,
    includeInOperationalResult: classification.includeInOperationalResult,
    includeInCashflow: classification.includeInCashflow,
    includeInBudget: classification.includeInBudget,
    isInternalTransfer: classification.isInternalTransfer,
    isAdjustment: false,
    sourceFile: raw.sourceFile,
    importBatchId: batchId,
    importHash: item.importHash,
    origin: 'import_xlsx',
    tags: raw.rawTags ? raw.rawTags.split(',').map(t => t.trim()).filter(Boolean) : [],
    group: raw.rawGroup,
    createdAt: now,
    updatedAt: now,
  }

  // Apply learned rules (Priority 1) if no category set and no manual override
  if (!tx.macroCategoryId && canAutoCategorize(tx)) {
    const rules = loadRules()
    const match = suggestFromRules(tx, rules)
    if (match) {
      tx.macroCategoryId = match.macroCategoryId
      tx.subCategoryId = match.subCategoryId
      if (match.classificationType) tx.classificationType = match.classificationType
      if (match.tags?.length) tx.tags = Array.from(new Set([...(tx.tags ?? []), ...match.tags]))
      tx.categorySuggestionSource = 'rule'
      tx.categoryConfidence = match.confidence ?? 'high'
      incrementRuleUseCount(match.ruleId)
    }
  }

  return tx
}
