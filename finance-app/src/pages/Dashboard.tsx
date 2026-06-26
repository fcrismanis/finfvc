import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useDashboard } from '../hooks/useDashboard'
import { ClarityFunnel } from '../components/dashboard/ClarityFunnel'
import { DataQualityCard } from '../components/dashboard/DataQualityCard'
import { IntelligenceCard } from '../components/dashboard/IntelligenceCard'
import { formatBRL } from '../utils/currency'
import { formatMonthFull, prevMonth, nextMonth, currentYearMonth } from '../utils/date'
import { MONTHS_PT } from '../utils/months'
import type { BudgetComparison, AlertItem, TopTransaction } from '../types'
import type { FunnelStep } from '../utils/funnelSteps'
import type { NavFilter } from '../App'

interface Props {
  selectedMonth: string
  onNavigate: (route: string, filter?: NavFilter) => void
  onMonthChange: (m: string) => void
}

export function Dashboard({ selectedMonth, onNavigate, onMonthChange }: Props) {
  const { summary, funnelSteps, budgetComparison, alerts, topExpenses, expenseBreakdown, trend } = useDashboard(selectedMonth)

  const isCurrent = selectedMonth === currentYearMonth()
  const now = new Date()
  const day = now.getDate()
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = totalDays - day
  const canGoNext = selectedMonth < currentYearMonth()

  // Status dinâmico baseado em alertas
  const hasCritical = alerts.some(a => a.level === 'critical')
  const hasWarning = !hasCritical && alerts.some(a => a.level === 'warning')
  const badgeClass = hasCritical ? 'b-crit' : hasWarning ? 'b-warn' : 'b-ok'
  const statusLabel = hasCritical ? 'Crítico' : hasWarning ? 'Atenção' : isCurrent ? 'Em andamento' : 'Saudável'

  const statusText = (() => {
    if (!isCurrent) return 'Leitura completa do mês. Entradas, saídas e sobra consolidados.'
    const top = alerts[0]
    if (top) return top.message + (alerts.length > 1 ? ` Mais ${alerts.length - 1} alerta(s) este mês.` : '')
    return `Mês em andamento — dia ${day} de ${totalDays}. Sem pontos críticos até agora.`
  })()

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: 'var(--paper)' }}>
      {/* Container editorial: clamp lateral + max-width 1280 */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '24px clamp(28px,4vw,72px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          width: '100%',
        }}
      >

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Visão geral</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
              Resultado do mês e jornada do dinheiro · {formatMonthFull(selectedMonth)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="month-nav">
              <button
                className="btn-ghost"
                style={{ width: 26, height: 26 }}
                onClick={() => onMonthChange(prevMonth(selectedMonth))}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="m">{formatMonthFull(selectedMonth)}</span>
              <button
                className="btn-ghost"
                style={{ width: 26, height: 26, opacity: canGoNext ? 1 : 0.3 }}
                onClick={() => canGoNext && onMonthChange(nextMonth(selectedMonth))}
                disabled={!canGoNext}
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <button className="btn btn-primary" onClick={() => onNavigate('/lancamentos')}>
              <Plus size={14} /> Lançar
            </button>
          </div>
        </div>

        {/* ── Faixa status + KPIs ── */}
        <div className="card status-row">
          <div className="status-text">
            <span className={`badge ${badgeClass}`} style={{ alignSelf: 'flex-start', marginBottom: 11 }}>
              <span className="dot" />
              {statusLabel}
            </span>
            <p>{statusText}</p>
          </div>
          <div className="status-kpis">
            <div className="status-kpi">
              <span className="kl">Entrou</span>
              <span className="kv num" style={{ color: 'var(--pos)' }}>{formatBRL(summary.operationalIncome)}</span>
            </div>
            <div className="status-kpi">
              <span className="kl">Saiu</span>
              <span className="kv num" style={{ color: 'var(--ink)' }}>{formatBRL(summary.totalExpenses)}</span>
            </div>
            <div className="status-kpi soft">
              <span className="kl">{isCurrent ? 'Saldo parcial' : 'Saldo do mês'}</span>
              <span className="kv num" style={{ color: 'var(--pos)' }}>{formatBRL(summary.operationalResult)}</span>
            </div>
          </div>
        </div>

        {/* ── Funil herói (1.6fr) + Planejado (1fr) ── */}
        <div className="fpgrid">
          <ClarityFunnel
            income={summary.operationalIncome}
            steps={funnelSteps}
            isPartial={isCurrent}
            partialDay={day}
            partialTotal={totalDays}
            onStepClick={(step: FunnelStep) => onNavigate('/lancamentos', {
              macroCategoryIds: step.macroIds,
              filterLabel: step.label,
              sourcePage: 'dashboard',
              sourceLabel: 'Visão Geral',
            })}
          />
          <PlanejadoCard data={budgetComparison} isPartial={isCurrent} onNavigate={onNavigate} />
        </div>

        {/* ── 3 cards alinhados ── */}
        <div className="grid3">
          <VillainsCard data={budgetComparison} />
          <AlertsCard alerts={alerts} isPartial={isCurrent} daysLeft={daysLeft} />
          <TopCard data={topExpenses} onNavigate={onNavigate} />
        </div>

        {/* ── Insights IA (Artha-style purple box) ── */}
        <InsightsCard summary={summary} expenseBreakdown={expenseBreakdown} trend={trend} isCurrent={isCurrent} />

        {/* ── 2 gráficos: Resumo Mensal + Gastos por Categoria ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <ResumoMensalChart trend={trend} />
          <GastosCategoriaChart expenseBreakdown={expenseBreakdown} />
        </div>

        {/* ── Essenciais x Não Essenciais ── */}
        <EssenciaisChart budgetComparison={budgetComparison} />

        {/* ── Inteligência financeira ── */}
        <IntelligenceCard month={selectedMonth} onNavigate={onNavigate} />

        {/* ── Qualidade dos dados ── */}
        <DataQualityCard selectedMonth={selectedMonth} onNavigate={onNavigate} />

      </div>
    </main>
  )
}

/* ── Planejado × realizado ── */
function PlanejadoCard({ data, isPartial, onNavigate }: { data: BudgetComparison[]; isPartial: boolean; onNavigate: (r: string) => void }) {
  const withBudget = data.filter(d => d.planned > 0)
  const totalPlanned = withBudget.reduce((s, d) => s + d.planned, 0)
  const totalRealized = withBudget.reduce((s, d) => s + d.realized, 0)
  const pct = totalPlanned > 0 ? Math.round((totalRealized / totalPlanned) * 100) : 0

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)' }}>Planejado × realizado</h3>
        <button
          onClick={() => onNavigate('/orcamento')}
          style={{ fontSize: 12, fontWeight: 650, color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Orçamento ›
        </button>
      </div>

      {totalPlanned === 0 ? (
        <div className="empty-state">
          <div className="empty-glyph" />
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Sem orçamento definido</h4>
          <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 200 }}>
            {isPartial ? 'Mês em andamento — sem plano definido.' : 'Nenhum orçamento para este mês.'}
          </p>
          <button className="btn btn-primary" style={{ marginTop: 4, fontSize: 12 }} onClick={() => onNavigate('/orcamento')}>
            Definir orçamento
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
            <span className="num" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>{pct}%</span>
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>
              {formatBRL(totalRealized)} de {formatBRL(totalPlanned)}
            </span>
          </div>
          {withBudget.slice(0, 4).map(d => {
            const fill = d.planned > 0 ? Math.min((d.realized / d.planned) * 100, 100) : 0
            const over = d.status === 'critical'
            const warn = d.status === 'warning'
            const barColor = over ? 'var(--crit)' : warn ? 'var(--warn)' : 'var(--ink)'
            return (
              <div className="bcat" key={d.macroCategoryId || d.categoryId}>
                <div className="r1">
                  <span className="nm">{d.name}</span>
                  <span className="vl">{formatBRL(d.realized)} / {formatBRL(d.planned)}</span>
                </div>
                <div className="bbar"><i style={{ width: `${fill}%`, background: barColor }} /></div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

/* ── Maiores vilões ── */
function VillainsCard({ data }: { data: BudgetComparison[] }) {
  const villains = data
    .filter(d => d.planned > 0 && d.deviationRs > 0 && (d.status === 'critical' || d.status === 'warning'))
    .sort((a, b) => b.deviationRs - a.deviationRs)
    .slice(0, 4)

  const noPlanned = data.filter(d => d.planned === 0 && d.realized > 0).slice(0, 2)

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)' }}>Maiores vilões</h3>
        <button
          onClick={() => {}}
          style={{ fontSize: 12, fontWeight: 650, color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Tudo ›
        </button>
      </div>

      {villains.length === 0 && noPlanned.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9, background: 'var(--pos-soft)', fontSize: 12.5, color: 'var(--pos)', fontWeight: 600 }}>
          Nenhum grupo estourou o previsto.
        </div>
      ) : (
        <>
          {villains.map(d => (
            <div className="villain-row" key={d.macroCategoryId || d.categoryId}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="vdot" style={{ background: d.status === 'critical' ? 'var(--crit)' : 'var(--warn)' }} />
                {d.name}
              </span>
              <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: d.status === 'critical' ? 'var(--crit)' : 'var(--warn)' }}>
                + {formatBRL(d.deviationRs)}
              </span>
            </div>
          ))}
          {noPlanned.map(d => (
            <div className="villain-row" key={d.macroCategoryId || d.categoryId}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="vdot" style={{ background: 'var(--ink)' }} />
                {d.name}
              </span>
              <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--faint)' }}>no plano</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

/* ── Alertas do mês ── */
function AlertsCard({ alerts, isPartial, daysLeft }: { alerts: AlertItem[]; isPartial: boolean; daysLeft: number }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Alertas do mês</h3>

      {isPartial && (
        <div className="alert-row" style={{ background: 'var(--accent-soft)' }}>
          <span className="vdot" style={{ background: 'var(--ink)' }} />
          <span>Leitura parcial: faltam {daysLeft} dias para fechar.</span>
        </div>
      )}
      {alerts.slice(0, 3).map(a => (
        <div
          key={a.id}
          className="alert-row"
          style={{ background: a.level === 'critical' ? 'var(--crit-soft)' : 'var(--warn-soft)' }}
        >
          <span className="vdot" style={{ background: a.level === 'critical' ? 'var(--crit)' : 'var(--warn)' }} />
          <span>{a.message}</span>
        </div>
      ))}
      {!isPartial && alerts.length === 0 && (
        <div className="alert-row" style={{ background: 'var(--pos-soft)' }}>
          <span className="vdot" style={{ background: 'var(--pos)' }} />
          <span style={{ color: 'var(--pos)', fontWeight: 600 }}>Nenhum ponto crítico neste mês.</span>
        </div>
      )}
    </div>
  )
}

/* ── Maiores lançamentos ── */
function TopCard({ data, onNavigate }: { data: TopTransaction[]; onNavigate: (r: string) => void }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)' }}>Maiores lançamentos</h3>
        <button
          onClick={() => onNavigate('/lancamentos')}
          style={{ fontSize: 12, fontWeight: 650, color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Ver ›
        </button>
      </div>

      {data.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--faint)', padding: '16px 0', textAlign: 'center' }}>Nenhum lançamento registrado</p>
      ) : (
        data.slice(0, 4).map(item => (
          <div className="villain-row" key={item.id}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
              {item.description}
            </span>
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', flexShrink: 0 }}>
              {formatBRL(item.amount)}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

/* ── Insights IA ── */
function InsightsCard({ summary, expenseBreakdown, trend, isCurrent }: {
  summary: { operationalIncome: number; totalExpenses: number; operationalResult: number }
  expenseBreakdown: Array<{ name: string; total: number; percentage: number }>
  trend: Array<{ month: string; operationalIncome: number; totalExpenses: number; operationalResult: number }>
  isCurrent: boolean
}) {
  const topCat = expenseBreakdown.slice().sort((a, b) => b.total - a.total)[0]
  const prevMonthTrend = trend.at(-2)
  const resultDiff = prevMonthTrend ? summary.operationalResult - prevMonthTrend.operationalResult : null
  const isPositive = summary.operationalResult >= 0
  const bullets: string[] = []
  if (topCat) bullets.push(`Categoria que mais consome: ${topCat.name} (${topCat.percentage.toFixed(0)}% das despesas).`)
  if (isPositive) bullets.push('Saldo positivo! Continue assim.')
  else bullets.push(`Saldo negativo de ${formatBRL(Math.abs(summary.operationalResult))}. Revise as despesas.`)
  if (resultDiff !== null) {
    if (resultDiff > 0) bullets.push(`Resultado ${formatBRL(resultDiff)} melhor que o mês anterior.`)
    else if (resultDiff < 0) bullets.push(`Resultado ${formatBRL(Math.abs(resultDiff))} pior que o mês anterior.`)
  }
  if (isCurrent) bullets.push('Mês em andamento — valores parciais.')
  return (
    <div className="card" style={{ padding: '18px 20px', background: '#f5f0ff', border: '1px solid #e0d4ff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>✨</span>
        <h3 style={{ fontSize: 14, fontWeight: 750, color: '#6b21a8' }}>Insights do mês</h3>
      </div>
      <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, margin: 0 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 13, color: '#4c1d95', lineHeight: 1.5 }}>{b}</li>
        ))}
      </ul>
    </div>
  )
}

/* ── Resumo Mensal (barra) ── */
function ResumoMensalChart({ trend }: { trend: Array<{ month: string; operationalIncome: number; totalExpenses: number }> }) {
  const data = trend.slice(-6).map(t => {
    const [, m] = t.month.split('-').map(Number)
    return { name: MONTHS_PT[m - 1], Receitas: Math.round(t.operationalIncome), Despesas: Math.round(t.totalExpenses) }
  })
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)', marginBottom: 16 }}>Resumo Mensal</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barSize={14} barGap={4}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--faint)' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip formatter={(v: unknown) => [formatBRL(Number(v)), ""]} />
          <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Gastos por Categoria (pizza) ── */
const PIE_COLORS = ['#6366f1','#f59e0b','#22c55e','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6']
function GastosCategoriaChart({ expenseBreakdown }: { expenseBreakdown: Array<{ name: string; total: number; color: string }> }) {
  const top = expenseBreakdown.slice().sort((a, b) => b.total - a.total).slice(0, 8)
  const data = top.map((d, i) => ({ name: d.name, value: Math.round(d.total), fill: PIE_COLORS[i % PIE_COLORS.length] }))
  if (data.length === 0) return null
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)', marginBottom: 16 }}>Gastos por Categoria</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={75} paddingAngle={2} label={({ name, percent }) => `${name} ${((percent??0)*100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
          <Tooltip formatter={(v: unknown) => [formatBRL(Number(v)), ""]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Essenciais x Não Essenciais (donut) ─────────────────────────────────────
   Essenciais = categorias com orçamento definido (planned>0) → controle ativo.
   Não Essenciais = gastos sem orçamento ou acima do planejado (variável).         */
function EssenciaisChart({ budgetComparison }: { budgetComparison: BudgetComparison[] }) {
  const total = budgetComparison.reduce((s, d) => s + d.realized, 0)
  if (total === 0) return null
  const ess = budgetComparison.filter(d => d.planned > 0).reduce((s, d) => s + Math.min(d.realized, d.planned), 0)
  const nonEss = total - ess
  const essP = total > 0 ? Math.round(ess / total * 100) : 0
  const nonP = 100 - essP
  const data = [
    { name: `Essenciais ${essP}%`, value: Math.round(ess), fill: '#22c55e' },
    { name: `Não Essenciais ${nonP}%`, value: Math.round(nonEss), fill: '#f59e0b' },
  ]
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)', marginBottom: 4 }}>Essenciais × Não Essenciais</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3}>
              {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip formatter={(v: unknown) => [formatBRL(Number(v)), ""]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map(d => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{d.name}</p>
                <p style={{ fontSize: 11, color: 'var(--faint)' }}>{formatBRL(d.value)}</p>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
            <p style={{ fontSize: 11, color: 'var(--faint)' }}>Total despesas</p>
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{formatBRL(total)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
