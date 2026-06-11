import type { TopTransaction } from '../../types'
import { formatBRL } from '../../utils/currency'

interface Props {
  data: TopTransaction[]
}

export function TopExpenses({ data }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-800 mb-3">Maiores gastos</p>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Nenhum gasto registrado</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {data.map((item, i) => (
            <div key={item.id} className="flex items-center gap-2.5 py-2">
              <span className="text-xs text-gray-400 w-4">{i + 1}</span>
              <p className="text-xs text-gray-800 font-medium flex-1 truncate">{item.description}</p>
              <span
                className="text-[9px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
                style={{
                  background: item.macroCategoryColor + '20',
                  color: item.macroCategoryColor,
                }}
              >
                {item.macroCategoryName.split(' ')[0]}
              </span>
              <span className="text-xs font-semibold text-red-600 tabular-nums w-20 text-right">
                {formatBRL(item.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
