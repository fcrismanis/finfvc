import { useState, useEffect } from 'react'
import { PluggyConnect } from 'react-pluggy-connect'
import {
  getConnectToken,
  getLocalConnections,
  saveLocalConnection,
  removeLocalConnection,
  registerConnection,
} from '../services/pluggy.service'
import type { PluggyLocalConnection } from '../services/pluggy.service'

type BackendStatus = 'checking' | 'configured' | 'not_configured'

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_LABEL: Record<string, string> = {
  UPDATED:           'Atualizado',
  UPDATING:          'Sincronizando…',
  WAITING_USER_INPUT:'Aguardando input',
  LOGIN_ERROR:       'Erro de login',
  OUTDATED:          'Desatualizado',
}

const STATUS_COLOR: Record<string, string> = {
  UPDATED:           'var(--pos)',
  UPDATING:          'var(--warn)',
  WAITING_USER_INPUT:'var(--warn)',
  LOGIN_ERROR:       'var(--crit)',
  OUTDATED:          'var(--crit)',
}

export function PluggyPage() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')
  const [connections, setConnections] = useState<PluggyLocalConnection[]>([])
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [fetchingToken, setFetchingToken] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)

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

  function handleClose() {
    setConnectToken(null)
  }

  function handleDisconnect(itemId: string) {
    if (!confirm('Remover esta conexão do FIN? Isso não desconecta o banco na Pluggy.')) return
    removeLocalConnection(itemId)
    setConnections(getLocalConnections())
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
            <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 8, padding: '1px 5px', borderRadius: 3, background: 'var(--warn)', color: '#fff', verticalAlign: 'middle' }}>
              BETA
            </span>
          </div>
        </div>

        {/* Backend status */}
        {backendStatus === 'checking' && (
          <div style={{ padding: '14px 18px', borderRadius: 11, background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--faint)', flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: 'var(--faint)' }}>Verificando configuração do backend…</p>
          </div>
        )}
        {backendStatus === 'not_configured' && (
          <div style={{ padding: '14px 18px', borderRadius: 11, background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Backend não configurado</p>
              <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
                Adicione <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>PLUGGY_CLIENT_ID</code> e <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>PLUGGY_CLIENT_SECRET</code> no <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>server/.env</code>.
              </p>
            </div>
          </div>
        )}
        {backendStatus === 'configured' && connections.length === 0 && (
          <div style={{ padding: '14px 18px', borderRadius: 11, background: 'var(--pos-soft)', border: '1px solid rgba(30,111,73,.28)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pos)', flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: 'var(--ink)' }}>
              <strong>Backend configurado</strong> — clique em &ldquo;+ Conectar banco&rdquo; para autenticar.
            </p>
          </div>
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
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              <p style={{ fontSize: 12.5 }}>Nenhuma conexão ativa</p>
              <p style={{ fontSize: 11.5, marginTop: 4, opacity: 0.7 }}>Clique em &ldquo;+ Conectar banco&rdquo; para adicionar</p>
            </div>
          ) : (
            <div>
              {connections.map(conn => (
                <div key={conn.itemId} style={{ borderBottom: '1px solid var(--line)', padding: '16px 20px' }}>
                  {/* Institution header */}
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
                          <span style={{ fontSize: 11, color: 'var(--faint)' }}>
                            {STATUS_LABEL[conn.status] ?? conn.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDisconnect(conn.itemId)}
                      style={{ fontSize: 11, fontWeight: 600, color: 'var(--crit)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                    >
                      Remover
                    </button>
                  </div>

                  {/* Accounts */}
                  {conn.accounts.length === 0 ? (
                    <p style={{ fontSize: 11.5, color: 'var(--faint)', paddingLeft: 4 }}>
                      Nenhuma conta encontrada — o banco pode ainda estar sincronizando.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {conn.accounts.map(acc => (
                        <div key={acc.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px', borderRadius: 8,
                          background: 'var(--well)', border: '1px solid var(--line)',
                        }}>
                          <div>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{acc.name}</span>
                            <span style={{
                              marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: '.06em',
                              padding: '1px 5px', borderRadius: 3,
                              background: acc.type === 'CREDIT' ? 'var(--accent-soft)' : 'var(--pos-soft)',
                              color: acc.type === 'CREDIT' ? 'var(--accent)' : 'var(--pos)',
                              border: `1px solid ${acc.type === 'CREDIT' ? 'var(--accent)' : 'var(--pos)'}40`,
                            }}>
                              {acc.type === 'CREDIT' ? 'CARTÃO' : 'CONTA'}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                              {fmtBRL(acc.balance)}
                            </p>
                            {acc.type === 'CREDIT' && acc.limit != null && (
                              <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 1 }}>
                                Limite: {fmtBRL(acc.limit)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(conn.status === 'UPDATING' || conn.accounts.length === 0) && (
                    <p style={{ fontSize: 11, color: 'var(--warn)', marginTop: 8, fontWeight: 600 }}>
                      Conexão criada. Sincronização de transações será a próxima etapa.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary chips */}
        {connections.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {bankAccounts.length > 0 && (
              <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Contas bancárias</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtBRL(bankAccounts.reduce((s, a) => s + a.balance, 0))}
                </p>
              </div>
            )}
            {creditCards.length > 0 && (
              <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Cartões — fatura</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtBRL(creditCards.reduce((s, a) => s + a.balance, 0))}
                </p>
              </div>
            )}
          </div>
        )}

        {/* How it works */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Como funciona</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['1', 'Você clica em "Conectar banco"'],
              ['2', 'Backend gera um connect_token via Pluggy API (server-side)'],
              ['3', 'Widget Pluggy abre — você autentica com suas credenciais bancárias'],
              ['4', 'FIN busca e salva a conexão localmente'],
              ['5', 'Sincronização de transações via webhook (próxima etapa)'],
            ].map(([n, text]) => (
              <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: 'var(--ink-2)' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0, color: 'var(--faint)' }}>{n}</span>
                {text}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--well)', borderRadius: 8, border: '1px solid var(--line)', fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--ink-2)' }}>Segurança:</strong> suas credenciais bancárias nunca passam pelo FIN. O app só recebe o connect_token de curta duração gerado pelo backend.
          </div>
        </div>

        {/* Supported banks */}
        <div className="card" style={{ padding: '16px 22px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Suporte estimado</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Itaú', 'Bradesco', 'Santander', 'BB', 'Nubank', 'C6 Bank', 'BTG', 'XP', 'Inter', '+ 300 mais'].map(b => (
              <span key={b} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: 'var(--well)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>{b}</span>
            ))}
          </div>
        </div>

      </div>

      {/* Pluggy Connect widget — overlay when token is available */}
      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          onSuccess={handleSuccess}
          onError={handleError}
          onClose={handleClose}
        />
      )}
    </main>
  )
}
