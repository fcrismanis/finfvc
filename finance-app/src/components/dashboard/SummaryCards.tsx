import { AlertTriangle, ArrowUpRight, ArrowDownRight, Activity, Percent } from 'lucide-react'
import type { MonthSummaryData } from '../../types'
import { formatBRL, formatPct } from '../../utils/currency'

interface Props {
  data: MonthSummaryData
}

export function SummaryCards({ data }: Props) {
  const {
    operationalIncome, totalExpenses, operationalResult,
    savingsRate, pendingAmount, isAtypicalMonth, hasRedemption, redemptionAmount,
  } = data
  const resultPositive = operationalResult >= 0

  return (
    <div className="grid grid-cols-4 gap-4">
      <SummaryCard
        label="Receita operacional"
        value={formatBRL(operationalIncome)}
        valueColor="#059669"
        iconEl={<ArrowUpRight size={14} color="#059669" />}
        iconBg="#ECFDF5"
        sub={isAtypicalMonth ? (
          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 mt-1.5">
            <AlertTriangle size={9} /> Mês atípico
          </span>
        ) : undefined}
      />

      <SummaryCard
        label="Despesas realizadas"
        value={formatBRL(totalExpenses)}
        valueColor="#DC2626"
        iconEl={<ArrowDownRight size={14} color="#DC2626" />}
        iconBg="#FEF2F2"
        sub={pendingAmount > 0 ? (
          <span className="block text-[10px] text-amber-600 mt-1.5">
            + {formatBRL(pendingAmount)} pendente
          </span>
        ) : undefined}
      />

      <SummaryCard
        label="Resultado operacional"
        value={formatBRL(operationalResult)}
        valueColor={resultPositive ? '#059669' : '#B91C1C'}
        iconEl={<Activity size={14} color={resultPositive ? '#059669' : '#B91C1C'} />}
        iconBg={resultPositive ? '#ECFDF5' : '#FEF2F2'}
        highlight
        sub={
          <span className={`inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 mt-1.5 ${resultPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <span className="w-1 h-1 rounded-full inline-block" style={{ background: resultPositive ? '#16A34A' : '#DC2626' }} />
            {resultPositive ? 'Positivo' : 'Negativo'}
          </span>
        }
        warning={hasRedemption ? `⚠ ${formatBRL(redemptionAmount)} em resgates` : undefined}
      />

      <SavingsCard rate={savingsRate} />
    </div>
  )
}

function SummaryCard({ label, value, valueColor, iconEl, iconBg, sub, highlight, warning }: {
  label: string
  value: string
  valueColor: string
  iconEl: React.ReactNode
  iconBg: string
  sub?: React.ReactNode
  highlight?: boolean
  warning?: string
}) {
  return (
    <div
      className="card p-5"
      style={highlight ? { borderColor: 'transparent', boxShadow: '0 0 0 1.5px rgba(79,70,229,0.15), var(--shadow-card)' } : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide leading-tight max-w-[120px]">
          {label}
        </p>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}
        >
          {iconEl}
        </div>
      </div>
      <p
        className="text-[23px] font-bold tracking-tight tabular-nums leading-none num"
        style={{ color: valueColor }}
      >
        {value}
      </p>
      {sub}
      {warning && (
        <p className="text-[10px] text-amber-700 bg-amber-50 rounded-md px-2 py-1 mt-2 leading-snug">
          {warning}
        </p>
      )}
    </div>
  )
}

function SavingsCard({ rate }: { rate: number }) {
  const pct = rate * 100
  const barWidth = Math.min(Math.abs(pct), 100)
  const barColor = pct < 0 ? '#DC2626' : pct < 10 ? '#D97706' : pct < 20 ? '#65A30D' : '#059669'
  const textColor = pct < 0 ? '#B91C1C' : pct < 10 ? '#B45309' : '#059669'

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Taxa de sobra</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-50 flex-shrink-0">
          <Percent size={13} color="#4F46E5" />
        </div>
      </div>
      <p className="text-[23px] font-bold tracking-tight tabular-nums leading-none num" style={{ color: textColor }}>
        {formatPct(pct)}
      </p>
      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${barWidth}%`, background: barColor }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <p className="text-[10px] text-gray-300">0%</p>
        <p className="text-[10px] text-gray-400">Meta: 20%</p>
      </div>
    </div>
  )
}
