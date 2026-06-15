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

export async function syncTransactions(_itemId: string): Promise<{ queued: boolean }> {
  // Call your backend: POST /api/pluggy/sync/:itemId
  const res = await fetch(`/api/pluggy/sync/${_itemId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to trigger Pluggy sync')
  return res.json() as Promise<{ queued: boolean }>
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
