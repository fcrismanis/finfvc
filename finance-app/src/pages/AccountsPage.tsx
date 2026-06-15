import { useState, useEffect } from 'react'
import { getLocalConnections } from '../services/pluggy.service'
import type { PluggyLocalConnection, PluggyLocalAccount } from '../services/pluggy.service'

interface Props {
  onNavigate: (route: string) => void
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function AccountsPage({ onNavigate }: Props) {
  const [connections, setConnections] = useState<PluggyLocalConnection[]>([])

  useEffect(() => {
    setConnections(getLocalConnections())
  }, [])

  const bankAccounts: (PluggyLocalAccount & { connectorName: string })[] = connections.flatMap(c =>
    c.accounts
      .filter(a => a.type === 'BANK')
      .map(a => ({ ...a, connectorName: c.connectorName }))
  )

  const totalBalance = bankAccounts.reduce((s, a) => s + a.balance, 0)

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Contas</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>Saldos e conexões bancárias</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('/pluggy')}>
            + Conectar banco
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Saldo Total</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
              {bankAccounts.length > 0 ? fmtBRL(totalBalance) : '—'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>
              {bankAccounts.length > 0 ? `${bankAccounts.length} conta${bankAccounts.length > 1 ? 's' : ''} via Pluggy` : 'Aguardando conexão'}
            </p>
          </div>
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Contas Ativas</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em' }}>{bankAccounts.length}</p>
            <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>
              {connections.length > 0 ? `${connections.length} banco${connections.length > 1 ? 's' : ''} conectado${connections.length > 1 ? 's' : ''}` : 'Nenhum conectado'}
            </p>
          </div>
        </div>

        {/* Accounts list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Suas contas</h3>
          </div>

          {bankAccounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--faint)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.35 }}>
                <line x1="3" y1="22" x2="21" y2="22" />
                <rect x="2" y="11" width="20" height="11" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p style={{ fontSize: 12.5 }}>Nenhuma conta bancária encontrada</p>
              <p style={{ fontSize: 11.5, marginTop: 4, opacity: 0.7, marginBottom: 16 }}>
                {connections.length > 0
                  ? 'As contas bancárias do banco conectado ainda não sincronizaram.'
                  : 'Conecte seu banco via Open Finance para visualizar saldos automaticamente.'}
              </p>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('/pluggy')}>
                {connections.length > 0 ? 'Ver Pluggy' : 'Conectar via Pluggy'}
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
                <thead>
                  <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                    <th className="table-th">Conta</th>
                    <th className="table-th">Banco</th>
                    <th className="table-th" style={{ textAlign: 'right' }}>Saldo</th>
                    <th className="table-th">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {bankAccounts.map(acc => (
                    <tr key={acc.id} className="table-row">
                      <td className="table-td">
                        <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{acc.name}</span>
                        {acc.subtype && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--faint)' }}>{acc.subtype}</span>
                        )}
                      </td>
                      <td className="table-td">
                        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{acc.connectorName}</span>
                      </td>
                      <td className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700, color: acc.balance >= 0 ? 'var(--pos)' : 'var(--crit)' }}>
                        {fmtBRL(acc.balance)}
                      </td>
                      <td className="table-td">
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--pos-soft)', color: 'var(--pos)', border: '1px solid var(--pos)40' }}>
                          Pluggy
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--well)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--faint)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink-2)' }}>Fase 2:</strong> Visualização de histórico de saldo e reconciliação automática com lançamentos estarão disponíveis após a sincronização completa via Open Finance.
        </div>

      </div>
    </main>
  )
}
