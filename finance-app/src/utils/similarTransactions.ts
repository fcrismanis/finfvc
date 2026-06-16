// similarTransactions.ts
// Find uncategorized transactions similar to a manually categorized one.
// Never touches transactions with manual overrides or existing categories.

import type { Transaction } from '../types'
import { normalizeText } from '../services/categoryRules.service'
import { canAutoCategorize } from '../services/categoryRules.service'

// Generic terms that alone are too weak for high/medium confidence matching.
const GENERIC_TERMS = new Set([
  'PIX', 'TED', 'DOC', 'BOLETO', 'PAGAMENTO', 'COMPRA', 'TRANSFERENCIA',
  'DEBITO', 'CREDITO', 'SAQUE', 'ESTORNO', 'DEPOSITO', 'RECEBIMENTO',
  'PAGTO', 'PGTO', 'PAG', 'CRED', 'DEB',
])

export interface SimilarityResult {
  highConfidence: Transaction[]
  mediumConfidence: Transaction[]
}

/** Extract a stable merchant token from description after removing noise. */
function merchantToken(text: string): string {
  return normalizeText(text)
    .replace(/\d{2}\/\d{2}\/\d{4}/g, '')
    .replace(/\d{2}\/\d{2}/g, '')
    .replace(/\d{4,}/g, '')
    .replace(/\bparcela\b|\bparc\b|\bpgto\b|\bpagto\b|\bpag\b|\bref\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True if the token is too generic to use for matching. */
function isGeneric(token: string): boolean {
  if (token.length < 4) return true
  const words = token.split(/\s+/)
  if (words.every(w => GENERIC_TERMS.has(w))) return true
  return false
}

/**
 * Find uncategorized or low-confidence transactions similar to sourceTx.
 * Never returns transactions that have manual overrides or already have
 * a confirmed category.
 */
export function findSimilarUncategorized(
  sourceTx: Transaction,
  allTransactions: Transaction[],
): SimilarityResult {
  // Source must have a category
  if (!sourceTx.macroCategoryId) return { highConfidence: [], mediumConfidence: [] }

  // Skip if source is neutral
  if (sourceTx.classificationType === 'neutral' || sourceTx.classificationType === 'transfer') {
    return { highConfidence: [], mediumConfidence: [] }
  }

  const high: Transaction[] = []
  const medium: Transaction[] = []

  const srcReceiver = sourceTx.pluggyReceiverName ? normalizeText(sourceTx.pluggyReceiverName) : ''
  const srcPayer = sourceTx.pluggyPayerName ? normalizeText(sourceTx.pluggyPayerName) : ''
  const srcToken = merchantToken(sourceTx.description)
  const srcOrigToken = sourceTx.originalDescription ? merchantToken(sourceTx.originalDescription) : ''

  for (const tx of allTransactions) {
    if (tx.id === sourceTx.id) continue

    // Skip if already categorized (not eligible)
    if (tx.macroCategoryId && !tx.needsReview) continue

    // Skip if already a confirmed manual edit
    if (!canAutoCategorize(tx)) continue

    // Skip neutral/transfer
    if (tx.classificationType === 'neutral' || tx.classificationType === 'transfer') continue

    // Must be same transaction type (don't categorize income like expense)
    if (tx.type !== sourceTx.type) continue

    // ── High confidence checks ──────────────────────────────────────────────

    const txReceiver = tx.pluggyReceiverName ? normalizeText(tx.pluggyReceiverName) : ''
    const txPayer = tx.pluggyPayerName ? normalizeText(tx.pluggyPayerName) : ''

    // Same receiver name (non-generic)
    if (srcReceiver && txReceiver && srcReceiver === txReceiver && !isGeneric(srcReceiver)) {
      high.push(tx); continue
    }

    // Same payer name (non-generic)
    if (srcPayer && txPayer && srcPayer === txPayer && !isGeneric(srcPayer)) {
      high.push(tx); continue
    }

    // Same provider code = same merchant terminal
    if (sourceTx.pluggyCategoryId && tx.pluggyCategoryId &&
        sourceTx.pluggyCategoryId === tx.pluggyCategoryId) {
      const txToken = merchantToken(tx.description)
      if (txToken && srcToken && !isGeneric(txToken) && !isGeneric(srcToken)) {
        const overlap = tokenOverlap(srcToken, txToken)
        if (overlap >= 0.7) { high.push(tx); continue }
      }
    }

    // Strong description token match
    const txToken = merchantToken(tx.description)
    const txOrigToken = tx.originalDescription ? merchantToken(tx.originalDescription) : ''

    if (srcToken.length >= 5 && txToken.length >= 5 && !isGeneric(srcToken) && !isGeneric(txToken)) {
      const overlap = tokenOverlap(srcToken, txToken)
      if (overlap >= 0.8) { high.push(tx); continue }

      // Try original descriptions
      const origCheck = (srcOrigToken || srcToken)
      const txOrigCheck = (txOrigToken || txToken)
      if (!isGeneric(origCheck) && !isGeneric(txOrigCheck)) {
        if (tokenOverlap(origCheck, txOrigCheck) >= 0.8) { high.push(tx); continue }
      }
    }

    // ── Medium confidence checks ────────────────────────────────────────────

    if (srcToken.length >= 5 && txToken.length >= 5 && !isGeneric(srcToken) && !isGeneric(txToken)) {
      const overlap = tokenOverlap(srcToken, txToken)
      if (overlap >= 0.5) { medium.push(tx); continue }
    }

    // Same pluggyCategory text (non-generic)
    if (sourceTx.pluggyCategory && tx.pluggyCategory &&
        !isGeneric(normalizeText(sourceTx.pluggyCategory)) &&
        normalizeText(sourceTx.pluggyCategory) === normalizeText(tx.pluggyCategory)) {
      medium.push(tx); continue
    }
  }

  // Dedupe (a tx could appear in both via different checks, prefer high)
  const highIds = new Set(high.map(t => t.id))
  return {
    highConfidence: high,
    mediumConfidence: medium.filter(t => !highIds.has(t.id)),
  }
}

/** Fraction of words in a that appear in b (word-level Jaccard-ish). */
function tokenOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length >= 3))
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length >= 3))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let common = 0
  for (const w of wordsA) { if (wordsB.has(w)) common++ }
  return common / Math.max(wordsA.size, wordsB.size)
}
