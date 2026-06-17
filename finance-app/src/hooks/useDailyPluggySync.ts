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

function todayDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Runs once per app open (when loading finishes).
// Silently syncs current month for accounts with selectedForDailySync=true
// that haven't been synced today yet.
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
      const { from, to } = getPeriodDates('current_month')

      for (const conn of connections) {
        for (const acc of conn.accounts) {
          if (!acc.selectedForDailySync) continue
          if (acc.lastDailySyncDate === today) continue

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
          } catch (err) {
            toggleAccountDailySync(
              conn.itemId, acc.id, true,
              acc.lastDailySyncDate,
              err instanceof Error ? err.message : 'Erro na sync automática',
            )
          }
        }
      }
    }

    run()
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps
}
