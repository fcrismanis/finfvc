// pluggyStorage.service.ts
// Safe read/write/recover layer for Pluggy connection data in localStorage.
// Never overwrites non-empty data with empty. Never exposes secrets.

import type { PluggyLocalConnection } from './pluggy.service'

export const CONNECTIONS_KEY = 'fin_pluggy_connections'
export const CONNECTIONS_BACKUP_KEY = 'fin_pluggy_connections_backup'

// Known legacy key names (historical key variants, for recovery scanning)
const LEGACY_KEYS = [
  'pluggy_connections',
  'fin_connections',
  'fin_pluggy_conns',
  'pluggyConnections',
  'fin_pluggy_data',
]

const SENSITIVE_RE = /token|secret|apikey|clientsecret|password|credential/i

function maskSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return obj
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj
  if (Array.isArray(obj)) return obj.map(v => maskSensitive(v, depth + 1))
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = SENSITIVE_RE.test(k) ? '[MASKED]' : maskSensitive(v, depth + 1)
    }
    return out
  }
  return obj
}

function hasPluggyShape(parsed: unknown): boolean {
  if (!Array.isArray(parsed) || parsed.length === 0) return false
  const first = parsed[0] as Record<string, unknown>
  return (
    typeof first === 'object' &&
    first !== null &&
    (typeof first.itemId === 'string' || typeof first.connectorName === 'string')
  )
}

function countField(arr: unknown[], field: string): number {
  return arr.filter(x => x && typeof x === 'object' && field in (x as object)).length
}

// ── Read/Write ──────────────────────────────────────────────────────────────

export function loadPluggyConnectionsSafe(): PluggyLocalConnection[] {
  try {
    const raw = localStorage.getItem(CONNECTIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    if (import.meta.env.DEV) console.debug(`[pluggy-storage] loaded ${parsed.length} connections`)
    return parsed as PluggyLocalConnection[]
  } catch {
    return []
  }
}

export function savePluggyConnectionsSafe(connections: PluggyLocalConnection[]): void {
  const existing = loadPluggyConnectionsSafe()
  if (connections.length === 0 && existing.length > 0) {
    console.warn('[pluggy-storage] skipped empty overwrite because existing data exists')
    return
  }
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(connections))
}

// ── Backup / Restore ────────────────────────────────────────────────────────

export function backupPluggyConnectionsSafe(connections: PluggyLocalConnection[]): void {
  if (connections.length === 0) return
  localStorage.setItem(CONNECTIONS_BACKUP_KEY, JSON.stringify(connections))
}

export function loadPluggyConnectionsBackup(): PluggyLocalConnection[] {
  try {
    const raw = localStorage.getItem(CONNECTIONS_BACKUP_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PluggyLocalConnection[]) : []
  } catch { return [] }
}

export function hasPluggyConnectionsBackup(): boolean {
  return loadPluggyConnectionsBackup().length > 0
}

export function restorePluggyConnectionsFromBackup(): { ok: boolean; count: number; message: string } {
  const backup = loadPluggyConnectionsBackup()
  if (backup.length === 0) {
    return { ok: false, count: 0, message: 'Nenhum backup encontrado.' }
  }
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(backup))
  return { ok: true, count: backup.length, message: `${backup.length} conexão(ões) restaurada(s) do backup.` }
}

// ── Diagnosis ───────────────────────────────────────────────────────────────

export interface StorageKeyReport {
  key: string
  byteSize: number
  isValidJson: boolean
  isArray: boolean
  recordCount: number
  hasItemId: boolean
  hasConnectorName: boolean
  hasAccounts: boolean
  hasTransactions: boolean
  looksLikeConnections: boolean
  source: 'current' | 'legacy' | 'scan'
}

export interface DiagnosticResult {
  keys: StorageKeyReport[]
  probableConnections: number
  probableAccounts: number
  probableTransactions: number
  hasRecoverableData: boolean
  message: string
}

function inspectKey(key: string, source: StorageKeyReport['source']): StorageKeyReport | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const byteSize = new Blob([raw]).size
    let isValidJson = false
    let isArray = false
    let recordCount = 0
    let hasItemId = false
    let hasConnectorName = false
    let hasAccounts = false
    let hasTransactions = false
    let looksLikeConnections = false

    try {
      const parsed = JSON.parse(raw)
      isValidJson = true
      if (Array.isArray(parsed)) {
        isArray = true
        recordCount = parsed.length
        hasItemId = countField(parsed, 'itemId') > 0
        hasConnectorName = countField(parsed, 'connectorName') > 0
        hasAccounts = countField(parsed, 'accounts') > 0
        hasTransactions = countField(parsed, 'description') > 0 || countField(parsed, 'amount') > 0
        looksLikeConnections = hasItemId && (hasConnectorName || hasAccounts)
      }
    } catch { /* invalid json */ }

    return {
      key, byteSize, isValidJson, isArray, recordCount,
      hasItemId, hasConnectorName, hasAccounts, hasTransactions,
      looksLikeConnections, source,
    }
  } catch {
    return null
  }
}

function scanAllKeys(): string[] {
  const found: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    const lower = key.toLowerCase()
    if (
      lower.includes('pluggy') ||
      lower.includes('fin_') ||
      lower.includes('connection') ||
      lower.includes('finance') ||
      lower.includes('account') ||
      lower.includes('provider') ||
      lower.includes('import')
    ) {
      found.push(key)
    }
  }
  return found
}

export function diagnosePluggyStorage(): DiagnosticResult {
  const reports: StorageKeyReport[] = []
  const seen = new Set<string>()

  // Always check current key
  const cur = inspectKey(CONNECTIONS_KEY, 'current')
  if (cur) { reports.push(cur); seen.add(CONNECTIONS_KEY) }

  // Check known legacy keys
  for (const k of LEGACY_KEYS) {
    if (seen.has(k)) continue
    const r = inspectKey(k, 'legacy')
    if (r) { reports.push(r); seen.add(k) }
  }

  // Scan all localStorage for Pluggy-like keys
  for (const k of scanAllKeys()) {
    if (seen.has(k)) continue
    const r = inspectKey(k, 'scan')
    if (r) { reports.push(r); seen.add(k) }
  }

  const connectionReports = reports.filter(r => r.looksLikeConnections)
  const probableConnections = Math.max(...connectionReports.map(r => r.recordCount), 0)
  const probableAccounts = connectionReports.reduce((acc, r) => {
    try {
      const raw = localStorage.getItem(r.key)
      if (!raw) return acc
      const parsed = JSON.parse(raw) as Array<{ accounts?: unknown[] }>
      return acc + parsed.reduce((s, c) => s + (Array.isArray(c.accounts) ? c.accounts.length : 0), 0)
    } catch { return acc }
  }, 0)

  const txReport = reports.find(r => r.key === 'finance_transactions')
  const probableTransactions = txReport?.recordCount ?? 0
  const hasRecoverableData = connectionReports.some(r => r.key !== CONNECTIONS_KEY && r.recordCount > 0) ||
    (connectionReports.some(r => r.key === CONNECTIONS_KEY && r.recordCount > 0))

  let message = ''
  if (probableConnections > 0) {
    message = `Encontrado(s) ${probableConnections} conexão(ões) com ${probableAccounts} conta(s).`
  } else {
    message = 'Nenhum dado Pluggy recuperável foi encontrado neste navegador/origem.'
  }

  return { keys: reports, probableConnections, probableAccounts, probableTransactions, hasRecoverableData, message }
}

// ── Recovery ────────────────────────────────────────────────────────────────

export interface RecoveryResult {
  ok: boolean
  source: string | null
  count: number
  backupKey: string | null
  message: string
}

export function recoverPluggyStorage(): RecoveryResult {
  // Check current key first
  const current = loadPluggyConnectionsSafe()
  if (current.length > 0) {
    return {
      ok: true,
      source: CONNECTIONS_KEY,
      count: current.length,
      backupKey: null,
      message: `Conexões já presentes em ${CONNECTIONS_KEY} (${current.length} conexão(ões)). Nada a recuperar.`,
    }
  }

  // Search for recoverable data in other keys
  const candidates: Array<{ key: string; data: PluggyLocalConnection[] }> = []

  for (const k of [...LEGACY_KEYS, ...scanAllKeys()]) {
    if (k === CONNECTIONS_KEY) continue
    try {
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (hasPluggyShape(parsed)) {
        candidates.push({ key: k, data: parsed as PluggyLocalConnection[] })
      }
    } catch { /* skip */ }
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      source: null,
      count: 0,
      backupKey: null,
      message: 'Nenhum dado Pluggy recuperável foi encontrado neste navegador/origem.',
    }
  }

  // Use the candidate with most records
  const best = candidates.reduce((a, b) => a.data.length >= b.data.length ? a : b)

  // Backup current (empty) state anyway for traceability
  const backupKey = `fin_pluggy_recovery_backup_${Date.now()}`
  localStorage.setItem(backupKey, JSON.stringify(best.data))

  // Write to current key
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(best.data))
  if (import.meta.env.DEV) console.debug(`[pluggy-storage] migrated ${best.key} → ${CONNECTIONS_KEY} (${best.data.length} conn)`)

  return {
    ok: true,
    source: best.key,
    count: best.data.length,
    backupKey,
    message: `Recuperado(s) ${best.data.length} conexão(ões) de "${best.key}". Backup salvo em "${backupKey}".`,
  }
}

// ── Safe diagnostic export (strips secrets) ─────────────────────────────────

export function getSafeStorageSummary(): Record<string, unknown> {
  const d = diagnosePluggyStorage()
  return maskSensitive(d) as Record<string, unknown>
}
