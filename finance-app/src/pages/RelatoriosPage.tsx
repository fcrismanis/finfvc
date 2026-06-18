import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useData } from '../context/DataContext'
import { getAllMacroCategories } from '../services/financeParentCategories.service'
import { formatBRL } from '../utils/currency'
import { getLast6Months, formatMonthLabel, prevMonth, nextMonth, currentYearMonth } from '../utils/date'
import { getCompetenceMonth } from '../utils/date'
import { getLocalConnections } from '../services/pluggy.service'

interface Props {
  selectedMonth: string
}

function txInMonth(tx: { competenceDate: string; status: string }, m: string) {
  return getCompetenceMonth(tx.competenceDate) === m && tx.status !== 'cancelled'
}

export function RelatoriosPage({ selectedMonth }: Props) {
  const { transactions, budgets } = useData()
  const [refMonth, setRefMonth] = useState(selectedMonth)

  const months = useMemo(() => getLast6Months(refMonth).slice(0, 6).reverse(), [refMonth])

  const expenseMacros = useMemo(
    () => getAllMacroCategories().filter(m =>
      ['operational_expense', 'debt_cost'].includes(m.classificationType)
    ),
    []
  )

  const tableData = useMemo(() => {
    return expenseMacros.map(macro => {
      const cols = months.map(m => {
        const realized = transactions
          .filter(tx => txInMonth(tx, m) && tx.macroCategoryId === macro.id && tx.includeInBudget && tx.type === 'expense')
          .reduce((s, tx) => s + tx.amount, 0)
        const budget = budgets.find(b => b.referenceMonth.startsWith(m) && b.macroCategoryId === macro.id)
        const planned = budget?.plannedAmount ?? 0
        const pct = planned > 0 ? (realized / planned) * 100 : null
        const over = planned > 0 && realized > planned
        return { realized, planned, pct, over }
      })
      const totalRealized = cols.reduce((s, c) => s + c.realized, 0)
      if (totalRealized === 0 && cols.every(c => c.planned === 0)) return null
      return { macro, cols, totalRealized }
    }).filter(Boolean) as { macro: (typeof expenseMacros)[0]; cols: { realized: number; planned: number; pct: number | null; over: boolean }[]; totalRealized: number }[]
  }, [expenseMacros, months, transactions, budgets])  // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => months.map((_m, mi) => {
    const realized = tableData.reduce((s, row) => s + row.cols[mi].realized, 0)
    const planned = tableData.reduce((s, row) => s + row.cols[mi].planned, 0)
    return { realized, planned }
  }), [tableData, months])

  const canGoNext = refMonth < currentYearMonth()

  // ── Cartões section ──────────────────────────────────────────────────────────
  const creditCards = useMemo(() => {
    return getLocalConnections().flatMap(c =>
      c.accounts
        .filter(a => a.type === 'CREDIT')
        .map(a => ({ id: a.id, name: a.displayName ?? a.name }))
    )
  }, [])

  const cardData = useMemo(() => {
    return creditCards.map(card => {
      const cols = months.map(m => {
        const spent = transactions
          .filter(tx =>
            txInMonth(tx, m) &&
            tx.accountId === card.id &&
            tx.type === 'expense' &&
            tx.classificationType !== 'transfer'
          )
          .reduce((s, tx) => s + tx.amount, 0)
        return spent
      })
      const total = cols.reduce((s, v) => s + v, 0)
      return { card, cols, total }
    }).filter(r => r.total > 0)
  }, [creditCards, months, transactions])

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Relatórios</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>Orçado × realizado por categoria — últimos 6 meses</div>
          </div>
          <div className="month-nav">
            <button className="btn-ghost" style={{ width: 26, height: 26 }} onClick={() => setRefMonth(prevMonth(refMonth))}>
              <ChevronLeft size={14} />
            </button>
            <span className="m">{formatMonthLabel(refMonth)}</span>
            <button className="btn-ghost" style={{ width: 26, height: 26, opacity: canGoNext ? 1 : 0.3 }}
              onClick={() => canGoNext && setRefMonth(nextMonth(refMonth))} disabled={!canGoNext}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                <th className="table-th" style={{ minWidth: 160, textAlign: 'left' }}>Categoria</th>
                {months.map(m => (
                  <th key={m} className="table-th" style={{ textAlign: 'right', minWidth: 120, whiteSpace: 'nowrap' }}>
                    {formatMonthLabel(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map(({ macro, cols }) => (
                <tr key={macro.id} className="table-row">
                  <td className="table-td">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: macro.color, flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{macro.name}</span>
                    </span>
                  </td>
                  {cols.map((c, mi) => (
                    <td key={mi} className="table-td" style={{ textAlign: 'right', verticalAlign: 'top' }}>
                      {c.realized === 0 && c.planned === 0 ? (
                        <span style={{ color: 'var(--faint)', fontSize: 11 }}>—</span>
                      ) : (
                        <div>
                          <div style={{
                            fontSize: 12.5, fontWeight: 700,
                            color: c.over ? 'var(--crit)' : 'var(--ink)',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {formatBRL(c.realized)}
                          </div>
                          {c.planned > 0 && (
                            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                              / {formatBRL(c.planned)}
                              {c.pct !== null && (
                                <span style={{
                                  marginLeft: 4, fontWeight: 700,
                                  color: c.over ? 'var(--crit)' : c.pct > 75 ? 'var(--warn)' : 'var(--pos)',
                                }}>
                                  {c.pct.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          )}
                          {c.planned === 0 && c.realized > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 1 }}>sem plano</div>
                          )}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Totals row */}
              <tr style={{ background: 'var(--well)', borderTop: '2px solid var(--line)' }}>
                <td className="table-td" style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--ink)' }}>Total Despesas</td>
                {totals.map((t, mi) => (
                  <td key={mi} className="table-td" style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatBRL(t.realized)}
                    </div>
                    {t.planned > 0 && (
                      <div style={{ fontSize: 10.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
                        / {formatBRL(t.planned)}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>
          Realizado em <strong style={{ color: 'var(--ink-2)' }}>preto</strong> · orçado abaixo em cinza · <span style={{ color: 'var(--crit)', fontWeight: 600 }}>vermelho</span> = estouro · percentual = realizado/orçado
        </div>

        {/* ── Cartões ── */}
        {cardData.length > 0 && (
          <>
            <div style={{ marginTop: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--ink)', marginBottom: 4 }}>Cartões</h2>
              <div style={{ fontSize: 13, color: 'var(--faint)' }}>Gastos por cartão — últimos 6 meses (excluindo pagamentos de fatura)</div>
            </div>
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                    <th className="table-th" style={{ minWidth: 160, textAlign: 'left' }}>Cartão</th>
                    {months.map(m => (
                      <th key={m} className="table-th" style={{ textAlign: 'right', minWidth: 110, whiteSpace: 'nowrap' }}>
                        {formatMonthLabel(m)}
                      </th>
                    ))}
                    <th className="table-th" style={{ textAlign: 'right', minWidth: 110 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cardData.map(({ card, cols, total }) => (
                    <tr key={card.id} className="table-row">
                      <td className="table-td">
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{card.name}</span>
                      </td>
                      {cols.map((v, mi) => (
                        <td key={mi} className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {v > 0
                            ? <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--crit)' }}>{formatBRL(v)}</span>
                            : <span style={{ fontSize: 11, color: 'var(--faint)' }}>—</span>
                          }
                        </td>
                      ))}
                      <td className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>{formatBRL(total)}</span>
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr style={{ background: 'var(--well)', borderTop: '2px solid var(--line)' }}>
                    <td className="table-td" style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--ink)' }}>Total Cartões</td>
                    {months.map((_m, mi) => {
                      const col = cardData.reduce((s, r) => s + r.cols[mi], 0)
                      return (
                        <td key={mi} className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>{col > 0 ? formatBRL(col) : '—'}</span>
                        </td>
                      )
                    })}
                    <td className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>
                        {formatBRL(cardData.reduce((s, r) => s + r.total, 0))}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </main>
  )
}
