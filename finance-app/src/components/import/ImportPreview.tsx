import { useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ParsedImportItem } from '../../importers/types'
import type { ClassificationType } from '../../types'
import { classificationTypeOptions } from '../../importers/classifier'
import { formatBRL } from '../../utils/currency'

interface Props {
  items: ParsedImportItem[]
  onUpdate: (updated: ParsedImportItem[]) => void
  onConfirm: () => void
  onCancel: () => void
}

const PAGE_SIZE = 20

export function ImportPreview({ items, onUpdate, onConfirm, onCancel }: Props) {
  const [page, setPage] = useState(0)
  const classOptions = classificationTypeOptions()
  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const selectedCount = items.filter(i => i.selected && !i.isDuplicate).length
  const duplicateCount = items.filter(i => i.isDuplicate).length

  function toggleSelected(index: number) {
    const globalIndex = page * PAGE_SIZE + index
    const updated = items.map((item, i) =>
      i === globalIndex ? { ...item, selected: !item.selected } : item
    )
    onUpdate(updated)
  }

  function updateClassification(index: number, classificationType: ClassificationType) {
    const globalIndex = page * PAGE_SIZE + index
    const updated = items.map((item, i) => {
      if (i !== globalIndex) return item
      const isIncome = ['operational_income', 'extraordinary_income', 'redemption'].includes(classificationType)
      const isNeutral = ['transfer', 'neutral', 'adjustment'].includes(classificationType)
      return {
        ...item,
        classification: {
          ...item.classification,
          classificationType,
          type: isIncome ? 'income' as const : 'expense' as const,
          includeInOperationalResult: !isNeutral && classificationType !== 'investment' && classificationType !== 'redemption',
          isInternalTransfer: classificationType === 'transfer',
        },
      }
    })
    onUpdate(updated)
  }

  function toggleAll(selected: boolean) {
    onUpdate(items.map(i => i.isDuplicate ? i : { ...i, selected }))
  }

  const typeColor = (item: ParsedImportItem) => {
    if (item.isDuplicate) return '#9CA3AF'
    if (item.classification.type === 'income') return '#16A34A'
    if (['transfer', 'neutral', 'adjustment', 'investment', 'redemption'].includes(item.classification.classificationType)) return '#9CA3AF'
    return '#DC2626'
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-indigo-50 rounded-lg text-sm">
        <span className="font-semibold text-indigo-800">{items.length} lançamentos detectados</span>
        <span className="text-green-700">·  {items.filter(i => i.classification.type === 'income' && !i.isDuplicate).length} receitas</span>
        <span className="text-red-700">·  {items.filter(i => i.classification.type === 'expense' && !i.isDuplicate).length} despesas</span>
        {duplicateCount > 0 && (
          <span className="flex items-center gap-1 text-amber-700">
            <AlertTriangle size={13} /> {duplicateCount} possíveis duplicados
          </span>
        )}
        <span className="ml-auto text-gray-600">{selectedCount} selecionados para importar</span>
      </div>

      {/* Bulk actions */}
      <div className="flex gap-2 text-xs">
        <button onClick={() => toggleAll(true)} className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium">Selecionar todos</button>
        <button onClick={() => toggleAll(false)} className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium">Desmarcar todos</button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-8 px-2 py-2" />
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Data</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Descrição</th>
              <th className="text-right px-3 py-2 text-gray-500 font-medium">Valor</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-44">Classificação</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Conta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageItems.map((item, idx) => (
              <tr
                key={idx}
                className={`transition-colors ${item.isDuplicate ? 'bg-amber-50' : item.selected ? 'hover:bg-gray-50' : 'opacity-50 bg-gray-50'}`}
              >
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={item.selected && !item.isDuplicate}
                    disabled={item.isDuplicate}
                    onChange={() => toggleSelected(idx)}
                    className="rounded"
                  />
                </td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{item.transactionDate}</td>
                <td className="px-3 py-2 text-gray-800 max-w-56 truncate">
                  {item.isDuplicate && <span className="inline-block mr-1 text-amber-600 font-semibold">[DUP]</span>}
                  {item.normalizedDescription}
                </td>
                <td
                  className="px-3 py-2 text-right font-medium whitespace-nowrap"
                  style={{ color: typeColor(item) }}
                >
                  {item.classification.type === 'expense' ? '-' : '+'}{formatBRL(item.amount)}
                </td>
                <td className="px-3 py-2">
                  {item.isDuplicate ? (
                    <span className="text-amber-600 text-xs">Duplicado ignorado</span>
                  ) : (
                    <select
                      value={item.classification.classificationType}
                      onChange={e => updateClassification(idx, e.target.value as ClassificationType)}
                      className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    >
                      {classOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500 max-w-28 truncate">{item.raw.rawAccount || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span>Página {page + 1} de {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onConfirm}
          disabled={selectedCount === 0}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Importar {selectedCount} lançamentos
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
