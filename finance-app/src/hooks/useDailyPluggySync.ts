import { useEffect, useRef } from 'react'
import { useData } from '../context/DataContext'
import {
  getLocalConnections,
  fetchPluggyTransactions,
  mapPluggyToTransactions,
  updateConnectionSyncMeta,
  toggleAccountDailySync,
  getPeriodDates,
} from '../services/pluggy.service'
import type { Transaction } from '../types'

export const DAILY_SYNC_STATUS_KEY = 'fin_pluggy_daily_sync_status'

export interface DailySyncStatus {
  running: boolean
  startedAt: string | null
  finishedAt: string | null
  accountsSynced: number
  newTxsTotal: number
  errors: Array<{ accountId: string; accountName: string; error: string }>
}

export function loadDailySyncStatus(): DailySyncStatus | null {
  try {
    const raw = localStorage.getItem(DAILY_SYNC_STATUS_KEY)
    return raw ? (JSON.parse(raw) as DailySyncStatus) : null
  } catch { return null }
}

function saveDailySyncStatus(status: DailySyncStatus): void {
  localStorage.setItem(DAILY_SYNC_STATUS_KEY, JSON.stringify(status))
}

function todayDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Runs once per app open (when loading finishes).
// Silently syncs current month for accounts with selectedForDailySync=true
// that haven't been synced today yet. Writes status to localStorage so
// PluggyPage can read it without prop-drilling.
export function useDailyPluggySync(loading: boolean) {
  const { appendTransactions, transactions } = useData()
  const ranRef = useRef(false)

  useEffect(() => {
    if (loading || ranRef.current) return
    ranRef.current = true

    async function run() {
      try {
        const res = await fetch('/api/pluggy/status')
        if (!res.ok) return
        const d = await res.json() as { configured: boolean }
        if (!d.configured) return
      } catch { return }

      const today = todayDateStr()
      const connections = getLocalConnections()
      const accountsDue = connections.flatMap(c =>
        c.accounts
          .filter(a => a.selectedForDailySync && a.lastDailySyncDate !== today)
          .map(a => ({ conn: c, acc: a }))
      )

      if (accountsDue.length === 0) return

      const status: DailySyncStatus = {
        running: true,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        accountsSynced: 0,
        newTxsTotal: 0,
        errors: [],
      }
      saveDailySyncStatus(status)

      const { from, to } = getPeriodDates('current_month')

      for (const { conn, acc } of accountsDue) {
        try {
          const raw = await fetchPluggyTransactions({ accountId: acc.id, from, to })
          const result = mapPluggyToTransactions(raw, acc.id, transactions, {
            accountName: acc.name,
            institutionName: conn.connectorName,
            institutionLogoUrl: conn.connectorImageUrl,
          })
          if (result.newTxs.length > 0) {
            await appendTransactions(result.newTxs as Transaction[])
          }
          updateConnectionSyncMeta(conn.itemId, acc.id, result.newTxs.length)
          toggleAccountDailySync(conn.itemId, acc.id, true, today, null)
          status.accountsSynced++
          status.newTxsTotal += result.newTxs.length
          saveDailySyncStatus(status)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro na sync automática'
          toggleAccountDailySync(conn.itemId, acc.id, true, acc.lastDailySyncDate, msg)
          status.errors.push({ accountId: acc.id, accountName: acc.name, error: msg })
          saveDailySyncStatus(status)
        }
      }

      status.running = false
      status.finishedAt = new Date().toISOString()
      saveDailySyncStatus(status)
    }

    run()
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps
}
