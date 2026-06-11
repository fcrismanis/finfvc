import { CheckCircle, TrendingUp, TrendingDown, ArrowLeftRight, Copy, Tag } from 'lucide-react'
import type { ImportSummaryData } from '../../importers/types'
import { formatBRL } from '../../utils/currency'

interface Props {
  summary: ImportSummaryData
  onNewImport: () => void
  onGoToDashboard: () => void
}

export function ImportSummary({ summary, onNewImport, onGoToDashboard }: Props) {
  const cards = [
    {
      label: 'Receitas',
      count: summary.incomeCount,
      amount: summary.totalIncome,
      color: '#16A34A',
      bg: '#F0FDF4',
      icon: TrendingUp,
    },
    {
      label: 'Despesas',
      count: summary.expenseCount,
      amount: summary.totalExpenses,
      color: '#DC2626',
      bg: '#FEF2F2',
      icon: TrendingDown,
    },
    {
      label: 'Neutros / Transferências',
      count: summary.neutralCount,
      amount: null,
      color: '#6B7280',
      bg: '#F9FAFB',
      icon: ArrowLeftRight,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-full" style={{ background: '#F0FDF4' }}>
          <CheckCircle size={24} color="#16A34A" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{summary.total} lançamentos importados com sucesso</p>
          <p className="text-xs text-gray-500 mt-0.5">Arquivo: {summary.sourceFile}</p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-3">
        {cards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-xl p-3 border border-gray-100" style={{ background: card.bg }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} color={card.color} />
                <p className="text-xs text-gray-600 font-medium">{card.label}</p>
              </div>
              <p className="text-lg font-bold" style={{ color: card.color }}>{card.count}</p>
              {card.amount !== null && (
                <p className="text-xs text-gray-500 mt-0.5">{formatBRL(card.amount)}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Notices */}
      {(summary.duplicateCount > 0 || summary.uncategorizedCount > 0) && (
        <div className="flex flex-col gap-2">
          {summary.duplicateCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <Copy size={14} />
              <span>{summary.duplicateCount} lançamentos ignorados por serem duplicados</span>
            </div>
          )}
          {summary.uncategorizedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
              <Tag size={14} />
              <span>{summary.uncategorizedCount} lançamentos sem categoria — revise em Lançamentos</span>
            </div>
          )}
        </div>
      )}

      {/* Result snapshot */}
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-2 font-medium">Resultado operacional bruto desta importação</p>
        <p
          className="text-2xl font-bold"
          style={{ color: summary.totalIncome - summary.totalExpenses >= 0 ? '#16A34A' : '#DC2626' }}
        >
          {formatBRL(summary.totalIncome - summary.totalExpenses)}
        </p>
        <p className="text-xs text-gray-400 mt-1">Receitas – Despesas (excluindo neutros e resgates)</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onGoToDashboard}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
        >
          Ver no Dashboard
        </button>
        <button
          onClick={onNewImport}
          className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Importar outro arquivo
        </button>
      </div>
    </div>
  )
}
