import { useState, useMemo } from 'react'
import { Lock, Unlock, CheckSquare, Square, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
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
    <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-page)' }}>
      <div className="p-5 md:p-7 max-w-[920px] mx-auto w-full flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight flex items-center gap-2.5" style={{ color: '#101828' }}>
              {closing.isClosed
                ? <Lock size={22} color="#16A34A" />
                : <Unlock size={22} color="var(--sidebar-active)" />}
              Fechamento
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: '#98A2B3' }}>
              {closing.isClosed
                ? `Fechado em ${new Date(closing.closedAt!).toLocaleDateString('pt-BR')}`
                : 'Em andamento · ' + formatMonthFull(month)}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 bg-white rounded-xl px-2 py-1.5" style={{ border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}>
            <button
              onClick={() => changeMonth(prevMonth(month))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[130px] text-center">
              {formatMonthFull(month)}
            </span>
            <button
              onClick={() => changeMonth(nextMonth(month))}
              disabled={month >= currentYearMonth()}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Closed celebration banner */}
        {closing.isClosed && (
          <div
            className="flex flex-col items-center py-6 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)', border: '1px solid #BBF7D0' }}
          >
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <CheckCircle size={24} color="#16A34A" />
            </div>
            <p className="font-semibold text-green-800 text-sm">
              {formatMonthFull(month)} fechado com sucesso
            </p>
            <p className="text-xs text-green-600 mt-1">
              Fechado em {new Date(closing.closedAt!).toLocaleDateString('pt-BR')}
            </p>
            <button
              onClick={handleReopen}
              className="mt-3 text-xs text-green-700 hover:text-green-900 underline flex items-center gap-1 transition-colors"
            >
              <Unlock size={11} /> Reabrir mês
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Checklist */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800">Checklist</p>
              <span className="text-xs font-semibold text-gray-500">{checklistDone}/{checklistTotal}</span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full mb-4 overflow-hidden" style={{ background: '#EDF0F7' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(checklistDone / checklistTotal) * 100}%`,
                  background: allDone ? '#16A34A' : 'var(--sidebar-active)',
                }}
              />
            </div>
            <div className="space-y-0.5">
              {CHECKLIST_ITEMS.map(item => {
                const done = !!closing.checklist[item.id]
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleChecklist(item.id)}
                    disabled={closing.isClosed}
                    className={`w-full flex items-center gap-2.5 text-xs px-2 py-2.5 rounded-lg text-left transition-colors ${
                      done ? 'text-green-700' : 'text-gray-600'
                    } ${closing.isClosed ? '' : 'hover:bg-gray-50'}`}
                  >
                    {done
                      ? <CheckSquare size={15} color="#16A34A" className="flex-shrink-0" />
                      : <Square size={15} color="#D1D5DB" className="flex-shrink-0" />
                    }
                    <span className={done ? 'line-through opacity-60' : ''}>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Month summary */}
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-800 mb-4">Resumo do mês</p>
            <div className="space-y-2">
              <SummaryRow label="Receita operacional" value={formatBRL(summary.operationalIncome)} color="#059669" />
              <SummaryRow label="Despesas operacionais" value={formatBRL(summary.totalExpenses)} color="#DC2626" />
              <SummaryRow
                label="Resultado operacional"
                value={formatBRL(summary.operationalResult)}
                color={summary.operationalResult >= 0 ? '#059669' : '#DC2626'}
                bold
              />
              <SummaryRow label="Taxa de sobra" value={formatPct(summary.savingsRate * 100)} color="var(--sidebar-active)" />
              <div className="border-t pt-2 mt-2 space-y-1.5" style={{ borderColor: 'var(--border-card)' }}>
                <SummaryRow label="Total investimentos" value={formatBRL(investmentTotal)} color="#9CA3AF" />
                <SummaryRow label="Total resgates" value={formatBRL(redemption)} color="#9CA3AF" />
                <SummaryRow label="Total dívidas/juros" value={formatBRL(debtTotal)} color="#991B1B" />
                <SummaryRow label="Pendentes futuros" value={formatBRL(summary.pendingAmount)} color="#D97706" />
              </div>
            </div>
          </div>
        </div>

        {/* Top deviations */}
        {topDeviations.length > 0 && (
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-800 mb-3">Maiores desvios vs orçamento</p>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-card)' }}>
                  <th className="text-left pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Categoria</th>
                  <th className="text-right pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Planejado</th>
                  <th className="text-right pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Realizado</th>
                  <th className="text-right pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Desvio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topDeviations.map(d => (
                  <tr key={d.macroCategoryId}>
                    <td className="py-2 text-gray-700 font-medium">{d.name}</td>
                    <td className="py-2 text-right text-gray-400 num">{formatBRL(d.planned)}</td>
                    <td className="py-2 text-right font-semibold num" style={{ color: d.color }}>{formatBRL(d.realized)}</td>
                    <td className={`py-2 text-right font-semibold num ${d.deviationRs > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {d.deviationRs > 0 ? '+' : ''}{formatBRL(d.deviationRs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        <div className="card p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Aprendizados do mês</p>
          <textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setNotesEdited(true) }}
            disabled={closing.isClosed}
            placeholder={`O que pesou este mês?\nO que melhorou?\nDecisão para o próximo mês?`}
            rows={4}
            className="w-full text-xs text-gray-700 rounded-lg p-3 resize-none focus:outline-none focus:ring-1 disabled:text-gray-400"
            style={{
              border: '1px solid var(--border-card)',
              background: closing.isClosed ? '#F8FAFC' : 'white',
              '--tw-ring-color': 'var(--sidebar-active)',
            } as React.CSSProperties}
          />
          {notesEdited && !closing.isClosed && (
            <button
              onClick={saveNotes}
              className="mt-2 text-xs px-4 py-2 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
              style={{ background: 'var(--sidebar-active)' }}
            >
              Salvar observações
            </button>
          )}
        </div>

        {/* Close action */}
        {!closing.isClosed && (
          <div className="space-y-2 pb-4">
            <button
              onClick={handleClose}
              disabled={!allDone}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: allDone ? 'var(--sidebar-active)' : '#E5E7EB',
                color: allDone ? 'white' : '#9CA3AF',
                cursor: allDone ? 'pointer' : 'not-allowed',
              }}
            >
              <Lock size={15} />
              Fechar {formatMonthFull(month)}
            </button>
            {!allDone && (
              <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                <AlertTriangle size={11} />
                Complete o checklist ({checklistDone}/{checklistTotal}) para fechar
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function SummaryRow({ label, value, color, bold }: {
  label: string
  value: string
  color: string
  bold?: boolean
}) {
  return (
    <div className={`flex justify-between items-center text-xs ${bold ? 'font-bold border-t pt-2' : ''}`}
      style={bold ? { borderColor: 'var(--border-card)' } : undefined}>
      <span className={bold ? 'text-gray-800' : 'text-gray-500'}>{label}</span>
      <span className="num font-semibold" style={{ color }}>{value}</span>
    </div>
  )
}
