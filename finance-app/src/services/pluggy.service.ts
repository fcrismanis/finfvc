import { suggestCategoryWithHistory } from './categorize.service'

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

export interface PluggyRawTransaction {
  id: string
  accountId: string
  accountType: 'BANK' | 'CREDIT'
  date: string
  description: string
  amount: number
  type: 'DEBIT' | 'CREDIT'
  status: 'POSTED' | 'PENDING'
  providerCode: string | null
  category: string | null
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

const CONNECTIONS_KEY = 'fin_pluggy_connections'

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
  try {
    const raw = localStorage.getItem(CONNECTIONS_KEY)
    return raw ? (JSON.parse(raw) as PluggyLocalConnection[]) : []
  } catch {
    return []
  }
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

// ── Map Pluggy raw transactions → app Transaction format ──────────────────────

export interface MapResult {
  newTxs: import('../types').Transaction[]
  duplicateCount: number
  incomeCount: number
  expenseCount: number
  autoCategorizedCount: number
  needsReviewCount: number
}

export function mapPluggyToTransactions(
  pluggyTxs: PluggyRawTransaction[],
  accountId: string,
  existingTxs: import('../types').Transaction[],
): MapResult {
  const existingHashes = new Set(existingTxs.map(t => t.importHash).filter(Boolean))
  const existingIds = new Set(existingTxs.map(t => t.id))
  const batchId = `pluggy_${Date.now().toString(36)}`
  const now = new Date().toISOString()

  const allMapped: import('../types').Transaction[] = pluggyTxs.map(ptx => {
    const importHash = ptx.providerCode
      ? `pluggy_${ptx.providerCode}`
      : `${(ptx.date ?? '').slice(0, 10)}|${Math.abs(ptx.amount)}|${(ptx.description ?? '').slice(0, 40).toUpperCase()}|${accountId}`

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
      transactionDate: (ptx.date ?? now).slice(0, 10),
      competenceDate: (ptx.date ?? now).slice(0, 10),
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
      createdAt: now,
      updatedAt: now,
    }

    // Auto-categorize
    const suggestion = suggestCategoryWithHistory(baseTx, existingTxs)
    if (suggestion && suggestion.classificationType !== 'neutral') {
      return {
        ...baseTx,
        macroCategoryId: suggestion.macroCategoryId,
        categoryId: suggestion.categoryId || undefined,
        subCategoryId: suggestion.subCategoryId,
        classificationType: suggestion.classificationType,
        needsReview: suggestion.confidence !== 'high',
      }
    }
    return baseTx
  })

  const newTxs = allMapped.filter(t =>
    !existingIds.has(t.id) && !(t.importHash && existingHashes.has(t.importHash))
  )

  const autoCategorizedCount = newTxs.filter(t => t.macroCategoryId && !t.needsReview).length
  const needsReviewCount = newTxs.filter(t => t.needsReview).length

  return {
    newTxs,
    duplicateCount: allMapped.length - newTxs.length,
    incomeCount: newTxs.filter(t => t.type === 'income').length,
    expenseCount: newTxs.filter(t => t.type === 'expense').length,
    autoCategorizedCount,
    needsReviewCount,
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
  period: 'current_month' | 'last_30d' | 'last_90d' | 'custom',
  _customFrom?: string,
  _customTo?: string,
): { from: string; to: string } {
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  if (period === 'current_month') {
    const y = today.getFullYear()
    const m = today.getMonth() + 1
    const lastDay = new Date(y, m, 0).getDate()
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay)}` }
  }
  const days = period === 'last_30d' ? 30 : 90
  const from = new Date(today)
  from.setDate(from.getDate() - days)
  return {
    from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    to: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
  }
  // 'custom' handled by caller
}
