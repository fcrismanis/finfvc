import { suggestCategoryWithHistory } from './categorize.service'
import { lookupPluggyCategory, inferCategoryFromText } from './pluggyCategoryMap'
import { suggestFromRules } from './categoryRules.service'
import { findCrossSourceDuplicate } from '../utils/transactionDedupe'
import { currentFinancialDate, normalizeFinancialDate } from '../utils/date'

/**
 * Pluggy Open Finance service.
 *
 * SECURITY: Never include Pluggy client_id or client_secret in frontend code.
 * Flow:
 *   1. Frontend calls your backend → backend calls Pluggy POST /auth/token
 *   2. Backend returns short-lived connect_token to frontend
 *   3. Frontend opens PluggyConnect widget with that token
 *   4. On success, backend webhook receives item_id
 *   5. Backend fetches /items/:id/transactions and stores them
 *
 * See docs/pluggy-integration.md for full setup guide.
 */

export type PluggyConnectStatus =
  | 'idle'
  | 'loading_token'
  | 'connecting'
  | 'syncing'
  | 'success'
  | 'error'

export type PluggyItemStatus =
  | 'UPDATED'
  | 'UPDATING'
  | 'WAITING_USER_INPUT'
  | 'LOGIN_ERROR'
  | 'OUTDATED'

export interface PluggyItem {
  id: string
  connectorName: string
  connectorImageUrl?: string
  status: PluggyItemStatus
  lastUpdatedAt: string
  createdAt: string
  error?: string
}

export interface PluggyAccount {
  id: string
  itemId: string
  name: string
  type: 'BANK' | 'CREDIT'
  subtype?: string
  balance: number
  currencyCode: string
}

export interface PluggyTransaction {
  id: string
  accountId: string
  date: string
  description: string
  amount: number
  type: 'DEBIT' | 'CREDIT'
  status: 'POSTED' | 'PENDING'
  providerCode?: string
  category?: string
}

export interface PluggyConnection {
  item: PluggyItem
  accounts: PluggyAccount[]
  lastSync: string
}

export interface PluggyDeduplicationKey {
  providerTransactionId?: string
  fallback?: string  // `${date}|${amount}|${description}|${accountId}`
}

export async function getConnectToken(_userId: string): Promise<string> {
  const res = await fetch('/api/pluggy/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: _userId }),
  })
  const data = await res.json() as { ok: boolean; token?: string; error?: string }
  if (!res.ok || !data.ok || !data.token) {
    throw new Error(data.error ?? 'Token Pluggy ausente na resposta do servidor')
  }
  return data.token
}

export async function listConnections(_userId: string): Promise<PluggyConnection[]> {
  // Call your backend: GET /api/pluggy/connections
  const res = await fetch('/api/pluggy/connections')
  if (!res.ok) throw new Error('Failed to list Pluggy connections')
  return res.json() as Promise<PluggyConnection[]>
}

export interface PluggyPaymentData {
  paymentMethod?: string | null
  receiver?: { name?: string | null; documentNumber?: string | null } | null
  payer?: { name?: string | null; documentNumber?: string | null } | null
  reason?: string | null
}

export interface PluggyRawTransaction {
  id: string
  accountId: string
  accountType?: 'BANK' | 'CREDIT'
  date: string
  transactionDate?: string | null
  paymentDate?: string | null
  competenceDate?: string | null
  operationDate?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  description: string
  descriptionRaw?: string | null
  amount: number
  type: 'DEBIT' | 'CREDIT'
  status: 'POSTED' | 'PENDING'
  providerCode: string | null
  category: string | null
  categoryId: string | null
  operationType?: string | null
  paymentData?: PluggyPaymentData | null
}

export async function fetchPluggyTransactions(
  params: { accountId: string; from: string; to: string } | { itemId: string; from: string; to: string }
): Promise<PluggyRawTransaction[]> {
  const res = await fetch('/api/pluggy/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await res.json() as { ok: boolean; transactions?: PluggyRawTransaction[]; error?: string }
  if (!res.ok || !data.ok) throw new Error(data.error ?? 'Erro ao buscar transações Pluggy')
  return data.transactions ?? []
}

export function makeDeduplicationKey(tx: PluggyTransaction, accountId: string): PluggyDeduplicationKey {
  return {
    providerTransactionId: tx.providerCode,
    fallback: `${tx.date}|${Math.abs(tx.amount)}|${tx.description.slice(0, 40).toUpperCase()}|${accountId}`,
  }
}

// ── Local persistence for connections (localStorage) ──────────────────────────

import { CONNECTIONS_KEY, loadPluggyConnectionsSafe } from './pluggyStorage.service'

export interface PluggyLocalAccount {
  id: string
  itemId: string
  name: string
  type: 'BANK' | 'CREDIT'
  subtype: string | null
  balance: number
  currencyCode: string
  limit: number | null
  availableLimit: number | null
  closeDate: string | null
  dueDate: string | null
  lastSyncAt?: string
  lastSyncCount?: number
}

export interface PluggyLocalConnection {
  itemId: string
  connectorName: string
  connectorImageUrl: string | null
  status: string
  createdAt: string
  lastUpdatedAt: string | null
  savedAt: string
  accounts: PluggyLocalAccount[]
}

export function getLocalConnections(): PluggyLocalConnection[] {
  return loadPluggyConnectionsSafe()
}

export function saveLocalConnection(conn: PluggyLocalConnection): void {
  const all = getLocalConnections()
  const idx = all.findIndex(c => c.itemId === conn.itemId)
  if (idx >= 0) all[idx] = conn
  else all.push(conn)
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(all))
}

export function removeLocalConnection(itemId: string): void {
  const updated = getLocalConnections().filter(c => c.itemId !== itemId)
  // Only write if this is an explicit user removal (array may become [])
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(updated))
}

export async function registerConnection(itemId: string): Promise<PluggyLocalConnection> {
  const res = await fetch('/api/pluggy/connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId }),
  })
  const data = await res.json() as { ok: boolean; connection?: Omit<PluggyLocalConnection, 'savedAt'>; error?: string }
  if (!res.ok || !data.ok || !data.connection) {
    throw new Error(data.error ?? 'Erro ao registrar conexão Pluggy')
  }
  return { ...data.connection, savedAt: new Date().toISOString() }
}

// ── Pluggy category mapping — delegated to pluggyCategoryMap.ts ──────────────
// Re-export for external callers (PluggyPage reclassify button etc.)
export { lookupPluggyCategory, inferCategoryFromText } from './pluggyCategoryMap'

// (maps moved to pluggyCategoryMap.ts — use lookupPluggyCategory / inferCategoryFromText)

/** @deprecated use lookupPluggyCategory from pluggyCategoryMap */
export function pluggyCategoryToResult(
  categoryId: string | null | undefined,
  categoryName: string | null | undefined,
) {
  return lookupPluggyCategory(categoryId, categoryName)
}

/** @deprecated use lookupPluggyCategory from pluggyCategoryMap */
export function pluggyCategoryToMacro(pluggyCategory: string | null): string | null {
  if (!pluggyCategory) return null
  return lookupPluggyCategory(null, pluggyCategory)?.macroCategoryId ?? null
}

// ── Map Pluggy raw transactions → app Transaction format ──────────────────────

export interface MapResult {
  newTxs: import('../types').Transaction[]
  duplicateCount: number
  crossSourceDupeCount?: number
  incomeCount: number
  expenseCount: number
  autoCategorizedCount: number
  needsReviewCount: number
  uncategorizedCount: number
  bySourceCount: Record<string, number>
}

export interface ConnInfo {
  accountName: string
  institutionName: string
  institutionLogoUrl: string | null
}

function firstNonEmptyDate(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return undefined
}

export function mapPluggyToTransactions(
  pluggyTxs: PluggyRawTransaction[],
  accountId: string,
  existingTxs: import('../types').Transaction[],
  connInfo?: ConnInfo,
): MapResult {
  const existingHashes = new Set(existingTxs.map(t => t.importHash).filter(Boolean))
  const existingIds = new Set(existingTxs.map(t => t.id))
  const batchId = `pluggy_${Date.now().toString(36)}`
  const now = new Date().toISOString()
  const fallbackDate = currentFinancialDate()

  const allMapped: import('../types').Transaction[] = pluggyTxs.map(ptx => {
    const rawPrimaryDate = firstNonEmptyDate(
      ptx.transactionDate,
      ptx.date,
      ptx.operationDate,
      ptx.paymentDate,
      ptx.competenceDate,
    )
    const financialDate = normalizeFinancialDate(rawPrimaryDate, fallbackDate)
    const competenceDate = normalizeFinancialDate(ptx.competenceDate ?? rawPrimaryDate, financialDate)
    const paymentDate = ptx.paymentDate ? normalizeFinancialDate(ptx.paymentDate, '') : undefined
    const importHash = ptx.providerCode
      ? `pluggy_${ptx.providerCode}`
      : `${financialDate}|${Math.abs(ptx.amount)}|${(ptx.description ?? '').slice(0, 40).toUpperCase()}|${accountId}`

    const type: import('../types').TransactionType = ptx.type === 'CREDIT' ? 'income' : 'expense'
    const defaultClassification: import('../types').ClassificationType =
      type === 'income' ? 'operational_income' : 'operational_expense'

    const baseTx: import('../types').Transaction = {
      id: `pluggy_${ptx.id}`,
      description: ptx.description ?? '',
      originalDescription: ptx.description ?? '',
      amount: Math.abs(ptx.amount),
      type,
      classificationType: defaultClassification,
      transactionDate: financialDate,
      competenceDate,
      paymentDate,
      status: ptx.status === 'POSTED' ? 'paid' : 'pending',
      accountId,
      paymentMethod: 'account' as import('../types').PaymentMethod,
      isRecurring: false,
      includeInOperationalResult: true,
      includeInCashflow: true,
      includeInBudget: true,
      isInternalTransfer: false,
      isAdjustment: false,
      origin: 'import_api' as const,
      source: 'pluggy',
      needsReview: true,
      importHash,
      importBatchId: batchId,
      lastImportedAt: now,
      pluggyCategory:      ptx.category ?? undefined,
      pluggyCategoryId:    ptx.categoryId ?? undefined,
      pluggyOperationType: ptx.operationType ?? undefined,
      pluggyPaymentMethod: ptx.paymentData?.paymentMethod ?? undefined,
      pluggyReceiverName:  ptx.paymentData?.receiver?.name ?? undefined,
      pluggyPayerName:     ptx.paymentData?.payer?.name ?? undefined,
      pluggyAccountName:   connInfo?.accountName,
      pluggyInstitutionName: connInfo?.institutionName,
      pluggyInstitutionLogoUrl: connInfo?.institutionLogoUrl ?? undefined,
      pluggyRawDate: ptx.date ?? undefined,
      pluggyRawTransactionDate: ptx.transactionDate ?? undefined,
      pluggyRawPaymentDate: ptx.paymentDate ?? undefined,
      pluggyRawCompetenceDate: ptx.competenceDate ?? undefined,
      pluggyRawOperationDate: ptx.operationDate ?? undefined,
      pluggyRawCreatedAt: ptx.createdAt ?? undefined,
      pluggyRawUpdatedAt: ptx.updatedAt ?? undefined,
      createdAt: now,
      updatedAt: now,
    }

    if (import.meta.env.DEV) {
      console.debug('[PluggyDateTrace]', {
        providerCode: ptx.providerCode,
        rawDate: ptx.date,
        rawTransactionDate: ptx.transactionDate,
        rawPaymentDate: ptx.paymentDate,
        rawCompetenceDate: ptx.competenceDate,
        rawOperationDate: ptx.operationDate,
        rawCreatedAt: ptx.createdAt,
        mappedDate: baseTx.transactionDate,
        mappedCompetenceDate: baseTx.competenceDate,
        mappedPaymentDate: baseTx.paymentDate,
      })
    }

    // Priority 1: history-based (high confidence wins; medium also applied)
    const suggestion = suggestCategoryWithHistory(baseTx, existingTxs)
    if (suggestion && suggestion.classificationType !== 'neutral') {
      return {
        ...baseTx,
        macroCategoryId: suggestion.macroCategoryId,
        categoryId: suggestion.categoryId || undefined,
        subCategoryId: suggestion.subCategoryId,
        classificationType: suggestion.classificationType,
        categorySuggestionSource: 'history',
        needsReview: suggestion.confidence !== 'high',
      }
    }

    // Priority 2: learned rule (user corrections persisted as fin_category_rules)
    const ruleSugg = suggestFromRules(baseTx)
    if (ruleSugg) {
      return {
        ...baseTx,
        macroCategoryId:          ruleSugg.macroCategoryId,
        subCategoryId:            ruleSugg.subCategoryId,
        classificationType:       ruleSugg.classificationType ?? baseTx.classificationType,
        tags:                     ruleSugg.tags && ruleSugg.tags.length ? ruleSugg.tags : undefined,
        pluggyCategoryMapped:     true,
        categoryConfidence:       'high',
        categorySuggestionSource: 'rule',
        needsReview:              false,
      }
    }

    // Priority 3: Pluggy provider category (by ID first, then by name)
    const catResult = lookupPluggyCategory(ptx.categoryId, ptx.category)
    if (catResult) {
      return {
        ...baseTx,
        macroCategoryId:            catResult.macroCategoryId,
        subCategoryId:              catResult.subCategoryId,
        subCategoryNameSuggested:   catResult.subCategoryNameSuggested,
        classificationType:         catResult.classificationType,
        includeInOperationalResult: catResult.includeInOperationalResult ?? true,
        includeInBudget:            catResult.includeInBudget ?? true,
        includeInCashflow:          catResult.includeInCashflow ?? true,
        isInternalTransfer:         catResult.isInternalTransfer ?? false,
        pluggyCategoryMapped:       true,
        categoryConfidence:         catResult.confidence,
        categorySuggestionSource:   catResult.source === 'id' ? 'pluggy_id' : 'pluggy_name',
        needsReview:                catResult.confidence !== 'high',
      }
    }

    // Priority 3: text inference from description / counterparty names
    const inferred = inferCategoryFromText(
      ptx.description ?? '',
      ptx.paymentData?.receiver?.name ?? undefined,
      ptx.paymentData?.payer?.name ?? undefined,
    )
    if (inferred) {
      return {
        ...baseTx,
        macroCategoryId:            inferred.macroCategoryId,
        subCategoryId:              inferred.subCategoryId,
        subCategoryNameSuggested:   inferred.subCategoryNameSuggested,
        classificationType:         inferred.classificationType,
        includeInOperationalResult: inferred.includeInOperationalResult ?? true,
        includeInBudget:            inferred.includeInBudget ?? true,
        includeInCashflow:          inferred.includeInCashflow ?? true,
        categoryConfidence:         'low',
        categorySuggestionSource:   'text_inference',
        needsReview:                true,
      }
    }

    return baseTx
  })

  // Level 1: hash / id dedupe (original)
  const hashDeduped = allMapped.filter(t =>
    !existingIds.has(t.id) && !(t.importHash && existingHashes.has(t.importHash))
  )

  // Level 2 & 3: cross-source dedupe (catches Excel vs Pluggy same transaction)
  const newTxs: import('../types').Transaction[] = []
  let crossSourceDupes = 0
  for (const t of hashDeduped) {
    const match = findCrossSourceDuplicate(t, existingTxs)
    if (match) {
      crossSourceDupes++
    } else {
      newTxs.push(t)
    }
  }

  const autoCategorizedCount = newTxs.filter(t => t.macroCategoryId && !t.needsReview).length
  const needsReviewCount = newTxs.filter(t => t.needsReview).length
  const uncategorizedCount = newTxs.filter(t => !t.macroCategoryId && t.classificationType !== 'neutral').length

  const bySourceCount: Record<string, number> = {}
  for (const tx of newTxs) {
    const src = (tx.categorySuggestionSource as string | undefined) ?? 'none'
    bySourceCount[src] = (bySourceCount[src] ?? 0) + 1
  }

  return {
    newTxs,
    duplicateCount: allMapped.length - newTxs.length - crossSourceDupes,
    crossSourceDupeCount: crossSourceDupes,
    incomeCount: newTxs.filter(t => t.type === 'income').length,
    expenseCount: newTxs.filter(t => t.type === 'expense').length,
    autoCategorizedCount,
    needsReviewCount,
    uncategorizedCount,
    bySourceCount,
  }
}

// ── Update per-account sync metadata in localStorage ─────────────────────────

export function updateConnectionSyncMeta(itemId: string, accountId: string, importedCount: number): void {
  const all = getLocalConnections()
  const conn = all.find(c => c.itemId === itemId)
  if (!conn) return
  const acc = conn.accounts.find(a => a.id === accountId)
  if (!acc) return
  acc.lastSyncAt = new Date().toISOString()
  acc.lastSyncCount = (acc.lastSyncCount ?? 0) + importedCount
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(all))
}

// ── Compute period date range from a preset ───────────────────────────────────

export function getPeriodDates(
  period: 'last_7d' | 'current_month' | 'last_30d' | 'last_90d' | 'custom',
  _customFrom?: string,
  _customTo?: string,
): { from: string; to: string } {
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  if (period === 'current_month') {
    const y = today.getFullYear()
    const m = today.getMonth() + 1
    const lastDay = new Date(y, m, 0).getDate()
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay)}` }
  }
  const dayMap: Partial<Record<typeof period, number>> = { last_7d: 7, last_30d: 30, last_90d: 90 }
  const days = dayMap[period] ?? 7
  const from = new Date(today)
  from.setDate(from.getDate() - days)
  return {
    from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    to: todayStr,
  }
  // 'custom' handled by caller
}
