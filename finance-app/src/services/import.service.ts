import { parseFile, validateParsedRows } from '../importers/xlsxParser'
import { normalizeAmount, normalizeDate, normalizeDescription } from '../importers/normalizer'
import { classifyByDescription } from '../importers/classifier'
import { computeImportHash, markDuplicates } from '../importers/deduplicator'
import { toTransaction } from '../importers/transformer'
import type { ParsedImportItem, ImportSummaryData } from '../importers/types'
import type { Transaction } from '../types'

function generateBatchId(): string {
  return `batch_${Date.now().toString(36)}`
}

export async function parseAndPreview(file: File, existingTransactions: Transaction[]): Promise<ParsedImportItem[]> {
  const rawRows = await parseFile(file)
  const { valid } = validateParsedRows(rawRows)

  const items: ParsedImportItem[] = valid.map(raw => {
    const amount = normalizeAmount(raw.rawAmount)
    const transactionDate = normalizeDate(raw.rawDate)
    const competenceDate = normalizeDate(raw.rawCompetenceDate)
    const paymentDate = raw.rawPaymentDate ? normalizeDate(raw.rawPaymentDate) : undefined
    const normalizedDescription = normalizeDescription(raw.originalDescription)
    const classification = classifyByDescription(normalizedDescription, raw.rawType, raw.rawCategory)
    const importHash = computeImportHash(raw.originalDescription, amount, transactionDate, raw.rawAccount)

    return {
      raw,
      normalizedDescription,
      amount,
      transactionDate,
      competenceDate,
      paymentDate,
      classification,
      importHash,
      isDuplicate: false,
      selected: true,
    }
  })

  return markDuplicates(items, existingTransactions)
}

// Pure transformer — does NOT persist. Caller must save via dataProvider.appendTransactions().
export function confirmImport(items: ParsedImportItem[]): { transactions: Transaction[]; summary: ImportSummaryData } {
  const selected = items.filter(i => i.selected && !i.isDuplicate)
  const batchId = generateBatchId()

  const transactions = selected.map(item => toTransaction(item, batchId))

  const incomeItems = transactions.filter(t => t.type === 'income')
  const expenseItems = transactions.filter(t => t.type === 'expense')
  const neutralItems = transactions.filter(t => t.classificationType === 'transfer' || t.classificationType === 'neutral')
  const uncategorized = transactions.filter(t => !t.categoryId)
  const duplicateCount = items.filter(i => i.isDuplicate).length

  const summary: ImportSummaryData = {
    total: transactions.length,
    incomeCount: incomeItems.length,
    expenseCount: expenseItems.length,
    neutralCount: neutralItems.length,
    duplicateCount,
    uncategorizedCount: uncategorized.length,
    totalIncome: incomeItems.reduce((s, t) => s + t.amount, 0),
    totalExpenses: expenseItems.reduce((s, t) => s + t.amount, 0),
    importedAt: new Date().toISOString(),
    batchId,
    sourceFile: selected[0]?.raw.sourceFile ?? '',
  }

  return { transactions, summary }
}

