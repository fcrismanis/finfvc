import { useMemo, useEffect, useState } from 'react'
import { Home } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatBRL } from '../utils/currency'
import { getLocalConnections } from '../services/pluggy.service'
import type { PluggyLocalConnection, PluggyLocalAccount } from '../services/pluggy.service'

export function PatrimonioPage() {
  const { transactions } = useData()
  const [connections, setConnections] = useState<PluggyLocalConnection[]>([])

  useEffect(() => {
    setConnections(getLocalConnections())
  }, [])

  const bankAccounts = connections.flatMap(c =>
    c.accounts
      .filter(a => a.type === 'BANK')
      .map(a => ({ ...a, connectorName: c.connectorName, connectorImageUrl: c.connectorImageUrl ?? null }))
  )

  const creditCards = connections.flatMap(c =>
    c.accounts
      .filter(a => a.type === 'CREDIT')
      .map(a => ({ ...a, connectorName: c.connectorName, connectorImageUrl: c.connectorImageUrl ?? null }))
  )

  // Net invested from transactions (aportes - resgates) — Pluggy doesn't expose investment account balances
  const investTxTotal = useMemo(() => {
    const invested = transactions.filter(tx => tx.classificationType === 'investment' && tx.status !== 'cancelled').reduce((s, tx) => s + tx.amount, 0)
    const redeemed = transactions.filter(tx => tx.classificationType === 'redemption' && tx.status !== 'cancelled').reduce((s, tx) => s + tx.amount, 0)
    return invested - redeemed
  }, [transactions])

  const totalBankBalance = bankAccounts.reduce((s, a) => s + (a.balance ?? 0), 0)
  const totalInvestBalance = investTxTotal
  const totalCreditBalance = creditCards.reduce((s, a) => s + (a.balance ?? 0), 0)

  const netWorth = totalBankBalance + totalInvestBalance - totalCreditBalance
  const hasData = bankAccounts.length > 0 || totalInvestBalance > 0

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Patrimônio</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>Visão consolidada de saldos e patrimônio líquido</div>
        </div>

        {!hasData ? (
          <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
            <Home size={32} style={{ margin: '0 auto 12px', color: 'var(--faint)' }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Conecte suas contas</p>
            <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 280, margin: '0 auto' }}>
              Saldos de contas e investimentos via Pluggy aparecerão aqui.
            </p>
          </div>
        ) : (
          <>
            {/* Net worth headline */}
            <div className="card" style={{ padding: '22px 26px', background: 'var(--ink)', color: 'white' }}>
              <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Patrimônio líquido</p>
              <p style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(netWorth)}</p>
              <p style={{ fontSize: 11.5, opacity: 0.5, marginTop: 6 }}>
                Contas ({formatBRL(totalBankBalance)}) + Invest. ({formatBRL(totalInvestBalance)}) − Cartões ({formatBRL(totalCreditBalance)})
              </p>
            </div>

            {/* Breakdown cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div className="card" style={{ padding: '16px 18px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Contas bancárias</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--pos)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(totalBankBalance)}</p>
                <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{bankAccounts.length} conta{bankAccounts.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="card" style={{ padding: '16px 18px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Investimentos</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--pos)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(totalInvestBalance)}</p>
                <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>aportado líquido via lançamentos</p>
              </div>
              {totalCreditBalance > 0 && (
                <div className="card" style={{ padding: '16px 18px', border: '1px solid var(--crit)30' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Cartões (fatura)</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--crit)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>−{formatBRL(totalCreditBalance)}</p>
                  <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{creditCards.length} cartão{creditCards.length !== 1 ? 'ões' : ''}</p>
                </div>
              )}
            </div>

            {/* Account list */}
            {bankAccounts.length > 0 && (
              <AccountList title="Contas bancárias" accounts={bankAccounts} valueColor="var(--pos)" />
            )}
            {creditCards.length > 0 && (
              <AccountList title="Cartões de crédito" accounts={creditCards} valueColor="var(--crit)" negated />
            )}
          </>
        )}

      </div>
    </main>
  )
}

function AccountList({
  title,
  accounts,
  valueColor,
  negated = false,
}: {
  title: string
  accounts: (PluggyLocalAccount & { connectorName: string; connectorImageUrl: string | null })[]
  valueColor: string
  negated?: boolean
}) {
  return (
    <div className="card" style={{ padding: '18px 22px' }}>
      <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {accounts.map(acc => (
          <div key={acc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {acc.connectorImageUrl && (
                <img src={acc.connectorImageUrl} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {acc.name}
                </p>
                <p style={{ fontSize: 11, color: 'var(--faint)' }}>{acc.connectorName}</p>
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: valueColor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {negated ? '−' : ''}{formatBRL(acc.balance ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
