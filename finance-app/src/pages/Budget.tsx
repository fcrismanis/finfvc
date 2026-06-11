import { useState, useMemo } from 'react'
import { Target, TrendingDown, Copy, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES } from '../config/categories'
import { formatBRL } from '../utils/currency'
import { formatMonthFull, prevMonth, nextMonth, currentYearMonth } from '../utils/date'
import { getMacroCategoryTotals } from '../engine/calculate'
import {
  upsertMacroBudget, copyBudgetFromMonth, suggestBudgets, getPrevMonthBudgets,
} from '../services/budget.service'

interface Props {
  selectedMonth: string
}

export function Budget({ selectedMonth }: Props) {
  const { transactions, budgets, reload, saveBudget } = useData()
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

  function saveEdit(macroCategoryId: string) {
    const val = parseFloat(editValue.replace(',', '.'))
    if (!isNaN(val) && val >= 0) {
      upsertMacroBudget(month, macroCategoryId, val)
      reload()
    }
    setEditingId(null)
  }

  function handleCopyPrev() {
    const prev = prevMonth(month)
    const prevBudgets = getPrevMonthBudgets(month)
    if (prevBudgets.length === 0) {
      alert(`Nenhum orçamento salvo em ${prev} para copiar.`)
      return
    }
    copyBudgetFromMonth(prev, month)
    reload()
  }

  function handleSuggest() {
    const suggestions = suggestBudgets(transactions, month)
    for (const s of suggestions) {
      saveBudget(s)
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
    <main className="flex-1 overflow-y-auto bg-gray-50 p-5">
      <div className="max-w-[860px] mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50">
            <Target size={20} color="#4F46E5" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Orçamento</h1>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setMonth(prevMonth(month))} className="p-1 rounded hover:bg-white"><ChevronLeft size={16} color="#6B7280" /></button>
            <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">{formatMonthFull(month)}</span>
            <button onClick={() => setMonth(nextMonth(month))} disabled={month >= currentYearMonth()} className="p-1 rounded hover:bg-white disabled:opacity-40"><ChevronRight size={16} color="#6B7280" /></button>
          </div>
        </div>

        {/* Summary totals */}
        <div className="grid grid-cols-3 gap-3">
          <Card label="Planejado" value={formatBRL(totalPlanned)} color="#4F46E5" />
          <Card label="Realizado" value={formatBRL(totalRealized)} color={totalRealized > totalPlanned ? '#DC2626' : '#16A34A'} />
          <Card label="Desvio" value={`${totalDev >= 0 ? '+' : ''}${formatBRL(totalDev)}`} color={totalDev > 0 ? '#DC2626' : '#16A34A'} />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={handleCopyPrev} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <Copy size={12} /> Copiar do mês anterior
          </button>
          <button onClick={handleSuggest} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <Lightbulb size={12} /> Sugerir pela média
          </button>
        </div>

        {/* Budget table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                <th className="text-left px-3 py-2.5 font-medium">Categoria</th>
                <th className="text-right px-3 py-2.5 font-medium">Planejado</th>
                <th className="text-right px-3 py-2.5 font-medium">Realizado</th>
                <th className="text-right px-3 py-2.5 font-medium">Desvio</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenseMacros.map(macro => {
                const row = rowForMacro(macro.id)
                const barPct = row.plannedAmount > 0
                  ? Math.min((row.realizedAmount / row.plannedAmount) * 100, 130)
                  : row.realizedAmount > 0 ? 100 : 0

                return (
                  <tr key={macro.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: macro.color }} />
                        <span className="font-medium text-gray-800">{macro.name}</span>
                      </div>
                      {row.realizedAmount > 0 && (
                        <div className="mt-1 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barPct}%`,
                              background: row.status === 'critical' ? '#DC2626' : row.status === 'warning' ? '#D97706' : macro.color,
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {row.isEditing ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(macro.id)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(macro.id); if (e.key === 'Escape') setEditingId(null) }}
                          className="w-28 text-right border border-indigo-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                          placeholder="0,00"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(macro.id)}
                          className="text-gray-700 hover:text-indigo-600 font-medium tabular-nums"
                          title="Clique para editar"
                        >
                          {row.plannedAmount > 0 ? formatBRL(row.plannedAmount) : <span className="text-gray-300">—</span>}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums" style={{ color: macro.color }}>
                      {row.realizedAmount > 0 ? formatBRL(row.realizedAmount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.plannedAmount > 0 && row.realizedAmount > 0 ? (
                        <div className={`font-medium ${row.status === 'critical' ? 'text-red-600' : row.status === 'warning' ? 'text-amber-600' : 'text-green-600'}`}>
                          {row.dev > 0 ? '+' : ''}{formatBRL(row.dev)}
                          <span className="text-gray-400 font-normal ml-1">({row.devPct > 0 ? '+' : ''}{row.devPct.toFixed(0)}%)</span>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.status === 'critical' && <TrendingDown size={12} color="#DC2626" />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 pb-4">Clique no valor planejado para editar. Enter para confirmar, Esc para cancelar.</p>
      </div>
    </main>
  )
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  )
}
