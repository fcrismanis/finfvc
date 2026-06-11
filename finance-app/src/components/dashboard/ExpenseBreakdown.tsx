import type { MacroCategoryTotal } from '../../types'
import { formatBRL } from '../../utils/currency'

interface Props {
  data: MacroCategoryTotal[]
  totalExpenses: number
}

// monochromatic blue ramp — avoids rainbow, keeps premium feel
const RAMP = ['#1D5FE0', '#3E78E8', '#5E90EF', '#7CA6F2', '#9BBDF6', '#B6CEF8', '#CFDEFA', '#E3EBFB']

export function ExpenseBreakdown({ data, totalExpenses }: Props) {
  const top = data.slice(0, 8)

  return (
    <div className="card p-[22px]">
      <div className="mb-[18px]">
        <h3 className="text-[15px] font-bold leading-tight" style={{ color: '#101828' }}>
          Para onde o dinheiro foi
        </h3>
        <p className="text-[12px] mt-1" style={{ color: '#98A2B3' }}>
          Distribuição das despesas operacionais
        </p>
      </div>

      {top.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col md:flex-row items-center md:items-start gap-[26px]">
          <Donut categories={top} total={totalExpenses} />
          <div className="flex-1 w-full flex flex-col gap-[10px]">
            {top.slice(0, 6).map((cat, i) => (
              <CategoryRow key={cat.macroCategoryId} cat={cat} color={RAMP[i]} />
            ))}
            {data.length > 6 && (
              <p className="text-[10px] pt-0.5 text-right" style={{ color: '#98A2B3' }}>
                +{data.length - 6} outras categorias
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Donut({ categories, total }: { categories: MacroCategoryTotal[]; total: number }) {
  let acc = 0
  const stops = categories.map((c, i) => {
    const pct = total > 0 ? (c.total / total) * 100 : 0
    const from = acc
    acc += pct
    return `${RAMP[i % RAMP.length]} ${from.toFixed(2)}% ${acc.toFixed(2)}%`
  })

  return (
    <div style={{ position: 'relative', width: 168, height: 168, flexShrink: 0 }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%',
        background: `conic-gradient(${stops.join(', ')})`,
      }} />
      <div style={{
        position: 'absolute', inset: 28, borderRadius: '50%', background: 'white',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3,
      }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#98A2B3', whiteSpace: 'nowrap' }}>
          Total gasto
        </span>
        <span style={{
          fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em',
          whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: '#101828',
        }}>
          {formatBRL(total)}
        </span>
      </div>
    </div>
  )
}

function CategoryRow({ cat, color }: { cat: MacroCategoryTotal; color: string }) {
  return (
    <div>
      {/* name + value row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0, display: 'inline-block' }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: '#101828', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cat.name}
        </span>
        {cat.isAboveAverage && (
          <span style={{ fontSize: 9.5, color: '#D97706', background: '#FFFBEB', borderRadius: 3, padding: '1px 5px', flexShrink: 0, fontWeight: 600 }}>
            ↑
          </span>
        )}
        <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#101828', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {formatBRL(cat.total)}
        </span>
      </div>
      {/* bar + % */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#EEF2FF', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(cat.percentage, 100)}%`, height: '100%', borderRadius: 2, background: color }} />
        </div>
        <span style={{ fontSize: 10.5, color: '#98A2B3', fontWeight: 600, flexShrink: 0, width: 26, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {cat.percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0' }}>
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#EEF2FF' }} />
        <div style={{
          position: 'absolute', inset: 20, borderRadius: '50%', background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#98A2B3' }}>—</span>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#98A2B3', fontWeight: 500 }}>
        Sem despesas operacionais neste mês
      </p>
    </div>
  )
}
