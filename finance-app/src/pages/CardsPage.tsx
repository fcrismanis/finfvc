import { useState, useEffect, useRef } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { useData } from '../context/DataContext'
import {
  getLocalConnections,
  fetchPluggyTransactions,
  mapPluggyToTransactions,
  updateConnectionSyncMeta,
  updateAccountDisplayName,
  getPeriodDates,
  type ConnInfo,
} from '../services/pluggy.service'
import { updateAccountDiagnostics } from '../services/pluggyStorage.service'
import { currentFinancialDate } from '../utils/date'
import { SyncModal, type SyncSession, type PeriodPreset } from '../components/pluggy/PluggySyncModal'
import type { PluggyLocalConnection, PluggyLocalAccount } from '../services/pluggy.service'
import type { Transaction } from '../types'

interface Props {
  onNavigate: (route: string) => void
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CardsPage({ onNavigate }: Props) {
  const { transactions, appendTransactions } = useData()
  const [connections, setConnections] = useState<PluggyLocalConnection[]>([])
  const [sync, setSync] = useState<SyncSession | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setConnections(getLocalConnections())
  }, [])

  function startEdit(card: PluggyLocalAccount & { itemId: string }) {
    setEditingId(card.id)
    setEditValue(card.displayName ?? card.name)
    setTimeout(() => editRef.current?.select(), 0)
  }

  function saveEdit(card: PluggyLocalAccount & { itemId: string }) {
    updateAccountDisplayName(card.itemId, card.id, editValue)
    setConnections(getLocalConnections())
    setEditingId(null)
  }

  const creditCards: (PluggyLocalAccount & { connectorName: string; connectorImageUrl: string | null; itemId: string })[] =
    connections.flatMap(c =>
      c.accounts
        .filter(a => a.type === 'CREDIT')
        .map(a => ({ ...a, connectorName: c.connectorName, connectorImageUrl: c.connectorImageUrl, itemId: c.itemId }))
    )

  const totalBill  = creditCards.reduce((s, a) => s + (a.balance ?? 0), 0)
  const totalLimit = creditCards.reduce((s, a) => s + (a.limit ?? 0), 0)

  function startSync(itemId: string, accountId: string, accountName: string) {
    const today = currentFinancialDate()
    setSync({ itemId, accountId, accountName, period: 'last_7d', customFrom: '2024-01-01', customTo: today, phase: 'period_select' })
  }

  async function doFetch(period: PeriodPreset, customFrom: string, customTo: string) {
    if (!sync) return
    let from: string; let to: string
    if (period === 'custom') {
      if (!customFrom || !customTo) return
      from = customFrom; to = customTo
    } else {
      const dates = getPeriodDates(period)
      from = dates.from; to = dates.to
    }
    const conn = connections.find(c => c.itemId === sync.itemId)
    const connInfo: ConnInfo | undefined = conn
      ? { accountName: sync.accountName, institutionName: conn.connectorName, institutionLogoUrl: conn.connectorImageUrl }
      : undefined
    setSync(s => s ? { ...s, period, customFrom, customTo, phase: 'fetching', result: undefined } : s)
    try {
      const raw = await fetchPluggyTransactions({ accountId: sync.accountId, from, to })
      const result = mapPluggyToTransactions(raw, sync.accountId, transactions, connInfo)
      setSync(s => s ? { ...s, phase: 'preview', result } : s)
    } catch (err) {
      setSync(s => s ? { ...s, phase: 'error', error: err instanceof Error ? err.message : 'Erro ao buscar transações' } : s)
    }
  }

  function resetPeriod() {
    setSync(s => s ? { ...s, phase: 'period_select', result: undefined } : s)
  }

  async function runImport() {
    if (!sync?.result) return
    const { itemId, accountId, result } = sync
    setSync(s => s ? { ...s, phase: 'importing' } : s)
    try {
      await appendTransactions(result.newTxs as Transaction[])
      updateConnectionSyncMeta(itemId, accountId, result.newTxs.length)
      updateAccountDiagnostics({
        accountId,
        accountName: sync.accountName,
        lastSyncAt: new Date().toISOString(),
        rawReturnedCount: result.rawReturnedCount,
        newTxsCount: result.newTxs.length,
        duplicateCount: result.duplicateCount,
        missingFinancialDateCount: result.missingFinancialDateCount,
        dateConfidenceCounts: result.dateConfidenceCounts,
      })
      setConnections(getLocalConnections())
      setSync(s => s ? { ...s, phase: 'done' } : s)
    } catch (err) {
      setSync(s => s ? { ...s, phase: 'error', error: err instanceof Error ? err.message : 'Erro ao importar' } : s)
    }
  }

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Cartões</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>Limites, faturas e gastos por cartão</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('/pluggy')}>
            + Conectar cartão
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Limite Total</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
              {creditCards.length > 0 && totalLimit > 0 ? fmtBRL(totalLimit) : '—'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>Soma dos limites</p>
          </div>
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Fatura Atual</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: creditCards.length > 0 ? 'var(--crit)' : 'var(--ink)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
              {creditCards.length > 0 ? fmtBRL(totalBill) : '—'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>Total em aberto</p>
          </div>
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Cartões Ativos</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em' }}>{creditCards.length}</p>
            <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>
              {connections.length > 0 ? `${connections.length} banco${connections.length > 1 ? 's' : ''} conectado${connections.length > 1 ? 's' : ''}` : 'Nenhum conectado'}
            </p>
          </div>
        </div>

        {/* Cards list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Seus cartões</h3>
          </div>

          {creditCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--faint)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.35 }}>
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              <p style={{ fontSize: 12.5 }}>Nenhum cartão de crédito encontrado</p>
              <p style={{ fontSize: 11.5, marginTop: 4, opacity: 0.7, marginBottom: 16 }}>
                {connections.length > 0
                  ? 'O banco conectado pode não ter cartões de crédito, ou ainda está sincronizando.'
                  : 'Conecte seu banco via Open Finance para importar cartões automaticamente.'}
              </p>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('/pluggy')}>
                {connections.length > 0 ? 'Ver Pluggy' : 'Conectar via Pluggy'}
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                <thead>
                  <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                    <th className="table-th">Cartão</th>
                    <th className="table-th">Banco</th>
                    <th className="table-th" style={{ textAlign: 'right' }}>Fatura</th>
                    <th className="table-th" style={{ textAlign: 'right' }}>Limite</th>
                    <th className="table-th">Última Sync</th>
                    <th style={{ width: 90 }} />
                  </tr>
                </thead>
                <tbody>
                  {creditCards.map(card => (
                    <tr key={card.id} className="table-row">
                      <td className="table-td">
                        {editingId === card.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              ref={editRef}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveEdit(card); if (e.key === 'Escape') setEditingId(null) }}
                              style={{ fontSize: 12.5, fontWeight: 600, border: '1px solid var(--accent)', borderRadius: 5, padding: '2px 6px', outline: 'none', background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'var(--ui)', width: 160 }}
                              autoFocus
                            />
                            <button onClick={() => saveEdit(card)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pos)', padding: 2 }}><Check size={13} /></button>
                            <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 2 }}><X size={13} /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{card.displayName ?? card.name}</span>
                              {card.displayName && (
                                <span style={{ display: 'block', fontSize: 10, color: 'var(--faint)' }}>{card.name}</span>
                              )}
                              {card.dueDate && (
                                <span style={{ display: 'block', fontSize: 10.5, color: 'var(--faint)', marginTop: 1 }}>
                                  Venc. {new Date(card.dueDate).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                            <button onClick={() => startEdit(card)} title="Renomear" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 2, flexShrink: 0 }}><Pencil size={11} /></button>
                          </div>
                        )}
                      </td>
                      <td className="table-td">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {card.connectorImageUrl && (
                            <img src={card.connectorImageUrl} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
                          )}
                          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{card.connectorName}</span>
                        </div>
                      </td>
                      <td className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700, color: 'var(--crit)' }}>
                        {card.balance !== null ? fmtBRL(card.balance) : '—'}
                      </td>
                      <td className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--ink-2)' }}>
                        {card.limit != null ? fmtBRL(card.limit) : '—'}
                      </td>
                      <td className="table-td">
                        {card.lastSyncAt ? (
                          <div>
                            <span style={{ fontSize: 11, color: 'var(--ink-2)', display: 'block' }}>
                              {new Date(card.lastSyncAt).toLocaleDateString('pt-BR')}
                            </span>
                            {card.lastSyncCount != null && (
                              <span style={{ fontSize: 10, color: 'var(--faint)' }}>
                                {card.lastSyncCount} lançamentos
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--faint)' }}>—</span>
                        )}
                      </td>
                      <td className="table-td" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => startSync(card.itemId, card.id, card.displayName ?? card.name)}
                          style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                        >
                          Sincronizar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--well)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--faint)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink-2)' }}>Fase 2:</strong> Gestão de faturas, alertas de vencimento e análise de gastos por cartão disponíveis na próxima versão.
        </div>

      </div>

      {sync && (
        <SyncModal
          sync={sync}
          onFetch={doFetch}
          onResetPeriod={resetPeriod}
          onImport={runImport}
          onClose={() => setSync(null)}
        />
      )}
    </main>
  )
}
