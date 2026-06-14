import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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

  function typeColor(item: ParsedImportItem): string {
    if (item.isDuplicate) return 'var(--faint)'
    if (item.classification.type === 'income') return 'var(--pos)'
    if (['transfer', 'neutral', 'adjustment', 'investment', 'redemption'].includes(item.classification.classificationType)) return 'var(--faint)'
    return 'var(--ink-2)'
  }

  const incomeCount = items.filter(i => i.classification.type === 'income' && !i.isDuplicate).length
  const expenseCount = items.filter(i => i.classification.type === 'expense' && !i.isDuplicate).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Summary bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        padding: '10px 14px', background: 'var(--well)', borderRadius: 9,
        border: '1px solid var(--line)', fontSize: 12.5,
      }}>
        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{items.length} lançamentos detectados</span>
        <span style={{ color: 'var(--pos)' }}>· {incomeCount} receitas</span>
        <span style={{ color: 'var(--ink-2)' }}>· {expenseCount} despesas</span>
        {duplicateCount > 0 && (
          <span style={{ color: 'var(--warn)', fontWeight: 600 }}>· {duplicateCount} possíveis duplicados</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--faint)' }}>{selectedCount} selecionados</span>
      </div>

      {/* Bulk actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => toggleAll(true)}>Selecionar todos</button>
        <button className="btn btn-secondary btn-sm" onClick={() => toggleAll(false)}>Desmarcar todos</button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 9, border: '1px solid var(--line)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
              <th style={{ width: 36, padding: '9px 8px' }} />
              <th className="table-th">Data</th>
              <th className="table-th">Descrição</th>
              <th className="table-th table-th-right">Valor</th>
              <th className="table-th" style={{ width: 160 }}>Classificação</th>
              <th className="table-th">Conta</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom: '1px solid var(--line)',
                  background: item.isDuplicate ? 'var(--warn-soft)' : item.selected ? 'transparent' : 'var(--well)',
                  opacity: item.selected || item.isDuplicate ? 1 : 0.55,
                  transition: 'background 0.1s',
                }}
              >
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={item.selected && !item.isDuplicate}
                    disabled={item.isDuplicate}
                    onChange={() => toggleSelected(idx)}
                  />
                </td>
                <td className="table-td" style={{ color: 'var(--faint)', whiteSpace: 'nowrap', fontFamily: 'var(--mono)', fontSize: 11.5 }}>
                  {item.transactionDate}
                </td>
                <td className="table-td" style={{ maxWidth: 200 }}>
                  {item.isDuplicate && (
                    <span className="chip chip-warn" style={{ marginRight: 5 }}>DUP</span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100%' }}>
                    {item.normalizedDescription}
                  </span>
                </td>
                <td
                  className="table-td table-th-right"
                  style={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: typeColor(item), fontFamily: 'var(--mono)', fontSize: 12 }}
                >
                  {item.classification.type === 'expense' ? '−' : '+'}{formatBRL(item.amount)}
                </td>
                <td className="table-td">
                  {item.isDuplicate ? (
                    <span style={{ fontSize: 11, color: 'var(--warn)', fontStyle: 'italic' }}>Duplicado ignorado</span>
                  ) : (
                    <select
                      value={item.classification.classificationType}
                      onChange={e => updateClassification(idx, e.target.value as ClassificationType)}
                      className="ledger-select"
                      style={{ width: '100%', fontSize: 11 }}
                    >
                      {classOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="table-td" style={{ color: 'var(--faint)', fontSize: 11, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.raw.rawAccount || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
          <button className="btn-ghost" style={{ width: 28, height: 28 }} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft size={13} />
          </button>
          <span>Página {page + 1} de {totalPages}</span>
          <button className="btn-ghost" style={{ width: 28, height: 28 }} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <button
          onClick={onConfirm}
          disabled={selectedCount === 0}
          className="btn btn-primary"
        >
          Importar {selectedCount} lançamentos
        </button>
        <button onClick={onCancel} className="btn btn-secondary">Cancelar</button>
      </div>
    </div>
  )
}
