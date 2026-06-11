import { TrendingUp } from 'lucide-react'
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
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-800 mb-4">Para onde foi o dinheiro</p>
      {top.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhuma despesa registrada</p>
      ) : (
        <div className="space-y-3">
          {top.map(cat => (
            <CategoryRow key={cat.macroCategoryId} cat={cat} maxTotal={maxTotal} />
          ))}
          {data.length > 6 && (
            <p className="text-xs text-gray-400 text-right pt-1">
              +{data.length - 6} outras categorias
            </p>
          )}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Total: <span className="font-semibold text-gray-800">{formatBRL(totalExpenses)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryRow({ cat, maxTotal }: { cat: MacroCategoryTotal; maxTotal: number }) {
  const barWidth = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0

  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
      <p className="text-xs text-gray-700 w-28 truncate flex-shrink-0">{cat.name}</p>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${barWidth}%`, background: cat.color }}
        />
      </div>
      <p className="text-xs text-gray-700 w-20 text-right tabular-nums">{formatBRL(cat.total)}</p>
      <p className="text-[10px] text-gray-400 w-8 text-right">{cat.percentage.toFixed(0)}%</p>
      {cat.isAboveAverage && (
        <span className="flex items-center gap-0.5 text-[9px] bg-amber-50 text-amber-700 rounded px-1 py-0.5 whitespace-nowrap">
          <TrendingUp size={8} />▲ média
        </span>
      )}
    </div>
  )
}
