import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, Lock, Unlock, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useDashboard } from '../hooks/useDashboard'
import { DataQualityCard } from '../components/dashboard/DataQualityCard'
import { IntelligenceCard } from '../components/dashboard/IntelligenceCard'
import { formatBRL } from '../utils/currency'
import { formatMonthFull, prevMonth, nextMonth, currentYearMonth } from '../utils/date'
import { useData } from '../context/DataContext'
import { getAllMacroCategories } from '../services/financeParentCategories.service'
import { getFullTrend } from '../engine/calculate'
import { CHECKLIST_ITEMS, emptyClosing } from '../services/closing.service'
import type { NavFilter } from '../App'
import type { BudgetComparison, AlertItem } from '../types'

interface Props {
  selectedMonth: string
  onNavigate: (route: string, filter?: NavFilter) => void
  onMonthChange: (m: string) => void
}

export function Dashboard({ selectedMonth, onNavigate, onMonthChange }: Props) {
  const { summary, budgetComparison, alerts, expenseBreakdown } = useDashboard(selectedMonth)
  const { transactions, closings, saveClosing } = useData()

  const isCurrent = selectedMonth === currentYearMonth()
  const canGoNext = selectedMonth < currentYearMonth()

  // ── Fechamento state ─────────────────────────────────────────────────────────
  const [showFechamento, setShowFechamento] = useState(false)
  const [closing, setClosing] = useState(() => closings.find(c => c.month === selectedMonth) ?? emptyClosing(selectedMonth))

  useEffect(() => {
    setClosing(closings.find(c => c.month === selectedMonth) ?? emptyClosing(selectedMonth))
  }, [closings, selectedMonth])

  function toggleChecklist(id: string) {
    if (closing.isClosed) return
    const updated = { ...closing, checklist: { ...closing.checklist, [id]: !closing.checklist[id] } }
    setClosing(updated)
    saveClosing(updated)
  }

  function toggleClose() {
    const updated = closing.isClosed
      ? { ...closing, isClosed: false, closedAt: undefined }
      : { ...closing, isClosed: true, closedAt: new Date().toISOString() }
    setClosing(updated)
    saveClosing(updated)
  }

  const checklistDone = CHECKLIST_ITEMS.filter(i => closing.checklist[i.id]).length
  const checklistTotal = CHECKLIST_ITEMS.length

  // ── Income categories (grouped) ───────────────────────────────────────────
  const allMacros = useMemo(() => getAllMacroCategories(), [])
  const incomeMacros = useMemo(() => allMacros.filter(m => m.tabType === 'income'), [allMacros])

  const incomeBreakdown = useMemo(() => {
    const monthTxs = transactions.filter(t =>
      t.competenceDate.startsWith(selectedMonth) &&
      t.status !== 'cancelled' &&
      t.type === 'income' &&
      t.includeInOperationalResult !== false
    )
    const totalIncome = monthTxs.reduce((s, t) => s + t.amount, 0)
    const result = incomeMacros
      .map(macro => {
        const total = monthTxs.filter(t => t.macroCategoryId === macro.id).reduce((s, t) => s + t.amount, 0)
        return total > 0 ? { id: macro.id, name: macro.name, color: macro.color, total, percentage: totalIncome > 0 ? (total / totalIncome) * 100 : 0 } : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.total - a.total)

    const uncatTotal = monthTxs.filter(t => !t.macroCategoryId).reduce((s, t) => s + t.amount, 0)
    if (uncatTotal > 0) result.push({ id: 'uncat', name: 'Não classificado', color: 'var(--faint)', total: uncatTotal, percentage: totalIncome > 0 ? (uncatTotal / totalIncome) * 100 : 0 })
    return result
  }, [transactions, selectedMonth, incomeMacros])

  // ── Status ────────────────────────────────────────────────────────────────
  const hasCritical = alerts.some(a => a.level === 'critical')
  const hasWarning = !hasCritical && alerts.some(a => a.level === 'warning')
  const statusLabel = hasCritical ? 'Crítico' : hasWarning ? 'Atenção' : isCurrent ? 'Em andamento' : 'Saudável'

  // ── Full history: entradas × saídas lado a lado, do primeiro mês com dados até hoje ──
  const fullTrendData = useMemo(() => {
    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return getFullTrend(transactions).map(t => {
      const [, m] = t.month.split('-').map(Number)
      return {
        month: t.month,
        label: `${MONTHS[m - 1]}/${t.month.slice(2, 4)}`,
        Receita: Math.round(t.operationalIncome),
        Despesa: Math.round(t.totalExpenses),
      }
    })
  }, [transactions])

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: 'var(--paper)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px clamp(16px,3vw,48px)', display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Visão Geral</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>Visão geral dos seus dados financeiros.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="month-nav">
              <button className="btn-ghost" style={{ width: 26, height: 26 }} onClick={() => onMonthChange(prevMonth(selectedMonth))}><ChevronLeft size={14} /></button>
              <span className="m">{formatMonthFull(selectedMonth)}</span>
              <button className="btn-ghost" style={{ width: 26, height: 26, opacity: canGoNext ? 1 : 0.3 }} onClick={() => canGoNext && onMonthChange(nextMonth(selectedMonth))} disabled={!canGoNext}><ChevronRight size={14} /></button>
            </div>
            <button className="btn btn-primary" onClick={() => onNavigate('/lancamentos')}><Plus size={14} /> Lançar</button>
          </div>
        </div>

        {/* ── Overview Pluggy-style: 3 colunas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>

          {/* CONTAS / RECEITAS */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--pos)' }}>Receitas</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums', marginBottom: 18 }}>
              {formatBRL(summary.operationalIncome)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {incomeBreakdown.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--faint)' }}>Sem receitas neste mês</p>
              ) : incomeBreakdown.map((cat, i) => (
                <div key={cat.id}
                  onClick={() => onNavigate('/lancamentos', { macroCategoryIds: [cat.id], filterLabel: cat.name, sourcePage: 'dashboard', sourceLabel: 'Visão Geral' })}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < incomeBreakdown.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer', gap: 10 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color || 'var(--pos)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{cat.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--pos)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatBRL(cat.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CARTÕES / DESPESAS */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--crit)' }}>Despesas</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums', marginBottom: 18 }}>
              {formatBRL(summary.totalExpenses)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {expenseBreakdown.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--faint)' }}>Sem despesas neste mês</p>
              ) : expenseBreakdown.map((cat, i) => (
                <div key={cat.macroCategoryId}
                  onClick={() => onNavigate('/lancamentos', { macroCategoryIds: [cat.macroCategoryId], filterLabel: cat.name, sourcePage: 'dashboard', sourceLabel: 'Visão Geral' })}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < expenseBreakdown.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer', gap: 10 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color || 'var(--crit)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{cat.percentage.toFixed(0)}%</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--crit)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(cat.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RESULTADO / SALDO */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <TrendingUp size={12} color={summary.operationalResult >= 0 ? 'var(--pos)' : 'var(--crit)'} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: summary.operationalResult >= 0 ? 'var(--pos)' : 'var(--crit)' }}>
                {isCurrent ? 'Saldo parcial' : 'Resultado do mês'}
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: summary.operationalResult >= 0 ? 'var(--pos)' : 'var(--crit)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums', marginBottom: 18 }}>
              {summary.operationalResult >= 0 ? '+' : ''}{formatBRL(summary.operationalResult)}
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 16 }}>
              {[
                { label: 'Margem de poupança', value: `${(summary.savingsRate * 100).toFixed(1)}%`, color: 'var(--ink-2)' },
                { label: 'Comprometido pendente', value: formatBRL(summary.pendingAmount ?? 0), color: 'var(--warn)' },
                { label: 'Status', value: statusLabel, color: hasCritical ? 'var(--crit)' : hasWarning ? 'var(--warn)' : 'var(--pos)' },
              ].map((row, i) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{row.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Fechamento progress */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Checklist do mês</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: checklistDone === checklistTotal ? 'var(--pos)' : 'var(--ink-2)' }}>{checklistDone}/{checklistTotal}</span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: 'var(--well)', overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${(checklistDone / checklistTotal) * 100}%`, background: checklistDone === checklistTotal ? 'var(--pos)' : 'var(--accent)', borderRadius: 6, transition: 'width .3s' }} />
              </div>
              <button
                onClick={() => setShowFechamento(v => !v)}
                style={{ fontSize: 11.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)', fontWeight: 600, padding: 0 }}
              >
                {showFechamento ? 'Ocultar checklist ↑' : 'Ver checklist ↓'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Checklist expandível (abaixo dos 3 cards) ── */}
        {showFechamento && (
          <div className="card" style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {closing.isClosed ? <Lock size={14} color="var(--pos)" /> : <Unlock size={14} color="var(--faint)" />}
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Fechamento do mês</span>
                {closing.isClosed && <span style={{ fontSize: 11, color: 'var(--pos)', fontWeight: 600 }}>Fechado</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={toggleClose} className={`btn btn-sm ${closing.isClosed ? 'btn-secondary' : 'btn-primary'}`} style={{ fontSize: 12 }}>
                  {closing.isClosed ? <><Unlock size={12} /> Reabrir</> : <><Lock size={12} /> Fechar mês</>}
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
              {CHECKLIST_ITEMS.map(item => {
                const done = !!closing.checklist[item.id]
                return (
                  <button key={item.id} onClick={() => toggleChecklist(item.id)} disabled={closing.isClosed}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: 'none', cursor: closing.isClosed ? 'default' : 'pointer', background: done ? 'var(--pos-soft)' : 'var(--well)', textAlign: 'left', fontFamily: 'var(--ui)' }}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${done ? 'var(--pos)' : 'var(--line)'}`, background: done ? 'var(--pos)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {done && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: done ? 'var(--pos)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none' }}>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Entradas × saídas: histórico completo ── */}
        {fullTrendData.length > 1 && (
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>Entradas × saídas</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={fullTrendData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} barGap={4}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--faint)' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: unknown) => formatBRL(Number(v))} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--line)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="Receita"
                  fill="var(--pos)"
                  radius={[3, 3, 0, 0]}
                  cursor="pointer"
                  onClick={(data: { month?: string; label?: string }) => data.month && onNavigate('/lancamentos', {
                    monthOverride: data.month,
                    typeOverride: 'income',
                    filterLabel: `Receitas — ${data.label}`,
                    sourcePage: 'dashboard',
                    sourceLabel: 'Visão Geral',
                  })}
                />
                <Bar
                  dataKey="Despesa"
                  fill="var(--crit)"
                  radius={[3, 3, 0, 0]}
                  cursor="pointer"
                  onClick={(data: { month?: string; label?: string }) => data.month && onNavigate('/lancamentos', {
                    monthOverride: data.month,
                    typeOverride: 'expense',
                    filterLabel: `Despesas — ${data.label}`,
                    sourcePage: 'dashboard',
                    sourceLabel: 'Visão Geral',
                  })}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Planejado + Alertas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <PlanejadoCard data={budgetComparison} isPartial={isCurrent} onNavigate={onNavigate} />
          <AlertsCard alerts={alerts} isPartial={isCurrent} />
        </div>

        {/* ── Inteligência ── */}
        <IntelligenceCard month={selectedMonth} onNavigate={onNavigate} />

        {/* ── Qualidade ── */}
        <DataQualityCard selectedMonth={selectedMonth} onNavigate={onNavigate} />

      </div>
    </main>
  )
}

/* ── Planejado × realizado ── */
function PlanejadoCard({ data, onNavigate }: { data: BudgetComparison[]; isPartial?: boolean; onNavigate: (r: string) => void }) {
  const withBudget = data.filter(d => d.planned > 0)
  const totalPlanned = withBudget.reduce((s, d) => s + d.planned, 0)
  const totalRealized = withBudget.reduce((s, d) => s + d.realized, 0)
  const pct = totalPlanned > 0 ? Math.round((totalRealized / totalPlanned) * 100) : 0

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)' }}>Planejado × realizado</h3>
        <button onClick={() => onNavigate('/orcamento')} style={{ fontSize: 12, fontWeight: 650, color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Orçamento ›
        </button>
      </div>

      {totalPlanned === 0 ? (
        <div className="empty-state">
          <div className="empty-glyph" />
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Sem orçamento</h4>
          <button className="btn btn-primary" style={{ marginTop: 4, fontSize: 12 }} onClick={() => onNavigate('/orcamento')}>Definir orçamento</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
            <span className="num" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>{pct}%</span>
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>{formatBRL(totalRealized)} de {formatBRL(totalPlanned)}</span>
          </div>
          {withBudget.slice(0, 4).map(d => {
            const fill = d.planned > 0 ? Math.min((d.realized / d.planned) * 100, 100) : 0
            const over = d.status === 'critical'; const warn = d.status === 'warning'
            return (
              <div className="bcat" key={d.macroCategoryId || d.categoryId}>
                <div className="r1">
                  <span className="nm">{d.name}</span>
                  <span className="vl">{formatBRL(d.realized)} / {formatBRL(d.planned)}</span>
                </div>
                <div className="bbar"><i style={{ width: `${fill}%`, background: over ? 'var(--crit)' : warn ? 'var(--warn)' : 'var(--ink)' }} /></div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

/* ── Alertas ── */
function AlertsCard({ alerts, isPartial }: { alerts: AlertItem[]; isPartial: boolean }) {
  const now = new Date()
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Alertas do mês</h3>
      {isPartial && (
        <div className="alert-row" style={{ background: 'var(--accent-soft)' }}>
          <span className="vdot" style={{ background: 'var(--ink)' }} />
          <span>Leitura parcial: faltam {daysLeft} dias para fechar.</span>
        </div>
      )}
      {alerts.slice(0, 4).map(a => (
        <div key={a.id} className="alert-row" style={{ background: a.level === 'critical' ? 'var(--crit-soft)' : 'var(--warn-soft)' }}>
          <span className="vdot" style={{ background: a.level === 'critical' ? 'var(--crit)' : 'var(--warn)' }} />
          <span>{a.message}</span>
        </div>
      ))}
      {!isPartial && alerts.length === 0 && (
        <div className="alert-row" style={{ background: 'var(--pos-soft)' }}>
          <span className="vdot" style={{ background: 'var(--pos)' }} />
          <span style={{ color: 'var(--pos)', fontWeight: 600 }}>Nenhum ponto crítico.</span>
        </div>
      )}
    </div>
  )
}
