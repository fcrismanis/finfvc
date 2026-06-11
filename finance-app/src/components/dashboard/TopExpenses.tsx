import type { TopTransaction } from '../../types'
import { formatBRL } from '../../utils/currency'

interface Props {
  data: TopTransaction[]
}

export function TopExpenses({ data }: Props) {
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-gray-800 mb-3">Maiores gastos</p>
      {data.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-1">
          <p className="text-sm text-gray-400">Nenhum gasto registrado</p>
        </div>
      ) : (
        <div>
          {data.map((item, i) => (
            <div
              key={item.id}
              className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
            >
              <span className="text-sm font-bold text-gray-200 w-5 text-center flex-shrink-0 num">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{item.description}</p>
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full inline-block mt-0.5"
                  style={{
                    background: item.macroCategoryColor + '18',
                    color: item.macroCategoryColor,
                  }}
                >
                  {item.macroCategoryName.split(' ')[0]}
                </span>
              </div>
              <span className="text-sm font-bold text-red-500 tabular-nums num flex-shrink-0">
                {formatBRL(item.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
