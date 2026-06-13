import { ChevronLeft, ChevronRight, Plus, AlertTriangle, CheckCircle, Calendar, List } from 'lucide-react'
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
      <div className="px-4 sm:px-5 lg:px-7 py-5 max-w-[1320px] mx-auto w-full flex flex-col gap-4 lg:gap-5">

        {/* ── Page header ── */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] sm:text-[26px] lg:text-[30px] font-extrabold tracking-tight" style={{ color: '#101828' }}>Visão geral</h1>
            <p className="text-[13px] mt-0.5" style={{ color: '#98A2B3' }}>
              Resultado do mês e jornada do dinheiro · {formatMonthFull(selectedMonth)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div
              className="flex items-center gap-1 rounded-xl px-2 py-1.5 bg-white"
              style={{ border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}
            >
              <button onClick={() => onMonthChange(prevMonth(selectedMonth))} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                <ChevronLeft size={15} />
              </button>
              <span className="text-[13.5px] font-bold text-gray-800 min-w-[96px] sm:min-w-[110px] text-center select-none">
                {formatMonthFull(selectedMonth)}
              </span>
              <button onClick={() => canGoNext && onMonthChange(nextMonth(selectedMonth))} disabled={!canGoNext} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>
            <button
              onClick={() => onNavigate('/lancamentos')}
              className="flex items-center gap-1.5 text-[13px] font-bold text-white px-4 py-2.5 rounded-xl transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ background: 'var(--accent)', boxShadow: 'var(--shadow-card)' }}
            >
              <Plus size={15} /> Lançar
            </button>
          </div>
        </div>

        {/* ── Status + KPIs ── */}
        <div className="card flex flex-col xl:flex-row overflow-hidden">
          <div className="flex-1 p-5 lg:p-[22px] min-w-0">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
              <span className="text-[13px] font-bold" style={{ color: 'var(--accent)' }}>
                {isCurrent ? 'Em andamento' : 'Mês fechado'}
              </span>
            </div>
            <p className="text-[14px] lg:text-[15px] leading-relaxed" style={{ color: '#475569' }}>
              {isCurrent
                ? <>Mês em andamento — dia {day} de {totalDays}. Os fixos já saíram; a leitura completa fecha no fim do mês.</>
                : <>Leitura completa do mês. Entradas, saídas e sobra consolidados.</>}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 xl:flex divide-y sm:divide-y-0 sm:divide-x xl:divide-y-0 divide-[#ECEEF2] border-t xl:border-t-0 xl:border-l border-[#ECEEF2]">
            <Kpi label="Entrou" value={summary.operationalIncome} color="#0E9E6E" />
            <Kpi label="Saiu" value={summary.totalExpenses} color="#101828" />
            <Kpi
              label={isCurrent ? 'Saldo parcial' : 'Saldo do mês'}
              value={summary.operationalResult}
              color="var(--accent)"
              soft
            />
          </div>
        </div>

        {/* ── Funil + Planejado ── (lado a lado só ≥1280) */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4 lg:gap-5">
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
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
      className="px-5 lg:px-6 py-4 lg:py-[22px] flex flex-col justify-center min-w-0 xl:min-w-[150px]"
      style={{ background: soft ? 'var(--accent-soft)' : undefined }}
    >
      <span className="text-[10.5px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#98A2B3' }}>{label}</span>
      <span className="text-[19px] sm:text-[18px] lg:text-[22px] font-extrabold num tracking-tight truncate" style={{ color }}>{formatBRL(value)}</span>
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
        <h3 className="text-[15px] font-bold" style={{ color: '#101828' }}>Planejado × realizado</h3>
        <p className="text-[12px] mt-0.5" style={{ color: '#98A2B3' }}>
          {isPartial ? 'Mês em andamento — uso parcial do plano' : 'Uso do plano no mês'}
        </p>
      </div>

      {totalPlanned === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6 text-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
            <span style={{ fontSize: 20 }}>📊</span>
          </div>
          <p className="text-[13px] font-semibold text-gray-600">Sem orçamento definido</p>
          <button onClick={() => onNavigate('/orcamento')} className="text-[12.5px] font-semibold px-3.5 py-2 rounded-lg" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}>
            Ir para Orçamento →
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[34px] font-extrabold tracking-tight num" style={{ color: '#101828' }}>{pct}%</span>
            <span className="text-[12.5px]" style={{ color: '#98A2B3' }}>
              {formatBRL(totalRealized)} de {formatBRL(totalPlanned)} planejados
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-5" style={{ background: '#EEF2FF' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: 'var(--accent)' }} />
          </div>
          <div className="flex flex-col gap-3">
            {withBudget.slice(0, 5).map(d => {
              const fill = d.planned > 0 ? Math.min((d.realized / d.planned) * 100, 100) : 0
              const over = d.status === 'critical' || d.status === 'warning'
              return (
                <div key={d.macroCategoryId || d.categoryId} className="flex items-center gap-3">
                  <span className="text-[12.5px] font-medium w-24 flex-shrink-0 truncate" style={{ color: '#475569' }}>{d.name}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#EEF2FF' }}>
                    <div className="h-full rounded-full" style={{ width: `${fill}%`, background: over ? '#DC4E41' : 'var(--accent)' }} />
                  </div>
                  <span className="text-[11px] font-bold flex-shrink-0" style={{ color: over ? '#DC4E41' : '#0E9E6E' }}>
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
      <h3 className="text-[15px] font-bold" style={{ color: '#101828' }}>Maiores vilões do mês</h3>
      <p className="text-[12px] mt-0.5 mb-4" style={{ color: '#98A2B3' }}>grupos que passaram do previsto</p>
      {villains.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: '#F0FDF4' }}>
          <CheckCircle size={16} color="#16A34A" />
          <span className="text-[13px] font-semibold" style={{ color: '#15803D' }}>Nenhum grupo estourou o previsto.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {villains.map(d => (
            <div key={d.macroCategoryId || d.categoryId} className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium truncate" style={{ color: '#475569' }}>{d.name}</span>
              <span className="text-[13px] font-bold num flex-shrink-0" style={{ color: '#DC4E41' }}>+{formatBRL(d.deviationRs)}</span>
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
      <h3 className="text-[15px] font-bold" style={{ color: '#101828' }}>Alertas do mês</h3>
      <p className="text-[12px] mt-0.5 mb-4" style={{ color: '#98A2B3' }}>o que o mês está dizendo</p>
      <div className="flex flex-col gap-2">
        {isPartial && (
          <Row icon={<Calendar size={14} color="var(--accent)" />} bg="var(--accent-soft)" text={`Leitura parcial: faltam ${daysLeft} dias para fechar o mês.`} color="#3730A3" />
        )}
        {alerts.slice(0, 3).map(a => (
          <Row
            key={a.id}
            icon={<AlertTriangle size={14} color={a.level === 'critical' ? '#DC2626' : '#D97706'} />}
            bg={a.level === 'critical' ? '#FEF2F2' : '#FFFBEB'}
            text={a.message}
            color={a.level === 'critical' ? '#991B1B' : '#92400E'}
          />
        ))}
        {!isPartial && alerts.length === 0 && (
          <Row icon={<CheckCircle size={14} color="#16A34A" />} bg="#F0FDF4" text="Nenhum ponto crítico neste mês." color="#15803D" />
        )}
      </div>
    </div>
  )
}

function Row({ icon, bg, text, color }: { icon: React.ReactNode; bg: string; text: string; color: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl px-3.5 py-2.5" style={{ background: bg }}>
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <span className="text-[12.5px] font-medium leading-snug" style={{ color }}>{text}</span>
    </div>
  )
}

function TopCard({ data, onNavigate }: { data: TopTransaction[]; onNavigate: (r: string) => void }) {
  return (
    <div className="card p-[22px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-bold" style={{ color: '#101828' }}>Maiores lançamentos</h3>
        <button onClick={() => onNavigate('/lancamentos')} className="text-[12.5px] font-semibold" style={{ color: 'var(--accent)' }}>
          Ver todos →
        </button>
      </div>
      {data.length === 0 ? (
        <p className="text-[13px] text-gray-400 py-4 text-center">Nenhum lançamento registrado</p>
      ) : (
        <div className="flex flex-col">
          {data.slice(0, 4).map(item => (
            <div key={item.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid #F4F6FA' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#F4F6FA' }}>
                <List size={14} color="#98A2B3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: '#101828' }}>{item.description}</p>
                <p className="text-[11px]" style={{ color: '#98A2B3' }}>{item.macroCategoryName.split(' ')[0]}</p>
              </div>
              <span className="text-[13px] font-bold num flex-shrink-0" style={{ color: '#101828' }}>{formatBRL(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
