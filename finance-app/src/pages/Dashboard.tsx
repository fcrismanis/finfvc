import { ChevronLeft, ChevronRight, Plus, AlertTriangle, CheckCircle, Calendar, List, BarChart3 } from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { ClarityFunnel } from '../components/dashboard/ClarityFunnel'
import { formatBRL } from '../utils/currency'
import { formatMonthFull, prevMonth, nextMonth, currentYearMonth } from '../utils/date'
import type { BudgetComparison, AlertItem, TopTransaction } from '../types'

interface Props {
  selectedMonth: string
  onNavigate: (route: string) => void
  onMonthChange: (m: string) => void
}

export function Dashboard({ selectedMonth, onNavigate, onMonthChange }: Props) {
  const { summary, funnelSteps, budgetComparison, alerts, topExpenses } = useDashboard(selectedMonth)

  const isCurrent = selectedMonth === currentYearMonth()
  const now = new Date()
  const day = now.getDate()
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = totalDays - day

  const canGoNext = selectedMonth < currentYearMonth()

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-page)' }}>
      <div className="px-5 sm:px-7 lg:px-9 py-6 max-w-[1200px] mx-auto w-full flex flex-col gap-5">

        {/* ── Page header ── */}
        <div
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 pb-5"
          style={{ borderBottom: '1px solid var(--border-card)' }}
        >
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[24px] lg:text-[28px] font-extrabold tracking-tight" style={{ color: '#1A1714' }}>
              Visão geral
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: '#9A9290' }}>
              Resultado do mês e jornada do dinheiro · {formatMonthFull(selectedMonth)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 bg-white"
              style={{ border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}
            >
              <button
                onClick={() => onMonthChange(prevMonth(selectedMonth))}
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-50 transition-colors"
                style={{ color: '#9A9290' }}
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-[13px] font-bold min-w-[96px] sm:min-w-[110px] text-center select-none" style={{ color: '#1A1714' }}>
                {formatMonthFull(selectedMonth)}
              </span>
              <button
                onClick={() => canGoNext && onMonthChange(nextMonth(selectedMonth))}
                disabled={!canGoNext}
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-colors"
                style={{ color: '#9A9290' }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
            <button
              onClick={() => onNavigate('/lancamentos')}
              className="flex items-center gap-1.5 text-[13px] font-bold text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={14} /> Lançar
            </button>
          </div>
        </div>

        {/* ── Status + KPIs ── */}
        <div className="card flex flex-col xl:flex-row overflow-hidden" style={{ borderTop: '3px solid var(--accent)' }}>
          <div className="flex-1 p-5 lg:p-[22px] min-w-0">
            <div
              className="inline-flex items-center gap-2 mb-3 rounded-md px-3 py-1.5"
              style={{ background: isCurrent ? '#EDF5F0' : '#F5F2ED', border: '1px solid var(--border-card)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: isCurrent ? 'var(--accent)' : '#9A9290' }} />
              <span className="text-[12px] font-bold" style={{ color: isCurrent ? 'var(--accent)' : '#4A4540' }}>
                {isCurrent ? 'Em andamento' : 'Mês fechado'}
              </span>
            </div>
            <p className="text-[14px] lg:text-[14.5px] leading-relaxed" style={{ color: '#4A4540' }}>
              {isCurrent
                ? <>Mês em andamento — dia {day} de {totalDays}. Os fixos já saíram; a leitura completa fecha no fim do mês.</>
                : <>Leitura completa do mês. Entradas, saídas e sobra consolidados.</>}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 xl:flex divide-y sm:divide-y-0 sm:divide-x xl:divide-y-0 divide-[#E8E4DE] border-t xl:border-t-0 xl:border-l border-[#E8E4DE]">
            <Kpi label="Entrou" value={summary.operationalIncome} color="var(--color-pos)" />
            <Kpi label="Saiu" value={summary.totalExpenses} color="#1A1714" />
            <Kpi
              label={isCurrent ? 'Saldo parcial' : 'Saldo do mês'}
              value={summary.operationalResult}
              color="var(--accent)"
              soft
            />
          </div>
        </div>

        {/* ── Funil + Planejado ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-5">
          <ClarityFunnel
            income={summary.operationalIncome}
            steps={funnelSteps}
            isPartial={isCurrent}
            partialDay={day}
            partialTotal={totalDays}
          />
          <PlanejadoCard data={budgetComparison} isPartial={isCurrent} onNavigate={onNavigate} />
        </div>

        {/* ── Bottom row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <VillainsCard data={budgetComparison} />
          <AlertsCard alerts={alerts} isPartial={isCurrent} daysLeft={daysLeft} />
          <TopCard data={topExpenses} onNavigate={onNavigate} />
        </div>

      </div>
    </main>
  )
}

function Kpi({ label, value, color, soft }: { label: string; value: number; color: string; soft?: boolean }) {
  return (
    <div
      className="px-5 lg:px-6 py-4 lg:py-5 flex flex-col justify-center min-w-0 xl:min-w-[160px]"
      style={{ background: soft ? '#EDF5F0' : undefined }}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#9A9290' }}>{label}</span>
      <span className="text-[20px] sm:text-[19px] lg:text-[24px] font-extrabold num tracking-tight truncate" style={{ color }}>{formatBRL(value)}</span>
    </div>
  )
}

function PlanejadoCard({ data, isPartial, onNavigate }: { data: BudgetComparison[]; isPartial: boolean; onNavigate: (r: string) => void }) {
  const withBudget = data.filter(d => d.planned > 0)
  const totalPlanned = withBudget.reduce((s, d) => s + d.planned, 0)
  const totalRealized = withBudget.reduce((s, d) => s + d.realized, 0)
  const pct = totalPlanned > 0 ? Math.round((totalRealized / totalPlanned) * 100) : 0

  return (
    <div className="card p-[22px] flex flex-col">
      <div className="mb-4">
        <h3 className="text-[14.5px] font-bold" style={{ color: '#1A1714' }}>Planejado × realizado</h3>
        <p className="text-[12px] mt-0.5" style={{ color: '#9A9290' }}>
          {isPartial ? 'Mês em andamento — uso parcial do plano' : 'Uso do plano no mês'}
        </p>
      </div>

      {totalPlanned === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6 text-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
            <BarChart3 size={20} color="var(--accent)" />
          </div>
          <p className="text-[13px] font-semibold" style={{ color: '#4A4540' }}>Sem orçamento definido</p>
          <button
            onClick={() => onNavigate('/orcamento')}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg"
            style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
          >
            Ir para Orçamento →
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[32px] font-extrabold tracking-tight num" style={{ color: '#1A1714' }}>{pct}%</span>
            <span className="text-[12px]" style={{ color: '#9A9290' }}>
              {formatBRL(totalRealized)} de {formatBRL(totalPlanned)} planejados
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mb-5" style={{ background: '#E8E4DE' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: 'var(--accent)' }} />
          </div>
          <div className="flex flex-col gap-3">
            {withBudget.slice(0, 5).map(d => {
              const fill = d.planned > 0 ? Math.min((d.realized / d.planned) * 100, 100) : 0
              const over = d.status === 'critical' || d.status === 'warning'
              return (
                <div key={d.macroCategoryId || d.categoryId} className="flex items-center gap-3">
                  <span className="text-[12px] font-medium w-24 flex-shrink-0 truncate" style={{ color: '#4A4540' }}>{d.name}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#E8E4DE' }}>
                    <div className="h-full rounded-full" style={{ width: `${fill}%`, background: over ? 'var(--color-over)' : 'var(--accent)' }} />
                  </div>
                  <span className="text-[11px] font-bold flex-shrink-0" style={{ color: over ? 'var(--color-over)' : 'var(--color-pos)' }}>
                    {over ? `+${Math.abs(d.deviationPct).toFixed(0)}%` : 'ok'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function VillainsCard({ data }: { data: BudgetComparison[] }) {
  const villains = data
    .filter(d => d.planned > 0 && d.deviationRs > 0 && (d.status === 'critical' || d.status === 'warning'))
    .sort((a, b) => b.deviationRs - a.deviationRs)
    .slice(0, 4)

  return (
    <div className="card p-[22px]">
      <h3 className="text-[14.5px] font-bold" style={{ color: '#1A1714' }}>Maiores vilões do mês</h3>
      <p className="text-[12px] mt-0.5 mb-4" style={{ color: '#9A9290' }}>grupos que passaram do previsto</p>
      {villains.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg px-4 py-3" style={{ background: '#EDF5F0' }}>
          <CheckCircle size={15} color="var(--color-pos)" />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--color-pos)' }}>Nenhum grupo estourou o previsto.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {villains.map(d => (
            <div key={d.macroCategoryId || d.categoryId} className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium truncate" style={{ color: '#4A4540' }}>{d.name}</span>
              <span className="text-[13px] font-bold num flex-shrink-0" style={{ color: 'var(--color-over)' }}>+{formatBRL(d.deviationRs)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AlertsCard({ alerts, isPartial, daysLeft }: { alerts: AlertItem[]; isPartial: boolean; daysLeft: number }) {
  return (
    <div className="card p-[22px]">
      <h3 className="text-[14.5px] font-bold" style={{ color: '#1A1714' }}>Alertas do mês</h3>
      <p className="text-[12px] mt-0.5 mb-4" style={{ color: '#9A9290' }}>o que o mês está dizendo</p>
      <div className="flex flex-col gap-2">
        {isPartial && (
          <Row icon={<Calendar size={14} color="var(--accent)" />} bg="var(--accent-soft)" text={`Leitura parcial: faltam ${daysLeft} dias para fechar o mês.`} color="var(--accent)" />
        )}
        {alerts.slice(0, 3).map(a => (
          <Row
            key={a.id}
            icon={<AlertTriangle size={14} color={a.level === 'critical' ? 'var(--color-over)' : 'var(--color-ocre)'} />}
            bg={a.level === 'critical' ? '#FBF0ED' : '#FDF8EC'}
            text={a.message}
            color={a.level === 'critical' ? 'var(--color-over)' : 'var(--color-ocre)'}
          />
        ))}
        {!isPartial && alerts.length === 0 && (
          <Row icon={<CheckCircle size={14} color="var(--color-pos)" />} bg="#EDF5F0" text="Nenhum ponto crítico neste mês." color="var(--color-pos)" />
        )}
      </div>
    </div>
  )
}

function Row({ icon, bg, text, color }: { icon: React.ReactNode; bg: string; text: string; color: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg px-3.5 py-2.5" style={{ background: bg }}>
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <span className="text-[12.5px] font-medium leading-snug" style={{ color }}>{text}</span>
    </div>
  )
}

function TopCard({ data, onNavigate }: { data: TopTransaction[]; onNavigate: (r: string) => void }) {
  return (
    <div className="card p-[22px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14.5px] font-bold" style={{ color: '#1A1714' }}>Maiores lançamentos</h3>
        <button onClick={() => onNavigate('/lancamentos')} className="text-[12px] font-bold" style={{ color: 'var(--accent)' }}>
          Ver todos →
        </button>
      </div>
      {data.length === 0 ? (
        <p className="text-[13px] py-4 text-center" style={{ color: '#9A9290' }}>Nenhum lançamento registrado</p>
      ) : (
        <div className="flex flex-col">
          {data.slice(0, 4).map(item => (
            <div key={item.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid #F0EDE8' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#F5F2ED' }}>
                <List size={14} color="#9A9290" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: '#1A1714' }}>{item.description}</p>
                <p className="text-[11px]" style={{ color: '#9A9290' }}>{item.macroCategoryName.split(' ')[0]}</p>
              </div>
              <span className="text-[13px] font-bold num flex-shrink-0" style={{ color: '#1A1714' }}>{formatBRL(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
