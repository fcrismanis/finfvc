import { useState, useMemo, useEffect } from 'react'
import { Lock, Unlock, CheckSquare, Square, ChevronLeft, ChevronRight, CreditCard, ChevronDown, RefreshCw } from 'lucide-react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES } from '../config/categories'
import { formatBRL, formatPct } from '../utils/currency'
import { formatMonthFull, prevMonth, nextMonth, currentYearMonth } from '../utils/date'
import { getMonthSummary, getBudgetComparison, getRedemptionTotal } from '../engine/calculate'
import { emptyClosing, CHECKLIST_ITEMS } from '../services/closing.service'
import { diagnoseReconciliation, neutralPatch } from '../services/reconciliation.service'
import type { NavFilter } from '../App'

interface Props {
  selectedMonth: string
  onNavigate?: (route: string, filter?: NavFilter) => void
}

export function Closing({ selectedMonth, onNavigate }: Props) {
  const { transactions, budgets, closings, saveClosing, updateTransactions } = useData()
  const [month, setMonth] = useState(selectedMonth)
  const [closing, setClosing] = useState(() => closings.find(c => c.month === month) ?? emptyClosing(month))
  const [notes, setNotes] = useState(closing.notes)
  const [notesEdited, setNotesEdited] = useState(false)

  useEffect(() => {
    const c = closings.find(c => c.month === month) ?? emptyClosing(month)
    setClosing(c)
    setNotes(c.notes)
    setNotesEdited(false)
  }, [closings, month])

  function changeMonth(m: string) {
    setMonth(m)
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

  const monthTxs = useMemo(() =>
    transactions.filter(t => t.competenceDate.startsWith(month) && t.status !== 'cancelled')
  , [transactions, month])

  const pluggyStats = useMemo(() => {
    const pluggy = monthTxs.filter(t => t.source === 'pluggy')
    const uncategorized = monthTxs.filter(t => !t.macroCategoryId && t.type === 'expense')
    const pending = monthTxs.filter(t => t.status === 'pending')
    return { count: pluggy.length, uncategorized: uncategorized.length, pending: pending.length }
  }, [monthTxs])

  const recon = useMemo(() => diagnoseReconciliation(monthTxs), [monthTxs])
  const [neutralizing, setNeutralizing] = useState(false)

  async function handleNeutralize() {
    if (recon.candidateIds.size === 0 || closing.isClosed) return
    setNeutralizing(true)
    try {
      const items = [...recon.candidateIds].map(id => ({ id, patch: neutralPatch() }))
      await updateTransactions(items, { markManual: true })
    } finally {
      setNeutralizing(false)
    }
  }

  function toggleChecklist(id: string) {
    if (closing.isClosed) return
    const updated = { ...closing, checklist: { ...closing.checklist, [id]: !closing.checklist[id] } }
    setClosing(updated)
    saveClosing(updated)
  }

  function handleClose() {
    const updated = { ...closing, isClosed: true, closedAt: new Date().toISOString() }
    setClosing(updated)
    saveClosing(updated)
  }

  function handleReopen() {
    const updated = { ...closing, isClosed: false, reopenedAt: new Date().toISOString() }
    setClosing(updated)
    saveClosing(updated)
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

  // Credit card breakdown: paymentMethod === 'card' OR creditCardId is set
  // Exclude internal transfers and payments that look like bill settlements (fatura/fat.)
  const creditCardTxs = useMemo(() => {
    const monthTxs = transactions.filter(t => t.competenceDate.startsWith(month))
    return monthTxs.filter(t => {
      if (t.type !== 'expense') return false
      if (t.isInternalTransfer) return false
      if (t.classificationType === 'transfer') return false
      const isCard = t.paymentMethod === 'card' || !!t.creditCardId
      return isCard
    })
  }, [transactions, month])

  const creditCardByMacro = useMemo(() => {
    const map = new Map<string, { name: string; color: string; total: number; macroId: string }>()
    for (const tx of creditCardTxs) {
      const macro = MACRO_CATEGORIES.find(m => m.id === tx.macroCategoryId)
      const key = macro?.id ?? 'sem_categoria'
      const existing = map.get(key)
      if (existing) {
        existing.total += tx.amount
      } else {
        map.set(key, {
          macroId: key,
          name: macro?.name ?? 'Sem categoria',
          color: macro?.color ?? 'var(--faint)',
          total: tx.amount,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [creditCardTxs])

  const creditCardTotal = creditCardTxs.reduce((s, t) => s + t.amount, 0)
  const [ccExpanded, setCcExpanded] = useState(false)

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 10 }}>
              {closing.isClosed
                ? <Lock size={22} color="var(--pos)" />
                : <Unlock size={22} color="var(--ink-2)" />}
              Fechamento
            </h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
              {closing.isClosed
                ? `Fechado em ${new Date(closing.closedAt!).toLocaleDateString('pt-BR')}`
                : 'Em andamento · ' + formatMonthFull(month)}
            </div>
          </div>
          <div className="month-nav">
            <button className="btn-ghost" style={{ width: 26, height: 26 }} onClick={() => changeMonth(prevMonth(month))}>
              <ChevronLeft size={14} />
            </button>
            <span className="m">{formatMonthFull(month)}</span>
            <button
              className="btn-ghost"
              style={{ width: 26, height: 26, opacity: month >= currentYearMonth() ? 0.3 : 1 }}
              onClick={() => changeMonth(nextMonth(month))}
              disabled={month >= currentYearMonth()}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* ── Closed banner ── */}
        {closing.isClosed && (
          <div style={{
            background: 'var(--pos-soft)',
            border: '1px solid var(--pos)',
            borderRadius: 11,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--pos)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={16} color="#fff" />
              </div>
              <div>
                <p style={{ fontWeight: 700, color: 'var(--pos)', fontSize: 13.5 }}>
                  {formatMonthFull(month)} fechado com sucesso
                </p>
                <p style={{ fontSize: 11, color: 'var(--pos)', opacity: 0.8, marginTop: 2 }}>
                  Fechado em {new Date(closing.closedAt!).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
            <button
              onClick={handleReopen}
              style={{ fontSize: 12, color: 'var(--pos)', background: 'none', border: '1px solid var(--pos)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--ui)', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Unlock size={11} /> Reabrir mês
            </button>
          </div>
        )}

        {/* ── Main grid: checklist + summary ── */}
        <div className="grid2">
          {/* Checklist */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)' }}>Checklist</h3>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--faint)' }}>{checklistDone}/{checklistTotal}</span>
            </div>
            <div className="bbar" style={{ marginBottom: 14 }}>
              <i style={{
                width: `${(checklistDone / checklistTotal) * 100}%`,
                background: allDone ? 'var(--pos)' : 'var(--ink)',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div>
              {CHECKLIST_ITEMS.map(item => {
                const done = !!closing.checklist[item.id]
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleChecklist(item.id)}
                    disabled={closing.isClosed}
                    className={`check-item${done ? ' done' : ''}`}
                  >
                    {done
                      ? <CheckSquare size={15} color="var(--pos)" style={{ flexShrink: 0 }} />
                      : <Square size={15} color="var(--line)" style={{ flexShrink: 0 }} />
                    }
                    <span style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Month summary */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Resumo do mês</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SummaryRow label="(+) Receita operacional" value={formatBRL(summary.operationalIncome)} color="var(--pos)" />
              <SummaryRow label="(−) Despesas operacionais" value={formatBRL(summary.totalExpenses)} color="var(--crit)" />
              <SummaryRow
                label="Resultado operacional"
                value={formatBRL(summary.operationalResult)}
                color={summary.operationalResult >= 0 ? 'var(--pos)' : 'var(--crit)'}
                bold
              />
              <SummaryRow label="Margem familiar" value={formatPct(summary.savingsRate * 100)} color="var(--ink)" />
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SummaryRow label="(−) Dívidas e juros" value={formatBRL(debtTotal)} color="var(--crit)" />
                <SummaryRow label="(+) Resgates" value={formatBRL(redemption)} color="var(--faint)" />
                <SummaryRow label="(−) Investimentos/aportes" value={formatBRL(investmentTotal)} color="var(--faint)" />
                <SummaryRow
                  label="Invest. líquido"
                  value={formatBRL(investmentTotal - redemption)}
                  color={investmentTotal >= redemption ? 'var(--pos)' : 'var(--warn)'}
                />
                <SummaryRow label="Pendentes futuros" value={formatBRL(summary.pendingAmount)} color="var(--warn)" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Pluggy / import stats ── */}
        {(pluggyStats.count > 0 || pluggyStats.uncategorized > 0) && (
          <div className="card" style={{ padding: '16px 20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 12 }}>Importações e revisão</h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Importados via Pluggy', value: pluggyStats.count, color: pluggyStats.count > 0 ? 'var(--pos)' : 'var(--faint)' },
                { label: 'Sem categoria', value: pluggyStats.uncategorized, color: pluggyStats.uncategorized > 0 ? 'var(--warn)' : 'var(--pos)' },
                { label: 'Pendentes', value: pluggyStats.pending, color: pluggyStats.pending > 0 ? 'var(--warn)' : 'var(--pos)' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                </div>
              ))}
            </div>
            {pluggyStats.uncategorized > 0 && (
              <p style={{ fontSize: 11, color: 'var(--warn)', marginTop: 10 }}>
                {pluggyStats.uncategorized} lançamento{pluggyStats.uncategorized !== 1 ? 's' : ''} sem categoria — classifique antes de fechar o mês.
              </p>
            )}
          </div>
        )}

        {/* ── Reconciliation / neutral movements ── */}
        {(recon.neutralTotal > 0 || recon.internalCount > 0 || recon.possibleCardDupes > 0) && (
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <RefreshCw size={15} color="var(--ink-2)" />
              <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Conciliação — movimentos internos</h3>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Total neutro', value: formatBRL(recon.neutralTotal), color: 'var(--faint)' },
                { label: 'Movimentos internos', value: String(recon.internalCount), color: recon.internalCount > 0 ? 'var(--ink-2)' : 'var(--faint)' },
                { label: 'Poss. duplicações por cartão', value: String(recon.possibleCardDupes), color: recon.possibleCardDupes > 0 ? 'var(--warn)' : 'var(--pos)' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</span>
                  <span className="num" style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
            {recon.candidateIds.size > 0 && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                  {recon.candidateIds.size} lançamento{recon.candidateIds.size !== 1 ? 's' : ''} (cartão/transferência/PIX próprio ou espelhado) ainda não está neutro.
                </p>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={neutralizing || closing.isClosed}
                  onClick={handleNeutralize}
                >
                  {neutralizing ? 'Aplicando…' : `Marcar ${recon.candidateIds.size} como neutros`}
                </button>
              </div>
            )}
            <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>
              Neutros não entram no orçamento nem no resultado operacional. Ajustes manuais são preservados.
            </p>
          </div>
        )}

        {/* ── Top deviations ── */}
        {topDeviations.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)' }}>Maiores desvios vs orçamento</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                  <th className="table-th">Categoria</th>
                  <th className="table-th table-th-right">Planejado</th>
                  <th className="table-th table-th-right">Realizado</th>
                  <th className="table-th table-th-right">Desvio</th>
                </tr>
              </thead>
              <tbody>
                {topDeviations.map(d => (
                  <tr key={d.macroCategoryId} className="table-row">
                    <td className="table-td" style={{ fontWeight: 600, color: 'var(--ink)' }}>{d.name}</td>
                    <td className="table-td table-th-right" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--faint)' }}>{formatBRL(d.planned)}</td>
                    <td className="table-td table-th-right" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--mono)', fontSize: 12, color: d.color }}>{formatBRL(d.realized)}</td>
                    <td
                      className="table-td table-th-right"
                      style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--mono)', fontSize: 12, color: d.deviationRs > 0 ? 'var(--crit)' : 'var(--pos)' }}
                    >
                      {d.deviationRs > 0 ? '+' : ''}{formatBRL(d.deviationRs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Credit card breakdown ── */}
        {creditCardTxs.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <button
              onClick={() => setCcExpanded(e => !e)}
              style={{
                width: '100%', padding: '14px 18px 10px',
                borderBottom: ccExpanded ? '1px solid var(--line)' : 'none',
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={15} color="var(--ink-2)" />
                <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)' }}>Cartões de crédito no mês</h3>
                <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 400 }}>
                  ({creditCardTxs.length} compras · visão preliminar)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="num" style={{ fontSize: 14, fontWeight: 800, color: 'var(--crit)' }}>
                  {formatBRL(creditCardTotal)}
                </span>
                <ChevronDown size={14} color="var(--faint)" style={{ transform: ccExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </div>
            </button>

            {ccExpanded && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                    <th className="table-th">Categoria</th>
                    <th className="table-th table-th-right">Total</th>
                    <th className="table-th table-th-right">%</th>
                    {onNavigate && <th style={{ width: 64 }} />}
                  </tr>
                </thead>
                <tbody>
                  {creditCardByMacro.map(row => (
                    <tr key={row.macroId} className="table-row">
                      <td className="table-td">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: row.color, flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{row.name}</span>
                        </div>
                      </td>
                      <td className="table-td table-th-right" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--crit)' }}>
                        {formatBRL(row.total)}
                      </td>
                      <td className="table-td table-th-right" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: 'var(--faint)' }}>
                        {creditCardTotal > 0 ? ((row.total / creditCardTotal) * 100).toFixed(0) : 0}%
                      </td>
                      {onNavigate && (
                        <td className="table-td">
                          <button
                            onClick={() => onNavigate('/lancamentos', {
                              macroCategoryIds: row.macroId !== 'sem_categoria' ? [row.macroId] : [],
                              filterLabel: `Fechamento › Cartão › ${row.name}`,
                              sourcePage: 'closing',
                              sourceLabel: 'Fechamento',
                            })}
                            style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                          >
                            Ver
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Notes ── */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)', marginBottom: 12 }}>Aprendizados do mês</h3>
          <textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setNotesEdited(true) }}
            disabled={closing.isClosed}
            placeholder={`O que pesou este mês?\nO que melhorou?\nDecisão para o próximo mês?`}
            rows={4}
            style={{
              width: '100%', fontSize: 12.5, lineHeight: 1.6,
              border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px',
              resize: 'none', outline: 'none', background: closing.isClosed ? 'var(--well)' : 'var(--card-bg)',
              fontFamily: 'var(--ui)', boxSizing: 'border-box',
              color: closing.isClosed ? 'var(--faint)' : 'var(--ink-2)',
            } as React.CSSProperties}
          />
          {notesEdited && !closing.isClosed && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={saveNotes}>
              Salvar observações
            </button>
          )}
        </div>

        {/* ── Close action ── */}
        {!closing.isClosed && (
          <div style={{ paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={handleClose}
              disabled={!allDone}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', fontSize: 14, opacity: allDone ? 1 : 0.35 }}
            >
              <Lock size={14} />
              Fechar {formatMonthFull(month)}
            </button>
            {!allDone && (
              <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--faint)' }}>
                Complete o checklist ({checklistDone}/{checklistTotal}) para fechar o mês.
              </p>
            )}
          </div>
        )}

      </div>
    </main>
  )
}

function SummaryRow({ label, value, color, bold }: {
  label: string; value: string; color: string; bold?: boolean
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 12.5,
      ...(bold ? { fontWeight: 800, borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 4 } : {}),
    }}>
      <span style={{ color: bold ? 'var(--ink)' : 'var(--ink-2)' }}>{label}</span>
      <span className="num" style={{ fontWeight: bold ? 800 : 600, color }}>{value}</span>
    </div>
  )
}
