import { AlertTriangle } from 'lucide-react'
import type { MonthSummaryData } from '../../types'
import { formatBRL, formatPct } from '../../utils/currency'

interface Props {
  data: MonthSummaryData
}

export function SummaryCards({ data }: Props) {
  const { operationalIncome, totalExpenses, operationalResult, savingsRate, pendingAmount, isAtypicalMonth, hasRedemption, redemptionAmount } = data
  const resultPositive = operationalResult >= 0

  return (
    <div className="grid grid-cols-4 gap-3">
      <SummaryCard
        label="Receita operacional"
        value={formatBRL(operationalIncome)}
        valueColor="#16A34A"
        accentColor="#16A34A"
        sub={isAtypicalMonth ? (
          <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-800 rounded-full px-2 py-0.5 mt-1">
            <AlertTriangle size={10} /> Mês atípico
          </span>
        ) : null}
      />

      <SummaryCard
        label="Despesas"
        value={formatBRL(totalExpenses)}
        valueColor="#DC2626"
        accentColor="#DC2626"
        sub={pendingAmount > 0 ? (
          <span className="text-xs text-amber-600 mt-1 block">+ {formatBRL(pendingAmount)} pendente</span>
        ) : null}
      />

      <SummaryCard
        label="Resultado operacional"
        value={formatBRL(operationalResult)}
        valueColor={resultPositive ? '#059669' : '#B91C1C'}
        accentColor={resultPositive ? '#059669' : '#B91C1C'}
        big
        sub={
          <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 mt-1 ${resultPositive ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: resultPositive ? '#16A34A' : '#DC2626' }} />
            {resultPositive ? 'Positivo' : 'Negativo'}
          </span>
        }
        warning={hasRedemption ? `⚠ Inclui ${formatBRL(redemptionAmount)} em resgates` : undefined}
      />

      <SavingsCard rate={savingsRate} />
    </div>
  )
}

function SummaryCard({ label, value, valueColor, accentColor, sub, big, warning }: {
  label: string; value: string; valueColor: string; accentColor: string;
  sub?: React.ReactNode; big?: boolean; warning?: string
}) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-4 overflow-hidden"
      style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}
    >
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <p className={`font-semibold leading-none ${big ? 'text-2xl' : 'text-xl'}`} style={{ color: valueColor }}>
        {value}
      </p>
      {sub}
      {warning && (
        <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-2">{warning}</p>
      )}
    </div>
  )
}

function SavingsCard({ rate }: { rate: number }) {
  const pct = rate * 100
  const positive = pct >= 0
  const barWidth = Math.min(Math.abs(pct), 100)
  const barColor = pct < 0 ? '#DC2626' : pct < 10 ? '#D97706' : pct < 20 ? '#65A30D' : '#16A34A'

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-4"
      style={{ borderLeftColor: '#D97706', borderLeftWidth: 3 }}
    >
      <p className="text-xs text-gray-500 mb-1.5">Taxa de sobra</p>
      <p className="text-xl font-semibold leading-none" style={{ color: positive ? '#059669' : '#B91C1C' }}>
        {formatPct(pct)}
      </p>
      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${barWidth}%`, background: barColor }}
        />
      </div>
      <p className="text-[10px] text-gray-400 mt-1">Meta: 20%</p>
    </div>
  )
}
