import { useState, useEffect } from 'react'
import { getLocalConnections } from '../services/pluggy.service'
import type { PluggyLocalConnection, PluggyLocalAccount } from '../services/pluggy.service'

interface Props {
  onNavigate: (route: string) => void
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CardsPage({ onNavigate }: Props) {
  const [connections, setConnections] = useState<PluggyLocalConnection[]>([])

  useEffect(() => {
    setConnections(getLocalConnections())
  }, [])

  const creditCards: (PluggyLocalAccount & { connectorName: string })[] = connections.flatMap(c =>
    c.accounts
      .filter(a => a.type === 'CREDIT')
      .map(a => ({ ...a, connectorName: c.connectorName }))
  )

  const totalBill  = creditCards.reduce((s, a) => s + a.balance, 0)
  const totalLimit = creditCards.reduce((s, a) => s + (a.limit ?? 0), 0)

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
              {connections.length > 0 ? 'via Pluggy' : 'Nenhum conectado'}
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
                  </tr>
                </thead>
                <tbody>
                  {creditCards.map(card => (
                    <tr key={card.id} className="table-row">
                      <td className="table-td">
                        <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{card.name}</span>
                        {card.dueDate && (
                          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--faint)', marginTop: 1 }}>
                            Venc. {new Date(card.dueDate).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </td>
                      <td className="table-td">
                        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{card.connectorName}</span>
                      </td>
                      <td className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700, color: 'var(--crit)' }}>
                        {fmtBRL(card.balance)}
                      </td>
                      <td className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--ink-2)' }}>
                        {card.limit != null ? fmtBRL(card.limit) : '—'}
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
    </main>
  )
}
