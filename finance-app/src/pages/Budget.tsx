import { useState, useMemo } from 'react'
import { TrendingDown, Copy, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES } from '../config/categories'
import { formatBRL } from '../utils/currency'
import { formatMonthFull, prevMonth, nextMonth, currentYearMonth } from '../utils/date'
import { getMacroCategoryTotals } from '../engine/calculate'
import { suggestBudgets } from '../services/budget.service'
import type { NavFilter } from '../App'

interface Props {
  selectedMonth: string
  onNavigate?: (route: string, filter?: NavFilter) => void
}

export function Budget({ selectedMonth, onNavigate }: Props) {
  const { transactions, budgets, saveBudget } = useData()
  const [month, setMonth] = useState(selectedMonth)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const expenseMacros = MACRO_CATEGORIES.filter(m =>
    ['operational_expense', 'debt_cost'].includes(m.classificationType)
  )

  const realized = useMemo(() =>
    getMacroCategoryTotals(transactions, month),
    [transactions, month]
  )

  const monthBudgets = useMemo(() =>
    budgets.filter(b => b.referenceMonth === month && !b.categoryId),
    [budgets, month]
  )

  const totalPlanned = monthBudgets.reduce((s, b) => s + b.plannedAmount, 0)
  const totalRealized = realized.reduce((s, m) => s + m.total, 0)
  const totalDev = totalRealized - totalPlanned

  function startEdit(macroCategoryId: string) {
    const existing = monthBudgets.find(b => b.macroCategoryId === macroCategoryId)
    setEditingId(macroCategoryId)
    setEditValue(existing ? String(existing.plannedAmount) : '')
  }

  function budgetIdFor(macroCategoryId: string | undefined, categoryId: string | undefined): string {
    const existing = budgets.find(b =>
      b.referenceMonth === month && b.macroCategoryId === macroCategoryId && b.categoryId === categoryId
    )
    return existing?.id ?? `bud_${month}_${macroCategoryId ?? categoryId ?? Date.now()}`
  }

  function saveEdit(macroCategoryId: string) {
    const val = parseFloat(editValue.replace(',', '.'))
    if (!isNaN(val) && val >= 0) {
      saveBudget({
        id: budgetIdFor(macroCategoryId, undefined),
        referenceMonth: month,
        macroCategoryId,
        plannedAmount: val,
      })
    }
    setEditingId(null)
  }

  function handleCopyPrev() {
    const prev = prevMonth(month)
    const prevBudgets = budgets.filter(b => b.referenceMonth === prev)
    if (prevBudgets.length === 0) {
      alert(`Nenhum orçamento salvo em ${prev} para copiar.`)
      return
    }
    for (const b of prevBudgets) {
      saveBudget({
        ...b,
        id: budgetIdFor(b.macroCategoryId, b.categoryId),
        referenceMonth: month,
      })
    }
  }

  function handleSuggest() {
    const suggestions = suggestBudgets(transactions, month)
    for (const s of suggestions) {
      saveBudget({ ...s, id: budgetIdFor(s.macroCategoryId, s.categoryId) })
    }
  }

  function rowForMacro(macroId: string) {
    const macro = MACRO_CATEGORIES.find(m => m.id === macroId)!
    const budget = monthBudgets.find(b => b.macroCategoryId === macroId)
    const realizedRow = realized.find(r => r.macroCategoryId === macroId)
    const plannedAmount = budget?.plannedAmount ?? 0
    const realizedAmount = realizedRow?.total ?? 0
    const dev = realizedAmount - plannedAmount
    const devPct = plannedAmount > 0 ? (dev / plannedAmount) * 100 : 0
    let status: 'ok' | 'warning' | 'critical' | 'no_budget' = 'no_budget'
    if (plannedAmount > 0) {
      if (devPct > 40) status = 'critical'
      else if (devPct > 20) status = 'warning'
      else status = 'ok'
    }
    const avgLast3m = realizedRow?.avgLast3m ?? 0
    return { macro, plannedAmount, realizedAmount, dev, devPct, status, isEditing: editingId === macroId, avgLast3m }
  }

  const devColor = totalDev > 0 ? 'var(--crit)' : 'var(--pos)'

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Orçamento</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
              Planejado × realizado · {formatMonthFull(month)}
            </div>
          </div>
          <div className="month-nav">
            <button className="btn-ghost" style={{ width: 26, height: 26 }} onClick={() => setMonth(prevMonth(month))}>
              <ChevronLeft size={14} />
            </button>
            <span className="m">{formatMonthFull(month)}</span>
            <button
              className="btn-ghost"
              style={{ width: 26, height: 26, opacity: month >= currentYearMonth() ? 0.3 : 1 }}
              onClick={() => setMonth(nextMonth(month))}
              disabled={month >= currentYearMonth()}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="stats-grid-3">
          <BudgetSummaryCard label="Planejado" value={formatBRL(totalPlanned)} color="var(--ink)" />
          <BudgetSummaryCard
            label="Realizado"
            value={formatBRL(totalRealized)}
            color={totalRealized > totalPlanned ? 'var(--crit)' : 'var(--pos)'}
          />
          <BudgetSummaryCard
            label="Desvio total"
            value={`${totalDev >= 0 ? '+' : ''}${formatBRL(totalDev)}`}
            color={devColor}
            soft={totalDev <= 0}
          />
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleCopyPrev}>
            <Copy size={12} /> Copiar do mês anterior
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleSuggest}>
            <Lightbulb size={12} /> Sugerir pela média
          </button>
        </div>

        {/* ── Budget table ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 540 }}>
              <thead>
                <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                  <th className="table-th">Categoria</th>
                  <th className="table-th table-th-right">Média 3m</th>
                  <th className="table-th table-th-right">Planejado</th>
                  <th className="table-th table-th-right">Realizado</th>
                  <th className="table-th table-th-right">Desvio</th>
                  <th style={{ width: 28 }} />
                </tr>
              </thead>
              <tbody>
                {expenseMacros.map(macro => {
                  const row = rowForMacro(macro.id)
                  const barPct = row.plannedAmount > 0
                    ? Math.min((row.realizedAmount / row.plannedAmount) * 100, 130)
                    : row.realizedAmount > 0 ? 100 : 0
                  const barColor = row.status === 'critical' ? 'var(--crit)'
                    : row.status === 'warning' ? 'var(--warn)'
                    : macro.color

                  return (
                    <tr key={macro.id} className="table-row">
                      <td className="table-td">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: macro.color }} />
                          {onNavigate ? (
                            <button
                              onClick={() => onNavigate('/lancamentos', { macroCategoryIds: [macro.id], filterLabel: macro.name, sourcePage: 'budget', sourceLabel: 'Orçamento' })}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12.5, color: 'var(--ink)', fontFamily: 'var(--ui)', padding: 0, textAlign: 'left' }}
                              title="Ver lançamentos desta categoria"
                            >
                              {macro.name}
                            </button>
                          ) : (
                            <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{macro.name}</span>
                          )}
                        </div>
                        {row.realizedAmount > 0 && (
                          <div className="bbar" style={{ marginTop: 6, width: '100%' }}>
                            <i style={{ width: `${barPct}%`, background: barColor }} />
                          </div>
                        )}
                      </td>
                      <td className="table-td table-th-right" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--faint)' }}>
                        {row.avgLast3m > 0 ? formatBRL(row.avgLast3m) : <span style={{ color: 'var(--line)' }}>—</span>}
                      </td>
                      <td className="table-td table-th-right">
                        {row.isEditing ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(macro.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(macro.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            style={{ width: 112, textAlign: 'right', border: '1px solid var(--ink)', borderRadius: 6, padding: '3px 7px', fontSize: 12, fontFamily: 'var(--mono)', outline: 'none', background: 'var(--card-bg)', color: 'var(--ink)' }}
                            placeholder="0,00"
                          />
                        ) : (
                          <button
                            onClick={() => startEdit(macro.id)}
                            title="Clique para editar"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}
                          >
                            {row.plannedAmount > 0
                              ? formatBRL(row.plannedAmount)
                              : <span style={{ color: 'var(--line)' }}>—</span>}
                          </button>
                        )}
                      </td>
                      <td
                        className="table-td table-th-right"
                        style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: macro.color, fontFamily: 'var(--mono)', fontSize: 12.5 }}
                      >
                        {row.realizedAmount > 0 ? formatBRL(row.realizedAmount) : <span style={{ color: 'var(--line)' }}>—</span>}
                      </td>
                      <td className="table-td table-th-right" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        {row.plannedAmount > 0 && row.realizedAmount > 0 ? (
                          <div style={{ fontWeight: 700, color: row.status === 'critical' ? 'var(--crit)' : row.status === 'warning' ? 'var(--warn)' : 'var(--pos)' }}>
                            {row.dev > 0 ? '+' : ''}{formatBRL(row.dev)}
                            <span style={{ color: 'var(--faint)', fontWeight: 400, marginLeft: 4, fontSize: 10 }}>
                              ({row.devPct > 0 ? '+' : ''}{row.devPct.toFixed(0)}%)
                            </span>
                          </div>
                        ) : <span style={{ color: 'var(--line)' }}>—</span>}
                      </td>
                      <td className="table-td" style={{ textAlign: 'center' }}>
                        {row.status === 'critical' && <TrendingDown size={13} color="var(--crit)" />}
                      </td>
                    </tr>
                  )
                })}
                {(() => {
                  const uncatRow = realized.find(r => r.macroCategoryId === 'mac_uncat')
                  if (!uncatRow || uncatRow.total === 0) return null
                  return (
                    <tr key="mac_uncat" className="table-row" style={{ opacity: 0.8 }}>
                      <td className="table-td">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: '#9CA3AF' }} />
                          {onNavigate ? (
                            <button
                              onClick={() => onNavigate('/lancamentos', { filterLabel: 'A classificar', sourcePage: 'budget', sourceLabel: 'Orçamento' })}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12.5, color: 'var(--faint)', fontFamily: 'var(--ui)', padding: 0, textAlign: 'left' }}
                            >
                              A classificar
                            </button>
                          ) : (
                            <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--faint)' }}>A classificar</span>
                          )}
                        </div>
                        <div className="bbar" style={{ marginTop: 6, width: '100%' }}>
                          <i style={{ width: '100%', background: '#9CA3AF' }} />
                        </div>
                      </td>
                      <td className="table-td table-th-right" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--faint)' }}>—</td>
                      <td className="table-td table-th-right">
                        <span style={{ color: 'var(--line)', fontFamily: 'var(--mono)', fontSize: 12.5 }}>—</span>
                      </td>
                      <td className="table-td table-th-right" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#9CA3AF', fontFamily: 'var(--mono)', fontSize: 12.5 }}>
                        {formatBRL(uncatRow.total)}
                      </td>
                      <td className="table-td table-th-right">
                        <span style={{ fontSize: 10, color: 'var(--faint)', fontStyle: 'italic' }}>sem meta</span>
                      </td>
                      <td className="table-td" />
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'var(--faint)', paddingBottom: 16 }}>
          Clique no valor planejado para editar — Enter para confirmar, Esc para cancelar.
        </p>
      </div>
    </main>
  )
}

function BudgetSummaryCard({ label, value, color, soft }: { label: string; value: string; color: string; soft?: boolean }) {
  return (
    <div className="card" style={{ padding: '14px 18px', ...(soft ? { background: 'var(--accent-soft)' } : {}) }}>
      <span className="eyebrow" style={{ display: 'block', marginBottom: 7 }}>{label}</span>
      <p className="num" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', color }}>{value}</p>
    </div>
  )
}
