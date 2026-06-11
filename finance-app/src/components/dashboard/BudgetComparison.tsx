import type { BudgetComparison as BudgetComparisonType } from '../../types'
import { formatBRL, formatPct } from '../../utils/currency'

interface Props {
  data: BudgetComparisonType[]
}

export function BudgetComparison({ data }: Props) {
  const top = data.slice(0, 6)
  const maxValue = Math.max(...data.flatMap(d => [d.planned, d.realized]), 1)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-800 mb-4">Planejado × realizado</p>
      {top.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400">Nenhum orçamento configurado</p>
          <button className="mt-2 text-xs text-blue-600 hover:underline">Configurar orçamento →</button>
        </div>
      ) : (
        <div className="space-y-4">
          {top.map(item => (
            <BudgetRow key={item.macroCategoryId} item={item} maxValue={maxValue} />
          ))}
        </div>
      )}
    </div>
  )
}

function BudgetRow({ item, maxValue }: { item: BudgetComparisonType; maxValue: number }) {
  const plannedWidth = (item.planned / maxValue) * 100
  const realizedWidth = (item.realized / maxValue) * 100
  const over = item.deviationRs > 0

  const statusColor = item.status === 'critical' ? '#DC2626'
    : item.status === 'warning' ? '#D97706'
    : '#16A34A'

  const statusBg = item.status === 'critical' ? 'bg-red-50 text-red-700'
    : item.status === 'warning' ? 'bg-amber-50 text-amber-700'
    : 'bg-green-50 text-green-700'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-gray-700">{item.name}</p>
        <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${statusBg}`}>
          {over ? '+' : ''}{formatPct(item.deviationPct)}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 w-14">Plan.</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-300 rounded-full" style={{ width: `${plannedWidth}%` }} />
          </div>
          <span className="text-[10px] text-gray-500 w-20 text-right tabular-nums">{formatBRL(item.planned)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 w-14">Real.</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${realizedWidth}%`, background: item.color }} />
          </div>
          <span className="text-[10px] font-medium w-20 text-right tabular-nums" style={{ color: statusColor }}>
            {formatBRL(item.realized)}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-right mt-0.5" style={{ color: statusColor }}>
        {over ? '+' : ''}{formatBRL(item.deviationRs)}
      </p>
    </div>
  )
}
