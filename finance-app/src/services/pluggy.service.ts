import { suggestCategoryWithHistory } from './categorize.service'
import { lookupPluggyCategory, inferCategoryFromText } from './pluggyCategoryMap'
import { suggestFromRules } from './categoryRules.service'
import { findCrossSourceDuplicate } from '../utils/transactionDedupe'
import { currentFinancialDate, normalizeFinancialDate } from '../utils/date'
import { ITAU_ANCHOR, ITAU_ANCHOR_ID } from '../config/bankTruth'

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

// Presente em transações de cartão de crédito quando a compra foi parcelada.
// Alguns emissores (ex: Rico) reportam a 1ª entrada com o valor CHEIO da
// compra e só nos meses seguintes trazem o valor por parcela — sem esse
// campo não há como distinguir isso de uma duplicata real.
export interface PluggyCreditCardMetadata {
  installmentNumber?: number | null
  totalInstallments?: number | null
  totalAmount?: number | null
  payeeMCC?: number | null
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
  creditCardMetadata?: PluggyCreditCardMetadata | null
}

export async function fetchPluggyTransactions(
  params: { accountId: string; from: string; to: string } | { itemId: string; from: string; to: string }
): Promise<PluggyRawTransaction[]> {
  const url = '/api/pluggy/transactions'
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch (e) {
    // Falha de rede antes de obter resposta (backend fora, CORS, DNS).
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    throw new Error(`Falha de conexão com ${url}: ${msg}`)
  }
  const text = await res.text()
  // Backend fora / gateway sem upstream.
  if (res.status === 404 || res.status === 502 || res.status === 503 || !text.trim()) {
    throw new Error(`Backend indisponível (status ${res.status}) em ${url}: ${text.slice(0, 300) || '(resposta vazia)'}`)
  }
  let data: { ok: boolean; transactions?: PluggyRawTransaction[]; error?: string }
  try { data = JSON.parse(text) } catch { throw new Error(`Resposta inválida do servidor (status ${res.status}): ${text.slice(0, 300)}`) }
  if (!res.ok || !data.ok) throw new Error(data.error ?? `Erro ao buscar transações Pluggy (status ${res.status})`)
  return data.transactions ?? []
}

export interface PluggyInvestment {
  id: string
  itemId: string
  name: string
  code: string | null
  type: string | null
  subtype: string | null
  currencyCode: string
  balance: number
  quantity: number | null
  lastMonthRate: number | null
  lastTwelveMonthsRate: number | null
  annualRate: number | null
  date: string | null
  dueDate: string | null
  issuer: string | null
  institutionName: string | null
  status: string | null
  amount: number | null
  amountProfit: number | null
  isinCode: string | null
  fixedAnnualRate: number | null
}

export async function fetchPluggyInvestments(itemId: string): Promise<PluggyInvestment[]> {
  const res = await fetch('/api/pluggy/investments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId }),
  })
  const data = await res.json() as { ok: boolean; investments?: PluggyInvestment[]; error?: string }
  if (!res.ok || !data.ok) throw new Error(data.error ?? 'Erro ao buscar investimentos Pluggy')
  return data.investments ?? []
}

export function makeDeduplicationKey(tx: PluggyTransaction, accountId: string): PluggyDeduplicationKey {
  return {
    providerTransactionId: tx.providerCode,
    fallback: `${tx.date}|${Math.abs(tx.amount)}|${tx.description.slice(0, 40).toUpperCase()}|${accountId}`,
  }
}

// ── Local persistence for connections (localStorage) ──────────────────────────

import { CONNECTIONS_KEY, loadPluggyConnectionsSafe, backupPluggyConnectionsSafe } from './pluggyStorage.service'

export interface PluggyLocalAccount {
  id: string
  itemId: string
  name: string
  displayName?: string
  type: 'BANK' | 'CREDIT'
  subtype: string | null
  balance: number | null
  availableBalance: number | null
  currencyCode: string
  limit: number | null
  availableLimit: number | null
  closeDate: string | null
  dueDate: string | null
  lastUpdatedAt: string | null
  lastSyncAt?: string
  lastSyncCount?: number
  selectedForDailySync?: boolean
  lastDailySyncDate?: string    // 'YYYY-MM-DD' — last calendar date auto-synced
  dailySyncError?: string | null
}

export interface PluggyLocalConnection {
  itemId: string
  connectorName: string
  displayName?: string
  connectorImageUrl: string | null
  status: string
  createdAt: string
  lastUpdatedAt: string | null
  savedAt: string
  accounts: PluggyLocalAccount[]
}

// Ensures every account has selectedForDailySync set.
// undefined → true (new or old accounts without the flag)
// false/true → preserved (explicit user choice)
function applyAccountDefaults(conns: PluggyLocalConnection[]): { conns: PluggyLocalConnection[]; changed: boolean } {
  let changed = false
  for (const conn of conns) {
    for (const acc of conn.accounts) {
      if (acc.selectedForDailySync === undefined) {
        acc.selectedForDailySync = true
        changed = true
      }
    }
  }
  return { conns, changed }
}

export function getLocalConnections(): PluggyLocalConnection[] {
  const raw = loadPluggyConnectionsSafe()
  if (raw.length === 0) return raw
  const { conns, changed } = applyAccountDefaults(raw)
  if (changed) {
    backupPluggyConnectionsSafe(conns)
    localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(conns))
    backupConnectionsToServer(conns)
  }
  return conns
}

/**
 * Returns the Itaú extrato anchor as a synthetic connection — the master saldo
 * for the real Itaú (ag 1145 / conta 023475-1) while it isn't connected via
 * Open Finance. Display-only: it never hits Pluggy (see ITAU_ANCHOR_ID guards).
 * Disabled by setting ITAU_ANCHOR.enabled = false in config/bankTruth.ts.
 */
export function itauAnchorConnection(): PluggyLocalConnection | null {
  if (!ITAU_ANCHOR.enabled) return null
  const account: PluggyLocalAccount = {
    id: ITAU_ANCHOR_ID,
    itemId: ITAU_ANCHOR_ID,
    name: `Conta Corrente Itaú · ${ITAU_ANCHOR.accountNumber}`,
    displayName: `Conta Corrente Itaú · ${ITAU_ANCHOR.accountNumber}`,
    type: 'BANK',
    subtype: 'CHECKING_ACCOUNT',
    balance: ITAU_ANCHOR.balance,
    availableBalance: ITAU_ANCHOR.balance,
    currencyCode: 'BRL',
    limit: null,
    availableLimit: null,
    closeDate: null,
    dueDate: null,
    lastUpdatedAt: ITAU_ANCHOR.asOf,
    selectedForDailySync: false,
  }
  return {
    itemId: ITAU_ANCHOR_ID,
    connectorName: 'Itaú (extrato · master)',
    displayName: 'Itaú (extrato · master)',
    connectorImageUrl: null,
    status: 'MANUAL',
    createdAt: ITAU_ANCHOR.asOf,
    lastUpdatedAt: ITAU_ANCHOR.asOf,
    savedAt: ITAU_ANCHOR.asOf,
    accounts: [account],
  }
}

/**
 * Appends the Itaú extrato anchor to a connections list for display/reconciliation.
 * No-op when the anchor is disabled or the real Itaú is already connected.
 */
export function withItauAnchor(conns: PluggyLocalConnection[]): PluggyLocalConnection[] {
  const anchor = itauAnchorConnection()
  if (!anchor) return conns
  // Suppress the anchor when a real Itaú *checking* account is already connected
  // (e.g. "ITAU - Uniclass"), matched by the account number or by an Itaú
  // checking account that isn't a savings/poupança. Poupança alone never
  // suppresses it — the anchor is the conta-corrente master.
  const itauNumber = ITAU_ANCHOR.accountNumber.replace(/^0+/, '') // '23475-1'
  const alreadyConnected = conns.some(c =>
    c.accounts.some(a => {
      if (a.type !== 'BANK') return false
      const hay = `${c.connectorName} ${c.displayName ?? ''} ${a.name} ${a.displayName ?? ''}`.toLowerCase()
      if (hay.includes(itauNumber) || hay.includes(ITAU_ANCHOR.accountNumber)) return true
      const isItau = hay.includes('ita')
      const isSavings = (a.subtype ?? '').toUpperCase().includes('SAVINGS') || /poupan/.test(hay)
      return isItau && !isSavings
    }),
  )
  if (alreadyConnected) return conns
  return [...conns, anchor]
}

export function saveLocalConnection(conn: PluggyLocalConnection): void {
  // Apply defaults to incoming connection before merging
  const { conns: [normalized] } = applyAccountDefaults([conn])
  const all = getLocalConnections()
  const idx = all.findIndex(c => c.itemId === normalized.itemId)
  if (idx >= 0) all[idx] = normalized
  else all.push(normalized)
  backupPluggyConnectionsSafe(all)
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(all))
  backupConnectionsToServer(all)
}

export function removeLocalConnection(itemId: string): void {
  const updated = getLocalConnections().filter(c => c.itemId !== itemId)
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(updated))
  if (updated.length > 0) backupConnectionsToServer(updated)
}

function backupConnectionsToServer(connections: PluggyLocalConnection[]): void {
  if (connections.length === 0) return
  fetch('/api/pluggy/backup-connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connections }),
  }).catch(() => {})
}

export async function restoreConnectionsFromServer(): Promise<PluggyLocalConnection[]> {
  try {
    const res = await fetch('/api/pluggy/backup-connections')
    if (!res.ok) return []
    const data = await res.json() as { ok: boolean; connections?: PluggyLocalConnection[] }
    if (!data.ok || !Array.isArray(data.connections) || data.connections.length === 0) return []
    const { conns } = applyAccountDefaults(data.connections)
    localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(conns))
    backupPluggyConnectionsSafe(conns)
    return conns
  } catch { return [] }
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
  const conn: PluggyLocalConnection = { ...data.connection, savedAt: new Date().toISOString() }
  const { conns: [normalized] } = applyAccountDefaults([conn])
  return normalized
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
  rawReturnedCount: number
  missingFinancialDateCount: number
  dateConfidenceCounts: { high: number; medium: number; low: number }
}

export interface ConnInfo {
  accountName: string
  institutionName: string
  institutionLogoUrl: string | null
}

// pickPluggyFinancialDate below replaces firstNonEmptyDate

export interface PluggyDatePickResult {
  date: string
  sourceField: 'transactionDate' | 'date' | 'operationDate' | 'paymentDate' | 'competenceDate' | 'unknown'
  rawValue: string | null
  confidence: 'high' | 'medium' | 'low'
}

// transactionDate = high confidence (the actual financial transaction date)
// date / operationDate = medium (posting date, usually correct but may differ for credit cards)
// paymentDate / competenceDate = low (billing/accounting dates, not the purchase date)
// unknown = low (fell back to today's date)
const DATE_CONFIDENCE: Record<PluggyDatePickResult['sourceField'], PluggyDatePickResult['confidence']> = {
  transactionDate: 'high',
  date:            'medium',
  operationDate:   'medium',
  paymentDate:     'low',
  competenceDate:  'low',
  unknown:         'low',
}

export function pickPluggyFinancialDate(
  rawTx: Pick<PluggyRawTransaction, 'transactionDate' | 'date' | 'operationDate' | 'paymentDate' | 'competenceDate'>,
  fallbackDate: string,
): PluggyDatePickResult {
  const candidates: Array<[string | null | undefined, PluggyDatePickResult['sourceField']]> = [
    [rawTx.transactionDate, 'transactionDate'],
    [rawTx.date,            'date'],
    [rawTx.operationDate,   'operationDate'],
    [rawTx.paymentDate,     'paymentDate'],
    [rawTx.competenceDate,  'competenceDate'],
  ]
  for (const [value, field] of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      const normalized = normalizeFinancialDate(value, '')
      if (normalized) return { date: normalized, sourceField: field, rawValue: value, confidence: DATE_CONFIDENCE[field] }
    }
  }
  return { date: fallbackDate, sourceField: 'unknown', rawValue: null, confidence: 'low' }
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
  const dateConfidenceCounts = { high: 0, medium: 0, low: 0 }
  let missingFinancialDateCount = 0

  const allMapped: import('../types').Transaction[] = pluggyTxs.map(ptx => {
    const picked = pickPluggyFinancialDate(ptx, fallbackDate)
    if (picked.sourceField === 'unknown') missingFinancialDateCount++
    dateConfidenceCounts[picked.confidence]++
    const financialDate = picked.date
    // Competência = data real do lançamento (= data da compra), igual à planilha Artha
    // (Data == Data Competência em 99,5%; cartão sempre igual). NÃO usar a competenceDate
    // do Pluggy: p/ cartão ela vem como o mês da FATURA, jogando a compra no mês errado
    // (o ledger filtra por competenceDate). paymentDate guarda quando a fatura é paga.
    const competenceDate = financialDate
    const paymentDate = ptx.paymentDate ? normalizeFinancialDate(ptx.paymentDate, '') : undefined
    const importHash = ptx.providerCode
      ? `pluggy_${ptx.providerCode}`
      : `${financialDate}|${Math.abs(ptx.amount)}|${(ptx.description ?? '').slice(0, 40).toUpperCase()}|${accountId}`

    const type: import('../types').TransactionType = ptx.type === 'CREDIT' ? 'income' : 'expense'

    const desc = (ptx.description ?? '').toUpperCase()
    const isCardPayment = type === 'expense' && (
      /PAG(AMENTO)?\s*(DE\s*)?(FATURA|CARTAO|CART[AÃ]O|CREDITO|CR[EÉ]DITO)/i.test(desc) ||
      /PGTO\s*(FATURA|CART[AÃ]O|CRED)/i.test(desc) ||
      /PAGTO\s*(FATURA|CART[AÃ]O)/i.test(desc) ||
      (ptx.operationType === 'CREDIT_CARD_PAYMENT') ||
      (ptx.category?.toUpperCase().includes('CARTAO') && ptx.category?.toUpperCase().includes('PAG'))
    )

    const defaultClassification: import('../types').ClassificationType =
      isCardPayment ? 'transfer' : type === 'income' ? 'operational_income' : 'operational_expense'

    const baseTx: import('../types').Transaction = {
      id: ptx.id,
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
      includeInOperationalResult: !isCardPayment,
      includeInCashflow: true,
      includeInBudget: !isCardPayment,
      isInternalTransfer: false,
      isAdjustment: false,
      origin: 'import_api' as const,
      source: 'pluggy',
      needsReview: true,
      installmentCurrent: ptx.creditCardMetadata?.installmentNumber ?? undefined,
      installmentTotal: ptx.creditCardMetadata?.totalInstallments ?? undefined,
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
      providerRawDate: picked.rawValue ?? undefined,
      providerDateField: picked.sourceField,
      providerDateConfidence: picked.confidence,
      createdAt: now,
      updatedAt: now,
    }

    if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_PLUGGY_DATES) {
      console.debug('[PluggyDateTrace]', {
        providerCode: ptx.providerCode,
        sourceField: picked.sourceField,
        rawValue: picked.rawValue,
        rawDate: ptx.date,
        rawTransactionDate: ptx.transactionDate,
        rawPaymentDate: ptx.paymentDate,
        rawCompetenceDate: ptx.competenceDate,
        rawOperationDate: ptx.operationDate,
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
    let catResult = lookupPluggyCategory(ptx.categoryId, ptx.category)
    // Direction guard: never apply an income classification to an outflow (or an
    // expense classification to an inflow). Pluggy sometimes tags bill/card payments
    // (expenses) with an income category id (e.g. "03000000" → operational_income),
    // which would book a boleto payment as receita. Reject the mismatch so it falls
    // through to text inference (boleto/fatura patterns → neutral).
    if (catResult) {
      const cls = catResult.classificationType
      const incomeCls = cls === 'operational_income' || cls === 'extraordinary_income'
      const expenseCls = cls === 'operational_expense' || cls === 'debt_cost'
      if ((type === 'expense' && incomeCls) || (type === 'income' && expenseCls)) {
        catResult = null
      }
    }
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
    rawReturnedCount: pluggyTxs.length,
    missingFinancialDateCount,
    dateConfidenceCounts,
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
  backupPluggyConnectionsSafe(all)
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(all))
  backupConnectionsToServer(all)
}

export function updateConnectionDisplayName(itemId: string, displayName: string): void {
  const all = getLocalConnections()
  const conn = all.find(c => c.itemId === itemId)
  if (!conn) return
  conn.displayName = displayName.trim() || undefined
  backupPluggyConnectionsSafe(all)
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(all))
  backupConnectionsToServer(all)
}

export function updateAccountDisplayName(itemId: string, accountId: string, displayName: string): void {
  const all = getLocalConnections()
  const conn = all.find(c => c.itemId === itemId)
  if (!conn) return
  const acc = conn.accounts.find(a => a.id === accountId)
  if (!acc) return
  acc.displayName = displayName.trim() || undefined
  backupPluggyConnectionsSafe(all)
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(all))
  backupConnectionsToServer(all)
}

export function toggleAccountDailySync(
  itemId: string,
  accountId: string,
  enabled: boolean,
  lastDailySyncDate?: string,
  error?: string | null,
): void {
  const all = getLocalConnections()
  const conn = all.find(c => c.itemId === itemId)
  if (!conn) return
  const acc = conn.accounts.find(a => a.id === accountId)
  if (!acc) return
  acc.selectedForDailySync = enabled
  if (lastDailySyncDate !== undefined) acc.lastDailySyncDate = lastDailySyncDate
  if (error !== undefined) acc.dailySyncError = error ?? null
  backupPluggyConnectionsSafe(all)
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(all))
  backupConnectionsToServer(all)
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
