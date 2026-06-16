import { useMemo } from 'react'
import { AlertTriangle, TrendingDown, RefreshCw, Zap } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { generateFinancialReviewItems, countBySeverity } from '../../utils/financialReview'
import { generateFinancialAlerts } from '../../utils/financialAlerts'
import { computeMonthProjection } from '../../utils/monthProjection'
import { detectRecurringPatterns } from '../../utils/recurrence'
import { formatBRL } from '../../utils/currency'
import type { NavFilter } from '../../App'

interface Props {
  month: string
  onNavigate?: (route: string, filter?: NavFilter) => void
}

export function IntelligenceCard({ month, onNavigate }: Props) {
  const { transactions, budgets } = useData()

  const reviewItems = useMemo(
    () => generateFinancialReviewItems(transactions, month),
    [transactions, month],
  )

  const alerts = useMemo(
    () => generateFinancialAlerts(transactions, month, budgets),
    [transactions, month, budgets],
  )

  const projection = useMemo(
    () => computeMonthProjection(transactions, budgets, month),
    [transactions, budgets, month],
  )

  const recurringPatterns = useMemo(
    () => detectRecurringPatterns(transactions, month),
    [transactions, month],
  )

  const counts = countBySeverity(reviewItems)
  const highAlerts = alerts.filter(a => a.severity === 'high')

  const riskColor =
    projection.riskLevel === 'high'
      ? 'var(--crit)'
      : projection.riskLevel === 'medium'
        ? 'var(--warn)'
        : 'var(--pos)'

  if (reviewItems.length === 0 && highAlerts.length === 0 && projection.riskLevel === 'low') {
    return null
  }

  return (
    <div
      className="card"
      style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={14} color="var(--accent)" />
          Inteligência financeira
        </h3>
        <button
          onClick={() => onNavigate?.('/revisao')}
          style={{
            fontSize: 11, fontWeight: 600, color: 'var(--accent)',
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)',
          }}
        >
          Ver revisão →
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {/* Review items */}
        {reviewItems.length > 0 && (
          <button
            onClick={() => onNavigate?.('/revisao')}
            style={{
              flex: 1, minWidth: 120,
              background: counts.high > 0 ? 'rgba(220,38,38,.07)' : 'var(--well)',
              border: `1px solid ${counts.high > 0 ? 'var(--crit)' : 'var(--line)'}`,
              borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
              textAlign: 'left', fontFamily: 'var(--ui)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <AlertTriangle size={13} color={counts.high > 0 ? 'var(--crit)' : 'var(--warn)'} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Revisão</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: counts.high > 0 ? 'var(--crit)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {reviewItems.length}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>
              {counts.high > 0 && <span style={{ color: 'var(--crit)', fontWeight: 600 }}>{counts.high} alta · </span>}
              {counts.medium > 0 && <span style={{ color: 'var(--warn)' }}>{counts.medium} média · </span>}
              {counts.low > 0 && <span>{counts.low} baixa</span>}
            </div>
          </button>
        )}

        {/* Projection */}
        <button
          onClick={() => onNavigate?.('/fechamento')}
          style={{
            flex: 1, minWidth: 120,
            background: projection.riskLevel === 'high' ? 'rgba(220,38,38,.07)' : 'var(--well)',
            border: `1px solid ${riskColor}`,
            borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
            textAlign: 'left', fontFamily: 'var(--ui)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <TrendingDown size={13} color={riskColor} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Projeção</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: projection.projectedBalance >= 0 ? 'var(--pos)' : 'var(--crit)', fontVariantNumeric: 'tabular-nums' }}>
            {formatBRL(projection.projectedBalance)}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>
            saldo projetado · {projection.risks.length} risco(s)
          </div>
        </button>

        {/* Recurring patterns */}
        {recurringPatterns.length > 0 && (
          <button
            onClick={() => onNavigate?.('/orcamento')}
            style={{
              flex: 1, minWidth: 120,
              background: 'var(--well)',
              border: '1px solid var(--line)',
              borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
              textAlign: 'left', fontFamily: 'var(--ui)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <RefreshCw size={13} color="var(--ink-2)" />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Recorrentes</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {recurringPatterns.length}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>
              padrões detectados
            </div>
          </button>
        )}
      </div>

      {/* High alerts list */}
      {highAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {highAlerts.slice(0, 3).map(alert => (
            <div
              key={alert.id}
              style={{
                fontSize: 11.5, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(220,38,38,.06)',
                border: '1px solid rgba(220,38,38,.2)',
                color: 'var(--ink-2)',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}
            >
              <AlertTriangle size={12} color="var(--crit)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{alert.message}</span>
            </div>
          ))}
          {highAlerts.length > 3 && (
            <button
              onClick={() => onNavigate?.('/revisao')}
              style={{ fontSize: 11, color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)', textAlign: 'left', padding: 0 }}
            >
              + {highAlerts.length - 3} alerta(s) adicional(is)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
