import { useState, useMemo } from 'react'
import { Lock, Unlock, CheckSquare, Square, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatBRL, formatPct } from '../utils/currency'
import { formatMonthFull, prevMonth, nextMonth, currentYearMonth } from '../utils/date'
import { getMonthSummary, getBudgetComparison, getRedemptionTotal } from '../engine/calculate'
import { getClosing, saveClosing, closeMonth, reopenMonth, CHECKLIST_ITEMS } from '../services/closing.service'

interface Props {
  selectedMonth: string
}

export function Closing({ selectedMonth }: Props) {
  const { transactions, budgets } = useData()
  const [month, setMonth] = useState(selectedMonth)
  const [closing, setClosing] = useState(() => getClosing(month))
  const [notes, setNotes] = useState(() => getClosing(month).notes)
  const [notesEdited, setNotesEdited] = useState(false)

  function loadClosing(m: string) {
    const c = getClosing(m)
    setClosing(c)
    setNotes(c.notes)
    setNotesEdited(false)
  }

  function changeMonth(m: string) {
    setMonth(m)
    loadClosing(m)
  }

  const summary = useMemo(() => getMonthSummary(transactions, month, budgets), [transactions, month, budgets])
  const comparison = useMemo(() => getBudgetComparison(transactions, month, budgets), [transactions, month, budgets])
  const redemption = useMemo(() => getRedemptionTotal(transactions, month), [transactions, month])
  const debtTotal = useMemo(() =>
    transactions
      .filter(t => t.classificationType === 'debt_cost' && t.competenceDate.startsWith(month))
      .reduce((s, t) => s + t.amount, 0)
  , [transactions, month])

  const investmentTotal = useMemo(() =>
    transactions
      .filter(t => t.classificationType === 'investment' && t.competenceDate.startsWith(month))
      .reduce((s, t) => s + t.amount, 0)
  , [transactions, month])

  function toggleChecklist(id: string) {
    if (closing.isClosed) return
    const updated = { ...closing, checklist: { ...closing.checklist, [id]: !closing.checklist[id] } }
    setClosing(updated)
    saveClosing(updated)
  }

  function handleClose() {
    closeMonth(month)
    loadClosing(month)
  }

  function handleReopen() {
    reopenMonth(month)
    loadClosing(month)
  }

  function saveNotes() {
    const updated = { ...closing, notes }
    setClosing(updated)
    saveClosing(updated)
    setNotesEdited(false)
  }

  const checklistDone = Object.values(closing.checklist).filter(Boolean).length
  const checklistTotal = CHECKLIST_ITEMS.length
  const allDone = checklistDone === checklistTotal

  const topDeviations = comparison.filter(c => Math.abs(c.deviationPct) > 5).slice(0, 5)

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 p-5">
      <div className="max-w-[860px] mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${closing.isClosed ? 'bg-gray-100' : 'bg-indigo-50'}`}>
            {closing.isClosed ? <Lock size={20} color="#6B7280" /> : <Unlock size={20} color="#4F46E5" />}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Fechamento mensal</h1>
            <p className="text-xs text-gray-500">{closing.isClosed ? `Fechado em ${new Date(closing.closedAt!).toLocaleDateString('pt-BR')}` : 'Aberto'}</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => changeMonth(prevMonth(month))} className="p-1 rounded hover:bg-white"><ChevronLeft size={16} color="#6B7280" /></button>
            <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">{formatMonthFull(month)}</span>
            <button onClick={() => changeMonth(nextMonth(month))} disabled={month >= currentYearMonth()} className="p-1 rounded hover:bg-white disabled:opacity-40"><ChevronRight size={16} color="#6B7280" /></button>
          </div>
        </div>

        {/* Closed banner */}
        {closing.isClosed && (
          <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600">
            <Lock size={12} />
            Mês fechado. Alterações nos dados mostrarão um aviso.
            <button onClick={handleReopen} className="ml-auto flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium">
              <Unlock size={11} /> Reabrir
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Checklist */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800">Checklist</p>
              <span className="text-xs text-gray-500">{checklistDone}/{checklistTotal}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full mb-3">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(checklistDone/checklistTotal)*100}%` }} />
            </div>
            {CHECKLIST_ITEMS.map(item => {
              const done = !!closing.checklist[item.id]
              return (
                <button
                  key={item.id}
                  onClick={() => toggleChecklist(item.id)}
                  disabled={closing.isClosed}
                  className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg text-left transition-colors ${done ? 'text-green-700' : 'text-gray-600'} ${closing.isClosed ? '' : 'hover:bg-gray-50'}`}
                >
                  {done ? <CheckSquare size={14} color="#16A34A" /> : <Square size={14} color="#D1D5DB" />}
                  {item.label}
                </button>
              )
            })}
          </div>

          {/* Month summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800 mb-3">Resumo do mês</p>
            <SummaryRow label="Receita operacional" value={formatBRL(summary.operationalIncome)} color="#16A34A" />
            <SummaryRow label="Despesas operacionais" value={formatBRL(summary.totalExpenses)} color="#DC2626" />
            <SummaryRow
              label="Resultado operacional"
              value={formatBRL(summary.operationalResult)}
              color={summary.operationalResult >= 0 ? '#16A34A' : '#DC2626'}
              bold
            />
            <SummaryRow label="Taxa de sobra" value={formatPct(summary.savingsRate * 100)} color="#4F46E5" />
            <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
              <SummaryRow label="Total investimentos" value={formatBRL(investmentTotal)} color="#6B7280" />
              <SummaryRow label="Total resgates" value={formatBRL(redemption)} color="#6B7280" />
              <SummaryRow label="Total dívidas/juros" value={formatBRL(debtTotal)} color="#991B1B" />
              <SummaryRow label="Pendentes futuros" value={formatBRL(summary.pendingAmount)} color="#D97706" />
            </div>
          </div>
        </div>

        {/* Top deviations */}
        {topDeviations.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">Maiores desvios vs orçamento</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-1.5 font-medium">Categoria</th>
                  <th className="text-right pb-1.5 font-medium">Planejado</th>
                  <th className="text-right pb-1.5 font-medium">Realizado</th>
                  <th className="text-right pb-1.5 font-medium">Desvio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topDeviations.map(d => (
                  <tr key={d.macroCategoryId}>
                    <td className="py-1.5 text-gray-700">{d.name}</td>
                    <td className="py-1.5 text-right text-gray-500 tabular-nums">{formatBRL(d.planned)}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums" style={{ color: d.color }}>{formatBRL(d.realized)}</td>
                    <td className={`py-1.5 text-right font-medium tabular-nums ${d.deviationRs > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {d.deviationRs > 0 ? '+' : ''}{formatBRL(d.deviationRs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">Aprendizados do mês</p>
          <textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setNotesEdited(true) }}
            disabled={closing.isClosed}
            placeholder={`O que pesou este mês?\nO que melhorou?\nDecisão para o próximo mês?`}
            rows={5}
            className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-400"
          />
          {notesEdited && !closing.isClosed && (
            <button onClick={saveNotes} className="mt-2 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
              Salvar observações
            </button>
          )}
        </div>

        {/* Close / reopen */}
        {!closing.isClosed && (
          <div className="flex items-center gap-3 pb-4">
            <button
              onClick={handleClose}
              disabled={!allDone}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gray-700 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Lock size={14} /> Fechar mês
            </button>
            {!allDone && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <AlertTriangle size={11} /> Complete o checklist para fechar
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function SummaryRow({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between items-center text-xs ${bold ? 'font-semibold border-t border-gray-100 pt-2' : ''}`}>
      <span className={bold ? 'text-gray-800' : 'text-gray-500'}>{label}</span>
      <span className="tabular-nums font-medium" style={{ color }}>{value}</span>
    </div>
  )
}
