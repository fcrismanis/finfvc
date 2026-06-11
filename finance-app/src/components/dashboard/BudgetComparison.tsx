import type { BudgetComparison as BudgetComparisonType } from '../../types'
import { formatBRL } from '../../utils/currency'

interface Props {
  data: BudgetComparisonType[]
  onNavigate?: (route: string) => void
}

const STATUS_RANK = { critical: 0, warning: 1, no_budget: 2, ok: 3 } as const

const STATUS_COLORS = {
  critical: { bar: '#DC4E41', text: '#DC4E41', bg: '#FEF2F2', label: 'Crítico' },
  warning:  { bar: '#D97706', text: '#B45309', bg: '#FFFBEB', label: 'Atenção' },
  ok:       { bar: '#0E9E6E', text: '#059669', bg: '#F0FDF4', label: 'Ok' },
  no_budget:{ bar: '#CBD5E1', text: '#94A3B8', bg: '#F8FAFC', label: 'Sem meta' },
}

export function BudgetComparison({ data, onNavigate }: Props) {
  const hasData = data.length > 0
  const hasBudget = data.some(d => d.status !== 'no_budget')

  const sorted = [...data]
    .sort((a, b) => {
      const rd = STATUS_RANK[a.status] - STATUS_RANK[b.status]
      if (rd !== 0) return rd
      return Math.abs(b.deviationRs) - Math.abs(a.deviationRs)
    })
    .slice(0, 6)

  return (
    <div className="card p-[22px] flex flex-col h-full">
      {/* Header */}
      <div className="mb-[18px]">
        <h3 className="text-[15px] font-bold leading-tight" style={{ color: '#101828' }}>
          Planejado × realizado
        </h3>
        <p className="text-[12px] mt-1" style={{ color: '#98A2B3' }}>
          Categorias com maior desvio no mês
        </p>
      </div>

      {!hasData || !hasBudget ? (
        <EmptyState onNavigate={onNavigate} />
      ) : (
        <div className="flex flex-col gap-[14px]">
          {sorted.map(item => (
            <BudgetRow key={item.macroCategoryId || item.categoryId} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function BudgetRow({ item }: { item: BudgetComparisonType }) {
  const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.no_budget
  const over = item.deviationRs > 0 && item.planned > 0
  const under = item.deviationRs < 0
  const fillPct = item.planned > 0 ? Math.min((item.realized / item.planned) * 100, 100) : 0
  const absPct = Math.abs(item.deviationPct)

  return (
    <div>
      {/* Row: name + deviation badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: '#101828', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </span>
        {item.planned > 0 && (
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
            color: sc.text, background: sc.bg, fontVariantNumeric: 'tabular-nums',
          }}>
            {over ? '+' : under ? '−' : ''}{absPct > 0 ? `${absPct.toFixed(0)}%` : 'ok'}
          </span>
        )}
      </div>

      {/* Bar */}
      <div style={{ height: 6, borderRadius: 3, background: '#EEF2FF', overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ width: `${fillPct}%`, height: '100%', borderRadius: 3, background: sc.bar, transition: 'width 0.4s ease' }} />
      </div>

      {/* Values: realized / planned */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ fontWeight: 700, color: sc.text }}>{formatBRL(item.realized)}</span>
        {item.planned > 0 && (
          <span style={{ color: '#98A2B3', fontWeight: 500 }}>
            {over
              ? <span style={{ color: sc.text, fontWeight: 600 }}>+{formatBRL(item.deviationRs)} acima</span>
              : `meta ${formatBRL(item.planned)}`}
          </span>
        )}
      </div>
    </div>
  )
}

function EmptyState({ onNavigate }: { onNavigate?: (r: string) => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '24px 0', textAlign: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 20 }}>📊</span>
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
          Sem orçamento definido
        </p>
        <p style={{ fontSize: 12, color: '#98A2B3' }}>
          Defina metas para acompanhar o progresso
        </p>
      </div>
      {onNavigate && (
        <button
          onClick={() => onNavigate('/orcamento')}
          style={{
            fontSize: 12.5, fontWeight: 600, color: 'var(--accent)',
            background: 'var(--accent-soft)', border: 'none', borderRadius: 8,
            padding: '7px 14px', cursor: 'pointer',
          }}
        >
          Ir para Orçamento →
        </button>
      )}
    </div>
  )
}
