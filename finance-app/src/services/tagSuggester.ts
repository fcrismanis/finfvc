import type { Transaction } from '../types'
import { derivePattern } from './categoryRules.service'

/**
 * Smart tag suggestions — non-destructive hints derived from description,
 * category, payment method, counterparty and recurrence history.
 *
 * Suggestions never replace user tags; callers append only.
 */

export const TAG_VOCABULARY = [
  'recorrente', 'reembolsavel', 'familia', 'trabalho', 'crianca', 'saude',
  'educacao', 'cartao', 'transferencia', 'revisar', 'assinatura',
] as const

export type SuggestedTag = (typeof TAG_VOCABULARY)[number]

export interface TagContext {
  recurrentPatterns: Set<string>
}

/** Pre-compute which merchant patterns repeat across ≥2 distinct months. */
export function buildTagContext(transactions: Transaction[]): TagContext {
  const monthsByPattern = new Map<string, Set<string>>()
  for (const tx of transactions) {
    const pattern = derivePattern(tx.originalDescription || tx.description || '')
    if (pattern.length < 4) continue
    const month = tx.competenceDate.slice(0, 7)
    const set = monthsByPattern.get(pattern) ?? new Set<string>()
    set.add(month)
    monthsByPattern.set(pattern, set)
  }
  const recurrentPatterns = new Set<string>()
  for (const [pattern, months] of monthsByPattern) {
    if (months.size >= 2) recurrentPatterns.add(pattern)
  }
  return { recurrentPatterns }
}

const KID_RE   = /escola|crian|infantil|fralda|brinquedo|pediatr|bebe|materno|colegio/i
const WORK_RE  = /nota fiscal|\bnf-?e\b|coworking|escrit[oó]rio|cnpj|empresa|honor[aá]rio/i
const REIMB_RE = /reembol|ressarc|estorno parcial/i
const CARD_RE  = /fatura|cart[aã]o de cr[eé]dito|credit card/i

/** Suggested tags for a transaction (excludes tags already present). */
export function suggestTags(tx: Transaction, ctx?: TagContext): SuggestedTag[] {
  const out = new Set<SuggestedTag>()
  const text = `${tx.description} ${tx.originalDescription ?? ''} ${tx.pluggyReceiverName ?? ''} ${tx.pluggyPayerName ?? ''}`
  const lower = text.toLowerCase()

  // By macro category
  switch (tx.macroCategoryId) {
    case 'mac_saude':       out.add('saude'); break
    case 'mac_educacao':    out.add('educacao'); break
    case 'mac_assinaturas': out.add('assinatura'); break
  }

  // Movement / transfer
  if (tx.classificationType === 'neutral' || tx.classificationType === 'transfer' || tx.isInternalTransfer) {
    out.add('transferencia')
  }

  // Card
  if (tx.paymentMethod === 'card' || tx.creditCardId || /credit/i.test(tx.pluggyPaymentMethod ?? '') || CARD_RE.test(lower)) {
    out.add('cartao')
  }

  // Reimbursable / reimbursement
  if (tx.classificationType === 'reimbursement' || REIMB_RE.test(lower)) out.add('reembolsavel')

  // Kids / work
  if (KID_RE.test(lower)) out.add('crianca')
  if (WORK_RE.test(lower)) out.add('trabalho')

  // Subscriptions also hint recurrence
  if (tx.macroCategoryId === 'mac_assinaturas') out.add('recorrente')

  // Recurrence by history
  if (ctx) {
    const pattern = derivePattern(tx.originalDescription || tx.description || '')
    if (pattern.length >= 4 && ctx.recurrentPatterns.has(pattern)) out.add('recorrente')
  } else if (tx.isRecurring) {
    out.add('recorrente')
  }

  // Needs attention
  if (!tx.macroCategoryId || tx.needsReview) out.add('revisar')

  // Drop tags already applied (never overwrite manual tags)
  const existing = new Set((tx.tags ?? []).map(t => t.toLowerCase()))
  return [...out].filter(t => !existing.has(t))
}
