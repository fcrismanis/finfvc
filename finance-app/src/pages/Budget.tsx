import { useState, useMemo } from 'react'
import { TrendingDown, Copy, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES } from '../config/categories'
import { formatBRL } from '../utils/currency'
import { formatMonthFull, prevMonth, nextMonth, currentYearMonth } from '../utils/date'
import { getMacroCategoryTotals } from '../engine/calculate'
import { suggestBudgets } from '../services/budget.service'

interface Props {
  selectedMonth: string
}

export function Budget({ selectedMonth }: Props) {
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

  // Reuse the id of an existing budget for the same month + macro/category so that
  // saveBudget upserts (both LocalProvider findIndex-by-id and Supabase natural-key)
  // instead of creating duplicates.
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
    return { macro, plannedAmount, realizedAmount, dev, devPct, status, isEditing: editingId === macroId }
  }

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-page)' }}>
      <div className="p-5 md:p-7 max-w-[920px] mx-auto w-full flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: '#101828' }}>Orçamento</h1>
            <p className="text-[13px] mt-0.5" style={{ color: '#98A2B3' }}>Planejado × realizado · {formatMonthFull(month)}</p>
          </div>
          <div className="ml-auto flex items-center gap-1 bg-white rounded-xl px-2 py-1.5" style={{ border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}>
            <button
              onClick={() => setMonth(prevMonth(month))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[130px] text-center">
              {formatMonthFull(month)}
            </span>
            <button
              onClick={() => setMonth(nextMonth(month))}
              disabled={month >= currentYearMonth()}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Summary totals */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="Planejado" value={formatBRL(totalPlanned)} color="var(--sidebar-active)" />
          <SummaryCard
            label="Realizado"
            value={formatBRL(totalRealized)}
            color={totalRealized > totalPlanned ? '#DC2626' : '#059669'}
          />
          <SummaryCard
            label="Desvio total"
            value={`${totalDev >= 0 ? '+' : ''}${formatBRL(totalDev)}`}
            color={totalDev > 0 ? '#DC2626' : '#059669'}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleCopyPrev}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition-colors"
            style={{ border: '1px solid var(--border-card)' }}
          >
            <Copy size={12} /> Copiar do mês anterior
          </button>
          <button
            onClick={handleSuggest}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition-colors"
            style={{ border: '1px solid var(--border-card)' }}
          >
            <Lightbulb size={12} /> Sugerir pela média
          </button>
        </div>

        {/* Budget table */}
        <div className="card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-card)', background: '#F8FAFC' }}>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Categoria
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Planejado
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Realizado
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Desvio
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {expenseMacros.map(macro => {
                const row = rowForMacro(macro.id)
                const barPct = row.plannedAmount > 0
                  ? Math.min((row.realizedAmount / row.plannedAmount) * 100, 130)
                  : row.realizedAmount > 0 ? 100 : 0

                return (
                  <tr
                    key={macro.id}
                    className="transition-colors hover:bg-gray-50"
                    style={{ borderBottom: '1px solid #F7F8FA' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: macro.color }}
                        />
                        <span className="font-medium text-gray-800">{macro.name}</span>
                      </div>
                      {row.realizedAmount > 0 && (
                        <div className="mt-1.5 h-1.5 w-full rounded-full overflow-hidden" style={{ background: '#EDF0F7' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barPct}%`,
                              background: row.status === 'critical' ? '#DC2626'
                                : row.status === 'warning' ? '#D97706'
                                : macro.color,
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
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
                          className="w-28 text-right border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1"
                          style={{ borderColor: 'var(--sidebar-active)' }}
                          placeholder="0,00"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(macro.id)}
                          className="font-medium tabular-nums num text-gray-700 hover:text-indigo-600 transition-colors"
                          title="Clique para editar"
                        >
                          {row.plannedAmount > 0
                            ? formatBRL(row.plannedAmount)
                            : <span className="text-gray-300">—</span>}
                        </button>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-semibold tabular-nums num"
                      style={{ color: macro.color }}
                    >
                      {row.realizedAmount > 0 ? formatBRL(row.realizedAmount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums num">
                      {row.plannedAmount > 0 && row.realizedAmount > 0 ? (
                        <div className={`font-semibold ${
                          row.status === 'critical' ? 'text-red-600'
                          : row.status === 'warning' ? 'text-amber-600'
                          : 'text-green-600'
                        }`}>
                          {row.dev > 0 ? '+' : ''}{formatBRL(row.dev)}
                          <span className="text-gray-400 font-normal ml-1 text-[10px]">
                            ({row.devPct > 0 ? '+' : ''}{row.devPct.toFixed(0)}%)
                          </span>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 w-6">
                      {row.status === 'critical' && <TrendingDown size={13} color="#DC2626" />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-gray-400 pb-4">
          Clique no valor planejado para editar — Enter para confirmar, Esc para cancelar.
        </p>
      </div>
    </main>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      <p className="text-xl font-bold tabular-nums num tracking-tight" style={{ color }}>{value}</p>
    </div>
  )
}
