import { useMemo } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { computeDataQuality, type QuickFilterKey } from '../../utils/dataQuality'
import { formatMonthFull } from '../../utils/date'
import type { NavFilter } from '../../App'

interface Props {
  selectedMonth: string
  onNavigate: (route: string, filter?: NavFilter) => void
}

interface Metric {
  key: string
  label: string
  value: number
  color: string
  quickFilter?: QuickFilterKey
}

export function DataQualityCard({ selectedMonth, onNavigate }: Props) {
  const { transactions } = useData()
  const q = useMemo(() => computeDataQuality(transactions, selectedMonth), [transactions, selectedMonth])

  if (q.total === 0) return null

  function go(quickFilter: QuickFilterKey, label: string) {
    onNavigate('/lancamentos', {
      quickFilter,
      monthOverride: selectedMonth,
      filterLabel: `Qualidade › ${label}`,
      sourcePage: 'dashboard',
      sourceLabel: 'Visão Geral',
    })
  }

  const metrics: Metric[] = [
    { key: 'total',    label: 'Lançamentos',     value: q.total,          color: 'var(--ink)' },
    { key: 'pluggy',   label: 'Pluggy',          value: q.pluggy,         color: 'var(--ink-2)', quickFilter: 'pluggy' },
    { key: 'csv',      label: 'CSV/XLSX',        value: q.csv,            color: 'var(--ink-2)', quickFilter: 'csv' },
    { key: 'noCat',    label: 'Sem categoria',   value: q.noCategory,     color: q.noCategory > 0 ? 'var(--warn)' : 'var(--pos)', quickFilter: 'no_category' },
    { key: 'auto',     label: 'Cat. automática', value: q.autoCategory,   color: 'var(--pos)', quickFilter: 'auto' },
    { key: 'manual',   label: 'Cat. manual',     value: q.manualCategory, color: 'var(--accent)', quickFilter: 'manual' },
    { key: 'neutral',  label: 'Neutros',         value: q.neutral,        color: 'var(--faint)', quickFilter: 'neutral' },
    { key: 'pending',  label: 'Pendentes',       value: q.pending,        color: q.pending > 0 ? 'var(--warn)' : 'var(--faint)', quickFilter: 'pending' },
    { key: 'dupes',    label: 'Poss. duplicados', value: q.duplicates,    color: q.duplicates > 0 ? 'var(--crit)' : 'var(--pos)', quickFilter: 'duplicates' },
    { key: 'tags',     label: 'Com tags',        value: q.withTags,       color: 'var(--ink-2)', quickFilter: 'with_tags' },
    { key: 'edited',   label: 'Descr. editada',  value: q.editedDesc,     color: 'var(--ink-2)', quickFilter: 'edited' },
  ]

  const percentages: Array<{ label: string; pct: number; color: string }> = [
    { label: '% categorizado',  pct: q.pctCategorized, color: 'var(--pos)' },
    { label: '% a revisar',     pct: q.pctToReview,    color: q.pctToReview > 25 ? 'var(--warn)' : 'var(--ink-2)' },
    { label: '% neutro',        pct: q.pctNeutral,     color: 'var(--faint)' },
    { label: '% ajuste manual', pct: q.pctManual,      color: 'var(--accent)' },
  ]

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} color="var(--ink-2)" />
          Qualidade dos dados
        </h3>
        <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{formatMonthFull(selectedMonth)}</span>
      </div>

      {/* Percentages */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
        {percentages.map(p => (
          <div key={p.label}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 600 }}>{p.label}</span>
              <span className="num" style={{ fontSize: 14, fontWeight: 800, color: p.color }}>{p.pct}%</span>
            </div>
            <div className="bbar" style={{ height: 4 }}>
              <i style={{ width: `${p.pct}%`, background: p.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Metric chips (clickable) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))', gap: 8 }}>
        {metrics.map(m => {
          const clickable = !!m.quickFilter && m.value > 0
          return (
            <button
              key={m.key}
              disabled={!clickable}
              onClick={() => clickable && m.quickFilter && go(m.quickFilter, m.label)}
              style={{
                textAlign: 'left', padding: '9px 11px', borderRadius: 8,
                background: 'var(--well)', border: '1px solid var(--line)',
                cursor: clickable ? 'pointer' : 'default', opacity: m.value === 0 ? 0.55 : 1,
                fontFamily: 'var(--ui)', transition: 'border-color .15s',
              }}
              onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line)' }}
            >
              <p className="num" style={{ fontSize: 18, fontWeight: 800, color: m.color, fontVariantNumeric: 'tabular-nums' }}>{m.value}</p>
              <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>{m.label}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
