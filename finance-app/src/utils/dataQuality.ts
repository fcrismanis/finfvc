import type { Transaction } from '../types'
import { getCompetenceMonth } from './date'

// ── Manual / auto helpers ─────────────────────────────────────────────────────

export function isManualTx(tx: Transaction): boolean {
  return !!(tx.manualCategoryOverride || tx.manualSubCategoryOverride || tx.manualTextOverride)
}

export function isPluggyTx(tx: Transaction): boolean {
  return tx.source === 'pluggy' || tx.origin === 'import_api'
}

export function isCsvTx(tx: Transaction): boolean {
  return tx.origin === 'import_xlsx'
}

/** Has a category that was applied automatically (Pluggy map / rule / inference / history). */
export function isAutoCategorized(tx: Transaction): boolean {
  if (!tx.macroCategoryId) return false
  if (tx.manualCategoryOverride || tx.manualSubCategoryOverride) return false
  return true
}

/** Needs a human look: no category, flagged for review, or pending. */
export function needsReviewTx(tx: Transaction): boolean {
  return !tx.macroCategoryId || !!tx.needsReview
}

// ── High-value threshold (mirror of reviewItems) ──────────────────────────────

export function highValueThreshold(transactions: Transaction[]): number {
  const amounts = transactions.filter(t => t.type === 'expense').map(t => t.amount)
  const avg = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0
  return Math.max(avg * 4, 2000)
}

// ── Possible duplicates ───────────────────────────────────────────────────────
// importHash dedup already blocks exact reimports; this catches the same expense
// arriving from two sources (e.g. CSV + Pluggy) with different hashes.

function dupeKey(tx: Transaction): string {
  const descNorm = (tx.originalDescription || tx.description || '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  return `${tx.type}|${tx.amount.toFixed(2)}|${tx.transactionDate}|${descNorm}`
}

export function findDuplicateCandidateIds(transactions: Transaction[]): Set<string> {
  const groups = new Map<string, string[]>()
  for (const tx of transactions) {
    if (tx.status === 'cancelled') continue
    const key = dupeKey(tx)
    const arr = groups.get(key) ?? []
    arr.push(tx.id)
    groups.set(key, arr)
  }
  const ids = new Set<string>()
  for (const arr of groups.values()) {
    if (arr.length > 1) arr.forEach(id => ids.add(id))
  }
  return ids
}

// ── Quick-filter predicates (shared by ledger + data-quality click-through) ───

export type QuickFilterKey =
  | 'no_category' | 'pluggy' | 'csv' | 'manual' | 'auto' | 'neutral'
  | 'pending' | 'high_value' | 'with_tags' | 'no_tags' | 'duplicates' | 'edited'
  | 'needs_review'

export interface QuickFilterCtx {
  threshold: number
  duplicateIds: Set<string>
}

export const QUICK_FILTER_LABELS: Record<QuickFilterKey, string> = {
  no_category: 'A classificar',
  pluggy:      'Pluggy',
  csv:         'CSV/XLSX',
  manual:      'Manual',
  auto:        'Automáticos',
  neutral:     'Neutros',
  pending:     'Pendentes',
  high_value:  'Alto valor',
  with_tags:   'Com tags',
  no_tags:     'Sem tags',
  duplicates:   'Possíveis duplicados',
  edited:       'Descrição editada',
  needs_review: 'A conferir',
}

export function matchesQuickFilter(tx: Transaction, key: QuickFilterKey, ctx: QuickFilterCtx): boolean {
  switch (key) {
    case 'no_category': return !tx.macroCategoryId
    case 'pluggy':      return isPluggyTx(tx)
    case 'csv':         return isCsvTx(tx)
    case 'manual':      return isManualTx(tx)
    case 'auto':        return isAutoCategorized(tx)
    case 'neutral':     return tx.classificationType === 'neutral'
    case 'pending':     return tx.status === 'pending'
    case 'high_value':  return tx.type === 'expense' && tx.amount > ctx.threshold
    case 'with_tags':   return !!tx.tags && tx.tags.length > 0
    case 'no_tags':     return !tx.tags || tx.tags.length === 0
    case 'duplicates':  return ctx.duplicateIds.has(tx.id)
    case 'edited':        return !!tx.manualTextOverride
    case 'needs_review':  return tx.needsReview === true
  }
}

// ── Data-quality summary for a month ──────────────────────────────────────────

export interface DataQuality {
  total: number
  pluggy: number
  csv: number
  noCategory: number
  autoCategory: number
  manualCategory: number
  neutral: number
  pending: number
  duplicates: number
  withTags: number
  editedDesc: number
  pctCategorized: number
  pctToReview: number
  pctNeutral: number
  pctManual: number
}

export function computeDataQuality(transactions: Transaction[], month: string): DataQuality {
  const monthTxs = transactions.filter(
    t => getCompetenceMonth(t.competenceDate) === month && t.status !== 'cancelled'
  )
  const duplicateIds = findDuplicateCandidateIds(monthTxs)
  const total = monthTxs.length

  const count = (pred: (t: Transaction) => boolean) => monthTxs.filter(pred).length
  const noCategory     = count(t => !t.macroCategoryId)
  const manualCategory = count(t => !!(t.manualCategoryOverride || t.manualSubCategoryOverride))
  const autoCategory   = count(isAutoCategorized)
  const neutral        = count(t => t.classificationType === 'neutral')
  const toReview        = count(needsReviewTx)

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  return {
    total,
    pluggy:         count(isPluggyTx),
    csv:            count(isCsvTx),
    noCategory,
    autoCategory,
    manualCategory,
    neutral,
    pending:        count(t => t.status === 'pending'),
    duplicates:     duplicateIds.size,
    withTags:       count(t => !!t.tags && t.tags.length > 0),
    editedDesc:     count(t => !!t.manualTextOverride),
    pctCategorized: pct(total - noCategory),
    pctToReview:    pct(toReview),
    pctNeutral:     pct(neutral),
    pctManual:      pct(manualCategory),
  }
}
