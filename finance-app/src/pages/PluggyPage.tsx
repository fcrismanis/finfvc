import { useState, useEffect } from 'react'
import { PluggyConnect } from 'react-pluggy-connect'
import { useData } from '../context/DataContext'
import {
  getConnectToken,
  getLocalConnections,
  saveLocalConnection,
  removeLocalConnection,
  registerConnection,
  fetchPluggyTransactions,
  mapPluggyToTransactions,
  updateConnectionSyncMeta,
  getPeriodDates,
} from '../services/pluggy.service'
import type { PluggyLocalConnection, MapResult } from '../services/pluggy.service'
import type { Transaction } from '../types'

type BackendStatus = 'checking' | 'configured' | 'not_configured'
type SyncPhase = 'idle' | 'fetching' | 'preview' | 'importing' | 'done' | 'error'
type PeriodPreset = 'current_month' | 'last_30d' | 'last_90d' | 'custom'

interface SyncSession {
  itemId: string
  accountId: string
  accountName: string
  period: PeriodPreset
  customFrom: string
  customTo: string
  phase: SyncPhase
  result?: MapResult
  error?: string
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const STATUS_LABEL: Record<string, string> = {
  UPDATED:            'Atualizado',
  UPDATING:           'Sincronizando…',
  WAITING_USER_INPUT: 'Aguardando input',
  LOGIN_ERROR:        'Erro de login',
  OUTDATED:           'Desatualizado',
}

const STATUS_COLOR: Record<string, string> = {
  UPDATED:            'var(--pos)',
  UPDATING:           'var(--warn)',
  WAITING_USER_INPUT: 'var(--warn)',
  LOGIN_ERROR:        'var(--crit)',
  OUTDATED:           'var(--crit)',
}

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  current_month: 'Mês atual',
  last_30d:      'Últimos 30 dias',
  last_90d:      'Últimos 90 dias',
  custom:        'Personalizado',
}

export function PluggyPage() {
  const { transactions, appendTransactions } = useData()
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')
  const [connections, setConnections] = useState<PluggyLocalConnection[]>([])
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [fetchingToken, setFetchingToken] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [sync, setSync] = useState<SyncSession | null>(null)

  useEffect(() => {
    fetch('/api/pluggy/status')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { configured: boolean }) => setBackendStatus(d.configured ? 'configured' : 'not_configured'))
      .catch(() => setBackendStatus('not_configured'))
    setConnections(getLocalConnections())
  }, [])

  async function handleConnect() {
    setFetchingToken(true)
    setTokenError(null)
    try {
      const token = await getConnectToken('local-user')
      setConnectToken(token)
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : 'Erro ao obter token Pluggy')
    } finally {
      setFetchingToken(false)
    }
  }

  async function handleSuccess({ item }: { item: { id: string } }) {
    setConnectToken(null)
    setRegistering(true)
    setTokenError(null)
    try {
      const conn = await registerConnection(item.id)
      saveLocalConnection(conn)
      setConnections(getLocalConnections())
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : 'Erro ao salvar conexão')
    } finally {
      setRegistering(false)
    }
  }

  function handleError(error: { message: string }) {
    setConnectToken(null)
    setTokenError(`Erro na conexão: ${error.message}`)
  }

  function handleClose() { setConnectToken(null) }

  function handleDisconnect(itemId: string) {
    if (!confirm('Remover esta conexão do FIN? Isso não desconecta o banco na Pluggy.')) return
    removeLocalConnection(itemId)
    setConnections(getLocalConnections())
  }

  function openSync(itemId: string, accountId: string, accountName: string) {
    setSync({ itemId, accountId, accountName, period: 'current_month', customFrom: '', customTo: '', phase: 'idle' })
  }

  async function runFetch() {
    if (!sync) return
    const { period, customFrom, customTo, accountId } = sync
    let from: string; let to: string
    if (period === 'custom') {
      if (!customFrom || !customTo) return
      from = customFrom; to = customTo
    } else {
      const dates = getPeriodDates(period)
      from = dates.from; to = dates.to
    }
    setSync(s => s ? { ...s, phase: 'fetching', error: undefined, result: undefined } : s)
    try {
      const raw = await fetchPluggyTransactions({ accountId, from, to })
      const result = mapPluggyToTransactions(raw, accountId, transactions)
      setSync(s => s ? { ...s, phase: 'preview', result } : s)
    } catch (err) {
      setSync(s => s ? { ...s, phase: 'error', error: err instanceof Error ? err.message : 'Erro ao buscar transações' } : s)
    }
  }

  async function runImport() {
    if (!sync?.result) return
    const { itemId, accountId, result } = sync
    setSync(s => s ? { ...s, phase: 'importing' } : s)
    try {
      await appendTransactions(result.newTxs as Transaction[])
      updateConnectionSyncMeta(itemId, accountId, result.newTxs.length)
      setConnections(getLocalConnections())
      setSync(s => s ? { ...s, phase: 'done' } : s)
    } catch (err) {
      setSync(s => s ? { ...s, phase: 'error', error: err instanceof Error ? err.message : 'Erro ao importar' } : s)
    }
  }

  const bankAccounts = connections.flatMap(c => c.accounts.filter(a => a.type === 'BANK'))
  const creditCards  = connections.flatMap(c => c.accounts.filter(a => a.type === 'CREDIT'))

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Pluggy</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Conecte bancos e cartões via Open Finance
            <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 8, padding: '1px 5px', borderRadius: 3, background: 'var(--warn)', color: '#fff', verticalAlign: 'middle' }}>BETA</span>
          </div>
        </div>

        {/* Backend status */}
        {backendStatus === 'checking' && <StatusBanner dot="var(--faint)" text="Verificando configuração do backend…" />}
        {backendStatus === 'not_configured' && (
          <StatusBanner dot="var(--warn)" title="Backend não configurado">
            Adicione <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>PLUGGY_CLIENT_ID</code> e{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>PLUGGY_CLIENT_SECRET</code> no{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>server/.env</code>.
          </StatusBanner>
        )}
        {backendStatus === 'configured' && connections.length === 0 && (
          <StatusBanner dot="var(--pos)" color="var(--pos-soft)" border="rgba(30,111,73,.28)">
            <strong>Backend configurado</strong> — clique em &ldquo;+ Conectar banco&rdquo; para autenticar.
          </StatusBanner>
        )}

        {tokenError && (
          <div style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--crit-soft)', border: '1px solid var(--crit)', fontSize: 12.5, color: 'var(--crit)' }}>
            {tokenError}
          </div>
        )}
        {registering && (
          <div style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--well)', border: '1px solid var(--line)', fontSize: 12.5, color: 'var(--faint)' }}>
            Salvando conexão e buscando contas na Pluggy…
          </div>
        )}

        {/* Connections list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>
              Conexões ativas
              {connections.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--well)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                  {connections.length}
                </span>
              )}
            </h3>
            <button
              className="btn btn-secondary btn-sm"
              disabled={backendStatus !== 'configured' || fetchingToken || registering}
              onClick={handleConnect}
              style={{ opacity: backendStatus !== 'configured' ? 0.4 : 1 }}
            >
              {fetchingToken ? 'Obtendo token…' : '+ Conectar banco'}
            </button>
          </div>

          {connections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--faint)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 10px', display: 'block', opacity: 0.35 }}>
                <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              <p style={{ fontSize: 12.5 }}>Nenhuma conexão ativa</p>
              <p style={{ fontSize: 11.5, marginTop: 4, opacity: 0.7 }}>Clique em &ldquo;+ Conectar banco&rdquo; para adicionar</p>
            </div>
          ) : (
            <div>
              {connections.map(conn => (
                <div key={conn.itemId} style={{ borderBottom: '1px solid var(--line)', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {conn.connectorImageUrl ? (
                        <img src={conn.connectorImageUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--faint)' }}>
                          {conn.connectorName[0]}
                        </div>
                      )}
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{conn.connectorName}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[conn.status] ?? 'var(--faint)', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'var(--faint)' }}>{STATUS_LABEL[conn.status] ?? conn.status}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleDisconnect(conn.itemId)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--crit)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}>
                      Remover
                    </button>
                  </div>

                  {conn.accounts.length === 0 ? (
                    <p style={{ fontSize: 11.5, color: 'var(--faint)', paddingLeft: 4 }}>Nenhuma conta encontrada.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {conn.accounts.map(acc => (
                        <div key={acc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{acc.name}</span>
                              <span style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: '.06em', padding: '1px 5px', borderRadius: 3,
                                background: acc.type === 'CREDIT' ? 'var(--accent-soft)' : 'var(--pos-soft)',
                                color: acc.type === 'CREDIT' ? 'var(--accent)' : 'var(--pos)',
                                border: `1px solid ${acc.type === 'CREDIT' ? 'var(--accent)' : 'var(--pos)'}40`,
                              }}>
                                {acc.type === 'CREDIT' ? 'CARTÃO' : 'CONTA'}
                              </span>
                            </div>
                            {acc.lastSyncAt && (
                              <p style={{ fontSize: 10.5, color: 'var(--faint)' }}>
                                Última sync: {fmtDate(acc.lastSyncAt)}
                                {acc.lastSyncCount != null && ` · ${acc.lastSyncCount} importados no total`}
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(acc.balance)}</p>
                              {acc.type === 'CREDIT' && acc.limit != null && (
                                <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 1 }}>Limite: {fmtBRL(acc.limit)}</p>
                              )}
                            </div>
                            <button onClick={() => openSync(conn.itemId, acc.id, acc.name)} className="btn btn-secondary btn-sm" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                              Sincronizar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary chips */}
        {connections.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {bankAccounts.length > 0 && <SummaryChip label="Contas bancárias" value={fmtBRL(bankAccounts.reduce((s, a) => s + a.balance, 0))} />}
            {creditCards.length > 0 && <SummaryChip label="Cartões — fatura" value={fmtBRL(creditCards.reduce((s, a) => s + a.balance, 0))} />}
          </div>
        )}

        {/* How it works */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Como funciona</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['1','Clique em "+ Conectar banco"'],['2','Backend gera connect_token via Pluggy (server-side)'],['3','Widget Pluggy abre — autentique com credenciais bancárias'],['4','FIN salva a conexão e contas localmente'],['5','Clique em "Sincronizar" por conta para importar transações'],['6','Revise categorias em Revisão → lançamentos entram no Dashboard']].map(([n, t]) => (
              <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: 'var(--ink-2)' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0, color: 'var(--faint)' }}>{n}</span>
                {t}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--well)', borderRadius: 8, border: '1px solid var(--line)', fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--ink-2)' }}>Segurança:</strong> credenciais bancárias nunca passam pelo FIN. O backend usa apenas o connect_token de curta duração.
          </div>
        </div>

        <div className="card" style={{ padding: '16px 22px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Suporte estimado</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Itaú','Bradesco','Santander','BB','Nubank','C6 Bank','BTG','XP','Inter','+ 300 mais'].map(b => (
              <span key={b} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: 'var(--well)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>{b}</span>
            ))}
          </div>
        </div>

      </div>

      {connectToken && (
        <PluggyConnect connectToken={connectToken} onSuccess={handleSuccess} onError={handleError} onClose={handleClose} />
      )}

      {sync && (
        <SyncModal
          sync={sync}
          onPeriodChange={p => setSync(s => s ? { ...s, period: p, result: undefined } : s)}
          onCustomFromChange={v => setSync(s => s ? { ...s, customFrom: v } : s)}
          onCustomToChange={v => setSync(s => s ? { ...s, customTo: v } : s)}
          onFetch={runFetch}
          onImport={runImport}
          onClose={() => setSync(null)}
        />
      )}
    </main>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBanner({ dot, color, border, title, text, children }: {
  dot: string; color?: string; border?: string; title?: string; text?: string; children?: React.ReactNode
}) {
  return (
    <div style={{ padding: '14px 18px', borderRadius: 11, background: color ?? 'var(--well)', border: `1px solid ${border ?? 'var(--line)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div>
        {title && <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{title}</p>}
        {text && <p style={{ fontSize: 13, color: 'var(--faint)' }}>{text}</p>}
        {children && <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: title ? 2 : 0 }}>{children}</p>}
      </div>
    </div>
  )
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  )
}

interface SyncModalProps {
  sync: SyncSession
  onPeriodChange: (p: PeriodPreset) => void
  onCustomFromChange: (v: string) => void
  onCustomToChange: (v: string) => void
  onFetch: () => void
  onImport: () => void
  onClose: () => void
}

function SyncModal({ sync, onPeriodChange, onCustomFromChange, onCustomToChange, onFetch, onImport, onClose }: SyncModalProps) {
  const { phase, result, error, period, customFrom, customTo, accountName } = sync
  const localFmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(16,15,10,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 520, boxShadow: '0 8px 32px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', gap: 18 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>Sincronizar transações</h2>
            <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{accountName}</p>
          </div>
          {phase !== 'importing' && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 20, lineHeight: 1, fontFamily: 'var(--ui)', padding: 4 }}>×</button>
          )}
        </div>

        {/* Period selector — shown when not actively working */}
        {(phase === 'idle' || phase === 'error' || phase === 'preview') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Período</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['current_month','last_30d','last_90d','custom'] as PeriodPreset[]).map(p => (
                <button key={p} onClick={() => onPeriodChange(p)} style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--ui)', fontWeight: period === p ? 700 : 400, background: period === p ? 'var(--accent-soft)' : 'var(--well)', border: `1px solid ${period === p ? 'var(--accent)' : 'var(--line)'}`, color: period === p ? 'var(--accent)' : 'var(--ink-2)' }}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="date" value={customFrom} onChange={e => onCustomFromChange(e.target.value)} className="login-field" style={{ fontSize: 12, flex: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>até</span>
                <input type="date" value={customTo} onChange={e => onCustomToChange(e.target.value)} className="login-field" style={{ fontSize: 12, flex: 1 }} />
              </div>
            )}
          </div>
        )}

        {phase === 'fetching' && <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--faint)', fontSize: 13 }}>Buscando transações na Pluggy…</div>}
        {phase === 'importing' && <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--faint)', fontSize: 13 }}>Importando lançamentos…</div>}

        {phase === 'error' && error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', border: '1px solid var(--crit)', fontSize: 12.5, color: 'var(--crit)' }}>{error}</div>
        )}

        {phase === 'preview' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Preview</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {([['Novas', String(result.newTxs.length), 'var(--pos)'],['Duplicadas', String(result.duplicateCount), 'var(--faint)'],['Total Pluggy', String(result.newTxs.length + result.duplicateCount), 'var(--ink-2)']] as [string,string,string][]).map(([label, val, color]) => (
                <div key={label} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)', textAlign: 'center' }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{val}</p>
                  <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>{label}</p>
                </div>
              ))}
            </div>
            {result.newTxs.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--pos-soft)', border: '1px solid var(--pos)30' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--pos)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Entradas</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--pos)', fontVariantNumeric: 'tabular-nums' }}>{localFmtBRL(result.newTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))}</p>
                </div>
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--crit-soft)', border: '1px solid var(--crit)30' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--crit)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Saídas</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--crit)', fontVariantNumeric: 'tabular-nums' }}>{localFmtBRL(result.newTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}</p>
                </div>
              </div>
            )}
            {result.newTxs.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center', padding: '8px 0' }}>Nenhuma transação nova — todas já importadas ou período sem dados.</p>}
            {result.newTxs.length > 0 && (
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
                {result.newTxs.slice(0, 20).map(tx => (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid var(--line)', fontSize: 12 }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                      <p style={{ fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</p>
                      <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 1 }}>{tx.transactionDate} · {tx.status === 'paid' ? 'Pago' : 'Pendente'}</p>
                    </div>
                    <span style={{ fontWeight: 700, color: tx.type === 'income' ? 'var(--pos)' : 'var(--crit)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {tx.type === 'income' ? '+' : '−'}{localFmtBRL(tx.amount)}
                    </span>
                  </div>
                ))}
                {result.newTxs.length > 20 && <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--faint)', padding: '8px 0' }}>+{result.newTxs.length - 20} mais</p>}
              </div>
            )}
          </div>
        )}

        {phase === 'done' && result && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: 22, marginBottom: 8 }}>✓</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--pos)' }}>{result.newTxs.length} lançamento{result.newTxs.length !== 1 ? 's' : ''} importado{result.newTxs.length !== 1 ? 's' : ''}</p>
            <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>{result.duplicateCount > 0 && `${result.duplicateCount} duplicados ignorados · `}Acesse Revisão para categorizar</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          {phase === 'done' ? (
            <button className="btn btn-primary" onClick={onClose}>Fechar</button>
          ) : phase === 'preview' && result && result.newTxs.length > 0 ? (
            <>
              <button className="btn btn-primary" onClick={onImport}>Importar {result.newTxs.length} lançamento{result.newTxs.length !== 1 ? 's' : ''}</button>
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            </>
          ) : phase === 'preview' && result && result.newTxs.length === 0 ? (
            <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
          ) : (phase === 'idle' || phase === 'error') ? (
            <>
              <button className="btn btn-primary" onClick={onFetch} disabled={period === 'custom' && (!customFrom || !customTo)}>Buscar transações</button>
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            </>
          ) : null}
        </div>

      </div>
    </div>
  )
}
