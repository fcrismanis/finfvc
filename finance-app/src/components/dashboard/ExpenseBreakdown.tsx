import type { MacroCategoryTotal } from '../../types'
import { formatBRL } from '../../utils/currency'

interface Props {
  data: MacroCategoryTotal[]
  totalExpenses: number
}

export function ExpenseBreakdown({ data, totalExpenses }: Props) {
  const top = data.slice(0, 6)
  const maxTotal = top[0]?.total ?? 1

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-800">Para onde foi o dinheiro</p>
        {top.length > 0 && (
          <span className="text-xs font-bold text-gray-500 num">{formatBRL(totalExpenses)}</span>
        )}
      </div>
      {top.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-1">
          <p className="text-sm text-gray-400">Nenhuma despesa registrada</p>
          <p className="text-xs text-gray-300">Importe seu extrato para visualizar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {top.map(cat => (
            <CategoryRow key={cat.macroCategoryId} cat={cat} maxTotal={maxTotal} />
          ))}
          {data.length > 6 && (
            <p className="text-[10px] text-gray-400 text-right pt-1">
              +{data.length - 6} outras categorias
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function CategoryRow({ cat, maxTotal }: { cat: MacroCategoryTotal; maxTotal: number }) {
  const barWidth = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
          <p className="text-xs font-medium text-gray-700 truncate">{cat.name}</p>
          {cat.isAboveAverage && (
            <span className="text-[9px] text-amber-600 bg-amber-50 rounded px-1 py-px flex-shrink-0">↑ média</span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5 num flex-shrink-0 ml-2">
          <span className="text-xs font-semibold text-gray-800">{formatBRL(cat.total)}</span>
          <span className="text-[10px] text-gray-400">{cat.percentage.toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#EDF0F7' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${barWidth}%`, background: cat.color }}
        />
      </div>
    </div>
  )
}
