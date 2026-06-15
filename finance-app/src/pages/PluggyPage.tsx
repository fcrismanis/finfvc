import { useState, useEffect, useRef } from 'react'
import { getConnectToken } from '../services/pluggy.service'

type PluggyBackendStatus = 'checking' | 'configured' | 'not_configured'
type PluggyConnectStatus = 'idle' | 'loading' | 'error'

export function PluggyPage() {
  const [pluggyStatus, setPluggyStatus] = useState<PluggyBackendStatus>('checking')
  const [connectStatus, setConnectStatus] = useState<PluggyConnectStatus>('idle')
  const [connectError, setConnectError] = useState<string | null>(null)
  const scriptInjected = useRef(false)

  useEffect(() => {
    fetch('/api/pluggy/status')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { configured: boolean }) => setPluggyStatus(d.configured ? 'configured' : 'not_configured'))
      .catch(() => setPluggyStatus('not_configured'))
  }, [])

  async function handlePluggyConnect() {
    setConnectStatus('loading')
    setConnectError(null)
    try {
      const token = await getConnectToken('local-user')
      openPluggyWidget(token)
      setConnectStatus('idle')
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Erro ao obter token Pluggy')
      setConnectStatus('error')
    }
  }

  function openPluggyWidget(connectToken: string) {
    if (!scriptInjected.current) {
      const script = document.createElement('script')
      script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js'
      script.onload = () => { scriptInjected.current = true; launchWidget(connectToken) }
      document.head.appendChild(script)
    } else {
      launchWidget(connectToken)
    }
  }

  function launchWidget(connectToken: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PluggyConnect = (window as any).PluggyConnect
    if (!PluggyConnect) {
      setConnectError('Widget Pluggy não carregou. Verifique a conexão.')
      setConnectStatus('error')
      return
    }
    new PluggyConnect({
      connectToken,
      onSuccess: () => { setConnectStatus('idle') },
      onError:   () => { setConnectError('Conexão encerrada com erro.'); setConnectStatus('error') },
      onClose:   () => { setConnectStatus('idle') },
    }).init()
  }

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

        {/* Status banner */}
        {pluggyStatus === 'checking' && (
          <div style={{ padding: '14px 18px', borderRadius: 11, background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--faint)', flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: 'var(--faint)' }}>Verificando configuração do backend…</p>
          </div>
        )}

        {pluggyStatus === 'not_configured' && (
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

        {pluggyStatus === 'configured' && (
          <div style={{ padding: '14px 18px', borderRadius: 11, background: 'var(--pos-soft)', border: '1px solid rgba(30,111,73,.28)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pos)', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Backend configurado</p>
              <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
                Pluggy pronto — clique em "+ Conectar banco" para autenticar.
              </p>
            </div>
          </div>
        )}

        {connectError && (
          <div style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--crit-soft)', border: '1px solid var(--crit)', fontSize: 12.5, color: 'var(--crit)' }}>
            {connectError}
          </div>
        )}

        {/* Connection list */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Conexões ativas</h3>
            <button
              className="btn btn-secondary btn-sm"
              disabled={pluggyStatus !== 'configured' || connectStatus === 'loading'}
              onClick={handlePluggyConnect}
              style={{ opacity: pluggyStatus !== 'configured' ? 0.4 : 1 }}
            >
              {connectStatus === 'loading' ? 'Obtendo token…' : '+ Conectar banco'}
            </button>
          </div>
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--faint)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.35 }}>
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <p style={{ fontSize: 12.5 }}>Nenhuma conexão configurada</p>
            <p style={{ fontSize: 11.5, marginTop: 4, opacity: 0.7 }}>Quando ativar, seus bancos aparecerão aqui</p>
          </div>
        </div>

        {/* How it works */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Como funciona</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['1', 'Você clica em "Conectar banco"'],
              ['2', 'Backend gera um connect_token via Pluggy API (server-side)'],
              ['3', 'Widget Pluggy abre — você autentifica com suas credenciais bancárias'],
              ['4', 'Transações sincronizam via webhook para o backend'],
              ['5', 'FIN importa e deduplica as transações automaticamente'],
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
    </main>
  )
}
