import type { BudgetComparison as BudgetComparisonType } from '../../types'
import { formatBRL } from '../../utils/currency'

interface Props {
  data: BudgetComparisonType[]
}

export function BudgetComparison({ data }: Props) {
  const top = data.slice(0, 6)

  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-gray-800 mb-4">Planejado × realizado</p>
      {top.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-1">
          <p className="text-sm text-gray-400">Nenhum orçamento configurado</p>
          <p className="text-xs text-gray-300">Defina metas na página Orçamento</p>
        </div>
      ) : (
        <div className="space-y-4">
          {top.map(item => (
            <BudgetRow key={item.macroCategoryId} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function BudgetRow({ item }: { item: BudgetComparisonType }) {
  const fillPct = item.planned > 0 ? Math.min((item.realized / item.planned) * 100, 100) : 0
  const over = item.deviationRs > 0

  const fillColor = item.status === 'critical' ? '#DC2626'
    : item.status === 'warning' ? '#D97706'
    : item.color

  const labelColor = item.status === 'critical' ? '#DC2626'
    : item.status === 'warning' ? '#B45309'
    : '#059669'

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
          <p className="text-xs font-medium text-gray-700">{item.name}</p>
        </div>
        <div className="flex items-baseline gap-1.5 num">
          <span className="text-xs font-semibold" style={{ color: labelColor }}>
            {formatBRL(item.realized)}
          </span>
          {item.planned > 0 && (
            <span className="text-[10px] text-gray-400">/ {formatBRL(item.planned)}</span>
          )}
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#EDF0F7' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${fillPct}%`, background: fillColor }}
        />
      </div>
      {over && item.planned > 0 && (
        <p className="text-[10px] text-right mt-0.5" style={{ color: labelColor }}>
          +{formatBRL(item.deviationRs)} acima do planejado
        </p>
      )}
    </div>
  )
}
