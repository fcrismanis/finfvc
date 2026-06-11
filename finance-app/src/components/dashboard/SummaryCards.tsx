import { AlertTriangle } from 'lucide-react'
import type { MonthSummaryData } from '../../types'
import { formatBRL } from '../../utils/currency'

interface Props {
  data: MonthSummaryData
  trendValues?: number[]
}

export function SummaryCards({ data, trendValues }: Props) {
  const {
    operationalIncome, totalExpenses, operationalResult,
    savingsRate, pendingAmount, isAtypicalMonth, hasRedemption, redemptionAmount,
  } = data

  return (
    <div className="grid grid-cols-3 gap-[18px]">

      {/* Entrou */}
      <div className="card p-[22px]">
        <div className="flex items-center gap-2 mb-[14px]">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-pos)' }} />
          <span className="text-[13px] font-semibold" style={{ color: '#667085' }}>Entrou</span>
          {isAtypicalMonth && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 whitespace-nowrap">
              <AlertTriangle size={9} /> Atípico
            </span>
          )}
        </div>
        <div
          className="text-[32px] font-extrabold tracking-[-0.03em] leading-none num"
          style={{ color: 'var(--color-pos)' }}
        >
          {formatBRL(operationalIncome)}
        </div>
        <div className="mt-3 text-[12.5px] font-semibold" style={{ color: '#98A2B3' }}>
          {hasRedemption
            ? <span className="text-amber-600">⚠ {formatBRL(redemptionAmount)} em resgates</span>
            : 'Receita operacional'}
        </div>
      </div>

      {/* Saiu */}
      <div className="card p-[22px]">
        <div className="flex items-center gap-2 mb-[14px]">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-neg)' }} />
          <span className="text-[13px] font-semibold" style={{ color: '#667085' }}>Saiu</span>
          {pendingAmount > 0 && (
            <span className="ml-auto text-[10px] font-semibold text-amber-600 whitespace-nowrap">
              +{formatBRL(pendingAmount)} pendente
            </span>
          )}
        </div>
        <div
          className="text-[32px] font-extrabold tracking-[-0.03em] leading-none num"
          style={{ color: 'var(--color-neg)' }}
        >
          {formatBRL(totalExpenses)}
        </div>
        <div className="mt-3 text-[12.5px] font-semibold" style={{ color: '#98A2B3' }}>
          Despesas realizadas
        </div>
      </div>

      {/* Sobrou — hero azul */}
      <div
        className="rounded-[12px] p-[22px]"
        style={{ background: 'var(--accent)', border: '1px solid var(--accent)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-center gap-2 mb-[14px]">
          <span className="w-2 h-2 rounded-full flex-shrink-0 bg-white opacity-90" />
          <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>Sobrou</span>
        </div>
        <div className="text-[32px] font-extrabold tracking-[-0.03em] leading-none num text-white">
          {formatBRL(operationalResult)}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[12.5px] font-semibold whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {(savingsRate * 100).toFixed(0)}% de sobra
          </span>
          {trendValues && <Spark values={trendValues} />}
        </div>
      </div>

    </div>
  )
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const mn = Math.min(...values)
  const mx = Math.max(...values)
  const range = mx - mn || 1
  const W = 78, H = 26
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - mn) / range) * H}`)
    .join(' ')
  const ly = H - ((values[values.length - 1] - mn) / range) * H
  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
      <polyline
        points={pts}
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={W} cy={ly} r="2.6" fill="white" />
    </svg>
  )
}
