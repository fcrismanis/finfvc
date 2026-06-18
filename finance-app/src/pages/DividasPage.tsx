import { useMemo } from 'react'
import { CreditCard } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatBRL } from '../utils/currency'
import { getCompetenceMonth } from '../utils/date'
import { currentYearMonth } from '../utils/date'

function fmtDate(d: string) {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return d }
}

export function DividasPage() {
  const { transactions } = useData()

  const debtTxs = useMemo(() =>
    transactions
      .filter(tx => tx.classificationType === 'debt_cost' && tx.status !== 'cancelled')
      .sort((a, b) => b.competenceDate.localeCompare(a.competenceDate)),
    [transactions]
  )

  const currentMonth = currentYearMonth()
  const thisMonth = debtTxs.filter(tx => getCompetenceMonth(tx.competenceDate) === currentMonth)
  const pendingTxs = debtTxs.filter(tx => tx.status === 'pending')
  const totalDebt = debtTxs.reduce((s, tx) => s + tx.amount, 0)
  const totalPending = pendingTxs.reduce((s, tx) => s + tx.amount, 0)
  const totalThisMonth = thisMonth.reduce((s, tx) => s + tx.amount, 0)

  // Group installments by description stem
  const installmentGroups = useMemo(() => {
    const pending = debtTxs.filter(tx => tx.installmentTotal && tx.installmentTotal > 1)
    const map = new Map<string, typeof pending>()
    for (const tx of pending) {
      const key = tx.description.replace(/\s*\d+\/\d+\s*$/, '').trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(tx)
    }
    return Array.from(map.entries())
      .map(([name, txs]) => ({
        name,
        txs: txs.sort((a, b) => (a.installmentCurrent ?? 0) - (b.installmentCurrent ?? 0)),
        total: txs.reduce((s, t) => s + t.amount, 0),
        maxInstallment: Math.max(...txs.map(t => t.installmentTotal ?? 1)),
      }))
      .filter(g => g.txs.length > 0)
      .sort((a, b) => b.total - a.total)
  }, [debtTxs])

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Dívidas</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>Custo de dívida e parcelamentos nos lançamentos</div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="card" style={{ padding: '16px 18px', border: totalThisMonth > 0 ? '1px solid var(--crit)40' : undefined }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Este mês</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: totalThisMonth > 0 ? 'var(--crit)' : 'var(--ink)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
              {formatBRL(totalThisMonth)}
            </p>
          </div>
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Pendente</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: totalPending > 0 ? 'var(--warn)' : 'var(--ink)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
              {formatBRL(totalPending)}
            </p>
          </div>
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Total histórico</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
              {formatBRL(totalDebt)}
            </p>
          </div>
        </div>

        {debtTxs.length === 0 ? (
          <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
            <CreditCard size={32} style={{ margin: '0 auto 12px', color: 'var(--pos)' }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Sem dívidas registradas</p>
            <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 280, margin: '0 auto' }}>
              Lançamentos classificados como "Custo de dívida" aparecem aqui.
            </p>
          </div>
        ) : (
          <>
            {/* Installment groups */}
            {installmentGroups.length > 0 && (
              <div className="card" style={{ padding: '18px 22px' }}>
                <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Parcelamentos ativos</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {installmentGroups.map(group => {
                    const lastTx = group.txs[group.txs.length - 1]
                    const current = lastTx?.installmentCurrent ?? 0
                    const total = group.maxInstallment
                    const pct = total > 0 ? (current / total) * 100 : 0
                    return (
                      <div key={group.name}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <div>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{group.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--faint)', marginLeft: 8 }}>{current}/{total} parcelas</span>
                          </div>
                          <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                            {formatBRL(lastTx?.amount ?? 0)}/mês
                          </span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: 'var(--well)' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: 'var(--accent)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Pending debts */}
            {pendingTxs.length > 0 && (
              <div className="card" style={{ padding: '18px 22px', border: '1px solid var(--warn)30' }}>
                <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Pendentes a pagar</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingTxs.map(tx => (
                    <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{tx.description}</span>
                        <span style={{ fontSize: 11, color: 'var(--faint)', marginLeft: 8 }}>{fmtDate(tx.competenceDate)}</span>
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--crit)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatBRL(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full list */}
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Histórico de dívidas</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--well)' }}>
                    <th className="table-th">Descrição</th>
                    <th className="table-th">Data</th>
                    <th className="table-th" style={{ textAlign: 'right' }}>Valor</th>
                    <th className="table-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {debtTxs.slice(0, 50).map(tx => (
                    <tr key={tx.id} className="table-row">
                      <td className="table-td" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                        {tx.description}
                        {tx.installmentCurrent && tx.installmentTotal && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, marginLeft: 6, padding: '1px 5px', borderRadius: 3, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                            {tx.installmentCurrent}/{tx.installmentTotal}
                          </span>
                        )}
                      </td>
                      <td className="table-td" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{fmtDate(tx.competenceDate)}</td>
                      <td className="table-td" style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: 'var(--crit)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatBRL(tx.amount)}
                      </td>
                      <td className="table-td">
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: tx.status === 'pending' ? 'var(--warn-soft, #fef3c7)' : 'var(--well)',
                          color: tx.status === 'pending' ? 'var(--warn)' : 'var(--faint)',
                        }}>
                          {tx.status === 'pending' ? 'pendente' : 'pago'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </main>
  )
}
