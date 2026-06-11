import type { AlertItem, AlertLevel } from '../../types'
import { formatBRL } from '../../utils/currency'

interface Props {
  alerts: AlertItem[]
  onNavigate?: (route: string) => void
}

const LEVEL_RANK: Record<AlertLevel, number> = { critical: 0, warning: 1, distortion: 2, info: 3 }

const LEVEL_STYLE: Record<AlertLevel, { bg: string; border: string; dot: string; badge: string; badgeBg: string; label: string }> = {
  critical:   { bg: '#FEF2F2', border: '#FECACA', dot: '#DC4E41', badge: '#DC4E41', badgeBg: '#FEE2E2', label: 'Crítico' },
  warning:    { bg: '#FFFBEB', border: '#FDE68A', dot: '#D97706', badge: '#B45309', badgeBg: '#FEF3C7', label: 'Atenção' },
  distortion: { bg: '#EEF2FF', border: '#C7D2FE', dot: '#6366F1', badge: '#4F46E5', badgeBg: '#E0E7FF', label: 'Distorção' },
  info:       { bg: '#F8FAFC', border: '#E2E8F0', dot: '#64748B', badge: '#475569', badgeBg: '#F1F5F9', label: 'Info' },
}

const LEVEL_ACTION: Record<AlertLevel, string> = {
  critical:   'Revisar lançamentos',
  warning:    'Verificar orçamento',
  distortion: 'Considerar na análise',
  info:       '',
}

export function AlertsPanel({ alerts, onNavigate }: Props) {
  const sorted = [...alerts]
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])
    .slice(0, 4)

  const criticalCount = alerts.filter(a => a.level === 'critical').length
  const warningCount = alerts.filter(a => a.level === 'warning').length

  return (
    <div className="card p-[22px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-[16px]">
        <div>
          <h3 className="text-[15px] font-bold leading-tight" style={{ color: '#101828' }}>
            Pontos de atenção
          </h3>
          <p className="text-[12px] mt-1" style={{ color: '#98A2B3' }}>
            O que merece revisão neste mês
          </p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0 mt-0.5">
          {criticalCount > 0 && (
            <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ color: '#DC4E41', background: '#FEE2E2' }}>
              {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ color: '#B45309', background: '#FEF3C7' }}>
              {warningCount} atenção
            </span>
          )}
        </div>
      </div>

      {alerts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-[8px]">
          {sorted.map(alert => (
            <AlertRow key={alert.id} alert={alert} onNavigate={onNavigate} />
          ))}
          {alerts.length > 4 && (
            <p className="text-[11px] pt-1" style={{ color: '#98A2B3' }}>
              +{alerts.length - 4} outros pontos
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function AlertRow({ alert, onNavigate }: { alert: AlertItem; onNavigate?: (r: string) => void }) {
  const s = LEVEL_STYLE[alert.level]
  const action = LEVEL_ACTION[alert.level]

  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 10, padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: s.dot,
          flexShrink: 0, marginTop: 4,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: '#101828', lineHeight: 1.4 }}>
            {alert.message}
          </p>
          {action && (
            <button
              onClick={() => onNavigate?.('/revisao')}
              style={{
                marginTop: 5, fontSize: 11, fontWeight: 600, color: s.badge,
                background: 'none', border: 'none', padding: 0, cursor: onNavigate ? 'pointer' : 'default',
                textDecoration: onNavigate ? 'underline' : 'none', textUnderlineOffset: 2,
              }}
            >
              {action} →
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {alert.amount != null && alert.amount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: s.badge, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {formatBRL(alert.amount)}
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
            color: s.badge, background: s.badgeBg,
          }}>
            {s.label}
          </span>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <span style={{
        width: 28, height: 28, borderRadius: 8, background: '#F0FDF4',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14,
      }}>✓</span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>Nenhum ponto crítico neste mês</p>
        <p style={{ fontSize: 11.5, color: '#98A2B3', marginTop: 1 }}>
          Continue revisando o orçamento no fechamento mensal.
        </p>
      </div>
    </div>
  )
}
